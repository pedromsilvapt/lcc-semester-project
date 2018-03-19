// services/database.js

var mongoose = require( 'mongoose' );

mongoose.connect( 'mongodb://localhost/repositorium' );

var Log = mongoose.model( 'Log', new mongoose.Schema( {
    action: {
        type: String
    },
    date: {
        type: Date,
        default: () => Date.now()
    },
    user: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String
    }
} ) );

const User = mongoose.model( 'User', new mongoose.Schema( {
    username: String,
    password: String
} ) );


// new User( { username: 'pedro', password: 'password' } ).save( ( err, results ) => {
//     console.log( err, results );
// } );

// new Log( { action: 'This is an action', user: { name: 'Ezequiel', _id: null } } ).save( ( err, results ) => {
//     console.log( err, results );
// } );

// Log.deleteMany( ( err, results ) => {
//     console.log( err, results );

//     Log.find( ( err, results ) => {
//         console.log( err, results );
//     } );
// } );

module.exports = {
    Log, User
};
