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
    Login, allowGroups
};
