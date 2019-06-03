var express = require('express');
var router = express.Router();
var passport = require('passport');
var ObjectID = require('mongodb').ObjectID;
var path = require('path');
var fs = require('fs');
var hbs  = require('hbs');
const sharp = require("sharp");
//const crypto = require('crypto');
//const hash = crypto.createHash('sha256');
var Config = require('./../config.js');
var lang = require('./../languages/Languages');
var languages = new lang();
var WearMenuUtils = require('./../utils');

/* GET home page. */
router.get('/', function(req, res, next) {
    var render_obj = {
        title: languages.getLanguageStringOrEmpty(req.session.lang,'HOME_TITLE'),
        lang: req.session.lang
    };

    if(WearMenuUtils.isUserAuthenticated(req)){
        render_obj['user'] = req.session.passport.user;
    }
    res.render('index', render_obj);

});

router.get('/logout', function (req, res){
    req.session = null;
    res.redirect('/');
});
router.get('/auth/google', passport.authenticate('google',{scope : ['email']}));
router.get('/auth/google/callback',
    passport.authenticate('google',{ failureRedirect: '/ggl_auth_err' }),
    function(req, res) {
        var email = WearMenuUtils.getEmailIfUserAuthenticated(req);
        if(email !== ''){
            res.db.collection("users").find({email:email}).toArray(function(err,users) {
                if(users.length > 0){
                    req.session.id = users[0]._id;
                    req.session.bookmarks = {};
                    if(users[0].hasOwnProperty('bookmarks')){
                        req.session.bookmarks = users[0].bookmarks;
                    }

                    req.session.shop_bookmarks = {};
                    if(users[0].hasOwnProperty('bookmarks')){
                        req.session.shop_bookmarks = users[0].shop_bookmarks;
                    }
                    res.redirect('/');
                }
            });

        }else{
            res.redirect('/error_login');
        }

    }
);


router.get('/posts',function(req,res,next){
    res.db.collection("posts").find({}).toArray(function(err,posts) {
        var _obj = {
            title: languages.getLanguageStringOrEmpty(req.session.lang,'POSTS_TITLE'),
            lang: req.session.lang,
            posts: posts
        };
        if(WearMenuUtils.isUserAuthenticated(req)) {
            _obj['user'] = req.session.passport.user;

            for (var i = 0; i < posts.length; i++) {
                if (posts[i].user.toString() === req.session.id.toString()) {
                    _obj['posts'][i]['editable'] = 1;
                }
                if (posts[i].hasOwnProperty('likes')) {
                    if (posts[i]['likes'].hasOwnProperty(req.session.id)) {
                        _obj['posts'][i]['liked'] = 1;
                    }
                    if (req.session.bookmarks.hasOwnProperty(posts[i]._id)) {
                        _obj['posts'][i]['bookmarked'] = 1;
                    }
                }
            }
        }
        res.render('posts_list',_obj);
    });

});

router.get('/post/:id',function(req,res,next){
    var id = req.params.id;
    res.db.collection("posts").find({_id:new ObjectID(id)}).toArray(function(err,post) {
        var _obj = {
            title: languages.getLanguageStringOrEmpty(req.session.lang,'POSTS_TITLE'),
            lang: req.session.lang,
            post: post[0]
        };
        if(WearMenuUtils.isUserAuthenticated(req)) {
            _obj['user'] = req.session.passport.user;
            if (post.length > 0) {
                if (post[0].hasOwnProperty('likes')) {
                    if (post[0]['likes'].hasOwnProperty(req.session.id)) {
                        _obj['liked'] = 1;
                    }
                }
                if (req.session.bookmarks.hasOwnProperty(id)) {
                    _obj['bookmarked'] = 1;
                }
            }
        }
        res.render('post_page',_obj);
    });

});


