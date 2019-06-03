var express = require('express');
var router = express.Router();
var passport = require('passport');
var ObjectID = require('mongodb').ObjectID;
var lang = require('./../languages/Languages');
var languages = new lang();
var WearMenuUtils = require('./../utils');



router.get('/likeit/:gender/:type/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "likes."+req.session.id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("shop_wears_"+gender+"_"+type).updateOne({_id:id},
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
router.get('/unlikeit/:gender/:type/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "likes."+req.session.id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("shop_wears_"+gender+"_"+type).updateOne({_id:id},
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


router.get('/bookmark/:gender/:type/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "shop_bookmarks."+gender+"_"+type+"_"+id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("users").updateOne({_id:new ObjectID(req.session.id)},
            {"$set":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    if(!req.session.hasOwnProperty('shop_bookmarks')){
                        req.session['shop_bookmarks'] = {}
                    }
                    req.session.shop_bookmarks[gender+"_"+type+"_"+id.toString()] = 1;
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});
router.get('/unbookmark/:gender/:type/:id',function(req,res,next){
    if(WearMenuUtils.isUserAuthenticated(req)) {
        var id = req.params.id;
        var gender = req.params.gender;
        var type = req.params.type;
        var _key = "shop_bookmarks."+gender+"_"+type+"_"+id.toString();
        var _obj = {};
        _obj[_key] = 1;
        res.db.collection("users").updateOne({_id:new ObjectID(req.session.id)},
            {"$unset":_obj},
            function(err,data){
                if(err){
                    res.send(err);
                }else{
                    if(!req.session.hasOwnProperty('shop_bookmarks')){
                        req.session['shop_bookmarks'] = {}
                    }
                    if(req.session.shop_bookmarks.hasOwnProperty(gender+"_"+type+"_"+id.toString())) {
                        delete req.session.shop_bookmarks[gender+"_"+type+"_"+id.toString()];
                    }
                    res.send("success");
                }
            });
    }else{
        req.session = null;
        res.redirect('/');
    }

});
/*
router.get('/get_tags',function(req,res,next){
    res.db.collection('tags').find().toArray(function(tags_err,tags_docs) {
        if(tags_err){

        }else {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(tags_docs[0]['tags']));
        }
    });
});

router.get('/search_tags',function(req,res,next){

});*/



module.exports = router;