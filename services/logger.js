const { Log } = require( './database' );

class Logger {
    static write ( message, user, callback ) {
    	new Log( {
        	action: message,
            user: user == null ? null : {
            	_id: user._id,
              	username: user.username
            }
        } ).save( err => {
          	if ( callback ) {
              	callback( err );
            } else if ( err ) {
            	console.error( err );
            }
        } );
    }
}

module.exports = { Logger };