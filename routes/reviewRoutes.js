const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Food = require('../models/Food');

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
            console.log(`Updated ${rating.food} to avgRating: ${allRatings[0].avgRating}, count: ${allRatings[0].count}`);
        }
    }
};


// Submit a review for an order
router.post('/', async (req, res) => {
    try {
        const { orderId, foodRatings, deliveryRating, overallRating, comment } = req.body;

        // Check if order exists and is delivered
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Can only review delivered orders' });
        }

        if (order.hasReview) {
            return res.status(400).json({ message: 'Order already has a review' });
        }

        // Create review
        const review = new Review({
            order: orderId,
            user: order.user,
            foodRatings,
            deliveryRating,
            overallRating,
            comment
        });

        await review.save();

        // Mark order as reviewed
        order.hasReview = true;
        await order.save();

        // Update food average ratings
        await updateFoodRatings(foodRatings);

        res.status(201).json({ message: 'Review submitted successfully', review });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ message: error.message });
    }
});

// Submit individual food rating (for real-time rating updates)
router.post('/food-rating', async (req, res) => {
    try {
        const { foodId, rating, orderId } = req.body;

        // Validate input
        if (!foodId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Valid food ID and rating (1-5) are required' });
        }

        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }

        // Check if order exists and is delivered
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Can only rate food from delivered orders' });
        }

        // Check if food exists
        const food = await Food.findById(foodId);
        if (!food) {
            return res.status(404).json({ message: 'Food item not found' });
        }

        // Check if there's an existing review for this order
        let review = await Review.findOne({ order: orderId });

        if (review) {
            // Update existing review's food rating
            const existingRatingIndex = review.foodRatings.findIndex(
                fr => fr.food && fr.food.toString() === foodId.toString()
            );

            if (existingRatingIndex >= 0) {
                review.foodRatings[existingRatingIndex].rating = rating;
            } else {
                review.foodRatings.push({
                    food: foodId,
                    foodName: food.name,
                    rating: rating
                });
            }
            await review.save();
        } else {
            // For orders without a review, update the food rating directly
            // We calculate the new average including this rating
            const currentRating = food.avgRating || 0;
            const currentCount = food.ratingCount || 0;

            // Calculate new average
            const newCount = currentCount + 1;
            const newAvgRating = ((currentRating * currentCount) + rating) / newCount;

            // Update food directly
            await Food.findByIdAndUpdate(foodId, {
                avgRating: Math.round(newAvgRating * 10) / 10,
                ratingCount: newCount
            });

            // Return early with updated food stats
            return res.status(200).json({
                message: 'Rating submitted successfully',
                food: {
                    _id: food._id,
                    name: food.name,
                    avgRating: Math.round(newAvgRating * 10) / 10,
                    ratingCount: newCount
                }
            });
        }

        // Update food average rating using all ratings from reviews
        const foodObjectId = new mongoose.Types.ObjectId(foodId);
        const allRatings = await Review.aggregate([
            { $unwind: '$foodRatings' },
            { $match: { 'foodRatings.food': foodObjectId } },
            {
                $group: {
                    _id: '$foodRatings.food',
                    avgRating: { $avg: '$foodRatings.rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        let updatedFood;
        if (allRatings.length > 0) {
            updatedFood = await Food.findByIdAndUpdate(
                foodId,
                {
                    avgRating: Math.round(allRatings[0].avgRating * 10) / 10,
                    ratingCount: allRatings[0].count
                },
                { new: true }
            );
        }

        res.status(200).json({
            message: 'Rating submitted successfully',
            food: {
                _id: food._id,
                name: food.name,
                avgRating: updatedFood?.avgRating || rating,
                ratingCount: updatedFood?.ratingCount || 1
            }
        });
    } catch (error) {
        console.error('Error submitting food rating:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get review for a specific order
router.get('/order/:orderId', async (req, res) => {
    try {
        const review = await Review.findOne({ order: req.params.orderId })
            .populate('user', 'name')
            .populate('foodRatings.food', 'name image');

        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all reviews (Admin)
router.get('/admin/all', async (req, res) => {
    try {
        const { sortBy, order, rating, startDate, endDate } = req.query;

        let query = {};

        // Filter by rating
        if (rating) {
            query.overallRating = parseInt(rating);
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Sort options
        let sortOptions = { createdAt: -1 }; // Default: newest first
        if (sortBy === 'rating') {
            sortOptions = { overallRating: order === 'asc' ? 1 : -1 };
        } else if (sortBy === 'date') {
            sortOptions = { createdAt: order === 'asc' ? 1 : -1 };
        }

        const reviews = await Review.find(query)
            .populate('user', 'name email')
            .populate('order', 'orderNumber totalAmount')
            .populate('foodRatings.food', 'name')
            .sort(sortOptions);

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get best and worst rated dishes
router.get('/admin/dish-ratings', async (req, res) => {
    try {
        const dishRatings = await Review.aggregate([
            { $unwind: '$foodRatings' },
            {
                $group: {
                    _id: '$foodRatings.food',
                    foodName: { $first: '$foodRatings.foodName' },
                    avgRating: { $avg: '$foodRatings.rating' },
                    totalReviews: { $sum: 1 },
                    ratings: { $push: '$foodRatings.rating' }
                }
            },
            {
                $lookup: {
                    from: 'foods',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'foodDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    foodName: { $ifNull: [{ $arrayElemAt: ['$foodDetails.name', 0] }, '$foodName'] },
                    image: { $arrayElemAt: ['$foodDetails.image', 0] },
                    avgRating: { $round: ['$avgRating', 1] },
                    totalReviews: 1
                }
            },
            { $sort: { avgRating: -1 } }
        ]);

        const bestRated = dishRatings.slice(0, 5);
        const worstRated = [...dishRatings].sort((a, b) => a.avgRating - b.avgRating).slice(0, 5);

        res.json({ bestRated, worstRated, allDishes: dishRatings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get review statistics
router.get('/admin/stats', async (req, res) => {
    try {
        const totalReviews = await Review.countDocuments();
        const avgOverallRating = await Review.aggregate([
            { $group: { _id: null, avg: { $avg: '$overallRating' } } }
        ]);
        const avgDeliveryRating = await Review.aggregate([
            { $group: { _id: null, avg: { $avg: '$deliveryRating' } } }
        ]);

        const ratingDistribution = await Review.aggregate([
            { $group: { _id: '$overallRating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            totalReviews,
            avgOverallRating: avgOverallRating[0]?.avg?.toFixed(1) || 0,
            avgDeliveryRating: avgDeliveryRating[0]?.avg?.toFixed(1) || 0,
            ratingDistribution
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
