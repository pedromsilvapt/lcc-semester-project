var yauzl = require( "yauzl" );
var fs = require( 'fs' );
var path = require( 'path' );
// Este módulo também é preciso instalar. Basicamente ele serve para assegurar que uma pasta existe, e se
// não existir, ele cria.
//ok
var mkdirp = require( 'mkdirp' );
//assumo que este módulo seja para guardar informação numa certa diretoria?
// Sim. O zipFile vai nos dar uma stream do ficheiro. E nós podiamos escrever o código para o guardar
// numa pasta (não era complicado) mas neste caso para simplificar as coisas vamos usar este módulo
//ok
//var saveTo = require( 'save-to' );

class Compressed {
  	static saveTo ( stream, dest, callback ) {
      	// A stream que a função recebe é uma stream Read (ou seja lemos dela)
      	// Também existem streams Write (para onde escrevemos)
      	// e streams ReadWrite que recebem dados, transformam, e escrevem (quase como
      	// o map de um array).
    	//ok. ok.
        const writer = fs.createWriteStream( dest );
        
      	// O que queremos agora é enviar tudo o que vem da stream Read para a Write, e em node
      	// isso é super simples de fazer.
      
      	stream.pipe( writer );
      	// Done
      	// agora só temos é de escutar os eventos finish e error para saber quando acaba ou se deu algum erro
        //ok.
        
      	writer.on( 'error', err => callback( err ) );
      
      	writer.on( 'finish', () => callback( null ) );
        //portanto, ele deteta 'error' e 'finish', e depois chama o callback com os códigos apropriados?
    	// sim.
        //ok.
      
      	// Só nos falta uma coisa, acho eu, na função unzip: detetar quando já não há mais ficheiros.
        //Se ele lê um a um, é procurar quando entry está vazia?
    }
  
  	static copyFile ( zipFile, entry, dest, callback ) {
        //esta função copia o ficheiro do zip para uma pasta, certo?  
        // Sim, copia o ficheiro entry do zipFile para dest
        //ok
        // Se o nome acabar com / é uma pasta
        if ( entry.fileName.endsWith( '/' ) ) {
      		// Nesse caso basta criar a pasta e seguir em frente
        	mkdirp( path.join( dest, entry.fileName ), callback );
      	} else {
          	// Se for um ficheiro, usamos a função path.dirname para obter o caminho da pasta 
          	// sem o ficheiro
        	mkdirp( path.join( dest, path.dirname( entry.fileName ) ), callback );
          
          	zipFile.openReadStream( entry, ( err, stream ) => {
            	if ( err ) {
                	return callback( err );
                }
              
              	Compressed.saveTo( stream, path.join( dest, entry.fileName ), callback );
                //qual a razão para ter path.join dentro de path.join?
              	// distração
                //ok
              	// Até se calhar não é má ideia fazermos nós a função saveTo
              	// Para tu veres como se trabalha com streams em node
              	//// e como é fácil
                //ok
            } );
        }
    }
  
    static unzip ( zipFile, dest, callback ) {
        // Ok, vamos começar por abrir o ficheiro zip
        yauzl.open( zipFile, { lazyEntries: true }, ( err, zipFile ) => {
          	// O costume: se der erro, mandamos para cima
        	//não seria return next(err)?
          	// Não, aqui não temos nenhuma variável chamada next. O next geralemnte é o nome 
            // dado nos servdores http. Se quisessemos, aqui podiamos chamar ao callback: next. Mas tinhamos de
          	// mudar o nome ali em cima também
            //ok.ok.
            if ( err ) {
            	return callback( err );
            }
            
          	// Agora, ele abriu o zip, mas ainda não viu quais são os ficheiros dentro dele. O que vamoz fazer é
          	// ler os ficheiros um a um, e copiar os ficheiros para a pasta dest
            //depois disso, eles terão o nome que tinham no zip? sim, o nome nós é que iremos dar, e por isso podemos
          	// escolher dar nomes diferentes, ou neste caso, queremos dar nomes iguais
            //ok.ok.
          
          	zipFile.on( 'entry', entry => {
            	// Esta função é um evento: o nome do evento é "entry" e é executado sempre que alguma entry (ficheiro)
              	// é encontrado dentro do zip. 
                //assumo que entry(ficheiro) simbolize um qualquer ficheiro do zip?
              	// sim. A variável entry desta funcção é um objeto com várias propriedades, como o nome e tamanho, do ficheiro.
              
              	// Aqui o importante perceber é que nós apenas registamos o evento: ou seja, quando ele encontrar o ficheiro, chama esta
              	// função. Mas ele encontra os ficheiros um a um. Por isso, temos de fora da função, chamar:
                //ok. 
                
              	// Pronto, aqui vamos copiar o ficheiro. Para simplificar as coisas, vamos fazer isso numa função
              	// à parte que vamos criar já a seguir.
              	Compressed.copyFile( zipFile, entry, dest, ( err ) => {
                  	if ( err ) {
                      	// Se a cópia der erro, fechamos o ficheiro zip para libertar a memória
                      	zipFile.close();
                      
                      	// E mandamos o erro para cima
                      	return callback( err );
                  	}
                    
                  	// Se não der erro, lemos mais um ficheiro
                  	// Vamos então criar a função copyFile
                  	zipFile.readEntry();
                } );
                //this refere-se ao código deste documento,certo? A esta classe. Como o método é estático, funciona das
              	// duas maneiras, mas se calhar fica mais claro se colocar o nome em vez do this
                //ok
            } );
          	
          	// Portanto, aqui vamos estar à escuta de qualquer possível evento de erro, ou de fim, tal como na stream.
          	// certo?
            zipFile.on( 'error', err => callback( err ) );
          
          	zipFile.on( 'end', () => callback( null ) );
            //uma pergunta:nós é que enviamos estes eventos?
          	// Não. A função on recebe o nome do evento e uma função, e regista um "listener" para esse evento
          	// Ou seja, quando/se ele for executado (alguns podem ser executados mais que uma vez, como o entry aqui em cima)
          	// A função que nós registamos é chamada. Mas é o módulo que a chama. Nós só registamos o código que queremos
          	// executar se isso acontecer
            //ok. ok.
          
            //Então esta função será responsável por tratar do que for detetado acima?
          	// Esta função diz ao módulo para ler o primeiro, e assumindo que o zip não está vazio, o primeiro
          	// ficheiro vai ser passado à função acima (ou seja, esta função vai chamar a que nós declaramos em cima)
          	//ok
            zipFile.readEntry();
        } );    
    }
}

module.exports = { Compressed };