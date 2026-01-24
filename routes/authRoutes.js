const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await User.findOne({ email });

        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({ name, email, password });

        // Set cookie
        const token = generateToken(user._id, user.role);
        res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin || false,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin || false
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            const token = generateToken(user._id, user.role);
            res.cookie('jwt', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isSuperAdmin: user.isSuperAdmin || false,
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isSuperAdmin: user.isSuperAdmin || false
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.json({ message: 'Logged out successfully' });
});

// Get current user profile
router.get('/me', require('../middleware/auth').protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
