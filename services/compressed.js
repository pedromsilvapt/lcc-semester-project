var yauzl = require( "yauzl" );
var fs = require( 'fs' );
var path = require( 'path' );
var mkdirp = require( 'mkdirp' );

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
        	mkdirp( path.join( dest, path.dirname( entry.fileName ) ), callback );
          
          	zipFile.openReadStream( entry, ( err, stream ) => {
            	if ( err ) {
                	return callback( err );
                }
              
              	Compressed.saveTo( stream, path.join( dest, entry.fileName ), callback );
            } );
        }
    }
  
    static unzip ( zipFile, dest, callback ) {
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
}

module.exports = { Compressed };