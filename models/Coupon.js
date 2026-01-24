const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    discountType: {
        type: String,
        enum: ['percentage', 'flat'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    maxDiscount: {
        type: Number,
        default: null // For percentage type, caps the maximum discount amount
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validTo: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: null // null means unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Method to check if coupon is valid
couponSchema.methods.isValid = function (orderValue) {
    const now = new Date();

    if (!this.isActive) {
        return { valid: false, message: 'Coupon is not active' };
    }

    if (now < this.validFrom) {
        return { valid: false, message: 'Coupon is not yet valid' };
    }

    if (now > this.validTo) {
        return { valid: false, message: 'Coupon has expired' };
    }

    if (this.usageLimit !== null && this.usedCount >= this.usageLimit) {
        return { valid: false, message: 'Coupon usage limit reached' };
    }

    if (orderValue < this.minOrderValue) {
        return { valid: false, message: `Minimum order value of ₹${this.minOrderValue} required` };
    }

    return { valid: true, message: 'Coupon is valid' };
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function (orderValue) {
    let discount = 0;

    if (this.discountType === 'percentage') {
        discount = (orderValue * this.discountValue) / 100;
        // Apply max discount cap if set
        if (this.maxDiscount !== null && discount > this.maxDiscount) {
            discount = this.maxDiscount;
        }
    } else if (this.discountType === 'flat') {
        discount = this.discountValue;
    }

    // Discount cannot be more than order value
    return Math.min(discount, orderValue);
};

module.exports = mongoose.model('Coupon', couponSchema);
