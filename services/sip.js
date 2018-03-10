const xml2js = require( 'xml2js' );
const fs = require( 'fs' );

class SubmissionInformationPackage {
    // static async parseMetadataPromises ( file ) {
    //     const content = await fs.readFile( file, 'utf8' );

    //     var parser = new xml2js.Parser();

    //     return parser.parseString( content );
    // }

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

            var parser = new xml2js.Parser();

            parser.parseString( content, ( err, content ) => {
                // Se ocorreu algum erro, paramos a execução da função e enviamos o erro para quem nos chamou                
                if ( err ) {
                    return callback( err );
                }

                // Guardamos uma função anónima na variável person.
                // Esta função recebe a variável node e retorna um objeto { name : string, email : string }
                const person = node => ( { name: node.name[ 0 ] || null, email: node.email[ 0 ] || null } );

                callback( null, {
                    meta: {
                        title: content.package.meta[ 0 ].title[ 0 ],
                        publishedDate: content.package.meta[ 0 ][ 'published-date' ][ 0 ],
                        type: content.package.meta[ 0 ].type[ 0 ],
                        access: content.package.meta[ 0 ].access[ 0 ],
                    },
                    authors: content.package.authors[ 0 ].author.map( person ),
                    supervisors: content.package.supervisors[ 0 ].supervisor.map( person ),
                    keywords: content.package.keywords[ 0 ].keyword,
                    abstract: content.package.abstract[ 0 ],
                    files: content.package.files[ 0 ].file
                } );
            } );
        } );
    }
}

module.exports = { SubmissionInformationPackage };