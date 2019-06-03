var express = require('express');
var router = express.Router();
var passport = require('passport');
var ObjectID = require('mongodb').ObjectID;
var lang = require('./../languages/Languages');
var languages = new lang();

router.get('/:gender?/:type?/:category?/:brand?/:color?/:page?', function(req, res, next) {

    var gender = req.params.gender;
    if(!gender){
        gender = "female";
    }
    var type = req.params.type;
    if(!type){
        type = "clothing";
    }
    var category = req.params.category;
    if(!category){
        category = "all";
    }
    var brand = req.params.brand;
    if(!brand){
        brand = "all";
    }
    var color = req.params.color;
    if(!color){
        color = "all";
    }

    var page = req.params.page;
    if(!page){
        page = 0;
    }

    var limit = 20;
    var collectionName = "shop_wears_female_clothing";
    var findObj = {"images.main.hash":{'$exists': true}};
    findObj["prices."+req.session.currency] = {'$exists': true};

    if(gender){
        collectionName = "shop_wears_"+gender+"_clothing";
        if(type){
            collectionName = "shop_wears_"+gender+"_"+type;
        }
    }
    if(category && category != "all"){
        findObj['categories'] = new String(category).toLowerCase();
    }
    if(brand && brand != "all"){
        findObj['brand'] = brand;
    }
    if(color && color != "all"){
        findObj['colors'] = new String(color).toLowerCase();
    }

    var fieldsObj = {
        "_id":1,
        "source":1,
        "images":1,
        "name":1,
        "link":1,
        "prices":1
    };
    res.db.collection(collectionName).find(findObj,fieldsObj).skip(parseInt(page)*parseInt(limit)).limit(parseInt(limit)).toArray(function(err,items){
        if(err == null) {
            res.db.collection('menu_data').find().toArray(function(menu_err,menu_docs) {
                res.db.collection(collectionName).count(findObj,function(err,count) {
                    if (menu_err == null) {
                        var gender_values = [];
                        var type_values = [];
                        var category_values = [];
                        var brand_values = [];
                        var color_values = [];

                        for (var gender_val in menu_docs[0]) {
                            if (gender_val !== "_id") {
                                gender_values.push(gender_val);
                            }
                        }
                        for (var type_val in menu_docs[0][gender]) {
                            type_values.push(type_val);
                        }
                        for (var cat_val in menu_docs[0][gender][type]['categories']) {
                            category_values.push(cat_val);
                        }
                        for (var brand_val in menu_docs[0][gender][type]['brands']) {
                            brand_values.push(brand_val);
                        }
                        for (var color_val in menu_docs[0][gender][type]['colors']) {
                            color_values.push(color_val);
                        }
                        //Set likeit and bookmarit flags
                        for (var i = 0; i < items.length; i++) {
                            if (items[i].hasOwnProperty('likes')) {
                                if (items[i]['likes'].hasOwnProperty(req.session.id)) {
                                    items[i]['liked'] = 1;
                                }
                            }
                            if (req.session.hasOwnProperty('shop_bookmarks')) {
                                if (req.session.shop_bookmarks.hasOwnProperty(gender + "_" + type + "_" + items[i]._id)) {
                                    items[i]['bookmarked'] = 1;
                                }
                            }
                            if(items[i].hasOwnProperty('prices')){
                                if(items[i]['prices'].hasOwnProperty(req.session.currency)){
                                    var prices_count = items[i]['prices'][req.session.currency].length;
                                    items[i]['price'] = items[i]['prices'][req.session.currency][prices_count-1]['value'];
                                }
                            }
                            items[i]['href'] = items[i]['link'];
                            if(items[i].hasOwnProperty('source')) {
                                items[i]['source_name'] = items[i]['source'].replace('https://', '').replace("www.", "").replace("http://", "");
                            }
                        }

                        res.render('shop/shop_index', {
                            title: languages.getLanguageStringOrEmpty(req.session.lang, 'SHOP_TITLE'),
                            user: req.session.passport ? req.session.passport.user : null,
                            lang: req.session.lang,
                            gender: gender,
                            type: type,
                            category: category,
                            brand: brand,
                            color: color,
                            currency: req.session.currency,
                            page: page,
                            gender_values: gender_values,
                            type_values: type_values,
                            category_values: category_values,
                            brand_values: brand_values,
                            color_values: color_values,
                            items_count: count,
                            items_limit: limit,
                            items: items
                        });
                    }
                });
            });
        }else{
            console.log(err);
        }
    });



});


module.exports = router;