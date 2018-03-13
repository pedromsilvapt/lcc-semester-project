var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var formidable = require( 'formidable' );
var util = require( 'util' );
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var multer = require( 'multer' );
var passport = require( 'passport' );

var upload = multer( {
    dest: 'uploads/'
} );

/* GET home page. */
router.get( '/', function ( req, res, next ) {
    fs.readFile( path.join( __dirname, '..', 'schema.xsd' ), 'utf8', ( err, contents ) => {
        if ( err ) {
            return next( err );
        }

        res.render( 'index', {
            title: 'Express',
            schema: contents,
            user: req.user
        } );
    } );
} );

router.get( '/submit', ( req, res, next ) => {
    res.render( 'submit' );
} );

router.post( '/submit', upload.single( 'file' ), ( req, res, next ) => {
    Compressed.unzip( req.file.path, 'uploads/unzipped', err => {
        if ( err ) {
            return next( err );
        }

        SubmissionInformationPackage.parseMetadata( 'uploads/unzipped/package.xml', ( err, package ) => {
            if ( err ) {
                return next( err );
            }

            res.render( 'submit-received', {
                name: req.body.name,
                file: req.file.originalname,
                package: package
            } );
        } );
    } );
} );


router.get( '/login', ( req, res, next ) => {
    res.render( 'login' );
} );

router.post( '/login', passport.authenticate( 'local', {
    successRedirect: '/',
    failureRedirect: '/login'
} ) );

module.exports = router;