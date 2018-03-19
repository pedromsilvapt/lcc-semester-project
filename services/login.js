var passport = require( 'passport' );
var LocalStrategy = require( 'passport-local' ).Strategy;
var { User } = require( './database' );

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

                if ( user.password !== password ) {
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
    Login
};
