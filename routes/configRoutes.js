const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');

// GET config
router.get('/', async (req, res) => {
    try {
        const config = await SystemConfig.getConfig();
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// PUT config (Update settings)
router.put('/', async (req, res) => {
    try {
        const { paymentQrCode, upiId, receiverName, accountDetails } = req.body;
        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig();
        }

        config.paymentQrCode = paymentQrCode || config.paymentQrCode;
        config.upiId = upiId || config.upiId;
        config.receiverName = receiverName || config.receiverName;
        config.accountDetails = accountDetails || config.accountDetails;

        await config.save();
        res.json(config);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
