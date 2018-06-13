const { User } = require( './database' );
const uid = require( 'uid-safe' );
const sha = require( 'sha.js' );

class UsersManager {
	static create ( username, password, email, group, approved, callback ) {
		User.find( { username: username }, ( err, users ) => {
			if ( err ) {
				return callback( err );
			}
			
			if ( users.length > 0 ) {
				return callback( new Error( 'Duplicated username: ' + username ) );
			}
			
			const salt = uid.sync( 10 );
								
			var hash = sha( 'sha256' ).update( salt + password ).digest( 'hex' );
		
			const user = new User( { username: username, email: email,password: hash, group: group, salt: salt ,approved: approved} );
			
			user.save( callback );
		} );
	}

	// Como começam a ser muitos campos, se calhar seria melhor eles virem num objeto para a função, não?
	//se simplificar a escrita, podemos fazer isso
	static update ( username, values, callback ) {
		User.findOne( { username }, ( err, user ) => {
			if ( err ) {
				return callback( err );
			}

			if ( !user ) {
				return callback( new Error( 'Trying to update a non-existent user: ' + username ) );
			}
			
			if ( 'username' in values ) {
				user.username = values.username;
			}

			if ( 'password' in values ) {
				const hash = sha( 'sha256' ).update( user.salt + values.password ).digest( 'hex' );
				
				user.password = hash;
			}
			
			if ( 'group' in values ) {
				user.group = values.group;
			}
				
			if ( 'email' in values ) {
				user.email = values.email;
			}
			
			if ( 'approved' in values ) {
				user.approved = values.approved;
			}
				
			user.save( callback );
		} );
	}
}

module.exports = { UsersManager };