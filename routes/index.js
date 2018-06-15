var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var { Log, User } = require( '../services/database' );
var { UsersManager } = require( '../services/users' );
var { Logger } = require( '../services/logger' );
var passport = require( 'passport' );
var { allowLoggedIn, allowLoggedOut } = require( '../services/login' );
var { Package } = require( '../services/database' );
var Joi = require( 'joi' );

function loadPackages ( field, order, callback ) {
    Package.find( { approved: true, state: 'public' } ).sort( { [ field ]: order } ).limit( 10 ).exec( callback );
}

/* GET home page. */
router.get( '/', function ( req, res, next ) {
    loadPackages( 'downloadsCount', 'desc', ( err, packagesDownloads ) => {
        if ( err ) return next( err );

        loadPackages( 'viewsCount', 'desc', ( err, packagesViews ) => {
            if ( err ) return next( err );

            loadPackages( 'createdAt', 'desc', ( err, packagesRecent ) => {
                if ( err ) return next( err );

                res.render( 'index', {
                    title: 'Express',
                    packageTabs: [ {
                        title: 'Most Recent',
                        name: 'recent',
                        packages: packagesRecent,
                        selected: true
                    }, {
                        title: 'Most Viewed',
                        name: 'views',
                        packages: packagesViews
                    }, {
                        title: 'Most Downloaded',
                        name: 'downloads',
                        packages: packagesDownloads,
                    } ],
                    format: () => ''
                } );
            } );
        } );
    } );
} );

router.get( '/login', allowLoggedOut(), ( req, res, next ) => {
    res.render( 'login', {
        error: req.query.error == '1' ? 'Credenciais incorretas introduzidas.' : null
    } );
} );

router.post( '/login', allowLoggedOut(), passport.authenticate( 'local', {
    failureRedirect: '/login?error=1'
} ), ( req, res, next ) => {
    console.log( req.body );
    
    Logger.write( 'User logged in: ' + req.user.username, req.user );
    
    res.redirect( '/' );
} );

router.get( '/logout', allowLoggedIn(), ( req, res, next ) => {
    req.logout();

    res.redirect( '/' );
} );

router.get( '/register', allowLoggedOut(), ( req, res, next ) => {
    res.render( 'register' );
} );


router.post( '/register', allowLoggedOut(), ( req, res, next ) => {
  	const errors = [];
  
  	User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
    	if ( users.find( user => user.username == req.body.username ) ) {
            errors.push( 'Username already exists' );
        }

        if ( users.find( user => user.email == req.body.email ) ) {  	
            errors.push( 'Email already exists' );
        }
        
      	const schema = Joi.object().keys( {
        	username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
          	password: Joi.string().min( 6 ).max( 20 ).required(),
          	password_confirm: Joi.any().equal( Joi.ref( 'password' ) ).required(),
          	email: Joi.string().email()
        } );
      
      	var validation = Joi.validate( req.body, schema, { abortEarly: false } );
          
        if ( validation.error ) {
            errors.push( ...validation.error.details.map( err => err.message ) );
        }
        
        if ( errors.length > 0 ) {
            res.render( 'register', {
                errors,
                ...req.body
            } );
        } else {
            UsersManager.create( req.body.username, req.body.password, req.body.email, 'consumer', false, ( err ) => {
                if ( err ) {
                    return next( err );
                }
            
                res.render( 'register', { success: true } );
            } );
        }
    } );
} );

module.exports = router;
