const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

// Get all notifications for the logged-in user
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Get individual notifications for this user
        const individualNotifications = await Notification.find({
            receiver: userId,
            type: 'individual'
        })
            .populate('sender', 'name')
            .sort({ createdAt: -1 })
            .limit(50);

        // Get global notifications (that haven't been deleted by this user)
        const globalNotifications = await Notification.find({
            isGlobal: true,
            deletedBy: { $ne: userId }
        })
            .populate('sender', 'name')
            .sort({ createdAt: -1 })
            .limit(50);

        // Combine and format notifications
        const allNotifications = [
            ...individualNotifications.map(n => ({
                _id: n._id,
                message: n.message,
                type: n.type,
                sender: n.sender,
                isRead: n.isRead,
                createdAt: n.createdAt
            })),
            ...globalNotifications.map(n => ({
                _id: n._id,
                message: n.message,
                type: n.type,
                sender: n.sender,
                isRead: n.readBy.includes(userId),
                createdAt: n.createdAt
            }))
        ];

        // Sort by date
        allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(allNotifications.slice(0, 50));
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get unread notification count
router.get('/unread-count', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Count unread individual notifications
        const unreadIndividual = await Notification.countDocuments({
            receiver: userId,
            type: 'individual',
            isRead: false
        });

        // Count unread global notifications (not in readBy array AND not in deletedBy array)
        const unreadGlobal = await Notification.countDocuments({
            isGlobal: true,
            readBy: { $ne: userId },
            deletedBy: { $ne: userId }
        });

        res.json({ count: unreadIndividual + unreadGlobal });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: error.message });
    }
});

// Mark single notification as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.isGlobal) {
            // For global notifications, add user to readBy array
            if (!notification.readBy.includes(userId)) {
                notification.readBy.push(userId);
                await notification.save();
            }
        } else {
            // For individual notifications, check ownership
            if (notification.receiver.toString() !== userId.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }
            notification.isRead = true;
            await notification.save();
        }

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: error.message });
    }
});

// Mark all notifications as read
router.put('/read-all', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // Mark all individual notifications as read
        await Notification.updateMany(
            { receiver: userId, type: 'individual', isRead: false },
            { isRead: true }
        );

        // Add user to readBy array for all global notifications they haven't read
        const unreadGlobalNotifications = await Notification.find({
            isGlobal: true,
            readBy: { $ne: userId }
        });

        for (const notification of unreadGlobalNotifications) {
            notification.readBy.push(userId);
            await notification.save();
        }

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete a notification
router.delete('/:id', protect, async (req, res) => {
    try {
        const userId = req.user._id;
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (notification.isGlobal) {
            // Global: Add to deletedBy array for this user (Soft Delete)
            // Initialize deletedBy if it doesn't exist (for old records)
            if (!notification.deletedBy) {
                notification.deletedBy = [];
            }

            if (!notification.deletedBy.includes(userId)) {
                notification.deletedBy.push(userId);
                await notification.save();
            }
            return res.json({ message: 'Notification removed' });
        } else {
            // Individual: Verify ownership then Hard Delete
            if (notification.receiver.toString() !== userId.toString()) {
                return res.status(403).json({ message: 'Not authorized to delete this notification' });
            }

            await Notification.findByIdAndDelete(req.params.id);
            return res.json({ message: 'Notification deleted' });
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
