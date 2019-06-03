var fs = require('fs');
const sharp = require("sharp");

var WearMenuUtils = function() {}

WearMenuUtils.isUserAuthenticated = function(req){
    if (req.hasOwnProperty('session')) {
        if (req.session.hasOwnProperty('passport')) {
            return true;
        }
    }
    return false;
}

WearMenuUtils.getEmailIfUserAuthenticated = function(req){
    if (req.session.passport.user.emails != undefined) {
        var emails = req.session.passport.user.emails;
        for (var i = 0; i < emails.length; i++) {
            if (emails[i].type === "account") {
                return emails[i].value;
            }
        }
    }
    return '';
}

WearMenuUtils.saveResized = function(id, filepath, sizes, save_dir, w, h){
    for(var i=0;i<sizes.length;i++) {
        var nw = sizes[i];
        var nh = nw * Math.round((parseFloat(h) / parseFloat(w)));
        if (!fs.existsSync(save_dir + "/" + sizes[i].toString())) {
            fs.mkdirSync(save_dir + "/" + sizes[i].toString(), 0755);
        }
        sharp(filepath).resize(nw, nh)
            .toFile(save_dir + "/" + sizes[i].toString()+ "/" + id + ".jpg", function (err,info) {
                console.log(err);
            });
    }
}


module.exports = WearMenuUtils;