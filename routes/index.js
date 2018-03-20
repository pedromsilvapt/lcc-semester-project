var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var { Log } = require( '../services/database' );
var { Logger } = require( '../services/logger' );
var passport = require( 'passport' );


/* GET home page. */
router.get( '/', function ( req, res, next ) {
    fs.readFile( path.join( __dirname, '..', 'schema.xsd' ), 'utf8', ( err, contents ) => {
        if ( err ) {
            return next( err );
        }

        res.render( 'index', {
            title: 'Express',
            schema: contents
        } );
    } );
} );

router.get( '/login', ( req, res, next ) => {
    res.render( 'login', {
        error: req.query.error == '1' ? 'Credenciais incorretas introduzidas.' : null
    } );
} );

router.post( '/login', passport.authenticate( 'local', {
    failureRedirect: '/login?error=1'
} ), ( req, res, next ) => {
    Logger.write( 'User logged in: ' + req.user.username, req.user );
    
    res.redirect( '/' );
} );

router.get( '/logout', ( req, res, next ) => {
    req.logout();

    res.redirect( '/' );
} );

module.exports = router;
