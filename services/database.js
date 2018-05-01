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
  	email: String,
    password: String,
    salt: String,
    group: String,
  	approved: Boolean
} ).index( { username: 'text', email: 'text' } ) );

const Package = mongoose.model( 'Package', new mongoose.Schema( {
    meta: new mongoose.Schema( {
        title: String,
        publishedDate: Date,
        type: String,
        access: String,
        context: String
    } ),
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
    abstract: mongoose.Schema.Types.Mixed,
    files: [ {
        description: String,
        path: String
    } ],
    folder: String,
    approved: { type: Boolean, default: () => false },
    approvedAt: Date,
    approvedBy: mongoose.Schema.Types.ObjectId,
    createdBy: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now },
    downloadsCount: { type: Number, default: 0 },
    visitsCount: { type: Number, default: 0 }
} ).index( { name: 'text', 'meta.title': 'text' } ) );


module.exports = {
    Log, User, Package
};
