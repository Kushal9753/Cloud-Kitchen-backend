const express = require('express');
const router = express.Router();
const Address = require('../models/Address');
const { protect } = require('../middleware/auth');

// Get all addresses for user
router.get('/', protect, async (req, res) => {
    try {
        const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single address
router.get('/:id', protect, async (req, res) => {
    try {
        const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }
        res.json(address);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new address
router.post('/', protect, async (req, res) => {
    try {
        const { name, phone, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

        // Validate required fields
        if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
            return res.status(400).json({ message: 'Please fill all required fields' });
        }

        // If this is set as default, unset other defaults
        if (isDefault) {
            await Address.updateMany({ user: req.user._id }, { isDefault: false });
        }

        // Check if this is first address - make it default
        const addressCount = await Address.countDocuments({ user: req.user._id });

        const address = await Address.create({
            user: req.user._id,
            name,
            phone,
            addressLine1,
            addressLine2: addressLine2 || '',
            city,
            state,
            pincode,
            isDefault: isDefault || addressCount === 0
        });

        res.status(201).json(address);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update address
router.put('/:id', protect, async (req, res) => {
    try {
        const { name, phone, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

        const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // If setting as default, unset other defaults
        if (isDefault && !address.isDefault) {
            await Address.updateMany({ user: req.user._id }, { isDefault: false });
        }

        address.name = name || address.name;
        address.phone = phone || address.phone;
        address.addressLine1 = addressLine1 || address.addressLine1;
        address.addressLine2 = addressLine2 !== undefined ? addressLine2 : address.addressLine2;
        address.city = city || address.city;
        address.state = state || address.state;
        address.pincode = pincode || address.pincode;
        address.isDefault = isDefault !== undefined ? isDefault : address.isDefault;

        await address.save();
        res.json(address);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete address
router.delete('/:id', protect, async (req, res) => {
    try {
        const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        const wasDefault = address.isDefault;
        await Address.deleteOne({ _id: req.params.id });

        // If deleted address was default, set another as default
        if (wasDefault) {
            const anotherAddress = await Address.findOne({ user: req.user._id });
            if (anotherAddress) {
                anotherAddress.isDefault = true;
                await anotherAddress.save();
            }
        }

        res.json({ message: 'Address deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Set address as default
router.put('/:id/default', protect, async (req, res) => {
    try {
        // Unset all defaults
        await Address.updateMany({ user: req.user._id }, { isDefault: false });

        // Set this as default
        const address = await Address.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { isDefault: true },
            { new: true }
        );

        if (!address) {
            return res.status(404).json({ message: 'Address not found' });
        }

        res.json(address);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
