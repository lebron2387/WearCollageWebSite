var express = require('express');
var router = express.Router();
var passport = require('passport');
var ObjectID = require('mongodb').ObjectID;
var Config = require('./../config.js');
var fs = require('fs');
var lang = require('./../languages/Languages');
var languages = new lang();
var WearMenuUtils = require('./../utils');

/* GET users listing. */
router.get('/', function(req, res, next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        res.render('user/user', {
            title: 'Express',
            lang: req.session.lang,
            user: req.session.passport.user
        });
    }else{
        req.session = null;
        res.redirect('/');
    }
});

router.get('/myDrafts',function(req,res,next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        res.db.collection("drafts").find({user:new ObjectID(req.session.id)}).toArray(function(err,drafts) {
            res.render('user/my_drafts', {
                title: 'Express',
                user: req.session.passport.user,
                lang: req.session.lang,
                drafts:drafts
            });
        });
    }else{
        req.session = null;
        res.redirect('/');
    }

});

router.get('/myPosts',function(req,res,next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        res.db.collection("posts").find({user:new ObjectID(req.session.id)}).toArray(function(err,posts) {
            res.render('user/my_posts', {
                title: 'Express',
                user: req.session.passport.user,
                lang: req.session.lang,
                posts:posts
            });
        });
    }else{
        req.session = null;
        res.redirect('/');
    }
});

router.get('/myImages',function(req,res,next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        var dir = "./" + Config.USER_IMG_DIR + "/" + req.session.id;
        var files = fs.readdirSync(dir);
        files.sort(function(a, b) {
            return fs.statSync(dir + "/" + b).mtime.getTime() -
                fs.statSync(dir + "/" + a).mtime.getTime();
        });

        res.render('user/my_images', {
            title: 'Express',
            user: req.session.passport.user,
            lang: req.session.lang,
            userId: req.session.id,
            files: files
        });

    }else{
        req.session = null;
        res.redirect('/');
    }
});

router.get('/myBookmarks/:gender/:type/:ids',function(req,res,next) {
    var gender = req.params.gender;
    var type = req.params.type;
    var ids = req.params.ids.split(":");
    res.db.collection("shop_wears_"+gender+"_"+type).find({_id: {'$in':ids}}).toArray(function (err, items) {
        for(var i=0;i<items.length;i++){
            items[i]['type'] = type;
            if(items[i].hasOwnProperty('prices')){
                if(items[i]['prices'].hasOwnProperty(req.session.currency)){
                    var prices_count = items[i]['prices'][req.session.currency].length;
                    items[i]['price'] = languages.getLanguageString(req.session.lang,req.session.currency) + items[i]['prices'][req.session.currency][prices_count-1]['value'];
                }
                items[i]['href'] = items[i]['link'];
                if(items[i].hasOwnProperty('source')) {
                    items[i]['source_name'] = items[i]['source'].replace('https://', '').replace("www.", "").replace("http://", "");
                }
            }
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(items));
    });

});

router.get('/myBookmarks', function(req,res,next) {
    if(WearMenuUtils.isUserAuthenticated(req)){
        res.db.collection("users").findOne({_id:new ObjectID(req.session.id)},function(err,user) {
            if(user.hasOwnProperty('bookmarks')) {
                var arr = [];
                for(var key in user.bookmarks){
                    arr.push(new ObjectID(key));
                }
                var shop_obj = {};
                for(var key in user.shop_bookmarks){
                    var _tmp = key.split('_');
                    var _gender = _tmp[0];
                    var _type = _tmp[1];
                    var _id = _tmp[2] + "_" + _tmp[3];
                    if(!shop_obj.hasOwnProperty(_gender)){
                        shop_obj[_gender] = {};
                    }
                    if(!shop_obj[_gender].hasOwnProperty(_type)){
                        shop_obj[_gender][_type] = [];
                    }

                    shop_obj[_gender][_type].push(_id);
                }


                res.db.collection("posts").find({_id: {'$in':arr}}).toArray(function (err, posts) {
                    for(var i=0;i<posts.length;i++) {

                        if (posts[i].user.toString() === req.session.id.toString()) {
                            posts[i]['editable'] = 1;
                        }
                    }

                    res.render('user/my_bookmarks', {
                        title: 'Express',
                        user: req.session.passport.user,
                        lang: req.session.lang,
                        currency: req.session.currency,
                        posts: posts,
                        posts_count: posts.length,
                        items: shop_obj,
                        user:arr
                    });
                });
            }
        });
    }else{
        req.session = null;
        res.redirect('/');
    }
});

module.exports = router;
