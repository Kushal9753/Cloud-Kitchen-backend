const express = require('express');
const router = express.Router();

// Delivery charge configuration
const DELIVERY_CONFIG = {
    freeDeliveryThreshold: 300,  // Free delivery for orders >= ₹300
    baseCharge: 30,              // Base delivery charge
    peakHourSurcharge: 10,       // Extra charge during peak hours
    peakHours: [
        { start: 12, end: 14 },  // Lunch: 12pm - 2pm
        { start: 19, end: 22 }   // Dinner: 7pm - 10pm
    ]
};

// Helper function to check if current time is peak hour
const isPeakHour = () => {
    const now = new Date();
    const currentHour = now.getHours();

    return DELIVERY_CONFIG.peakHours.some(
        period => currentHour >= period.start && currentHour < period.end
    );
};

// @route   POST /api/delivery/calculate
// @desc    Calculate delivery charge based on order value and time
router.post('/calculate', (req, res) => {
    try {
        const { orderValue } = req.body;

        if (orderValue === undefined) {
            return res.status(400).json({
                message: 'Order value is required'
            });
        }

        // Free delivery for orders >= threshold
        if (orderValue >= DELIVERY_CONFIG.freeDeliveryThreshold) {
            return res.json({
                deliveryCharge: 0,
                isFreeDelivery: true,
                message: 'Free delivery on orders above ₹' + DELIVERY_CONFIG.freeDeliveryThreshold
            });
        }

        // Calculate delivery charge
        let deliveryCharge = DELIVERY_CONFIG.baseCharge;
        const peakHour = isPeakHour();

        if (peakHour) {
            deliveryCharge += DELIVERY_CONFIG.peakHourSurcharge;
        }

        // Calculate how much more needed for free delivery
        const amountForFreeDelivery = DELIVERY_CONFIG.freeDeliveryThreshold - orderValue;

        res.json({
            deliveryCharge,
            isFreeDelivery: false,
            isPeakHour: peakHour,
            baseCharge: DELIVERY_CONFIG.baseCharge,
            peakSurcharge: peakHour ? DELIVERY_CONFIG.peakHourSurcharge : 0,
            amountForFreeDelivery: Math.round(amountForFreeDelivery),
            freeDeliveryThreshold: DELIVERY_CONFIG.freeDeliveryThreshold,
            message: peakHour
                ? `Delivery charge includes ₹${DELIVERY_CONFIG.peakHourSurcharge} peak hour surcharge`
                : 'Standard delivery charge'
        });
    } catch (error) {
        console.error('Error calculating delivery:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/delivery/config
// @desc    Get delivery configuration (for displaying info to users)
router.get('/config', (req, res) => {
    res.json({
        freeDeliveryThreshold: DELIVERY_CONFIG.freeDeliveryThreshold,
        baseCharge: DELIVERY_CONFIG.baseCharge,
        peakHourSurcharge: DELIVERY_CONFIG.peakHourSurcharge,
        peakHours: DELIVERY_CONFIG.peakHours,
        isPeakHour: isPeakHour()
    });
});

module.exports = router;
