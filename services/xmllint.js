var { exec } = require( 'child_process' )

function validateXML ( options, callback ) {
	exec( `xmllint --schema ${ options.schema } --noout ${ options.xml }`, ( err, stdout, stderr ) => {
        callback( null, stderr.split( '\n' ).filter( e => e != '' ).slice( 0, -1 ) );
    } );
}

module.exports = { validateXML };
