var express = require('express');
var router = express.Router();
var { allowGroups } = require( '../services/login.js' );
var { User } = require( '../services/database.js' );
var qs = require( 'querystring' );

router.get( '/', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	console.log( req.header( 'Referer' ) );

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
