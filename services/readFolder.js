const fs = require( 'fs' );
const path = require( 'path' );

function readFolder ( folder, callback ) {
    const filesList = [];
  
    const fr = ( files, index, current, callback ) => {
        if ( index >= files.length ) {
            return callback( null, filesList );
        }

        var fp = path.join( current, files[ index ] );

        fs.stat( fp, ( error, file ) => {
            if ( error ) {
                return callback( error );
            }

            if( file.isFile() ) {
                filesList.push( path.relative( folder, fp ) );
                fr( files, index + 1, current, callback );
            } else {
                fs.readdir( fp, ( error, subfiles ) => {
                    fr( subfiles, 0, fp, ( error ) => {
                        if( error ) {
                            return callback( error );
                        }

                        fr( files, index + 1, current, callback );
                    } );
                } );
            }
        } );
    };

    fs.readdir( folder, ( error, files ) => {
        fr( files, 0, folder, callback );
    } );
}

module.exports = readFolder;