/**
 * Notification Service
 * Handles SMS and WhatsApp notifications to admin when new orders arrive
 * 
 * For production, integrate with:
 * - Twilio (SMS + WhatsApp): https://www.twilio.com
 * - MSG91 (Indian SMS): https://msg91.com
 * - Gupshup (WhatsApp): https://www.gupshup.io
 */

// Configure these in .env file
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+919876543210';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER;

/**
 * Format order message for notification
 */
const formatOrderMessage = (order, payment) => {
    const items = order.items?.map(i => `• ${i.name} × ${i.quantity}`).join('\n') || '';

    return `
📦 NEW ORDER RECEIVED!

Customer: ${order.customerName || 'N/A'}
Phone: ${order.customerPhone || order.deliveryAddress?.phone || 'N/A'}
Address: ${order.deliveryAddress?.fullAddress ||
        `${order.deliveryAddress?.addressLine1 || ''}, ${order.deliveryAddress?.city || ''}, ${order.deliveryAddress?.state || ''} - ${order.deliveryAddress?.pincode || ''}`}

Order Items:
${items}

Amount: ₹${order.totalAmount?.toFixed(2)}
Payment: ${payment?.status === 'Success' ? '✅ PAID' : '⏳ PENDING'} (${order.paymentMethod || 'N/A'})

Order ID: ${order.orderNumber || order._id}
Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
`.trim();
};

/**
 * Send SMS notification (using Twilio)
 */
const sendSMS = async (phone, message) => {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
        console.log('📱 SMS (Demo Mode):', message.substring(0, 100) + '...');
        return { success: true, demo: true };
    }

    try {
        const twilio = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
        const result = await twilio.messages.create({
            body: message,
            from: TWILIO_PHONE,
            to: phone
        });
        console.log('✅ SMS sent:', result.sid);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('❌ SMS failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send WhatsApp notification (using Twilio WhatsApp)
 */
const sendWhatsApp = async (phone, message) => {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WHATSAPP) {
        console.log('📲 WhatsApp (Demo Mode):', message.substring(0, 100) + '...');
        return { success: true, demo: true };
    }

    try {
        const twilio = require('twilio')(TWILIO_SID, TWILIO_TOKEN);
        const result = await twilio.messages.create({
            body: message,
            from: `whatsapp:${TWILIO_WHATSAPP}`,
            to: `whatsapp:${phone}`
        });
        console.log('✅ WhatsApp sent:', result.sid);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('❌ WhatsApp failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send notification to admin when new order is placed
 */
const notifyAdminNewOrder = async (order, payment) => {
    const message = formatOrderMessage(order, payment);

    console.log('\n' + '='.repeat(60));
    console.log('🔔 ADMIN NOTIFICATION - NEW ORDER');
    console.log('='.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\n');

    // Send both SMS and WhatsApp (in production)
    const results = await Promise.allSettled([
        sendSMS(ADMIN_PHONE, message),
        sendWhatsApp(ADMIN_PHONE, message)
    ]);

    return {
        sms: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        whatsapp: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason }
    };
};

module.exports = {
    formatOrderMessage,
    sendSMS,
    sendWhatsApp,
    notifyAdminNewOrder,
    ADMIN_PHONE
};
