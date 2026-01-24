const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Review = require('../models/Review');
const { generateInvoicePDF, generateMonthlyReportData } = require('../services/invoiceService');

// ==================== REVENUE ANALYTICS ====================

// Get revenue data (daily/weekly/monthly)
router.get('/revenue', async (req, res) => {
    try {
        const { period = 'daily', days = 30 } = req.query;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        let groupBy;
        if (period === 'daily') {
            groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        } else if (period === 'weekly') {
            groupBy = { $week: '$createdAt' };
        } else {
            groupBy = { $month: '$createdAt' };
        }

        const revenueData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: 'Delivered',
                    isPaid: true
                }
            },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                    gst: { $sum: '$gstAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in missing dates with zero for daily view
        if (period === 'daily') {
            const filledData = [];
            const currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const existing = revenueData.find(d => d._id === dateStr);

                filledData.push({
                    date: dateStr,
                    revenue: existing?.revenue || 0,
                    orders: existing?.orders || 0,
                    gst: existing?.gst || 0
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return res.json(filledData);
        }

        res.json(revenueData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ORDER ANALYTICS ====================

// Get order status distribution
router.get('/orders', async (req, res) => {
    try {
        const statusCounts = await Order.aggregate([
            { $match: { isArchived: { $ne: true } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
        const totalOrders = await Order.countDocuments();
        const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
        const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });

        res.json({
            statusDistribution: statusCounts,
            todayOrders,
            totalOrders,
            deliveredOrders,
            cancelledOrders,
            deliveryRate: totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== TOP FOODS ANALYTICS ====================

// Get most sold food items
router.get('/top-foods', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const topFoods = await Order.aggregate([
            { $match: { status: 'Delivered' } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.food',
                    name: { $first: '$items.name' },
                    image: { $first: '$items.image' },
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json(topFoods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== TOP CUSTOMERS ANALYTICS ====================

// Get top customers by order value
router.get('/top-customers', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const topCustomers = await Order.aggregate([
            { $match: { status: 'Delivered', isPaid: true } },
            {
                $group: {
                    _id: '$user',
                    customerName: { $first: '$customerName' },
                    totalSpent: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: '$totalAmount' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    customerName: { $ifNull: [{ $arrayElemAt: ['$userDetails.name', 0] }, '$customerName'] },
                    email: { $arrayElemAt: ['$userDetails.email', 0] },
                    totalSpent: { $round: ['$totalSpent', 0] },
                    orderCount: 1,
                    avgOrderValue: { $round: ['$avgOrderValue', 0] }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json(topCustomers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== DASHBOARD SUMMARY ====================

// Get complete dashboard stats
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);

        const [
            totalOrders,
            todayOrders,
            monthOrders,
            totalRevenue,
            todayRevenue,
            monthRevenue,
            totalGST,
            avgRating,
            totalCustomers
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.countDocuments({ createdAt: { $gte: thisMonth } }),
            Order.aggregate([
                { $match: { status: 'Delivered', isPaid: true } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: today }, status: 'Delivered', isPaid: true } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: thisMonth }, status: 'Delivered', isPaid: true } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { status: 'Delivered', isPaid: true } },
                { $group: { _id: null, total: { $sum: '$gstAmount' } } }
            ]),
            Review.aggregate([
                { $group: { _id: null, avg: { $avg: '$overallRating' } } }
            ]),
            User.countDocuments({ role: 'user' })
        ]);

        res.json({
            totalOrders,
            todayOrders,
            monthOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            todayRevenue: todayRevenue[0]?.total || 0,
            monthRevenue: monthRevenue[0]?.total || 0,
            totalGST: totalGST[0]?.total || 0,
            avgRating: avgRating[0]?.avg?.toFixed(1) || 'N/A',
            totalCustomers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== INVOICE GENERATION ====================

// Download invoice for an order
router.get('/invoice/:orderId', async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId)
            .populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Generate invoice number if not exists
        if (!order.invoiceNumber) {
            const date = new Date();
            const year = date.getFullYear();
            const count = await Order.countDocuments({ invoiceNumber: { $exists: true, $ne: null } });
            order.invoiceNumber = `INV-${year}-${String(count + 1).padStart(6, '0')}`;

            // Calculate GST if not set
            if (!order.gstAmount) {
                const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                order.gstAmount = subtotal * 0.05; // 5% GST
                order.gstPercentage = 5;
            }

            await order.save();
        }

        const pdfDoc = generateInvoicePDF(order);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.invoiceNumber}.pdf`);

        pdfDoc.pipe(res);
        pdfDoc.end();
    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ message: error.message });
    }
});

// ==================== MONTHLY REPORT ====================

// Get monthly billing report
router.get('/reports/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;

        const queryMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const queryYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(queryYear, queryMonth, 1);
        const endDate = new Date(queryYear, queryMonth + 1, 0, 23, 59, 59);

        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: -1 });

        const reportData = generateMonthlyReportData(orders);

        res.json({
            period: {
                month: queryMonth + 1,
                year: queryYear,
                startDate,
                endDate
            },
            ...reportData,
            orders: orders.map(o => ({
                orderNumber: o.orderNumber,
                date: o.createdAt,
                customer: o.customerName,
                amount: o.totalAmount,
                gst: o.gstAmount || 0,
                status: o.status,
                isPaid: o.isPaid
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
