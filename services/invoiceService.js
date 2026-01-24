const PDFDocument = require('pdfkit');

/**
 * Generate invoice PDF for an order
 * @param {Object} order - Order document with populated fields
 * @returns {PDFDocument} - PDF document stream
 */
const generateInvoicePDF = (order) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Company Info
    const companyName = 'FreshEats';
    const companyTagline = 'Fresh & Delicious Food Delivery';
    const companyAddress = 'Your City, India';
    const companyPhone = '+91 XXXXXXXXXX';
    const companyGSTIN = 'GSTIN: 00XXXXX0000X0XX';

    // Colors
    const primaryColor = '#10B981'; // Emerald
    const darkColor = '#1F2937';
    const grayColor = '#6B7280';

    // Header
    doc.fillColor(primaryColor)
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(companyName, 50, 50);

    doc.fillColor(grayColor)
        .fontSize(10)
        .font('Helvetica')
        .text(companyTagline, 50, 80);

    // Invoice Title
    doc.fillColor(darkColor)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('INVOICE', 400, 50, { align: 'right' });

    // Invoice Details Box
    doc.fillColor(grayColor)
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice #: ${order.invoiceNumber || 'N/A'}`, 400, 75, { align: 'right' })
        .text(`Order #: ${order.orderNumber}`, 400, 90, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })}`, 400, 105, { align: 'right' });

    // Horizontal line
    doc.moveTo(50, 130)
        .lineTo(545, 130)
        .strokeColor('#E5E7EB')
        .stroke();

    // Bill To Section
    doc.fillColor(primaryColor)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('BILL TO:', 50, 150);

    doc.fillColor(darkColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(order.customerName || 'Customer', 50, 170);

    doc.fillColor(grayColor)
        .fontSize(10)
        .font('Helvetica');

    if (order.deliveryAddress) {
        const addr = order.deliveryAddress;
        doc.text(addr.addressLine1 || '', 50, 185)
            .text(`${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`, 50, 200)
            .text(`Phone: ${order.customerPhone || addr.phone || 'N/A'}`, 50, 215);
    }

    // Items Table Header
    const tableTop = 260;
    doc.fillColor('#F3F4F6')
        .rect(50, tableTop, 495, 25)
        .fill();

    doc.fillColor(darkColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('ITEM', 60, tableTop + 8)
        .text('QTY', 320, tableTop + 8, { width: 50, align: 'center' })
        .text('PRICE', 380, tableTop + 8, { width: 70, align: 'right' })
        .text('TOTAL', 460, tableTop + 8, { width: 75, align: 'right' });

    // Items
    let y = tableTop + 35;
    doc.font('Helvetica');

    if (order.items && order.items.length > 0) {
        order.items.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;

            doc.fillColor(darkColor)
                .fontSize(10)
                .text(item.name, 60, y, { width: 250 })
                .text(item.quantity.toString(), 320, y, { width: 50, align: 'center' })
                .text(`₹${item.price.toFixed(0)}`, 380, y, { width: 70, align: 'right' })
                .text(`₹${itemTotal.toFixed(0)}`, 460, y, { width: 75, align: 'right' });

            y += 25;

            // Draw line after each item
            doc.moveTo(50, y - 5)
                .lineTo(545, y - 5)
                .strokeColor('#E5E7EB')
                .stroke();
        });
    }

    // Totals Section
    const totalsY = y + 20;

    // Subtotal
    doc.fillColor(grayColor)
        .fontSize(10)
        .text('Subtotal:', 380, totalsY, { width: 70, align: 'right' });
    doc.fillColor(darkColor)
        .text(`₹${(order.subtotal || order.totalAmount - (order.gstAmount || 0)).toFixed(0)}`, 460, totalsY, { width: 75, align: 'right' });

    // GST
    doc.fillColor(grayColor)
        .text(`GST (${order.gstPercentage || 5}%):`, 380, totalsY + 18, { width: 70, align: 'right' });
    doc.fillColor(darkColor)
        .text(`₹${(order.gstAmount || 0).toFixed(0)}`, 460, totalsY + 18, { width: 75, align: 'right' });

    // Delivery Fee
    doc.fillColor(grayColor)
        .text('Delivery:', 380, totalsY + 36, { width: 70, align: 'right' });
    doc.fillColor(primaryColor)
        .text(order.deliveryFee > 0 ? `₹${order.deliveryFee}` : 'FREE', 460, totalsY + 36, { width: 75, align: 'right' });

    // Total Box
    doc.fillColor(primaryColor)
        .rect(370, totalsY + 55, 175, 30)
        .fill();

    doc.fillColor('white')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('GRAND TOTAL:', 380, totalsY + 63, { width: 70, align: 'right' })
        .text(`₹${order.totalAmount.toFixed(0)}`, 460, totalsY + 63, { width: 75, align: 'right' });

    // Payment Info
    const paymentY = totalsY + 110;
    doc.fillColor(darkColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Payment Method:', 50, paymentY);

    doc.fillColor(grayColor)
        .font('Helvetica')
        .text(order.paymentMethod || 'COD', 150, paymentY);

    doc.fillColor(order.isPaid ? primaryColor : '#F59E0B')
        .font('Helvetica-Bold')
        .text(order.isPaid ? '✓ PAID' : '⏳ PENDING', 250, paymentY);

    // Footer
    const footerY = 750;
    doc.moveTo(50, footerY)
        .lineTo(545, footerY)
        .strokeColor('#E5E7EB')
        .stroke();

    doc.fillColor(grayColor)
        .fontSize(9)
        .font('Helvetica')
        .text('Thank you for ordering with FreshEats!', 50, footerY + 15, { align: 'center', width: 495 })
        .text(companyGSTIN, 50, footerY + 30, { align: 'center', width: 495 })
        .text('This is a computer generated invoice.', 50, footerY + 45, { align: 'center', width: 495 });

    return doc;
};

/**
 * Generate monthly report data
 * @param {Array} orders - Array of orders for the month
 * @returns {Object} - Report summary
 */
const generateMonthlyReportData = (orders) => {
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'Delivered');
    const paidOrders = orders.filter(o => o.isPaid);

    const totalRevenue = deliveredOrders
        .filter(o => o.isPaid)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const totalGST = deliveredOrders
        .filter(o => o.isPaid)
        .reduce((sum, o) => sum + (o.gstAmount || 0), 0);

    const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;

    return {
        totalOrders,
        deliveredOrders: deliveredOrders.length,
        cancelledOrders,
        paidOrders: paidOrders.length,
        totalRevenue,
        totalGST,
        netRevenue: totalRevenue - totalGST
    };
};

module.exports = {
    generateInvoicePDF,
    generateMonthlyReportData
};
