const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// Place Order
router.post('/', async (req, res) => {
    try {
        const { orderItems, deliveryAddress, totalAmount, userId } = req.body;

        if (orderItems && orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        const order = new Order({
            user: userId, // In real app, get from req.user._id
            items: orderItems,
            totalAmount,
            deliveryAddress
        });

        const createdOrder = await order.save();

        // Emit socket event
        const io = req.app.get('io');
        io.emit('new_order', createdOrder);

        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get User Orders
router.get('/myorders/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get All Orders (Admin)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find({ isArchived: { $ne: true } }).populate('user', 'id name').sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Order Status (Admin)
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id);

        if (order) {
            order.status = status;
            const updatedOrder = await order.save();

            // Emit socket event
            const io = req.app.get('io');
            io.emit('order_status_updated', updatedOrder);

            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Archive Order (Soft Delete - Admin only)
// Order sirf archive hoga, permanently delete nahi hoga
router.put('/:id/archive', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Soft delete - archive the order
        order.isArchived = true;
        order.archivedAt = new Date();
        await order.save();

        // Emit socket event for real-time update
        const io = req.app.get('io');
        io.emit('order_archived', { orderId: req.params.id });

        res.json({ message: 'Order archived successfully', orderId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Order History (includes all orders including archived) - Admin
router.get('/history', async (req, res) => {
    try {
        const { period, status, startDate, endDate } = req.query;
        let query = {};

        // Date filter based on period
        const now = new Date();
        if (period === 'today') {
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            query.createdAt = { $gte: todayStart };
        } else if (period === '7days') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: weekAgo };
        } else if (period === '30days') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: monthAgo };
        } else if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('user', 'id name')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Order (Permanent Delete)
router.delete('/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Permanently delete the order
        await Order.findByIdAndDelete(req.params.id);

        res.json({ message: 'Order deleted successfully', orderId: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
