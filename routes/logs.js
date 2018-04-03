
var express = require( 'express' );
var router = express.Router();
var { Log } = require( '../services/database' );

router.get( '/', ( req, res, next ) => {
    const logsPerPage = 25;
  
    const currentPage = parseInt( req.query.page || 0 );
    
    Log.find().sort( { date: 'desc' } ).skip( currentPage * logsPerPage ).limit( logsPerPage ).exec( ( err, logs ) => {
        if ( err ) {
          	return next( err );
        }
      
      	res.render( 'logs/list', {
        	logs: logs,
          	currentPage: currentPage,
          	hasNextPage: logs.length > 0,
          	hasPreviousPage: currentPage > 0
        } );
    } );
} );

router.get( '/:id', ( req, res, next ) => {
  
} );

module.exports = router;