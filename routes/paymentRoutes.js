const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Address = require('../models/Address');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { notifyAdminNewOrder } = require('../services/notificationService');

// Generate unique payment ID
const generatePaymentId = () => {
    return 'PAY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
};

// Process dummy payment and create order
router.post('/process', protect, async (req, res) => {
    try {
        const { addressId, paymentMethod, items, totalAmount, deliveryFee = 0, discount = 0, couponCode, orderNotes } = req.body;

        // Validate inputs
        if (!addressId || !paymentMethod || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Get user details
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get address details
        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Calculate subtotal
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const finalTotal = totalAmount || (subtotal + deliveryFee - discount);

        // Create order first
        const order = new Order({
            user: req.user._id,
            customerName: user.name,
            customerPhone: user.phone || address.phone,
            customerEmail: user.email,
            deliveryAddress: {
                name: address.name,
                phone: address.phone,
                addressLine1: address.addressLine1,
                addressLine2: address.addressLine2,
                city: address.city,
                state: address.state,
                pincode: address.pincode,
                fullAddress: address.fullAddress
            },
            items: items.map(item => ({
                food: item.productId || item.food,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image
            })),
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            discount: discount,
            couponCode: couponCode,
            totalAmount: finalTotal,
            paymentMethod: paymentMethod,
            status: 'Pending',
            statusHistory: [{
                status: 'Pending',
                timestamp: new Date()
            }],
            orderNotes: orderNotes
        });

        await order.save();

        // Increment coupon usage if used
        if (couponCode) {
            try {
                const coupon = await require('../models/Coupon').findOne({ code: couponCode });
                if (coupon) {
                    coupon.usedCount += 1;
                    await coupon.save();
                }
            } catch (err) {
                console.error('Error incrementing coupon usage:', err);
            }
        }

        // Payment processing - removed artificial delay for better performance

        // Create payment record
        const payment = await Payment.create({
            order: order._id,
            user: req.user._id,
            gatewayPaymentId: generatePaymentId(),
            amount: finalTotal,
            method: paymentMethod,
            status: paymentMethod === 'COD' ? 'Pending' : 'Success',
            currency: 'INR'
        });

        // Update order with payment info
        order.payment = payment._id;
        order.isPaid = paymentMethod !== 'COD';
        order.paidAt = paymentMethod !== 'COD' ? new Date() : undefined;
        order.status = 'Confirmed';
        order.statusHistory.push({
            status: 'Confirmed',
            timestamp: new Date()
        });
        await order.save();

        // Clear user's cart
        await Cart.findOneAndUpdate(
            { user: req.user._id },
            { items: [], totalAmount: 0 }
        );

        // Emit socket event for admin notification
        const io = req.app.get('io');
        if (io) {
            // Emit properly structured order object for frontend
            io.emit('new_order', {
                _id: order._id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                customerEmail: order.customerEmail,
                items: order.items,
                subtotal: order.subtotal,
                deliveryFee: order.deliveryFee,
                discount: order.discount,
                totalAmount: order.totalAmount,
                status: order.status,
                isPaid: order.isPaid,
                paymentMethod: order.paymentMethod,
                deliveryAddress: order.deliveryAddress,
                createdAt: order.createdAt,
                user: order.user,
                payment: {
                    method: payment.method,
                    status: payment.status,
                    gatewayPaymentId: payment.gatewayPaymentId
                }
            });
        }

        // Send notification (SMS/WhatsApp) to admin
        notifyAdminNewOrder(order, payment).catch(err => {
            console.error('Notification error:', err);
        });

        res.status(201).json({
            success: true,
            message: 'Order placed successfully!',
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: payment.status,
                paymentId: payment.gatewayPaymentId
            }
        });
    } catch (error) {
        console.error('Payment/Order error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get payment details for an order
router.get('/order/:orderId', protect, async (req, res) => {
    try {
        const payment = await Payment.findOne({ order: req.params.orderId });
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json(payment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get user's payment history
router.get('/history', protect, async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id })
            .populate('order')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
