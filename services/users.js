// services/users.js

const { User } = require( './database' );
const uid = require( 'uid-safe' );
const sha = require( 'sha.js' );

class UsersManager {
  	static create ( username, password, group, callback ) {
      	User.find( { username: username }, ( err, users ) => {
          	if ( err ) {
              return callback( err );
            }
          
          	if ( users.length > 0 ) {
            	return callback( new Error( 'Duplicated username: ' + username ) );
            }
          
        	const salt = uid.sync( 10 );
                    
            var hash = sha( 'sha256' ).update( salt + password ).digest( 'hex' );
          
            const user = new User( { username: username, password: hash, group: group, salt: salt } );
            
          	user.save( callback );
        } );
    }
    
    static update ( username, password, group, callback ) {
    	User.findOne( { username }, ( err, user ) => {
        	if ( err ) {
            	return callback( err );
            }
    
          	if ( !user ) {
            	return callback( new Error( 'Trying to update a non-existent user: ' + username ) );
            }
          
            if ( password ) {
            	const hash = sha( 'sha256' ).update( user.salt + password ).digest( 'hex' );
              
              	user.password = hash;
            }
          
            if ( group ) {
              user.group = group;
            }
          
          	user.save( callback );
        } );
    }
}