router.get('/history', function(req, res, next) {
    if(WearMenuUtils.isUserAuthenticated(req)) {
        res.db.collection("users").find({_id:new ObjectID(req.session.id)}).project({"history":1}).toArray(function(err,data){
                if(err){
                    res.send(err);
                }else{
                    if(data.length === 0){
                        res.end('length === 0')
                    }
                    res.send(JSON.stringify(data[0].history));
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }



});

router.get('/history/add/:gender/:type/:src/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var obj = {
            id:req.params.id,
            src:req.params.src,
            gender:req.params.gender,
            type:req.params.type
        }
        res.db.collection("users").updateOne(
            {_id:new ObjectID(req.session.id)},
            {"$push":{"history":obj}},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    res.db.collection("users").updateOne(
                        { "history.20": { "$exists": 1 } },
                        { "$pop": { "history": -1 } },
                        { "multi": true },
                        function(err,data){}
                    );
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});


router.get('/favorites', function(req, res, next) {
    if(WearMenuUtils.isUserAuthenticated(req)) {
        res.db.collection("users").find({_id:new ObjectID(req.session.id)}).project({"favorites":1}).toArray(function(err,data){
            if(err){
                res.send(err);
            }else{
                if(data.length === 0){
                    res.end('length === 0')
                }
                res.send(JSON.stringify(data[0].favorites));
            }
        });
    }else{
        req.session = null;
        res.redirect('/');
    }



});

router.get('/favorites/add/:gender/:type/:id/:src',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var src = req.params.src;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "favorites."+id.toString();
        var _obj = {};
        _obj[_key] = {
            id:id,
            src:src,
            gender:gender,
            type: type};
        res.db.collection("users").updateOne(
            {_id:new ObjectID(req.session.id)},
            {"$set":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    res.send("success");
                }
            });
        var _key2 = "likes."+req.session.id.toString();
        var _obj2 = {};
        _obj2[_key2] = 1;
        res.db.collection("shop_wears_"+gender+"_"+type).updateOne({_id:id},
            {"$set":_obj2},
            function(err,data){
                if(err){
                    //res.send(err);
                }else{
                    //res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});

router.get('/favorites/rm/:gender/:type/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "favorites."+id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("users").updateOne(
            {_id:new ObjectID(req.session.id)},
            {"$unset":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    res.send("success");
                }
            });

        var _key2 = "likes."+req.session.id.toString();
        var _obj2 = {};
        _obj2[_key2] = 1;
        res.db.collection("shop_wears_"+gender+"_"+type).updateOne({_id:id},
            {"$unset":_obj2},
            function(err,data){
                if(err){
                    //res.send(err);
                }else{
                    //res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});

router.get('/post/likeit/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var _key = "likes."+req.session.id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("posts").updateOne({_id:new ObjectID(id)},
            {"$set":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    res.send("success");
                }
        });
    }else{
        req.session = null;
        res.redirect('/');
    }

});
router.get('/post/unlikeit/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var _key = "likes."+req.session.id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("posts").updateOne({_id:new ObjectID(id)},
            {"$unset":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});


router.get('/post/bookmark/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var _key = "bookmarks."+id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("users").updateOne({_id:new ObjectID(req.session.id)},
            {"$set":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    req.session.bookmarks[id.toString()] = 1;
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});
router.get('/post/unbookmark/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var _key = "bookmarks."+id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("users").updateOne({_id:new ObjectID(req.session.id)},
            {"$unset":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    delete req.session.bookmarks[id.toString()];
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});

router.get('/post/add_comment/:id',function(req,res,next){
    var id = req.params.id;
    res.db.collection("posts").find({_id:id}).toArray(function(err,post) {
    });

});

router.get('/createCollage/:type?/:edit_id?', function(req, res, next) {
        var editId = req.params.edit_id;
        var type = req.params.type;
        if(type) {
            if (type !== 'draft' && type !== 'post') {
                res.end('type error');
                return;
            }
        }
        var collectionName = "";
        if (type === 'draft') {
            collectionName = "drafts";
        } else if (type === 'post') {
            collectionName = "posts";
        }

        if(editId){
            res.db.collection(collectionName).find({_id:new ObjectID(editId)}).toArray(function(err,draft){
                var obj = {};
                if(draft.length > 0){
                    obj = draft[0];
                    for(var key in obj.wears){
                        if(obj.wears[key].hasOwnProperty('clipContour')) {
                            obj.wears[key].clipJSONStr = new hbs.SafeString(JSON.stringify(obj.wears[key].clipContour));
                        }
                    }
                }

                var render_obj = {
                    title: languages.getLanguageStringOrEmpty(req.session.lang,'CREATE_COLLAGE_TITLE'),
                    lang: req.session.lang,
                    editId:editId,
                    editObj:obj,
                    type:type,
                    colors:languages.languages[req.session.lang].colors,
                    colorsHex:languages.languages[req.session.lang].colorsHex
                };
                if(WearMenuUtils.isUserAuthenticated(req)){
                    render_obj['user'] = req.session.passport.user;
                }
                res.render('collage_editor', render_obj);
            });
        }else {
            var render_obj = {
                title: languages.getLanguageStringOrEmpty(req.session.lang,'CREATE_COLLAGE_TITLE'),
                lang: req.session.lang,
                colors:languages.languages[req.session.lang].colors,
                colorsHex:languages.languages[req.session.lang].colorsHex
            };
            if(WearMenuUtils.isUserAuthenticated(req)){
                render_obj['user'] = req.session.passport.user;
            }
            res.render('collage_editor', render_obj);
        }
});

router.get('/getEmojis/:group', function(req, res, next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        var group = req.params.group;
        res.db.collection("emoji").find({}).toArray(function(err,docs) {
            if(docs.length > 0) {
                var emoji = docs[0][group];
                var ret = [];
                for(var i=0;i<emoji.length;i++){
                    ret.push({
                        code:emoji[i].emoji,
                        desc:emoji[i].description
                    });
                }
                res.send(JSON.stringify(ret));
            }
        });

    }else{
        req.session = null;
        res.redirect('/');
    }
});

router.post("/save/:type/:edit_id?", function(req, res) {
    if(!WearMenuUtils.isUserAuthenticated(req)){
        res.end('not_authenticated');
        return;
    }
    var type = req.params.type;
    if(type !== 'draft' && type !== 'post'){
        res.end('type error');
        return;
    }

    var data = req.body;
    var edit_id = req.params.edit_id;
    var base64Data = req.body.imgData.replace(/^data:image\/jpeg;base64,/, "");
    delete data.id;
    delete data.imgData;
    data.user = new ObjectID(req.session.id);

    var save_dir = '';
    if(type === 'draft'){
        save_dir = "drafts";
    }else if(type === 'post'){
        save_dir = "posts";
    }
    var save_collection = '';
    if (type === 'draft') {
        save_collection = "drafts";
    } else if (type === 'post') {
        save_collection = "posts";
    }

    if (!fs.existsSync("./" + Config.DATA_DIR + "/" + save_dir)) {
        fs.mkdirSync("./" + Config.DATA_DIR + "/" + save_dir, 0755);
    }

    if (edit_id) {
        data._id = new ObjectID(edit_id);
        res.db.collection(save_collection).save(data,function (err, response) {
            if(err) {
                //console.log('Error occurred while inserting');
            } else {
                (function (save_dir, insertedId, w, h) {
                    fs.writeFile("./" + Config.DATA_DIR + "/" + save_dir + "/" + insertedId.toString() + ".jpg", base64Data, 'base64', function (err) {
                        if (!err) {
                            WearMenuUtils.saveResized(insertedId,
                                "./" + Config.DATA_DIR + "/" + save_dir + "/" + insertedId + ".jpg",
                                [2048,1024,512],
                                "./" + Config.DATA_DIR + "/" + save_dir, w, h);
                            res.send('success');
                        }
                    });
                })(save_dir, data._id.toString(), data.imgWidth, data.imgHeight);
            }
        });
    } else {
        var ret = res.db.collection(save_collection).insertOne(data,function (err, response) {
            if(err) {
                //console.log('Error occurred while inserting');
            } else {
                var insertedId = response.ops[0]._id;
                (function (save_dir, insertedId, w, h) {
                    fs.writeFile("./" + Config.DATA_DIR + "/" + save_dir + "/" + insertedId + ".jpg", base64Data, 'base64', function (err) {
                        if (!err) {
                            WearMenuUtils.saveResized(insertedId,
                                "./" + Config.DATA_DIR + "/" + save_dir + "/" + insertedId + ".jpg",
                                [2048,1024,512],
                                "./" + Config.DATA_DIR + "/" + save_dir, w, h);
                            /*
                            var sizes = [2048,1024,512];
                            for(var i=0;i<sizes.length;i++) {
                                var nw = sizes[i];
                                var nh = nw * Math.round((parseFloat(h) / parseFloat(w)));
                                if (!fs.existsSync("./" + Config.DATA_DIR + "/" + save_dir + "/" + sizes[i].toString())) {
                                    fs.mkdirSync("./" + Config.DATA_DIR + "/" + save_dir + "/" + sizes[i].toString(), 0755);
                                }
                                sharp("./" + Config.DATA_DIR + "/" + save_dir + "/" + insertedId + ".jpg")
                                    .resize(nw, nh)
                                    .toFile("./" + Config.DATA_DIR + "/" + save_dir + "/" + sizes[i].toString()+ "/" + insertedId + ".jpg", function (err,info) {
                                        console.log(err);
                                    });
                            }*/

                        }
                        res.send('success');
                    });
                })(save_dir, insertedId.toString(), data.imgWidth, data.imgHeight);

            }
        });
    }
});

router.get('/tags/:gender/:type', function(req, res, next) {
    var gender = req.params.gender;
    var type = req.params.type;

    res.db.collection("menu_data").find({}).toArray(function(err,data){
       if(!err){
           res.setHeader('Content-Type', 'application/json');
           res.send(JSON.stringify(data[0][gender][type]));
       }
    });

});


router.get('/wearInfo/:gender/:type/:id', function(req, res, next) {

    var gender = req.params.gender;
    var type = req.params.type;
    var id = req.params.id;

    var collectionName = "shop_wears_"+gender+"_"+type;
    res.db.collection(collectionName).find({_id:id}).toArray(function(err,data){
        if(err === null){
            if(data.length > 0) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data[0]));
            }else{
                res.end('data.length === 0');
            }
        }
        else{
            res.end(err)
        }
    });
});

