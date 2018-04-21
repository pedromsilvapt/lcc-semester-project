var passport = require( 'passport' );
var LocalStrategy = require( 'passport-local' ).Strategy;
var { User } = require( './database' );
var sha = require( 'sha.js' );

function allowGroups ( groups ) {
	return ( req, res, next ) => {
    	if ( !req.user || groups.indexOf( req.user.group ) == -1 ) {
        	next( new Error( 'Permission denied.' ) );
        } else {
        	next();
        }
    };
}


function allowLoggedIn () {
    return ( req, res, next ) => {
        if ( !req.user ) {
            next( new Error( 'Permition denied.' ) );
        } else {
            next();
        }
    }
}
  
function allowLoggedOut () {
    return ( req, res, next ) => {
        if ( req.user ) {
            next( new Error( 'Permition denied.' ) );
        } else {
            next();
        }
    }
}  

class Login {
    static setup( passport ) {
        passport.serializeUser( ( user, done ) => {
            done( null, user.username );
        } );

        passport.deserializeUser( ( username, done ) => {
            User.findOne( {
                username: username
            }, ( err, user ) => {
                if ( err ) {
                    return done( err );
                }

                done( null, user );
            } );
        } );

        passport.use( new LocalStrategy( ( username, password, callback ) => {
            User.findOne( {
                username: username
            }, ( err, user ) => {
                if ( err ) {
                    return callback( err );
                }

                if ( !user ) {
                    return callback( null, false, {
                        message: 'Incorrect username.'
                    } );
                }

                if ( !user.approved ) {
                    return callback( null, false, {
                        message: 'Account is not approved yet.'
                    } );
                }

                var hash = sha(  'sha256' ).update( user.salt + password ).digest( 'hex' );

                if ( user.password !== hash ) {
                    return callback( null, false, {
                        message: 'Incorrect password.'
                    } );
                }

                return callback( null, user );
            } );
        } ) );
        passport.serializeUser( ( user, done ) => {
            done( null, user.username );
        } );
    }
}

module.exports = {
    Login, allowGroups, allowLoggedIn, allowLoggedOut
};
