const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    let token;

    // Check for token in cookies or Authorization header
    if (req.cookies.jwt) {
        token = req.cookies.jwt;
        console.log('Token found in cookies');
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];
        console.log('Token found in Authorization header');
    } else {
        console.log('No token found. Cookies:', Object.keys(req.cookies || {}));
    }

    if (token) {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

            // Get user from token (exclude password)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'User not found' });
            }

            next();
        } catch (error) {
            console.error('Auth error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Admin only middleware (includes both admin and superadmin)
const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.isSuperAdmin)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as admin' });
    }
};

// Super Admin only middleware
const superAdminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'superadmin' || req.user.isSuperAdmin === true)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as super admin' });
    }
};

// User only middleware
const userOnly = (req, res, next) => {
    if (req.user && req.user.role === 'user') {
        next();
    } else {
        res.status(403).json({ message: 'This route is only accessible to regular users' });
    }
};

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '30d'
    });
};

module.exports = { protect, adminOnly, superAdminOnly, userOnly, generateToken };