router.get('/myimageslist', function(req, res, next) {
    var dir = "./" + Config.USER_IMG_DIR + "/" + req.session.id;
    var files = fs.readdirSync(dir);
    files.sort(function(a, b) {
        return fs.statSync(dir + "/" + b).mtime.getTime() -
            fs.statSync(dir + "/" + a).mtime.getTime();
    });

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(files));

});

router.get('/wearslist/:gender/:type/:category/:color/:brand/:page/:limit', function(req, res, next) {
    var gender = req.params.gender;
    var type = req.params.type;
    var category = req.params.category;
    var color = req.params.color;
    var brand = req.params.brand;
    var page = req.params.page;
    var limit = req.params.limit;
    var findObj = {"images.main.hash":{'$exists': true}};
    var findObjCount = {"images.main.hash":{'$exists': true}};


    var collectionName = "shop_wears_"+gender+"_"+type;

    if(category !== "all"){
        findObjCount['categories'] = category.toLowerCase();
        findObj['categories'] = category.toLowerCase();
    }
    if(color !== "all"){
        findObjCount['colors'] = color.toLowerCase();
        findObj['colors'] = color.toLowerCase();
    }
    if(brand !== "all"){
        findObjCount['brand'] = brand;
        findObj['brand'] = brand;
    }
    res.db.collection(collectionName).find(findObj, {
        "_id":1,
        "images":1,
        "source":1,
        "prices":1,
        "link":1,
        "names":1
        }).skip(parseInt(page)*parseInt(limit)).limit(parseInt(limit)).toArray(function(err,items){
            if(err == null) {
                for (var i = 0; i < items.length; i++) {
                    if (items[i].hasOwnProperty('likes')) {
                        if (items[i]['likes'].hasOwnProperty(req.session.id)) {
                            items[i]['liked'] = 1;
                        }
                    }
                    if(items[i].hasOwnProperty('prices')){
                        if(items[i]['prices'].hasOwnProperty(req.session.currency)){
                            var prices_count = items[i]['prices'][req.session.currency].length;
                            items[i]['price'] = languages.getLanguageString(req.session.lang,req.session.currency) + items[i]['prices'][req.session.currency][prices_count-1]['value'];
                        }
                    }
                    items[i]['href'] = items[i]['link'];
                    if(items[i].hasOwnProperty('source')) {
                        items[i]['source_name'] = items[i]['source'].replace('https://', '').replace("www.", "").replace("http://", "");
                    }
                }
                res.db.collection(collectionName).countDocuments(findObjCount,function(err,count){
                    items.push({count:count,no_results_txt:languages.getLanguageStringOrEmpty('russian','NO_RESULTS')});
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(items));
                }.bind(items));
            }else{
                console.log(err);
            }
    }.bind(collectionName));
});


