var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var formidable = require( 'formidable' );
var util = require( 'util' );
var multer = require( 'multer' );

multer( {
    
} )

/* GET home page. */
router.get( '/', function ( req, res, next ) {
    fs.readFile( path.join( __dirname, '..', 'schema.xsd' ), 'utf8', ( err, contents ) => {
        if ( err ) {
            return next( err );
        }

        res.render( 'index', {
            title: 'Express',
            schema: contents
        } );
    } );
} );

router.get( '/submit', ( req, res, next ) => {
    res.render( 'submit' );
} );

router.post( '/submit', ( req, res, next ) => {
    var form = new formidable.IncomingForm();

    form.parse( req, ( err, fields, files ) => {
        if ( err ) {
            return next( err );
        }

        console.log( util.inspect( { fields, files } ) );

        res.render( 'submit-received', {
            name: fields.name,
            file: fields.file
        } );
    } );
} );

module.exports = router;
