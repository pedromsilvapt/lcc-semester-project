var express = require( 'express' );
var router = express.Router();
var fs = require( 'fs' );
var path = require( 'path' );
var { Log, User } = require( '../services/database' );
var { UsersManager } = require( '../services/users' );
var { Logger } = require( '../services/logger' );
var passport = require( 'passport' );
var { allowLoggedIn, allowLoggedOut } = require( '../services/login' );
var Joi = require( 'joi' );


/* GET home page. */
router.get( '/', function ( req, res, next ) {
    fs.readFile( path.join( __dirname, '..', 'schema.xsd' ), 'utf8', ( err, contents ) => {
        if ( err ) {
            return next( err );
        }

        res.render( 'index', {
            title: 'Express',
            schema: contents
        } );
    } );
} );

router.get( '/login', allowLoggedOut(), ( req, res, next ) => {
    res.render( 'login', {
        error: req.query.error == '1' ? 'Credenciais incorretas introduzidas.' : null
    } );
} );

router.post( '/login', allowLoggedOut(), passport.authenticate( 'local', {
    failureRedirect: '/login?error=1'
} ), ( req, res, next ) => {
    Logger.write( 'User logged in: ' + req.user.username, req.user );
    
    res.redirect( '/' );
} );

router.get( '/logout', allowLoggedIn(), ( req, res, next ) => {
    req.logout();

    res.redirect( '/' );
} );

router.get( '/register', allowLoggedOut(), ( req, res, next ) => {
    res.render( 'register' );
} );


router.post( '/register', allowLoggedOut(), ( req, res, next ) => {
	// Portanto: temos de verificar
  	// 1 - se o utilizador e email não existem já na base de dados
  	// 2 - se o email é válido (tem o formato válido)
  	// 3 - se as passwords coincidem
  	// Se tudo for válido, inserimos
  	// Se não mostramos com as mensagens de erro 
    //penso que sim
  	// Procuramos por utilizadores que tenham aquele username ou aquele email
  
  	// Como podem haver vários "erros" no formulário, podemos ir guardando num array:
  	// - Se no fim esse array estiver vazio (não houver errors) inserimos
  	// - se o length > 0 então mostramos novamente a página com o array dos erros
    //ok, parece bem
  	const errors = [];
  
    
  	User.find( { $or: [ { username: req.body.username }, { email: req.body.email } ] }, ( err, users ) => {
    	if ( users.find( user => user.username == req.body.username ) ) {
            errors.push( 'Username already exists' );
        }

        if ( users.find( user => user.email == req.body.email ) ) {  	
            errors.push( 'Email already exists' );
        }
        
      	const schema = Joi.object().keys( {
        	username: Joi.string().alphanum().min( 6 ).max( 16 ).required(),
          	password: Joi.string().min( 6 ).max( 20 ).required(),
          	password_confirm: Joi.any().equal( Joi.ref( 'password' ) ).required(),
          	email: Joi.string().email()
        } );
      
      	var validation = Joi.validate( req.body, schema, { abortEarly: false } );
          
        if ( validation.error ) {
            errors.push( ...validation.error.details.map( err => err.message ) );
        }
        
        if ( errors.length > 0 ) {
            res.render( 'register', {
                errors,
                ...req.body
            } );
        } else {
            // Certo?
          // portanto, se não tiver erros, ele cria o utilizador com os parâmetros apropriados, e depois renderiza no ecrã a mensagem de sucesso.
          //é mais ou menos isso?
            // sim. Agora temos de ir ao template e passar a usar isso
            UsersManager.create( req.body.username, req.body.password, req.body.email, 'consumer', false, ( err ) => {
                if ( err ) {
                    return next( err );
                }
            
                res.render( 'register', { success: true } );
            } );
        }
    } );
} );

module.exports = router;
