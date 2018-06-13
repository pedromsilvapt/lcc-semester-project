var express = require('express');
var router = express.Router();
var { allowGroups } = require( '../services/login.js' );
var { User } = require( '../services/database.js' );
var qs = require( 'querystring' );
var { UsersManager } = require( '../services/users' );
var Joi = require( 'joi' );

router.get( '/', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	const usersPerPage = 5;
	
	const currentPage = +( req.query.page || 0 );
	
	let query = {};

	const searchQuery = req.query.search || '';
	const searchApproved = req.query.approved == 'on';
	const searchWaiting = req.query.waiting == 'on';
	
	if ( searchQuery ) {
		query.$text = { $search: searchQuery };
	}

	if ( searchApproved && !searchWaiting ) {
		query.approved = true;
	} else if ( !searchApproved && searchWaiting ) {
		query.approved = false;
	}

	User.find( query ).sort( { username: 1 } ).skip( currentPage * usersPerPage ).limit( usersPerPage ).exec( ( err, users ) => {
		if ( err ) {
			return next( err );
		}
		
		res.render( 'users/list', {
			users: users,
			currentPage: currentPage,
			hasNextPage: users.length == usersPerPage,
			hasPreviousPage: currentPage > 0,
			nextPageLink: '/users?' + qs.stringify( { ...req.query, page: currentPage + 1 } ),
			previousPageLink: '/users?' + qs.stringify( { ...req.query, page: currentPage - 1 } ),

			searchQuery, searchApproved, searchWaiting
		} );
	} );
} );

router.get( '/create', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	res.render( 'users/edit', { userData: {} } );
} );

router.post( '/create', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
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
          	email: Joi.string().email().required(),
          	group: Joi.string().valid( 'admin', 'producer', 'consumer' ).required(),
        } );
      
      	var validation = Joi.validate( req.body, schema, { abortEarly: false } );
          
        if ( validation.error ) {
            errors.push( ...validation.error.details.map( err => err.message ) );
        }
        
        if ( errors.length > 0 ) {
            res.render( 'users/edit', {
                errors,
                userData: req.body
            } );
        } else {
            UsersManager.create( req.body.username, req.body.password, req.body.email, req.body.group, true, ( err, user ) => {
                if ( err ) {
                    return next( err );
				}
				
                res.redirect( '/users/' + user.username );
            } );
        }
    } );
} );

router.get( '/:name/edit', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}
		
		if ( user == null ) {
        	return next( new Error( 'User not found.' ) );
        }

		res.render( 'users/edit', { userData: user } );
	} );
} );


router.post( '/:name/edit', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
	  	if ( err ) {
			return next( err );
		}
  
	  	if ( user == null ) {
			return next( new Error( 'User not found.' ) );
	  	}
	  
	  	const errors = [];
	
		User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
			if ( users.find( u => !u._id.equals( user._id ) && u.username == req.body.username ) ) {
				errors.push( 'Username already exists' );
		  	}
  
		  	if ( users.find( u => !u._id.equals( user._id ) && u.email == req.body.email ) ) {
				errors.push( 'Email already exists' );
		  	}
		  
			const schema = Joi.object().keys( {
				username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
				password: Joi.string().min( 6 ).max( 20 ).allow( '' ),
				password_confirm: Joi.any().equal( Joi.ref( 'password' ) ),
				email: Joi.string().email().required(),
				group: Joi.string().valid( 'admin', 'producer', 'consumer' )
		  	} ).with( 'password', 'password_confirm' );
		
			var validation = Joi.validate( req.body, schema, { abortEarly: false } );
			
		  	if ( validation.error ) {
				errors.push( ...validation.error.details.map( err => err.message ) );
		  	}
		  
		  	if ( errors.length > 0 ) {
				res.render( 'users/edit', {
					errors,
					userData: {
						...user.toObject(),
						...req.body
					}
				} );
		  	} else {
				const updated = { ...req.body };
				  
				if ( !req.body.password ) delete updated.password;
				
				if ( req.body.approved == 'on' ) updated.approved = true;
				else delete updated.approved;

				UsersManager.update( req.params.name, updated, ( err, user ) => {
					if ( err ) {
						return next( err );
				  	}
					  
					res.redirect( '/users/' + updated.username );
			  	} );
		  	}
	  	} );
	} );
} );

router.get( '/:name/approve', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return next( new Error( 'User "' + req.params.name + '" not found.' ) );
		}

		user.approved = true;

		user.save( ( err ) => {
			if ( err ) {
				return next( err );
			}

			// No header Referer de cada pedido vem o URL anterior da pagina.
			// Se carregarmos numa hiperligação que nos direcionou a esta route,
			// Referer indica o endereço da página onde carregamos na hiperligação
			const backUrl = req.header( 'Referer' ) || ( '/users/' + user.username );

			res.redirect( backUrl );
		} );
	} );
} );

router.get( '/:name/remove', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.name }, ( err, user ) => {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return next( new Error( 'User "' + req.params.name + '" not found.' ) );
		}

		const backUrl = req.query.redirect || req.header( 'Referer' ) || ( '/users/' + user.username );
		const confirmBackUrl = req.query.redirect || req.header( 'Referer' ) || ( '/users' );

		if ( req.query.confirm == 'true' ) {	
			user.remove( ( err ) => {
				if ( err ) {
					return next( err );
				}

				res.redirect( backUrl );
			} );
		} else {
			res.render( 'users/remove', { userDetails: user, redirectLink: backUrl, confirmRedirectLink: confirmBackUrl } );
		}
	} );
} );

router.get( '/:username', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	User.findOne( { username: req.params.username }, ( err, user ) => {
	  	if ( err ) {
			return next( err );
	  	}

	  	if( !user ) {
			return next( new Error( 'User not found.' ) );
		}

		res.render( 'users/detailed', {
			userDetails: user
		} );
	} );
} );

module.exports = router;
