const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, enum: ['veg', 'non-veg'], required: true },
    available: { type: Boolean, default: true },

    // Discount fields
    discountType: {
        type: String,
        enum: ['percentage', 'flat', 'none'],
        default: 'none'
    },
    discountValue: {
        type: Number,
        default: 0,
        min: 0
    },

    // Rating fields - calculated from reviews
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },

    createdAt: { type: Date, default: Date.now }
});

// Virtual field for discounted price
foodSchema.virtual('discountedPrice').get(function () {
    if (this.discountType === 'none' || this.discountValue === 0) {
        return this.price;
    }

    if (this.discountType === 'percentage') {
        return Math.round(this.price * (1 - this.discountValue / 100));
    }

    if (this.discountType === 'flat') {
        return Math.max(0, this.price - this.discountValue);
    }

    return this.price;
});

// Ensure virtuals are included in JSON output
foodSchema.set('toJSON', { virtuals: true });
foodSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Food', foodSchema);
