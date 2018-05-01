const xml2js = require( 'xml2js' );
const fs = require( 'fs' );
const path = require( 'path' );
const xmllint = require( './xmllint' );
const mkdirp = require( 'mkdirp' );
const builder = require( 'xmlbuilder' );
const sha = require( 'sha.js' );
const once = require( 'once' );
const { format } = require( 'date-fns' );


class SubmissionInformationPackage {
    static validateMetadata ( file, schema, callback ) {
        xmllint.validateXML( {
            xml: file,
            schema: schema
        }, ( err, errors ) => {
            if ( err ) {
                return callback( err );
            }
            
            callback( null, errors );
        } );
    }    


  	static calculateChecksum ( folder, file, callback ) {
        callback = once( callback );
    
        const stream = fs.createReadStream( path.join( folder, file ) );
    
        const checksum = sha( 'sha256' );
    
        stream.on( 'data', data => checksum.update( data ) );
      
        stream.on( 'error', err => callback( err ) );
      
        stream.on( 'end', () => callback( null, checksum.digest( 'hex' ) ) );
    }

  	static validateFiles ( checksums, filesList, folder, callback ) {
    	if ( filesList.length == 0 ) {
        	return callback( null, [] );
        }
        
      	fs.exists( path.join( folder, filesList[ 0 ].path ), ( exists ) => {
          	SubmissionInformationPackage.validateFiles( checksums, filesList.slice( 1 ), folder, ( err, errors ) => {
            	if ( err ) {
                	return callback( err );
                }

                if ( exists ) {
                    SubmissionInformationPackage.calculateChecksum( folder, filesList[ 0 ].path, ( err, checksum ) => {
                        if ( err ) {
                            return callback( err );
                        }

                        if ( checksum !== checksums[ filesList[ 0 ].path ] ) {
                            callback( null, [ 'Ficheiro adulterado: ' + filesList[ 0 ].path, ...errors ] );
                        } else {
                            callback( null, errors );
                        }
                    } );
                } else {
                    callback( null, [ 'Ficheiro em falta: ' + filesList[ 0 ].path, ...errors ] );
                }
            } );
        } );
    }
    
  	static moveFiles ( filesList, src, dest, callback ) {
    	if ( filesList.length == 0 ) {
        	return callback( null );
        }
      
        const file = filesList[ 0 ].path;
      
      	mkdirp( path.dirname( path.join( dest, file ) ), ( err ) => {
        	if ( err ) {
            	return callback( err );
            }
          
          	fs.copyFile( path.join( src, file ), path.join( dest, file ), ( err ) => {
            	SubmissionInformationPackage.moveFiles( filesList.slice( 1 ), src, dest, callback );
            } );
        } );
    }

    /**
     * interface AbstractParagraph {
     *      body : ( AbstractNode | string )[];
     * }
     * 
     * interface AbstractNode {
     *      type : "__text__" | "b" | "xref" | "u";
     *      atributes : object;
     *      body: ( AbstractNode | string )[]
     * }
     */
    static convertMixedXml ( element ) {
        if ( element[ '#name' ] == '__text__' ) {
            return element._;
        }

        let body = element.$$.map( el => this.convertMixedXml( el ) );

        return {
            type: element[ '#name' ],
            attributes: element[ "$" ],
            body
        };
    }

    /**
     * 
     * @param {string} file O caminho do ficheiro XML que iremos 
     * @param {(err : any, result ?: any) => void} callback Uma função que vai ser chamada dentro da nossa função para enviar o resultado obtido
     */
    static parseMetadata ( file, callback ) {
        fs.readFile( file, 'utf8', ( err, content ) => {
            if ( err ) {
                return callback( err );
            }

            var parser = new xml2js.Parser( {
                explicitChildren: true,
                preserveChildrenOrder: true,
                charsAsChildren: true
            } );
            
            parser.parseString( content, ( err, content ) => {
                if ( err ) {
                    return callback( err );
                }

                if ( !content ) {
                    return callback( new Error( 'File package.xml should not be empty.' ) );
                }

                const person = node => ( { name: node.name[ 0 ] ? node.name[ 0 ]._ : null, email: node.email[ 0 ] ? node.email[ 0 ]._ : null } );

                const abstract = this.convertMixedXml( content.package.abstract[ 0 ] );

                callback( null, {
                    meta: {
                        title: content.package.meta[ 0 ].title[ 0 ]._,
                        publishedDate: content.package.meta[ 0 ][ 'published-date' ][ 0 ]._,
                        type: content.package.meta[ 0 ].type[ 0 ]._,
                        access: content.package.meta[ 0 ].access[ 0 ]._,
                    },
                    authors: content.package.authors[ 0 ].author.map( person ),
                    supervisors: content.package.supervisors[ 0 ].supervisor.map( person ),
                    keywords: content.package.keywords[ 0 ].keyword.map( k => k._ ),
                    abstract: abstract,
                    files: content.package.files[ 0 ].file.map( file => {
                        return {
                            description: file._,
                            path: file.$.path
                        };
                    } )
                } );
            } );
        } );
    }

    static buildMixedXml ( element, node ) {
    	if ( typeof node === 'string' ) {
            element.txt( node );

        	return;
        }
      
        const subElement = element.ele( node.type, node.attributes || {} );

        for ( let subNode of node.body ) {
            this.buildMixedXml( subElement, subNode );
        }
    }

    static buildMetadata ( pkg ) {
        const xml = builder.create( 'package' );

        const meta = xml.ele( 'meta' );
        
        meta.ele( 'title', pkg.meta.title );
        meta.ele( 'published-date', format( pkg.meta.publishedDate, 'YYYY-MM-DD' ) );
        meta.ele( 'type', pkg.meta.type );
        meta.ele( 'access', pkg.meta.access );
        meta.ele( 'context', pkg.meta.context );

        const authors = xml.ele( 'authors' );

        for ( let author of pkg.authors ) {
            authors.ele( 'author' )
                .ele( 'name', author.name ).up()
                .ele( 'email', author.email ).up()
                .ele( 'course', author.course ).up()
                .ele( 'id', author.id );
        }

        const supervisors = xml.ele( 'supervisors' );        

        for ( let supervisor of pkg.supervisors ) {
            supervisors.ele( 'supervisor' )
                .ele( 'name', supervisor.name ).up()
                .ele( 'email', supervisor.email );
        }

        const keywords = xml.ele( 'keywords' );

        for ( let keyword of pkg.keywords ) {
            keywords.ele( 'keyword', keyword );
        }

        const abstract = xml.ele( 'abstract' );

        for ( let paragraph of pkg.abstract.body ) {
            this.buildMixedXml( abstract, paragraph );
        }

        const files = xml.ele( 'files' );

        for ( let file of pkg.files ) {
            files.ele( 'file', { path: file.path }, file.description );
        }

        return xml.end( { pretty: true } );
    }
}

module.exports = { SubmissionInformationPackage };