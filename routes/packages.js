var express = require( 'express' );
var router = express.Router();
var { Log } = require( '../services/database' );
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var { Logger } = require( '../services/logger' );
var multer = require( 'multer' );

var upload = multer( {
    dest: 'uploads/'
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

            Logger.write( 'Package submitted: ' + package.meta.title, req.user );
          	
            res.render( 'submit-received', {
                name: req.body.name,
                file: req.file.originalname,
                package: package
            } );
        } );
    } );
} );

module.exports = router;