const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // Auto-generated order number
    orderNumber: {
        type: String,
        unique: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Customer Details (snapshot at order time)
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String
    },

    // Delivery Address (embedded for historical record)
    deliveryAddress: {
        name: { type: String },
        phone: { type: String },
        addressLine1: { type: String },
        addressLine2: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
        fullAddress: { type: String }
    },

    // Order Items
    items: [
        {
            food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
            name: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true },
            image: { type: String }
        }
    ],

    // Pricing
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    totalAmount: { type: Number, required: true },

    // Order Status
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },

    // Status History
    statusHistory: [
        {
            status: { type: String },
            timestamp: { type: Date, default: Date.now },
            updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }
    ],

    // Payment Reference
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    paymentMethod: {
        type: String,
        default: 'COD'
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paidAt: { type: Date },

    // Delivery
    isDelivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: { type: Date },

    // Notes
    orderNotes: { type: String },

    // Archive Flag - for soft delete (data never lost)
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date
    },

    // Invoice & Billing
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    gstAmount: {
        type: Number,
        default: 0
    },
    gstPercentage: {
        type: Number,
        default: 5 // 5% GST
    },

    // Review tracking
    hasReview: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate order number before saving
// Generate order number before saving
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const date = new Date();
        const year = date.getFullYear();

        // Find the latest order from this year
        const lastOrder = await mongoose.model('Order').findOne(
            { orderNumber: { $regex: `^ORD-${year}-` } }
        ).sort({ orderNumber: -1 });

        let nextSequence = 1;
        if (lastOrder && lastOrder.orderNumber) {
            const parts = lastOrder.orderNumber.split('-');
            if (parts.length === 3) {
                nextSequence = parseInt(parts[2], 10) + 1;
            }
        }

        this.orderNumber = `ORD-${year}-${String(nextSequence).padStart(6, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
