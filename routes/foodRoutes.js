const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Food = require('../models/Food');
const upload = require('../middleware/uploadMiddleware');
const cloudinary = require('../config/cloudinary');

// Get All Food Items (with optional category filter)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;

        // Build filter object
        const filter = {};
        if (category && category !== 'all') {
            filter.category = category;
        }

        const foods = await Food.find(filter);
        res.json(foods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Upload Image to Cloudinary
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        console.log('Food Image Upload Request Received');

        if (!req.file) {
            console.error('No file received by Multer');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('File received locally:', req.file);

        // Ensure path is absolute
        const localFilePath = path.resolve(req.file.path);
        console.log('Processing upload for file:', localFilePath);

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: 'food-delivery-app/food-items',
            resource_type: 'image'
        });

        console.log('Cloudinary Upload Success:', result);

        // Delete local file after successful upload
        fs.unlink(localFilePath, (err) => {
            if (err) {
                console.error('Failed to delete local file:', err);
            } else {
                console.log('Successfully deleted local file:', localFilePath);
            }
        });

        // Return the Cloudinary URL
        res.json({
            imageUrl: result.secure_url,
            publicId: result.public_id
        });

    } catch (error) {
        console.error('Upload Process Failed:', error);

        // Attempt to delete file if upload failed
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Failed to delete local file after error:', unlinkErr);
            });
        }

        res.status(500).json({
            message: 'Server error during upload',
            error: error.message
        });
    }
});

// Add Food Item (Admin)
router.post('/', async (req, res) => {
    try {
        const { name, description, price, image, category, type } = req.body;

        // STRICT VALIDATION: Reject local /uploads URLs
        if (image && image.includes('/uploads/')) {
            return res.status(400).json({
                message: 'Local image URLs are not allowed. Please upload images via the admin panel.'
            });
        }

        // STRICT VALIDATION: Enforce Cloudinary-only URLs (if image provided)
        if (image && image.trim() !== '' && !image.startsWith('https://res.cloudinary.com/')) {
            return res.status(400).json({
                message: 'Only Cloudinary image URLs are allowed. Please upload images via the admin panel.'
            });
        }

        const food = new Food({ name, description, price, image, category, type });
        const createdFood = await food.save();
        res.status(201).json(createdFood);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Food Item (Admin)
router.put('/:id', async (req, res) => {
    try {
        const { name, description, price, image, category, type, discountType, discountValue } = req.body;

        // STRICT VALIDATION: Reject local /uploads URLs
        if (image && image.includes('/uploads/')) {
            return res.status(400).json({
                message: 'Local image URLs are not allowed. Please upload images via the admin panel.'
            });
        }

        // STRICT VALIDATION: Enforce Cloudinary-only URLs (if image provided)
        if (image && image.trim() !== '' && !image.startsWith('https://res.cloudinary.com/')) {
            return res.status(400).json({
                message: 'Only Cloudinary image URLs are allowed. Please upload images via the admin panel.'
            });
        }

        const food = await Food.findById(req.params.id);
        if (food) {
            // Update fields if they are provided in the request
            if (name !== undefined) food.name = name;
            if (description !== undefined) food.description = description;
            if (price !== undefined) food.price = price;
            if (image !== undefined) food.image = image;
            if (category !== undefined) food.category = category;
            if (type !== undefined) food.type = type;

            // Update discount fields
            if (discountType !== undefined) food.discountType = discountType;
            if (discountValue !== undefined) food.discountValue = discountValue;

            const updatedFood = await food.save();
            res.json(updatedFood);
        } else {
            res.status(404).json({ message: 'Food not found' });
        }
    } catch (error) {
        console.error('Error updating food:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete Food Item (Admin)
router.delete('/:id', async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (food) {
            await food.deleteOne();
            res.json({ message: 'Food removed' });
        } else {
            res.status(404).json({ message: 'Food not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
