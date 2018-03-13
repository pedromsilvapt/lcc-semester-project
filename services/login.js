var passport = require( 'passport' );
var LocalStrategy = require( 'passport-local' ).Strategy;

const User = {
    username: 'Ezequiel',
    password: 'A'
}

class Login {
    static setup( passport ) {
        passport.serializeUser( ( user, done ) => {
            done( null, user.username );
        } );

        // E se temos a função que retorna o valor a guardar, precisamos agora de uma que dado esse valor, vá buscar o objeto original novamente.
        passport.deserializeUser( ( username, done ) => {
            // Só temos este
            done( null, User );
        } );

        passport.use( new LocalStrategy( ( username, password, callback ) => {
            console.log( username, password, User.username == username, User.password === password );

            if ( User.username == username && User.password === password ) {
                callback( null, User );
            } else {
                callback( null, false );
            }


            // User.findOne( {
            //     username: username
            // }, ( err, user ) => {
            //     if ( err ) {
            //         return callback( err );
            //     }
            //     if ( !user ) {
            //         return callback( null, false, {
            //             message: 'Incorrect username.'
            //         } );
            //     }
            //     if ( !user.verifyPassword( password ) ) {
            //         return callback( null, false, {
            //             message: 'Incorrect password.'
            //         } );
            //     }
            //     return callback( null, user );
            // } );
        } ) );
    }
}

module.exports = {
    Login
};
