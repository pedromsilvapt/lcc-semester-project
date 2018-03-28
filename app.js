var express = require( 'express' );
var path = require( 'path' );
var favicon = require( 'serve-favicon' );
var logger = require( 'morgan' );
var cookieParser = require( 'cookie-parser' );
var bodyParser = require( 'body-parser' );
var passport = require( 'passport' );
// var formidable = require( 'express-formidable' );

var index = require( './routes/index' );
var users = require( './routes/users' );
var logs = require( './routes/logs' );
var packages = require( './routes/packages' );
var {
    Login
} = require( './services/login' );

var app = express();

// view engine setup
app.set( 'views', path.join( __dirname, 'views' ) );
app.set( 'view engine', 'pug' );

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use( logger( 'dev' ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( {
    extended: false
} ) );
// app.use( formidable() );
app.use( cookieParser() );
app.use( require( 'express-session' )( {
    secret: 'SUPERSECRETREPOSITORIUMKEY',
    resave: false,
    saveUninitialized: false
} ) );
app.use( express.static( path.join( __dirname, 'public' ) ) );

Login.setup( passport );

app.use( passport.initialize() );
app.use( passport.session() );

app.use( ( req, res, next ) => {
    res.locals.user = req.user;
    
    next();
  } );

app.use( '/', index );
app.use( '/users', users );
app.use( '/logs', logs );
app.use( '/packages', packages );

// catch 404 and forward to error handler
app.use( function ( req, res, next ) {
    var err = new Error( 'Not Found' );
    err.status = 404;
    next( err );
} );

// error handler
app.use( function ( err, req, res, next ) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get( 'env' ) === 'development' ? err : {};

    // render the error page
    res.status( err.status || 500 );
    res.render( 'error' );
} );

module.exports = app;

// var yazl = require( "yazl" );
// var fs = require( "fs" );

// var zipfile = new yazl.ZipFile();
// zipfile.addFile( "package.xml", "package.xml" );
// // (add only files, not directories)
// zipfile.addFile( "app.js", "app.js" );
// zipfile.addFile( "routes/index.js", "routes/index.js" );
// zipfile.addFile( "routes/users.js", "routes/users.js" );
// // pipe() can be called any time after the constructor
// zipfile.outputStream.pipe( fs.createWriteStream( "package.zip" ) ).on( "close", function () {
//     console.log( "done" );
// } );
// zipfile.end();