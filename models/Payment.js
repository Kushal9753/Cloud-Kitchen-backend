const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Payment Gateway Details (dummy IDs for simulation)
    gatewayPaymentId: {
        type: String,
        required: true
    },

    // Payment Info
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    method: {
        type: String,
        enum: ['UPI', 'Card', 'NetBanking', 'Wallet', 'COD'],
        required: true
    },

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Success', 'Failed', 'Refunded'],
        default: 'Pending'
    },

    // Additional Details
    upiId: { type: String },
    cardLast4: { type: String },
    bank: { type: String },
    wallet: { type: String },

    // Refund Info
    refundId: { type: String },
    refundAmount: { type: Number },
    refundStatus: { type: String },
    refundedAt: { type: Date }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
