var createError = require('http-errors');
var express = require('express');
const fileUpload = require('express-fileupload');
var path = require('path');
var http = require('http');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var passport = require('passport');
var fb_strategy = require('passport-facebook').Strategy;
var ggl_strategy = require('passport-google-oauth20').Strategy;
var bodyParser = require('body-parser');
var request = require('request');


var exphbs  = require('express-handlebars');
var config = require('./config.js');
var MongoClient = require( 'mongodb' ).MongoClient;
var MongoServer = require( 'mongodb' ).Server;

var lang = require('./languages/Languages');
var languages = new lang();
var indexRouter = require('./routes/index');
var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var shopRouter = require('./routes/shop');
var shopUtilsRouter = require('./routes/shop_utils');

var app = express();
var mongoDB = null;
var hbs = exphbs.create({
    defaultLayout: 'layout',
    layoutsDir: 'views',
    extname: '.hbs',
    helpers: {
        domainUrl:config.DOMAIN_URL,
        getLanguageString: function (lang_name,value) {
            return languages.getLanguageString(lang_name,value);
        },
        getLanguageMenuString: function (lang_name,value) {
            return languages.getLanguageString(lang_name,'menu_'+value);
        },
        getItemImageUrlFromHash: function(size,hash){
            return config.DOMAIN_URL+"/wears/"+size+"/"+hash.substring(0,2)+"/"+hash+".jpg";
        },
        getShopBookmarksUrlList: function(item_obj){
            var ret = [];
            for(var _g in item_obj){
                for(var _t in item_obj[_g]){
                    ret.push("/"+_g+"/"+_t+"/"+item_obj[_g][_t].join(":"));
                }
            }
            return ret;
        },
        ifCond: function (v1, operator, v2, options) {
            switch (operator) {
                case '==':
                    return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        }
    }
});
//hbs.registerPartial('userTabPanelPartial', fs.readFileSync(__dirname + '/views/user/user_tab_panel.hbs', 'utf8'));
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');


//app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    createParentPath:true,
    useTempFiles:true,
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ limit: '500mb',extended: true,parameterLimit:100000}));
app.use(bodyParser.json({ limit: '500mb',parameterLimit:100000,type:'application/json'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieSession({
    name: 'wmsess',
    secret: config.SESSION_SECRET,
    httpOnly: true,
    domain: config.COOKIE_HOST,
    //keys: [Config.SESSION_SECRET],
    // Cookie Options
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 - days
}));

app.use(function(req, res, next) {
    res.db = mongoDB;
    if(!req.session.hasOwnProperty('lang')){
        req.session.lang = 'english';
    }
    if(!req.session.hasOwnProperty('currency')){
        req.session.currency = 'USD';
    }
    next();
});
app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/admin', adminRouter);
app.use('/shop', shopRouter);
app.use('/shop_utils', shopUtilsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

passport.use(new ggl_strategy({
        clientID: config.AUTH_GGL_CLIENT_ID,
        clientSecret: config.AUTH_GGL_CLIENT_SECRET,
        callbackURL: config.AUTH_GGL_CALLBACK,
        accessType: 'offline'
    },
    function(accessToken, refreshToken, profile, cb) {
        return cb(null, profile);
    }
));

function processLogin(profile){
    var email = '';
    if(profile.emails != undefined) {
        email = profile.emails[0].value;
    }
    if(email != ''){
        mongoDB.collection('users').findOne({
            email: email
        },
        function (err, doc) {
            if (err || !doc) {
                mongoDB.collection('users').insertOne(
                    {
                        email: email,
                        socialnetwork_profile: profile
                    },
                    function (err) {
                        if (err) {
                            //TODO process error
                            console.log(err);
                        }
                    });
            }else{
                mongoDB.collection('users').updateOne({email: email},{
                    $set:{
                        socialnetwork_profile: profile}
                    },
                    { upsert: true },
                    function (err) {
                        if (err) {
                            //TODO process error
                            console.log(err);
                        }
                    });
            }
        });
    }
}

/*
passport.use(new fb_strategy({
        clientID: Config.AUTH_FB_APP_ID,
        clientSecret: Config.AUTH_FB_CLIENT_SECRET,
        callbackURL: Config.AUTH_FB_CALLBACK,
        profileFields:['id', 'displayName', 'emails', 'birthday', 'first_name', 'last_name', 'gender', 'link']
    },
    function(accessToken, refreshToken, profile, cb) {
        // In this example, the user's Facebook profile is supplied as the user
        // record.  In a production-quality application, the Facebook profile should
        // be associated with a user record in the application's database, which
        // allows for account linking and authentication with other identity
        // providers.
        return cb(null, profile);
    }
));
*/
// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Facebook profile is serialized
// and deserialized.
passport.serializeUser(function(user, cb) {
    processLogin(user);
    cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
    cb(null, obj);
});


/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    console.log('Listening on ' + bind);
}

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '54321');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);
//server.timeout = 240000;

/**
 * Listen on provided port, on all network interfaces.
 */

const mongoUrl = 'mongodb://'+config.MONGODB_USER+':'+config.MONGODB_PASS+'@'+config.MONGODB_HOST+':'+config.MONGODB_PORT+'/'+config.MONGODB_DATABASE;

// Open the connection to the server
MongoClient.connect(mongoUrl, { useNewUrlParser: true, reconnectTries: 600, reconnectInterval: 1000},function(err, mongoclient) {
    if (err) throw 'Error connecting to database - ' + err;
    if(mongoclient) {
        console.log("Connected to MongoDB");
        mongoDB = mongoclient.db(config.MONGODB_DATABASE);
        server.listen(port);
        server.on('error', onError);
        server.on('listening', onListening);
    }else{
        console.log("ERROR!!");
    }

});





