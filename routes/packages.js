var express = require( 'express' );
var router = express.Router();
var { Readable } = require( 'stream' );
var { SubmissionInformationPackage } = require( '../services/sip' );
var { Compressed } = require( '../services/compressed' );
var { Logger } = require( '../services/logger' );
var { Package, Settings, User } = require( '../services/database' );
var { allowGroups } = require( '../services/login' );
var multer = require( 'multer' );
var rmdir = require( 'rmdir' );
var fs = require( 'fs' );
var uid = require( 'uid-safe' );
var path = require( 'path' );
var sanitize = require( 'sanitize-filename' );
var BagIt = require( 'bagit-fs' );
var readFolder = require( '../services/readFolder' );
var mkdirp = require( 'mkdirp' );
var { format } = require( 'date-fns' );

var upload = multer( {
    dest: 'uploads/',
    preservePath: true
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

function createRestrictionQuery ( user ) {
    if ( !user || user.group === 'consumer' ) {
        return { approved: true, state: 'public' };
    }

    if ( user.group === 'admin' ) {
        //No restrictions
        return {};
    }

    if ( user.group === 'producer' ) {
        return {
            $or: [ 
                // can view all public and approved packages
                { approved: true, state: 'public' },
                { approved: false, createdBy: user._id },
                { state: 'private', createdBy: user._id }
            ]
        };
    }
}

router.get( '/', ( req, res, next ) => {
    const packagesPerPage = 5;
  
    const currentPage = parseInt( req.query.page || 0 );
    
    const searchQuery = req.query.search || '';
    const searchMine = req.query.mine == 'on';
    const searchWaiting = req.query.waiting == 'on';
    const searchApproved = req.query.approved == 'on';
    const searchSort = req.query.sort || 'title';
    const searchSortDirection = req.query.sortDirection == 'desc' ? 'desc' : 'asc';

    const allowedSearchSort = [ 'title', 'approvedAt', 'createdAt', 'downloadsCount', 'visitsCount' ];

    if ( !allowedSearchSort.includes( searchSort ) ) {
        return next( new Error( `Invalid sort option.` ) );
    }

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

    const userCanSee = createRestrictionQuery( req.user );

    Package.find( { $and: [ query, userCanSee ] } ).sort( { [ searchSort ]: searchSortDirection } ).skip( currentPage * packagesPerPage ).limit( packagesPerPage ).exec( ( err, packages ) => {
        if ( err ) {
            return next( err );
        }
        
        res.render( 'packages/list', {
            packages: packages,
            currentPage: currentPage,
          	hasNextPage: packages.length == packagesPerPage,
            hasPreviousPage: currentPage > 0,
            searchQuery, searchSort, searchSortDirection, searchMine, searchWaiting, searchApproved,
            format: format
        } );
    } );
} );


const submitPackageFolder = ( id, user, uploadFolder, storageFolder, next ) => {
	SubmissionInformationPackage.validateMetadata( uploadFolder + '/data/package.xml', 'schema.xsd', ( err, errors ) => {
        if ( err ) {
            cleanup( uploadFolder );

            return next( err );
        }

        if ( errors.length ) {
            cleanup( uploadFolder );

            return next( null, errors );
        }

        SubmissionInformationPackage.parseMetadata( uploadFolder + '/data/package.xml', ( err, package ) => {
            if ( err ) {
                cleanup( uploadFolder );

                return next( err );
            }
            
            var bag = BagIt( uploadFolder );
            
            bag.readManifest( ( err, entries ) => {
                if ( err ) {
                    cleanup( uploadFolder );

                    return next( err );
                }
                
                const checksums = {};
                
                for ( let entry of entries ) {
                    if ( entry.name && entry.name.startsWith( 'data/' ) ) {
                        checksums[ entry.name.slice( 'data/'.length ) ] = entry.checksum;
                    }
                }
                    
                SubmissionInformationPackage.validateFiles( checksums, package.files, uploadFolder + '/data', ( err, missingFiles ) => {
                    if ( err ) {
                        cleanup( uploadFolder );

                        return next( err );
                    }

                    if ( missingFiles.length ) {
                        cleanup( uploadFolder );

                        return next( null, missingFiles );
                    }

                    SubmissionInformationPackage.moveFiles( package.files, uploadFolder + '/data', storageFolder, ( err ) => {
                        if ( err ) {
                            cleanup( uploadFolder, storageFolder );

                            return next( err );
                        }

                        Settings.findOne( { key: 'packagesIndex' }, ( err, setting ) => {
                            if ( err ) {
                                cleanup( uploadFolder, storageFolder );

                                return next( err );
                            }

                            if ( !setting ) {
                                setting = new Settings( { key: 'packagesIndex', value: 0 } );
                            }

                            new Package( {
                                // Isto expande o objecto package, ou seja, coloca todos os valores de package também aqui
                                ...package,
                                folder: id,
                                approved: false,
                                approvedBy: null,
                                approvedAt: null,
                                createdBy: user.id,
                                index: setting.value++
                            } ).save( ( err, result ) => {
                                if ( err ) {
                                    cleanup( uploadFolder, storageFolder );
                                
                                    return next( err );
                                }
                            
                                Logger.write( 'Package submitted: ' + package.meta.title, user );

                                cleanup( uploadFolder );
                            
                                setting.save();

                                return next( null, null, package );
                            } );
                        } );
                    } );
                } );
            } );
        } );
    } );
}

router.get( '/submit', allowGroups( [ 'producer', 'admin' ] ), ( req, res, next ) => {
    res.render( 'packages/submit' );
} );

router.post( '/submit', allowGroups( [ 'producer', 'admin' ] ), upload.single( 'file' ), ( req, res, next ) => {
    const id = uid.sync( 20 );

    const uploadFolder = 'uploads/unzipped/' + id;
    const storageFolder = 'storage/packages/' + id;

    Compressed.unzip( req.file.path, uploadFolder, err => {
        if ( err ) {
            cleanup( req.file.path, uploadFolder );

            return next( err );
        }

        submitPackageFolder( id, req.user, uploadFolder, storageFolder, ( err, validationErrors, package ) => {
        	cleanup( req.file.path );
          
          	if ( err ) {
            	return next( err );
            }
          	
          	if ( validationErrors ) {
            	return res.render( 'submit-received', {
                    errors: validationErrors
                } );
            } else {
            	res.render( 'submit-received', {
                    name: req.body.name,
                    file: req.file.originalname,
                    package: package
                } );
            }
        } );
    } );
} );

router.get( '/create', allowGroups( [ 'producer', 'admin' ] ), ( req, res, next ) => {
    res.render( 'packages/create' );
} );
  

const addFileToBagit = ( files, index, bag, storageFolder, packageFolder, callback ) => {
    if ( index >= files.length ) {
        return callback( null );
    }
  
  	const [ origin, destination ] = files[ index ];

    mkdirp( path.dirname( path.join( storageFolder, 'data', destination ) ), ( err ) => {
        if ( err ) {
            return callback( err );
        }

        const writer = fs.createReadStream( path.join( packageFolder, origin ) )
            .pipe( bag.createWriteStream( destination ) );

          writer.on( 'error', ( err ) => callback( err ) );

          writer.on( 'finish', () => addFileToBagit( files, index + 1, callback ) );
    } );
};

const addStringToBagit = ( source, destination, bag, storageFolder, callback ) => {
    mkdirp( path.dirname( path.join( storageFolder, 'data', destination ) ), ( err ) => {
    	if ( err ) {
        	return callback( err );
        }
      
      	const reader = new Readable();
      
      	reader.push( source );
      
      	reader.push( null );
      
      	const writer = reader.pipe( bag.createWriteStream( destination ) );
      
      	writer.on( 'error', ( err ) => callback( err ) );
      
      	writer.on( 'finish', () => callback( null ) );
    } );
};

const listify = ( body, prop_name ) => {
    if ( !( body[ prop_name ] instanceof Array ) ) {
        if ( !( prop_name in body ) ) {
            body[ prop_name ] = [];
        } else {
            body[ prop_name ] = [ body[ prop_name ] ];
        }
    }

    return body[ prop_name ];
};

const objectify = ( body, prefix, properties ) => {
    for ( let prop of properties ) {
        let prop_name = prefix + '_' + prop;

        listify( body, prop_name );
    }

    const lengths = properties.map( prop => body[ prefix + '_' + prop ].length );

    if ( lengths.some( len => len != lengths[ 0 ] ) ) {
        throw new Error( `Not all properties of field ` + prefix + ` have the same length.` );
    }

    const objects = [];

    for ( let i = 0; i < lengths[ 0 ]; i++ ) {
        objects.push( {} );

        for ( let prop of properties ) {
            objects[ i ][ prop ] = body[ prefix + '_' + prop ][ i ];
        }
    }

    return objects;
};


router.post( '/create', allowGroups( [ 'producer', 'admin' ] ), upload.array( 'folder' ), ( req, res, next ) => {
  	const id = uid.sync( 20 );

    const permanentStorageFolder = 'storage/packages/' + id;
    const storageFolder = 'storage/bags/' + id;
    const packageFolder = 'uploads/';

    const bag = BagIt( storageFolder );
  
  	const files = objectify( { file_origin: reqFiles.map( file => file.filename ), file_dest: req.body.file_path }, 'file', [ 'origin', 'dest' ] )
    	.map( file => [ file.origin, file.dest ] );
  
  	addFileToBagit( files, 0, bag, storageFolder, packageFolder, err => {
    	if ( err ) {
          	return next( err );
        }

      	const package = {};
          
        package.meta = {};
      	package.meta.title = req.body.title;  
        package.meta.publishedDate = new Date();
      	package.meta.access = req.body.visiblity;
      
      	package.authors = objectify( req.body, 'author', [ 'name', 'id', 'email', 'course' ] );
      	package.supervisors = objectify( req.body, 'supervisor', [ 'name', 'email' ] );
        package.keywords = listify( req.body, 'keyword' );
      	package.files = objectify( req.body, 'file', [ 'path', 'description' ] );
      
      	addStringToBagit( SubmissionInformationPackage.buildMetadata( package ), 'package.xml', ( err ) => {
        	if ( err ) {
            	return next( err );
            }
          
          	bag.finalize( err => {
                if ( err ) {
                    return next( err );
                }

              	submitPackageFolder( id, req.user, storageFolder, permanentStorageFolder, ( err, validationErrors, package ) => {
                    cleanup( ...req.files.map( file => file.path ) );

                    if ( err ) {
                        return next( err );
                    }

                    if ( validationErrors ) {
                        return res.render( 'packages/create', {
                            errors: validationErrors,
                          	data: req.body
                        } );
                    } else {
    					res.redirect( '/packages/' + package.index );
                    }
                } );
        	} );
        } );      
    } );    
} );

router.get( '/:id', ( req, res, next ) => {
    const userCanSee = createRestrictionQuery( req.user );
  
	Package.findOne( { $and: [ { index: req.params.id }, userCanSee ] }, ( err, package ) => {
        if ( err ) {
            return next( err );
        }

        if ( !package ) {
            return next( new Error( `No package with code ${ req.params.id } was found.` ) );
        }

        package.visitsCount = ( package.visitsCount || 0 ) + 1;
        package.save();

        const buildHtml = ( elem ) => {
            
            if ( typeof elem === 'string' ) {
                return elem;
            }
            
            const attributes = Object.keys( elem.attributes || {} )
                .map( key => key + '="' + elem.attributes[ key ] + '"' )
                .join( ' ' );
            
            return '<' + elem.type + ' ' + attributes + '>' + elem.body.map( buildHtml ).join( '' ) + '</' + elem.type + '>';
        };
        
        res.render( 'packages/detailed', {
            package: package,
            abstract: package.abstract.body.map( paragraph => buildHtml( paragraph ) ).join( '\n' ),
            format: format,
            canApprove: req.user && req.user.group == 'admin'
        } );
    } );
} );


// Agora temos de criar o código para permitir aprovar os projetos
router.get( '/:id/approve', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	Package.findById( req.params.id, ( err, package ) => {
      	if ( err ) {
          	return next( err );
        }
      
    	if ( !package.approved ) {
        	package.approved = true;
          	package.approvedAt = new Date();
          	package.approvedBy = req.user._id;
          	
          	package.save( ( err ) => {
            	if ( err ) {
                	return next( err );
                }
              
                const backUrl = req.header( 'Referer' ) || ( '/packages/' + package._id );

                res.redirect( backUrl );
            } );
        } else {
            return next( new Error( `The package was already approved.` ) );
        }
    } );
} );

router.get( '/:id/download', ( req, res, next ) => {
    Package.findById( req.params.id, ( err, package ) => {
        if ( err ) {
            return next( err );
        }

        package.downloadsCount = ( package.downloadsCount || 0 ) + 1;
        package.save();

        const random = uid.sync( 20 );
      
        const storageFolder = 'storage/bags/' + random;
        const packageFolder = path.join( 'storage/packages/', package.folder );
  
        const bag = BagIt( storageFolder );

        readFolder( packageFolder, ( err, files ) => {
            if ( err ) {
                return next( err );
            }
            
            addFileToBagit( files, 0, bag, storageFolder, packageFolder, err => {
                if ( err ) {
                    return next( err );
                }
  
                bag.finalize( err => {
                    if ( err ) {
                        return next( err );
                    }
  
                    Compressed.zip( storageFolder, ( err, zip ) => {
                        zip.addBuffer( new Buffer( SubmissionInformationPackage.buildMetadata( package ) ), 'data/package.xml' );

                        zip.end( size => {
                            if ( size > 0 ) {
                                res.set( 'Content-Length', size );
                            }

                            res.attachment( ( sanitize( package.meta.title ) || 'package' ) + '.zip' );
                
                            zip.outputStream.pipe( res );
                        } );
                    } );
                } );
            } );
        } );
    } );
} );


router.get('/:id/remove',allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	Package.findOne( { _id: req.params.id, $or: [ { state: 'public' }, { state: 'private' } ] }, ( err, pck ) => {
		if ( err ) {
			return next( err );
		}

		if ( !pck ) {
			return next( new Error( 'Package "' + req.params.id + '" not found.' ) );
		}

        const backUrl = req.query.redirect || req.header( 'Referer' ) || ( '/packages/' + pck.index );
		const confirmBackUrl = req.query.redirect || req.header( 'Referer' ) || ( '/packages' );
      
        if ( req.query.confirm == 'true' ) {
            if ( pck.approved == true ) {
                pck.state = 'deleted';
                pck.save( ( err ) => {
                    if ( err ) {
                        return next( err );
                    }

                    res.redirect( backUrl );
                } );
            } else {
                pck.remove( ( err ) => {
                    if ( err ) {
                        return next( err );
                    }

                    res.redirect( confirmBackUrl );
                } );
            }
        } else {
            res.render( 'packages/remove', { package: pck, redirectLink: backUrl, confirmRedirectLink: confirmBackUrl } );
        }
    } );
} );

router.get('/:id/recover/:state', allowGroups( [ 'admin' ] ), ( req, res, next ) => {
	Package.findOne( { _id: req.params.id, state: 'deleted' }, ( err, pck ) => {
		if ( err ) {
			return next( err );
		}

		if ( !pck ) {
			return next( new Error( 'Package "' + req.params.id + '" not found.' ) );
		}
      
        if ( req.params.state != 'public' && req.params.state != 'private' ) {
        	return next( new Error( 'Invalid state ' + req.params.state + ' is not public neither private.' ) );
        }
     
        const backUrl = req.query.redirect || req.header( 'Referer' ) || ( '/packages/' + pck.index );
      
      	User.find( { _id: pck.createdBy, deleted: { $ne: true } }, ( err, user ) => {
          	if ( err ) {
              	return next( err );
            }
          
          	if ( !user ) {
            	return next( new Error( 'Cannot recover package because it\'s author has been deleted.' ) );
            }
          
            pck.state = req.params.state;
            pck.save( ( err ) => {
                if ( err ) {
                    return next( err );
                }

                res.redirect( backUrl );
            } );
        } );
	} );
} );

module.exports = router;
