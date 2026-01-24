const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Food = require('../models/Food');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Get All Food Items
router.get('/', async (req, res) => {
    try {
        const foods = await Food.find({});
        res.json(foods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Upload Image
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add Food Item (Admin)
router.post('/', async (req, res) => {
    try {
        const { name, description, price, image, category, type } = req.body;
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
        const { name, description, price, image, category, type } = req.body;
        const food = await Food.findById(req.params.id);
        if (food) {
            food.name = name || food.name;
            food.description = description || food.description;
            food.price = price || food.price;
            food.image = image || food.image;
            food.category = category || food.category;
            food.type = type || food.type;
            const updatedFood = await food.save();
            res.json(updatedFood);
        } else {
            res.status(404).json({ message: 'Food not found' });
        }
    } catch (error) {
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
