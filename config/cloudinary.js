const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

// Debug logging for credentials (masking secrets)
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('Cloudinary Config Check:');
console.log('CLOUDINARY_CLOUD_NAME:', cloudName ? 'Present' : 'MISSING');
console.log('CLOUDINARY_API_KEY:', apiKey ? 'Present' : 'MISSING');
console.log('CLOUDINARY_API_SECRET:', apiSecret ? 'Present' : 'MISSING');

if (!cloudName || !apiKey || !apiSecret) {
    const errorMsg = 'FATAL ERROR: Cloudinary credentials are missing from .env file! Uploads will fail.';
    console.error(errorMsg);
    throw new Error(errorMsg);
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary;
