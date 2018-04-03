var express = require( 'express' );
var router = express.Router();
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var { Logger } = require( '../services/logger' );
var { Package } = require( '../services/database' );
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

router.get( '/', ( req, res, next ) => {
    
    const packagesPerPage = 2;
  
    const currentPage = parseInt( req.query.page || 0 );
    
    const searchQuery = req.query.search || '';
    const searchMine = req.query.mine == 'on';
    const searchWaiting = req.query.waiting == 'on';
    const searchApproved = req.query.approved == 'on';
    const searchSort = req.query.sort || 'title';

    let query = {};

    if ( searchQuery ) {
        query.$text = { $search: searchQuery };
    }

    if ( searchApproved && !searchWaiting ) {
        query.approved = true;
    } else if ( !searchApproved && searchWaiting ) {
        query.approved = false;
    }

    if ( searchMine && req.user ) {
        query.createdBy = req.user._id;
    }

    Package.find( query ).sort( { [ searchSort ]: 'asc' } ).skip( currentPage * packagesPerPage ).limit( packagesPerPage ).exec( ( err, packages ) => {
        if ( err ) {
            return next( err );
        }
        
        res.render( 'packages/list', {
            packages: packages,
            currentPage: currentPage,
          	hasNextPage: packages.length == packagesPerPage,
            hasPreviousPage: currentPage > 0,
            searchQuery, searchSort, searchMine, searchWaiting, searchApproved
        } );
    } );
} );


router.get( '/:id', ( req, res, next ) => {
    Package.findById(req.params.id, ( err, package ) => {
        if ( err ) {
            return next( err );
        }

        const buildHtml = ( elem ) => {
            // O nosso caso base tinha dois tipos: string | AbstractNode
            
            if ( typeof elem === 'string' ) {
                return elem;
            }
            // agora faltam os atributos
            // e depois alguns elementos (xref) que não sei como é que o professor os quer traduzir, mas isso
            // depois temos de lhe perguntar
            
            // Portanto lembraste que elem.attributes = { attr1: valor1, attr2: valor2, .... }, certo?
            // E queremos traduzir isso em 'attr1="valor1" attr2="valor2"'
            // Por isso para cada attributo geramos a string key="value" e juntamos com espaços
            // certo?
            //Penso que sim
            // Object.keys retorna um array com as keys de um objeto
            const attributes = Object.keys( elem.attributes || {} )
                .map( key => key + '="' + elem.attributes[ key ] + '"' )
                .join( ' ' );
            
            // Com as aspas e pelicas fica um pouco confuso, mas percebes mais ou menos o que está ali?
            //percebo, não é complicado(estamos apenas a colocar as chaves, depois fazemos map para 'chave ='atributos de chave'' e depois juntamos tudo com espaços no meio)
            // exato. Agora só temos de o inserir na tag
            return '<' + elem.type + ' ' + attributes + '>' + elem.body.map( buildHtml ).join( '' ) + '</' + elem.type + '>';
        };
        
        res.render( 'packages/detailed', {
            package: package,
            // Para cada parágrafo vamos usar uma função recusriva que retorna uma string
            // E depois juntamos dos os parágrafos com '\n'
            abstract: package.abstract.body.map( paragraph => buildHtml( paragraph ) ).join( '\n' )
        } );
    } );
} );



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

                        
                      	new Package( {
                          	// Isto expande o objecto package, ou seja, coloca todos os valores de package também aqui
                        	...package,
                          	folder: id,
                          	approved: false,
                          	approvedBy: null,
                          	approvedAt: null,
                          	createdBy: req.user.id
                        } ).save( ( err, result ) => {
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
