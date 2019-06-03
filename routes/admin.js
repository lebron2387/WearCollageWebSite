var express = require('express');
var Busboy = require('busboy');
var path = require('path');
var fs = require('fs');
var lang = require('./../languages/Languages');
var languages = new lang();
var router = express.Router();

function isUserAllowed(req) {
    if(req.session.passport.user.emails != undefined) {
        var emails = req.session.passport.user.emails;
        for(var i=0;i<emails.length;i++) {
            if (emails[i].type === "account"){
                if(emails[i].value === 'lebron.mail@gmail.com'){
                    return true;
                }
            }
        }
    }
    return false;
}

/* GET users listing. */
router.get('/', function(req, res, next) {
    if(isUserAllowed(req)) {
        res.render('admin/admin_index', { layout:'admin/admin_layout', title: 'Express' });
    }
    else {
        res.redirect('/logout');
    }
});

router.get('/users', function(req, res, next) {
    if(isUserAllowed(req)) {
        res.db.collection("users").find({}).toArray(function(err,docs){
            if(err == null) {
                res.render('admin/admin_users',
                {
                    layout:'admin/admin_layout',
                    title: 'Admin users',
                    users: docs
                });
            }else{
                console.log(err);
            }
        });
    }
});
/*
router.get('/tags/generateResults/:gender/:type', function(req, res, next) {
    if (isUserAllowed(req)) {
        var gender = req.params.gender;
        var type = req.params.type;
        var collectionName = "search_" + gender + "_" + type;


        res.db.collection(collectionName).remove({},function(err,data){
            res.db.collection(collectionName).createIndex({tags:1});
            res.db.collection(collectionName).createIndex({colors:1});
            res.db.collection(collectionName).createIndex({brand:1});
            res.db.collection(collectionName).createIndex({num:1});
            res.db.collection('wears_' + gender + '_' + type).find({}).sort({insertDT:-1}).toArray(function(err,docs){
               if(err === null) {
                   for (var i = 0; i < docs.length; i++) {
                       docs[i].num = i;
                       res.db.collection(collectionName).insertOne(docs[i], function (err, res) {});
                   }
                   res.redirect("/admin/tags/");
               }
           });
        });

    }
});*/
/*
router.get('/tags/generateUniqTags/:gender/:type', function(req, res, next) {
    if (isUserAllowed(req)) {
        var gender = req.params.gender;
        var type = req.params.type;
        var colName = "wears_"+gender+"_"+type;
        var newObj = {
            _id:"tags_"+gender+"_"+type,
            tags:[],
            colors:[],
            brands:[]
        };
        res.db.collection(colName).distinct("tags",function(err,docs){
            if(err === null) {
                docs.sort();
                for(var i=0;i<docs.length;i++){
                    newObj['tags'].push({name:docs[i],
                                         english:languages.getLanguageForTags('english',type,docs[i]),
                                         russian:languages.getLanguageForTags('russian',type,docs[i])});
                }
                res.db.collection(colName).distinct("colors",function(err,docs){
                    docs.sort();
                    if(err === null) {
                        for(var i=0;i<docs.length;i++){
                            newObj['colors'].push({
                                            name:docs[i],
                                            english:languages.getLanguageStringOrEmpty('english',"color_" + docs[i]),
                                            russian:languages.getLanguageStringOrEmpty('russian',"color_" + docs[i])});
                        }
                        res.db.collection(colName).distinct("brand",function(err,docs){
                            docs.sort();
                            if(err === null) {
                                for(var i=0;i<docs.length;i++){
                                    newObj['brands'].push({name:docs[i],english:docs[i], russian:docs[i]});
                                }
                                res.db.collection('metadata').save(newObj);
                                res.redirect("/admin/tags");
                            }
                        });

                    }
                });
            }
        });

    }
});
*/

router.get('/tags', function(req, res, next) {
    if(isUserAllowed(req)) {
        res.db.listCollections().toArray(function(err, coll_docs) {
            if(err === null) {
                var colls = [];
                for(var i=0;i<coll_docs.length;i++){
                    if(coll_docs[i]['name'].indexOf("wears_") === 0) {
                        if(coll_docs[i]['name'].indexOf("female_") === 6) {
                            colls.push({
                                coll:coll_docs[i]['name'],
                                gender:"female",
                                type:coll_docs[i]['name'].substr(6+7)
                            });
                        }else if(coll_docs[i]['name'].indexOf("male_") === 6) {
                            colls.push({
                                coll:coll_docs[i]['name'],
                                gender:"male",
                                type:coll_docs[i]['name'].substr(6+5)
                            });
                        }
                    }
                }
                res.render('admin/admin_tags',
                    {
                        layout:'admin/admin_layout',
                        title: 'Admin wears',
                        collections: colls,
                    });
            }else{
                console.log(err);
            }
        });
    }
});