router.post('/upload', function(req, res) {
    if (!req.files)
        return res.status(400).send('No files were uploaded.');

    if(req.body.hasOwnProperty('key') && req.body.hasOwnProperty('hash') && req.body.hasOwnProperty('size')){
        if(req.body.key === 'AS2jLAAdj93jASkdj32'){
            // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
            var sampleFile = req.file;//req.files.upload_file;
            // Use the mv() method to place the file somewhere on your server
            sampleFile.mv('../wears/'+req.body.size.toString()+'/'+req.body.hash.substr(0,2).toString()+'/'+req.body.hash.toString()+'.jpg', function(err) {
                if (err)
		    console.log(err);
                    return res.status(500).send(err);

                res.send('File uploaded!');
            });
        }
    }
});


router.post('/uploadUserImages', function(req, res) {
    if (!req.files){
        return res.status(400).send('No files were uploaded.');
    }
    for(var i=0; i < req.files.uploadedImages.length; i++){
        var element = req.files.uploadedImages[i];
        element.mv("./" + Config.USER_IMG_DIR + "/" + req.session.id + "/" + element.name,function (err) {
            if(err) {
                console.log(err);
            }
        });
    };
    res.send('done');
});

router.get('/removeUserImage/:filename', function(req, res) {
    var filename = req.params.filename;
    fs.unlinkSync("./" + Config.USER_IMG_DIR + "/" + req.session.id + "/" + filename);
    res.send('done');
});

module.exports = router;
