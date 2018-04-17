const xml2js = require( 'xml2js' );
const fs = require( 'fs' );
const path = require( 'path' );
const xmllint = require( './xmllint' );
const mkdirp = require( 'mkdirp' );

class SubmissionInformationPackage {
    // static async parseMetadataPromises ( file ) {
    //     const content = await fs.readFile( file, 'utf8' );

    //     var parser = new xml2js.Parser();

    //     return parser.parseString( content );
    // }

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


  	static validateFiles ( filesList, folder, callback ) {
    	if ( filesList.length == 0 ) {
        	return callback( null, [] );
        }
        
      	fs.exists( path.join( folder, filesList[ 0 ].path ), ( exists ) => {
          	SubmissionInformationPackage.validateFiles( filesList.slice( 1 ), folder, ( err, errors ) => {
            	if ( err ) {
                	return callback( err );
                }
              
              	callback( null, exists ? errors : [ 'Ficheiro em falta: ' + filesList[ 0 ].path, ...errors ] );
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
        // Lemos o ficheiro
        // O encoding utf8 significa que a variável content irá ser uma string
        // Sem o encoding, seria um objeto Buffer do node com os bits do ficheiro em bnário
        fs.readFile( file, 'utf8', ( err, content ) => {
            // Se ocorreu algum erro, paramos a execução da função e enviamos o erro para quem nos chamou
            if ( err ) {
                return callback( err );
            }

            var parser = new xml2js.Parser( {
                explicitChildren: true,
                preserveChildrenOrder: true,
                charsAsChildren: true
            } );

            parser.parseString( content, ( err, content ) => {
                // Se ocorreu algum erro, paramos a execução da função e enviamos o erro para quem nos chamou                
                if ( err ) {
                    return callback( err );
                }

                // Guardamos uma função anónima na variável person.
                // Esta função recebe a variável node e retorna um objeto { name : string, email : string }
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

    static buildMixedXml ( node ) {
    	if ( typeof node === 'string' ) {
        	return { _: node };
        }
      
      	return {
        	[ node.type ]: {
                $: node.attributes,
                $$: node.body.map( subNode => SubmissionInformationPackage.buildMixedXml( subNode ) )
            }
        };
    }

    static buildMetadata ( pkg ) {
        // {
        //     meta: {
        //         title: content.package.meta[ 0 ].title[ 0 ]._,
        //         publishedDate: content.package.meta[ 0 ][ 'published-date' ][ 0 ]._,
        //         type: content.package.meta[ 0 ].type[ 0 ]._,
        //         access: content.package.meta[ 0 ].access[ 0 ]._,
        //     },
        //     authors: content.package.authors[ 0 ].author.map( person ),
        //     supervisors: content.package.supervisors[ 0 ].supervisor.map( person ),
        //     keywords: content.package.keywords[ 0 ].keyword.map( k => k._ ),
        //     abstract: abstract,
        //     files: content.package.files[ 0 ].file.map( file => {
        //         return {
        //             description: file._,
        //             path: file.$.path
        //         };
        //     } )
        // }

        var xmlObject = {
            package: {
                meta: {
                    title: pkg.meta.title,
                },
                authors: {
                    author: Array.from( pkg.authors ).map( author => ( { 
                        name: author.name, email: author.email,
                          course: author.course, id: author.id
                    } ) )
                },
                  supervisors: {
                    supervisor: Array.from( pkg.supervisors ).map( supervisor => ( {
                          name: supervisor.name, email: supervisor.email,
                      } ) ),
                },
                  keywords: {
                    keyword: Array.from( pkg.keywords )
                  },
                  // Depois temos de criar também uma função recursiva para criar o abstract
                  //ok
                abs: [ [ { _: "Ola" }, { teste: 1 }, "Adues", { sss: 2 } ] ],
                abstract: this.buildMixedXml( pkg.abstract ),
                  files: {
                    file: Array.from( pkg.files ).map( file => ( {
                        $: { path: file.path },
                          _: file.description
                    } ) )
                }
            }
        };

        var builder = new xml2js.Builder( { 
            explicitArray: true
        } );

        var xmlString = builder.buildObject( xmlObject );
        
        return xmlString;
    }
}

module.exports = { SubmissionInformationPackage };