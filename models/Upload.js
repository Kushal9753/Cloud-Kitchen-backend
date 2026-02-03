const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    url: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    format: {
        type: String
    },
    width: {
        type: Number
    },
    height: {
        type: Number
    },
    bytes: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Upload = mongoose.model('Upload', uploadSchema);

module.exports = Upload;
