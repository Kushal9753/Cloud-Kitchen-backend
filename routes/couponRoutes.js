const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');

// @route   GET /api/coupons
// @desc    Get all coupons (admin)
router.get('/', async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/coupons
// @desc    Create a new coupon (admin)
router.post('/', async (req, res) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            validFrom,
            validTo,
            usageLimit,
            isActive
        } = req.body;

        // Check if coupon code already exists
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const coupon = new Coupon({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            minOrderValue: minOrderValue || 0,
            maxDiscount: maxDiscount || null,
            validFrom: validFrom || new Date(),
            validTo,
            usageLimit: usageLimit || null,
            isActive: isActive !== undefined ? isActive : true
        });

        await coupon.save();
        res.status(201).json(coupon);
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/coupons/:id
// @desc    Update a coupon (admin)
router.put('/:id', async (req, res) => {
    try {
        const {
            code,
            description,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscount,
            validFrom,
            validTo,
            usageLimit,
            isActive
        } = req.body;

        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        // If changing code, check if new code already exists
        if (code && code.toUpperCase() !== coupon.code) {
            const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
            if (existingCoupon) {
                return res.status(400).json({ message: 'Coupon code already exists' });
            }
            coupon.code = code.toUpperCase();
        }

        if (description !== undefined) coupon.description = description;
        if (discountType) coupon.discountType = discountType;
        if (discountValue !== undefined) coupon.discountValue = discountValue;
        if (minOrderValue !== undefined) coupon.minOrderValue = minOrderValue;
        if (maxDiscount !== undefined) coupon.maxDiscount = maxDiscount;
        if (validFrom) coupon.validFrom = validFrom;
        if (validTo) coupon.validTo = validTo;
        if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
        if (isActive !== undefined) coupon.isActive = isActive;

        await coupon.save();
        res.json(coupon);
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/coupons/:id
// @desc    Delete a coupon (admin)
router.delete('/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/coupons/validate
// @desc    Validate and calculate coupon discount (user)
router.post('/validate', async (req, res) => {
    try {
        const { code, orderValue } = req.body;

        if (!code || orderValue === undefined) {
            return res.status(400).json({
                valid: false,
                message: 'Coupon code and order value are required'
            });
        }

        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(404).json({
                valid: false,
                message: 'Coupon code not found'
            });
        }

        // Check validity
        const validationResult = coupon.isValid(orderValue);
        if (!validationResult.valid) {
            return res.status(400).json(validationResult);
        }

        // Calculate discount
        const discountAmount = coupon.calculateDiscount(orderValue);

        res.json({
            valid: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: Math.round(discountAmount),
                maxDiscount: coupon.maxDiscount
            }
        });
    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ valid: false, message: 'Server error' });
    }
});

// @route   POST /api/coupons/use/:id
// @desc    Increment usage count when coupon is used (called during order placement)
router.post('/use/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        coupon.usedCount += 1;
        await coupon.save();
        res.json({ message: 'Coupon usage recorded' });
    } catch (error) {
        console.error('Error recording coupon usage:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
