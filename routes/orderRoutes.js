const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Food = require('../models/Food');
const { protect } = require('../middleware/auth');

// Helper function to update food average rating
const updateFoodRatings = async (foodRatings) => {
    for (const rating of foodRatings) {
        if (!rating.food) continue;

        // Convert to ObjectId for proper matching
        const foodId = new mongoose.Types.ObjectId(rating.food);

        // Get all ratings for this food from reviews
        const allRatings = await Review.aggregate([
            { $unwind: '$foodRatings' },
            { $match: { 'foodRatings.food': foodId } },
            {
                $group: {
                    _id: '$foodRatings.food',
                    avgRating: { $avg: '$foodRatings.rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        if (allRatings.length > 0) {
            await Food.findByIdAndUpdate(rating.food, {
                avgRating: Math.round(allRatings[0].avgRating * 10) / 10,
                ratingCount: allRatings[0].count
            });
        }
    }
};

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

// Rate Order (User only - for delivered orders)
router.post('/:id/rate', protect, async (req, res) => {
    try {
        const { rating, reviewText } = req.body;

        // Validation: Rating must be between 1 and 5
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const order = await Order.findById(req.params.id);

        // Check if order exists
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user owns this order
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to rate this order' });
        }

        // Check if order is delivered
        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Can only rate delivered orders' });
        }

        // Check if already rated
        if (order.hasReview) {
            return res.status(400).json({ message: 'Order already rated' });
        }

        // Update rating
        // Create Review Document 
        // Map order items to foodRatings (applying overall rating to each item as default)
        const foodRatings = order.items.map(item => ({
            food: item.food,
            foodName: item.name,
            rating: rating,
            comment: reviewText
        }));

        const review = new Review({
            order: order._id,
            user: req.user._id,
            foodRatings: foodRatings,
            deliveryRating: rating, // Defaulting delivery rating to overall rating
            overallRating: rating,
            comment: reviewText
        });

        await review.save();
        await updateFoodRatings(foodRatings);

        // Update Order
        order.rating = rating;
        order.reviewText = reviewText || '';
        order.hasReview = true;
        order.ratedAt = Date.now();
        await order.save();

        // Emit socket event for real-time review updates (for Admin Reviews page)
        // We structure this to match what Reviews.jsx expects (Review model structure)
        const io = req.app.get('io');
        // Populate user and order data for the socket event
        const populatedReview = await Review.findById(review._id)
            .populate('user', 'name email')
            .populate('order', 'orderNumber totalAmount')
            .populate('foodRatings.food', 'name');

        io.emit('new_rating', populatedReview);

        res.status(200).json({
            message: 'Rating submitted successfully',
            order,
            review // Return the review as well
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
