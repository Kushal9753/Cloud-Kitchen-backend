const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // Order reference - one review per order
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        unique: true
    },

    // User who submitted the review
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Individual food item ratings
    foodRatings: [{
        food: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Food'
        },
        foodName: String, // Snapshot of food name at review time
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true
        },
        comment: String
    }],

    // Delivery experience rating
    deliveryRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },

    // Overall order rating
    overallRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },

    // General comment about the order
    comment: {
        type: String,
        maxlength: 500
    },

    // Admin response (optional)
    adminResponse: {
        type: String,
        maxlength: 300
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
reviewSchema.index({ 'foodRatings.food': 1, 'foodRatings.rating': 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ overallRating: -1 });

module.exports = mongoose.model('Review', reviewSchema);
