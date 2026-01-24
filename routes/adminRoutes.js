const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');

// Get all orders with filters (Admin)
router.get('/orders', protect, adminOnly, async (req, res) => {
    try {
        const { status, startDate, endDate, paymentStatus, search } = req.query;

        let query = { isArchived: { $ne: true } }; // Hide archived from active list

        // Filter by status
        if (status && status !== 'all') {
            query.status = status;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Filter by payment status
        if (paymentStatus === 'paid') {
            query.isPaid = true;
        } else if (paymentStatus === 'unpaid') {
            query.isPaid = false;
        }

        // Search by customer name, phone, or order number
        if (search) {
            query.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { orderNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .populate('payment')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get order by ID (Admin)
router.get('/orders/:id', protect, adminOnly, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('payment')
            .populate('items.food');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update order status (Admin)
router.put('/orders/:id/status', protect, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = status;
        order.statusHistory.push({
            status: status,
            timestamp: new Date(),
            updatedBy: req.user._id
        });

        // Mark as delivered if status is Delivered
        if (status === 'Delivered') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        }

        await order.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.emit('order_status_updated', order);
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get dashboard statistics (Admin)
router.get('/dashboard/stats', protect, adminOnly, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            totalOrders,
            todayOrders,
            pendingOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            todayRevenue,
            totalUsers
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.countDocuments({ status: 'Pending' }),
            Order.countDocuments({ status: 'Delivered' }),
            Order.countDocuments({ status: 'Cancelled' }),
            Order.aggregate([
                { $match: { isPaid: true } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: today }, isPaid: true } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            User.countDocuments({ role: 'user' })
        ]);

        res.json({
            totalOrders,
            todayOrders,
            pendingOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            todayRevenue: todayRevenue[0]?.total || 0,
            totalUsers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all users (Admin)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'user' })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all payments (Admin)
router.get('/payments', protect, adminOnly, async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('order', 'orderNumber totalAmount status')
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get order count by status (Admin)
router.get('/orders/count/by-status', protect, adminOnly, async (req, res) => {
    try {
        const counts = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            Pending: 0,
            Confirmed: 0,
            Preparing: 0,
            'Out for Delivery': 0,
            Delivered: 0,
            Cancelled: 0
        };

        counts.forEach(item => {
            result[item._id] = item.count;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Toggle user status (Admin)
router.put('/users/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Toggle status
        user.status = user.status === 'active' ? 'inactive' : 'active';
        await user.save();

        res.json({
            message: `User ${user.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            status: user.status
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send notification to specific user(s) (Admin)
router.post('/notifications/send', async (req, res) => {
    try {
        const { message, userIds } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Message is required' });
        }

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: 'At least one user must be selected' });
        }

        // Get the first admin user as sender
        const adminUser = await User.findOne({ role: 'admin' });
        const senderId = adminUser ? adminUser._id : null;
        const senderName = adminUser ? adminUser.name : 'Admin';

        const notifications = [];

        for (const userId of userIds) {
            const notification = new Notification({
                message: message.trim(),
                type: 'individual',
                sender: senderId,
                receiver: userId,
                isGlobal: false
            });
            await notification.save();
            notifications.push(notification);
        }

        // Emit socket event for real-time delivery
        const io = req.app.get('io');
        if (io) {
            for (const notification of notifications) {
                io.emit('notification_received', {
                    userId: notification.receiver.toString(),
                    notification: {
                        _id: notification._id,
                        message: notification.message,
                        type: notification.type,
                        sender: { name: senderName },
                        isRead: false,
                        createdAt: notification.createdAt
                    }
                });
            }
        }

        res.status(201).json({
            message: `Notification sent to ${notifications.length} user(s)`,
            count: notifications.length
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: error.message });
    }
});

// Broadcast notification to all users (Admin)
router.post('/notifications/broadcast', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // Get the first admin user as sender
        const adminUser = await User.findOne({ role: 'admin' });
        const senderId = adminUser ? adminUser._id : null;
        const senderName = adminUser ? adminUser.name : 'Admin';

        const notification = new Notification({
            message: message.trim(),
            type: 'global',
            sender: senderId,
            receiver: null,
            isGlobal: true,
            readBy: []
        });

        await notification.save();

        // Emit socket event for real-time delivery to all users
        const io = req.app.get('io');
        if (io) {
            io.emit('notification_broadcast', {
                notification: {
                    _id: notification._id,
                    message: notification.message,
                    type: notification.type,
                    sender: { name: senderName },
                    isRead: false,
                    createdAt: notification.createdAt
                }
            });
        }

        // Count total users for response
        const totalUsers = await User.countDocuments({ role: 'user' });

        res.status(201).json({
            message: `Broadcast sent to all ${totalUsers} users`,
            count: totalUsers
        });
    } catch (error) {
        console.error('Error broadcasting notification:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create new admin account (Admin only)
router.post('/create-admin', protect, adminOnly, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide name, email, and password' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create new admin user
        const adminUser = await User.create({
            name,
            email,
            password,
            role: 'admin'
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                _id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: error.message });
    }
});

// Change admin password (Admin only)
router.put('/change-password', protect, adminOnly, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide current and new password' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        // Get user with password (since protect middleware excludes it)
        const user = await User.findById(req.user._id);

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get all admin accounts (Super Admin only)
router.get('/admins', protect, superAdminOnly, async (req, res) => {
    try {
        const admins = await User.find({
            $or: [
                { role: 'admin' },
                { role: 'superadmin' },
                { isSuperAdmin: true }
            ]
        })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: error.message });
    }
});

// Create new admin account (Super Admin only)
router.post('/admins', protect, superAdminOnly, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide name, email, and password' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create new admin user
        const adminUser = await User.create({
            name,
            email,
            password,
            role: 'admin',
            isSuperAdmin: false,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                _id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role,
                isSuperAdmin: adminUser.isSuperAdmin,
                createdAt: adminUser.createdAt
            }
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete admin account (Super Admin only)
router.delete('/admins/:id', protect, superAdminOnly, async (req, res) => {
    try {
        const admin = await User.findById(req.params.id);

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // Prevent deletion of Super Admin account
        if (admin.isSuperAdmin === true || admin.role === 'superadmin') {
            return res.status(403).json({ message: 'Cannot delete Super Admin account' });
        }

        // Prevent deletion of non-admin accounts via this route
        if (admin.role !== 'admin') {
            return res.status(400).json({ message: 'This user is not an admin' });
        }

        await User.findByIdAndDelete(req.params.id);

        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;


