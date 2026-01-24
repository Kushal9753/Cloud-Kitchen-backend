const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    paymentQrCode: {
        type: String,
        default: ''
    },
    upiId: {
        type: String,
        default: ''
    },
    receiverName: {
        type: String,
        default: ''
    },
    accountDetails: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Ensure only one config document exists
systemConfigSchema.statics.getConfig = async function () {
    const config = await this.findOne();
    if (config) return config;
    return await this.create({});
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
