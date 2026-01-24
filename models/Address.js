const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String,
        default: ''
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Get full formatted address
addressSchema.virtual('fullAddress').get(function () {
    return `${this.addressLine1}${this.addressLine2 ? ', ' + this.addressLine2 : ''}, ${this.city}, ${this.state} - ${this.pincode}`;
});

// Ensure virtuals are included in JSON
addressSchema.set('toJSON', { virtuals: true });
addressSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Address', addressSchema);
