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

const Package = mongoose.model( 'Package', new mongoose.Schema( {
    meta: {
        title: String,
        publishedDate: Date,
        type: String,
        access: String,
        context: String
    },
    authors: [ {
        name: String,
        email: String,
        course: String,
        id: String
    } ],
    supervisors: [ {
        name: String,
        email: String
    } ],
    keywords: [ String ],
    abstract: [ {
        type: String,
        attributes: mongoose.Schema.Types.Mixed,
        body: String
    } ],
    files: [ {
        description: String,
        path: String
    } ]
} ) );

module.exports = {
    Log, User
};