router.get('/wears/:type/:query?', function(req, res, next) {
    if(isUserAllowed(req)) {
        var type = req.params.type;
        var query = req.params.query;
        var colName = "wears_"+req.params.type;
        var q = {};
        if(query === "withoutTags"){
            q = {'tags.0': {$exists: false}}
        }else if(query === "withoutColors"){
            q = {'colors.0': {$exists: false}}
        };
        res.db.collection(colName).find(q).limit(20).toArray(function(err,docs){
            if(err === null) {
                res.db.listCollections().toArray(function(err, coll_docs) {
                    var colls = [];
                    for(var i=0;i<coll_docs.length;i++){
                        if(coll_docs[i]['name'].indexOf("wears_") === 0) {
                            colls.push(coll_docs[i]['name'].substr(6));
                        }
                    }

                    for(var i=0;i<docs.length;i++){
                        var hash = docs[i]._id;
                        docs[i]['imagesSrc'] = [];
                        if (docs[i].hasOwnProperty('images')) {
                            if (docs[i]['images'].hasOwnProperty('onClearBg')) {
                                if (docs[i]['images']['onClearBg'].hasOwnProperty('hash')) {
                                    if (docs[i]['images']['onClearBg']['hash'] !== "") {
                                        hash = docs[i]['images']['onClearBg']['hash'];
                                        var obj = docs[i]['images']['onClearBg'];
                                        obj['src'] = "https://wearmenu.com/wears/"+type.split('_')[0]+"/"+type.split('_')[1]+"/300/" + hash.substr(0, 2) + "/" + hash + ".jpg";
                                        docs[i].imagesSrc.push(obj);

                                    }
                                }
                            }

                            if (docs[i]['images'].hasOwnProperty('withModel')) {
                                if (docs[i]['images']['withModel'].hasOwnProperty('hash')) {
                                    if (docs[i]['images']['withModel']['hash'] !== "") {
                                        hash = docs[i]['images']['withModel']['hash'];
                                        var obj = docs[i]['images']['withModel'];
                                        obj['src'] = "https://wearmenu.com/wears/"+type.split('_')[0]+"/"+type.split('_')[1]+"/300/" + hash.substr(0, 2) + "/" + hash + ".jpg"
                                        docs[i].imagesSrc.push(obj);
                                    }
                                }
                            }
                        }


                    }

                    res.render('admin/admin_wears',
                        {
                            layout:'admin/admin_layout',
                            title: req.params.type,
                            collections: colls,
                            wears: docs,
                            type:type
                        });
                });
            }else{
                res.send(err);
            }
        });
    }
});

router.get('/wears', function(req, res, next) {
    if(isUserAllowed(req)) {
        res.db.listCollections().toArray(function(err, coll_docs) {
            if(err === null) {
                var colls = [];
                for(var i=0;i<coll_docs.length;i++){
                    if(coll_docs[i]['name'].indexOf("wears_") === 0) {
                        colls.push(coll_docs[i]['name'].substr(6));
                    }
                }
                res.render('admin/admin_wears',
                    {
                        layout:'admin/admin_layout',
                        title: 'Admin wears',
                        collections: colls,
                        wears:[]
                    });
            }else{
                console.log(err);
            }
        });
    }
});

router.post("/setTags", function(req, res) {
    if(isUserAllowed(req)) {
        var id = req.body.id;
        var tags = req.body.tags;
        var collName = "wears_"+req.body.collName;
        if(tags.length === 1){
            if(tags[0] === ""){
                tags = [];
            }
        }
        res.db.collection(collName).updateOne({_id:id}, {"$set":{tags:tags}}, function(err,data){
            if(err){
                res.send(err);
            }else{
                res.send("success");
            }
        });
    }
});

router.post("/setColors", function(req, res) {
    if(isUserAllowed(req)) {
        var id = req.body.id;
        var colors = req.body.colors;
        var collName = "wears_"+req.body.collName;
        if(colors.length === 1){
            if(colors[0] === ""){
                colors = [];
            }
        }
        res.db.collection(collName).updateOne({_id:id}, {"$set":{colors:colors}}, function(err,data){
            if(err){
                res.send(err);
            }else{
                res.send("success");
            }
        });
    }
});

function readUploadedFile(busboy,finish_cb){
    var ret = "";
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        var buf = '';
        file.on('data', function(d) {
            buf += d;
        }).on('end', function() {
            ret = buf;
        }).setEncoding('utf8');
    });
    busboy.on('finish', function() {
        finish_cb(ret);
    });
}

function saveUploadedFile(){

}

router.post("/wears/upload", function(req, res) {
    var busboy = new Busboy({ headers: req.headers });
    readUploadedFile(busboy,function(data){
        var wears_obj = JSON.parse(data);
        res.render('admin/admin_parsed_wears', {
            layout:false,
            title: 'Admin parsed wears',
            wears: wears_obj
        });
    });
    return req.pipe(busboy);
});

module.exports = router;
