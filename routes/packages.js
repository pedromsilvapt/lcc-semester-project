var express = require( 'express' );
var router = express.Router();
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var { Logger } = require( '../services/logger' );
var multer = require( 'multer' );
var rmdir = require( 'rmdir' );
var fs = require( 'fs' );
var uid = require( 'uid-safe' );

var upload = multer( {
    dest: 'uploads/'
} );

function cleanup( ...folders ) {
    for ( let folder of folders ) {
        fs.exists( folder, exists => {
            if ( exists ) {
                rmdir( folder, ( err ) => err && console.log( err ) );
            }
        } );
    }
}

router.get( '/submit', ( req, res, next ) => {
    res.render( 'packages/submit' );
} );

router.post( '/submit', upload.single( 'file' ), ( req, res, next ) => {
    const id = uid.sync( 20 );

    const uploadFolder = 'uploads/unzipped/' + id;
    const storageFolder = 'storage/packages/' + id;

    Compressed.unzip( req.file.path, uploadFolder, err => {
        if ( err ) {
            cleanup( req.file.path, uploadFolder );

            return next( err );
        }

        SubmissionInformationPackage.validateMetadata( uploadFolder + '/package.xml', 'schema.xsd', ( err, errors ) => {
            if ( err ) {
                cleanup( req.file.path, uploadFolder );

                return next( err );
            }

            if ( errors.length ) {
                cleanup( req.file.path, uploadFolder );

                return res.render( 'submit-received', {
                    errors: errors
                } );
            }

            SubmissionInformationPackage.parseMetadata( uploadFolder + '/package.xml', ( err, package ) => {
                if ( err ) {
                    cleanup( req.file.path, uploadFolder );

                    return next( err );
                }
                
                SubmissionInformationPackage.validateFiles( package.files, uploadFolder, ( err, missingFiles ) => {
                    if ( err ) {
                        cleanup( req.file.path, uploadFolder );

                        return next( err );
                    }

                    if ( missingFiles.length ) {
                        cleanup( req.file.path, uploadFolder );

                        return res.render( 'submit-received', {
                            errors: missingFiles
                        } );
                    }

                    SubmissionInformationPackage.moveFiles( package.files, uploadFolder, storageFolder, ( err ) => {
                        if ( err ) {
                            cleanup( req.file.path, uploadFolder, storageFolder );

                            return next( err );
                        }

                        Logger.write( 'Package submitted: ' + package.meta.title, req.user );

                        cleanup( req.file.path, uploadFolder );

                        res.render( 'submit-received', {
                            name: req.body.name,
                            file: req.file.originalname,
                            package: package
                        } );
                    } );
                } );
            } );
        } );
    } );
} );

// router.post( '/submit', upload.single( 'file' ), async ( req, res, next ) => {
//     const id = uid.sync( 20 );

//     const uploadFolder = 'uploads/unzipped/' + id;
//     const storageFolder = 'storage/packages/' + id;

//     try {
//         await Compressed.unzip( req.file.path, uploadFolder );
        

//         const errors = await SubmissionInformationPackage.validateMetadata( uploadFolder + '/package.xml', 'schema.xsd' );

//         if ( errors.length ) {
//             cleanup( req.file.path, uploadFolder );

//             return res.render( 'submit-received', {
//                 errors: errors
//             } );
//         }

//         const package = await SubmissionInformationPackage.parseMetadata( uploadFolder + '/package.xml' );
        
//         const missingFiles = await SubmissionInformationPackage.validateFiles( package.files, uploadFolder );
        
//         if ( missingFiles.length ) {
//             cleanup( req.file.path, uploadFolder );

//             return res.render( 'submit-received', {
//                 errors: missingFiles
//             } );
//         }

//         await SubmissionInformationPackage.moveFiles( package.files, uploadFolder, storageFolder );

//         Logger.write( 'Package submitted: ' + package.meta.title, req.user );

//         cleanup( req.file.path, uploadFolder );

//         res.render( 'submit-received', {
//             name: req.body.name,
//             file: req.file.originalname,
//             package: package
//         } );
//     } catch ( err ) {
//         cleanup( req.file.path, uploadFolder, storageFolder );

//         next( err );
//     }
// } );

module.exports = router;
