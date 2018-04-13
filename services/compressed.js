var yauzl = require( "yauzl" );
var yazl = require( 'yazl' );
var fs = require( 'fs' );
var path = require( 'path' );
var mkdirp = require( 'mkdirp' );

function once ( fn ) {
	let wasCalled = false;

	return ( ...args ) => {
		if ( !wasCalled ) {
			wasCalled = true;
			
			return fn( ...args );
		}
	};
}

class Compressed {
  	static saveTo ( stream, dest, callback ) {
        const writer = fs.createWriteStream( dest );
        
      	stream.pipe( writer );
        
      	writer.on( 'error', err => callback( err ) );
      
      	writer.on( 'finish', () => callback( null ) );
    }
  
  	static copyFile ( zipFile, entry, dest, callback ) {
        if ( entry.fileName.endsWith( '/' ) ) {
        	mkdirp( path.join( dest, entry.fileName ), callback );
      	} else {
        	mkdirp( path.join( dest, path.dirname( entry.fileName ) ), err => {
				if ( err ) {
					return callback( err );
				}

				zipFile.openReadStream( entry, ( err, stream ) => {
					if ( err ) {
						return callback( err );
					}
				  
					Compressed.saveTo( stream, path.join( dest, entry.fileName ), callback );
				} );
			} );
        }
    }
  
    static unzip ( zipFile, dest, callback ) {
		callback = once( callback );

        yauzl.open( zipFile, { lazyEntries: true }, ( err, zipFile ) => {
            if ( err ) {
            	return callback( err );
            }
            
          	zipFile.on( 'entry', entry => {
              	Compressed.copyFile( zipFile, entry, dest, ( err ) => {
                  	if ( err ) {
                      	zipFile.close();
                      
                      	return callback( err );
                  	}
                    
                  	zipFile.readEntry();
                } );
            } );
          	
            zipFile.on( 'error', err => callback( err ) );
          
            zipFile.once( 'end', () => callback( null ) );
              
            zipFile.readEntry();
        } );    
	}
	
	static zip ( folder,callback ) {
		var zipfile = new yazl.ZipFile();
		// zipfile.addFile( "package.xml", "package.xml" );
		// // (add only files, not directories)
		// zipfile.addFile( "app.js", "app.js" );
		// zipfile.addFile( "routes/index.js", "routes/index.js" );
		// zipfile.addFile( "routes/users.js", "routes/users.js" );
		// // pipe() can be called any time after the constructor
		// zipfile.outputStream.pipe( fs.createWriteStream( "package.zip" ) ).on( "close", function () {
		//     console.log( "done" );
		// } );
		// zipfile.end();
		var fr = (files,index,current,callback)=>{
			var fp=path.join(current,files[index]);
			if(index>=files.length){return callback();}
			fs.stat(fp,(error,file)=>{
				if(error) return callback(error);
				if(file.isFile()){
					zipfile.addFile(fp,path.relative(fp,folder));
					fr(files,index+1,current,callback);
				}else{
					fs.readdir(fp,(error,subfiles)=>{
						fr(subfiles,0,fp,(error)=>{
							if(error){
								return callback(error);
							}
							fr(files,index+1,current,callback);
						});
					});
				}
			});
		};
		fs.readdir(folder,(error,files)=>{			
			fr(files,0,folder,(error)=>{
				if(error){callback(error);}
				callback(null,zipfile);
			})
		})
	}
}

module.exports = { Compressed };