const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Food = require('../models/Food');
const { protect } = require('../middleware/auth');

// Get user's cart
router.get('/', protect, async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, items: [] });
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add item to cart
router.post('/add', protect, async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        // Find the product
        const product = await Food.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Find or create cart
        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            cart = new Cart({ user: req.user._id, items: [] });
        }

        // Check if item already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (existingItemIndex > -1) {
            // Update quantity
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            // Add new item
            cart.items.push({
                product: productId,
                name: product.name,
                price: product.price,
                quantity: quantity,
                image: product.image
            });
        }

        await cart.save();

        // Populate and return
        cart = await Cart.findById(cart._id).populate('items.product');
        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update item quantity
router.put('/update', protect, async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (quantity <= 0) {
            // Remove item if quantity is 0 or less
            cart.items.splice(itemIndex, 1);
        } else {
            cart.items[itemIndex].quantity = quantity;
        }

        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate('items.product');
        res.json(updatedCart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Remove item from cart
router.delete('/remove/:productId', protect, async (req, res) => {
    try {
        const { productId } = req.params;

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.items = cart.items.filter(
            item => item.product.toString() !== productId
        );

        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate('items.product');
        res.json(updatedCart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Clear cart
router.delete('/clear', protect, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
            cart.items = [];
            await cart.save();
        }
        res.json({ message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
