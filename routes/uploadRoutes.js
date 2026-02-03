const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');
const cloudinary = require('../config/cloudinary');
const Upload = require('../models/Upload');
const fs = require('fs');
const path = require('path');

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Private/Admin
router.post('/', protect, adminOnly, upload.single('image'), async (req, res) => {
    try {
        console.log('Upload Request Received');

        if (!req.file) {
            console.error('No file received by Multer');
            return res.status(400).json({ message: 'No image file provided' });
        }

        console.log('File received locally:', req.file);

        // Ensure path is absolute
        const localFilePath = path.resolve(req.file.path);
        console.log('Processing upload for file:', localFilePath);

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: 'food-delivery-app',
            resource_type: 'image'
        });

        console.log('Cloudinary Upload Success:', result);

        // Store in database
        const newUpload = new Upload({
            user: req.user._id,
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes
        });

        await newUpload.save();
        console.log('Database Record Saved:', newUpload._id);

        // Delete local file after successful upload
        fs.unlink(localFilePath, (err) => {
            if (err) {
                console.error('Failed to delete local file:', err);
            } else {
                console.log('Successfully deleted local file:', localFilePath);
            }
        });

        // Return the secure URL and db record
        res.status(200).json({
            message: 'Image uploaded successfully',
            imageUrl: result.secure_url,
            publicId: result.public_id,
            uploadId: newUpload._id
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
            error: error.message,
            stack: process.env.NODE_ENV === 'production' ? null : error.stack
        });
    }
});

module.exports = router;
