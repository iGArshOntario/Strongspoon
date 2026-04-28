const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { Resend } = require('resend');
const PDFDocument = require('pdfkit');

// Cache brand logo for email embedding
let LOGO_BASE64 = '';
try {
  LOGO_BASE64 = fs.readFileSync(path.join(__dirname, 'Ong.png')).toString('base64');
  console.log('✅ Brand logo loaded for emails');
} catch (e) {
  console.error('⚠️  Could not load brand logo for emails:', e.message);
}
const LOGO_IMG_TAG = `
  <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:36px;font-weight:900;color:#EFE8D8;letter-spacing:-0.5px;line-height:1;margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,0.25);">Strong Spoon</div>
  <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(239,232,216,0.75);letter-spacing:4px;text-transform:uppercase;margin-bottom:0;">High-Protein Dessert</div>
`;

// ─── PDF Invoice Generator ──────────────────────────────────────────────────
function generateInvoicePDF(orderData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const TEAL   = '#015A64';
      const DARK   = '#1a1a1a';
      const GREY   = '#666666';
      const LGREY  = '#f5f5f5';
      const WHITE  = '#EFE8D8';

      let items = [];
      try { items = JSON.parse(orderData.items || '[]'); } catch(e) {}

      const orderDate = new Date(orderData.created_at).toLocaleString('en-CA', {
        timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short'
      });

      // ── Header bar ──────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 110).fill(TEAL);

      doc.fillColor(WHITE)
         .font('Helvetica-Bold')
         .fontSize(30)
         .text('Strong Spoon', 50, 28, { align: 'left' });

      doc.fillColor('rgba(239,232,216,0.75)')
         .font('Helvetica')
         .fontSize(10)
         .text('HIGH-PROTEIN DESSERT · REGINA, SK', 50, 64);

      // INVOICE label on the right
      doc.fillColor(WHITE)
         .font('Helvetica-Bold')
         .fontSize(26)
         .text('INVOICE', 0, 32, { align: 'right', width: doc.page.width - 50 });

      doc.fillColor('rgba(239,232,216,0.85)')
         .font('Helvetica')
         .fontSize(10)
         .text(`# ${orderData.order_number}`, 0, 64, { align: 'right', width: doc.page.width - 50 });

      // ── Invoice meta info ────────────────────────────────────────────────
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('DATE', 50, 132);
      doc.fillColor(GREY).font('Helvetica').fontSize(9).text(orderDate, 50, 145);

      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('ORDER TYPE', 200, 132);
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
         .text((orderData.order_type || 'pickup').toUpperCase(), 200, 145);

      if (orderData.delivery_date) {
        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('DELIVERY DATE', 350, 132);
        doc.fillColor(GREY).font('Helvetica').fontSize(9)
           .text(`${orderData.delivery_date}`, 350, 145);
      }

      // ── Divider ──────────────────────────────────────────────────────────
      doc.moveTo(50, 170).lineTo(doc.page.width - 50, 170).strokeColor('#e0e0e0').lineWidth(1).stroke();

      // ── Bill To ──────────────────────────────────────────────────────────
      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(9).text('BILL TO', 50, 185);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text(orderData.customer_name || '', 50, 200);
      doc.fillColor(GREY).font('Helvetica').fontSize(9);
      let billY = 215;
      if (orderData.customer_email)   { doc.text(orderData.customer_email, 50, billY);   billY += 13; }
      if (orderData.customer_phone)   { doc.text(orderData.customer_phone, 50, billY);   billY += 13; }
      if (orderData.customer_address) { doc.text(orderData.customer_address, 50, billY); billY += 13; }

      // ── Items Table ──────────────────────────────────────────────────────
      const tableTop = Math.max(billY + 30, 285);
      const colItem  = 50;
      const colTopp  = 260;
      const colQty   = 380;
      const colPrice = 430;
      const colTotal = 490;

      // Table header
      doc.rect(50, tableTop, doc.page.width - 100, 22).fill(TEAL);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9);
      doc.text('ITEM',     colItem,  tableTop + 7, { width: 200 });
      doc.text('TOPPINGS', colTopp,  tableTop + 7, { width: 110 });
      doc.text('QTY',      colQty,   tableTop + 7, { width: 44, align: 'center' });
      doc.text('PRICE',    colPrice, tableTop + 7, { width: 54, align: 'right' });
      doc.text('TOTAL',    colTotal, tableTop + 7, { width: 60, align: 'right' });

      // Table rows
      let rowY = tableTop + 28;
      items.forEach((item, i) => {
        const toppings = (item.toppings || []).map(t => t.name || t).join(', ') || 'None';
        const price    = typeof item.price === 'number' ? item.price : parseFloat(item.price || 0);
        const qty      = item.quantity || 1;
        const lineTotal = (price * qty).toFixed(2);

        const bg = i % 2 === 0 ? WHITE : LGREY;
        doc.rect(50, rowY - 4, doc.page.width - 100, 26).fill(bg);

        doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(item.name || 'Item', colItem, rowY, { width: 200 });
        doc.fillColor(GREY).font('Helvetica').fontSize(8).text(toppings, colTopp, rowY, { width: 110 });
        doc.fillColor(DARK).font('Helvetica').fontSize(9).text(String(qty), colQty, rowY, { width: 44, align: 'center' });
        doc.text(`$${price.toFixed(2)}`, colPrice, rowY, { width: 54, align: 'right' });
        doc.font('Helvetica-Bold').text(`$${lineTotal}`, colTotal, rowY, { width: 60, align: 'right' });

        rowY += 30;
      });

      // ── Totals ───────────────────────────────────────────────────────────
      rowY += 10;
      doc.rect(50, rowY, doc.page.width - 100, 1).fill('#e0e0e0');
      rowY += 14;

      doc.rect(doc.page.width - 210, rowY - 4, 160, 34).fill(TEAL);
      doc.fillColor(WHITE).font('Helvetica').fontSize(10)
         .text('TOTAL PAID (CAD)', doc.page.width - 210, rowY, { width: 160, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(16)
         .text(`$${orderData.total_amount}`, doc.page.width - 210, rowY + 14, { width: 160, align: 'center' });

      // ── Footer ───────────────────────────────────────────────────────────
      const footerY = doc.page.height - 70;
      doc.rect(0, footerY, doc.page.width, 70).fill(DARK);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
         .text('Strong Spoon', 50, footerY + 18);
      doc.fillColor(GREY).font('Helvetica').fontSize(8)
         .text('Regina, SK · strongspoon.ca · orders@resend.dev', 50, footerY + 32)
         .text('Thank you for your order!', 50, footerY + 46);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
// ────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`🚀 Starting Strong Spoon server...`);
console.log(`📌 PORT environment variable: ${process.env.PORT || 'not set, using 5000'}`);
console.log(`📌 DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
console.log(`📌 STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'NOT SET'}`);

// Initialize Stripe with error handling
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  } else {
    console.warn('⚠️ STRIPE_SECRET_KEY not set - payment processing disabled');
  }
} catch (err) {
  console.error('❌ Failed to initialize Stripe:', err.message);
}

// PostgreSQL connection pool with error handling
let pool = null;
try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    console.log('✅ Database pool created');
  } else {
    console.error('❌ DATABASE_URL not set - database features disabled');
  }
} catch (err) {
  console.error('❌ Failed to create database pool:', err.message);
}

// Resend email client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️ RESEND_API_KEY not set - email confirmations disabled');
} else {
  console.log('✅ Resend email service initialized');
}

// Owner alert email
const OWNER_EMAIL = 'Strongspoon.ca@gmail.com';

// Sender address — set RESEND_FROM_EMAIL secret once your domain is verified in Resend.
// Without it, Resend's test domain only delivers to your own account email.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Strong Spoon <orders@resend.dev>';

async function sendOwnerAlertEmail(orderData) {
  if (!resend) return { success: false };
  try {
    const items = JSON.parse(orderData.items || '[]');
    const orderType = (orderData.order_type || 'delivery').toUpperCase();
    const itemLines = items.map(i => {
      const toppingStr = (i.toppings && i.toppings.length) ? i.toppings.map(t => t.name).join(', ') : 'No toppings';
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;">${i.name} x${i.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#666;">${toppingStr}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Order</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <!-- Header -->
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">New Order Received</div>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px 0 0;">

        <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1a1a1a;">🛎 Order #${orderData.order_number}</p>

        <!-- Order info -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Order Details</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              <strong>Type:</strong> ${orderType}<br>
              <strong>Total:</strong> $${orderData.total_amount} CAD
            </div>
          </td></tr>
        </table>

        <!-- Customer info -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Customer</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              👤 ${orderData.customer_name}<br>
              📧 ${orderData.customer_email}<br>
              📞 ${orderData.customer_phone || '—'}<br>
              📍 ${orderData.customer_address || 'Regina, SK'}
            </div>
          </td></tr>
        </table>

        ${orderData.delivery_date ? `
        <!-- Delivery schedule -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Scheduled Delivery</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              📅 ${orderData.delivery_date}
            </div>
          </td></tr>
        </table>
        ` : ''}

        <!-- Items -->
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Items Ordered</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 24px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Item</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Toppings</th>
            </tr>
          </thead>
          <tbody>${itemLines}</tbody>
        </table>

        <p style="margin:0 0 32px;font-size:17px;font-weight:700;color:#013e4a;">Total: $${orderData.total_amount} CAD</p>

      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:24px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      subject: `🛎 New Order #${orderData.order_number} — $${orderData.total_amount} CAD`,
      html
    });
    console.log('✅ Owner alert email sent to:', OWNER_EMAIL);
    return { success: true };
  } catch (err) {
    console.error('❌ Owner alert email error:', err.message);
    return { success: false, error: err.message };
  }
}

function getCurrentPrice() {
  const now = Date.now();
  const launchStart = new Date('2026-04-10T08:00:00-05:00').getTime();
  const launchEnd   = new Date('2026-04-11T08:00:00-05:00').getTime();
  return (now >= launchStart && now < launchEnd) ? 7.00 : 12.99;
}
// PRODUCT_PRICE is called per-request via getCurrentPrice() to handle live pricing changes
const PRODUCT_SIZE = '250g';

// Email sending function
async function sendOrderConfirmation(orderData) {
  if (!resend) {
    console.warn('Email service not configured - skipping confirmation email');
    return { success: false, reason: 'No email service' };
  }

  try {
    const items = JSON.parse(orderData.items);
    
    // Build items list HTML
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;font-weight:700;">${item.name} ×${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#666;">${item.toppings && item.toppings.length > 0 ? item.toppings.map(t => t.name).join(', ') : 'No toppings'}</td>
      </tr>
    `).join('');

    const emailHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Confirmed</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Order Confirmed ✓</div>
      </td></tr>

      <tr><td style="padding:28px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi ${orderData.customer_name}!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">Your order has been confirmed and will be prepared shortly. Thank you for choosing Strong Spoon!</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Order Reference</div>
            <div style="font-size:16px;font-weight:700;color:#1a1a1a;">#${orderData.order_number}</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">📅 ${new Date(orderData.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' })}</div>
          </td></tr>
        </table>

        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Items Ordered</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 20px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Item</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Toppings</th>
          </tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>

        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#013e4a;">Total Paid: $${orderData.total_amount} CAD</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Your Details</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              👤 ${orderData.customer_name}<br>
              📧 ${orderData.customer_email}<br>
              ${orderData.customer_phone ? `📞 ${orderData.customer_phone}<br>` : ''}
              ${orderData.customer_address ? `📍 ${orderData.customer_address}` : ''}
            </div>
          </td></tr>
        </table>

        ${orderData.order_type === 'delivery' ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#f5fafa;border:1px solid #e0eeee;border-radius:10px;padding:18px 20px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#555;">Need to change your delivery date?</p>
            <a href="https://strongspoon.ca/manage-order.html?order=${encodeURIComponent(orderData.order_number)}&email=${encodeURIComponent(orderData.customer_email)}"
               style="display:inline-block;background:#015A64;color:#ffffff;text-decoration:none;padding:11px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-top:4px;">
              📅 Manage My Order
            </a>
          </td></tr>
        </table>
        ` : ''}

        <p style="margin:0;font-size:14px;color:#555;">Questions? Simply reply to this email and we'll get back to you.</p>
      </td></tr>

      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    // Generate PDF invoice
    let pdfAttachments = [];
    try {
      const pdfBuffer = await generateInvoicePDF(orderData);
      pdfAttachments = [{
        filename: `StrongSpoon-Invoice-${orderData.order_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }];
      console.log('✅ PDF invoice generated');
    } catch (pdfErr) {
      console.error('⚠️ PDF generation failed (sending email without PDF):', pdfErr.message);
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [orderData.customer_email],
      subject: `Order Confirmed ✓ — ${orderData.order_number}`,
      html: emailHTML,
      attachments: pdfAttachments,
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error };
    }

    console.log('✅ Order confirmation email sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('Error in sendOrderConfirmation:', error);
    return { success: false, error: error.message };
  }
}

// Delivery notification email function with proof photo
async function sendDeliveryNotification(orderData, deliveryProof, deliveryPerson) {
  if (!resend) {
    console.warn('Email service not configured - skipping delivery notification');
    return { success: false, reason: 'No email service' };
  }

  try {
    let items = [];
    try {
      items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]');
    } catch (e) {
      items = [];
    }

    // Use actual delivered_at from database, fallback to now
    const deliveredAtDate = orderData.delivered_at ? new Date(orderData.delivered_at) : new Date();
    const deliveredAt = deliveredAtDate.toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      dateStyle: 'long',
      timeStyle: 'short'
    });

    // Build items list HTML
    const itemsHTML = items.map(item => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;font-weight:700;">${item.name || 'Item'} ×${item.quantity || 1}</td>
      </tr>
    `).join('');

    // Prepare the proof image as an inline attachment
    let attachments = [];
    let proofImageHTML = '';
    
    if (deliveryProof && deliveryProof.startsWith('data:image/')) {
      const matches = deliveryProof.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const base64Data = matches[2];
        const extension = contentType.split('/')[1] || 'jpeg';
        const imageBuffer = Buffer.from(base64Data, 'base64');
        attachments = [{
          filename: `delivery-proof.${extension}`,
          content: imageBuffer,
          contentType: contentType,
          cid: 'deliveryproof'
        }];
        proofImageHTML = `
          <p style="margin:20px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">📷 Proof of Delivery</p>
          <img src="cid:deliveryproof" alt="Delivery Proof" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid #e8e8e8;" />
        `;
      }
    }

    const emailHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Order Has Arrived</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Your Order Has Arrived!</div>
      </td></tr>

      <tr><td style="padding:28px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi ${orderData.customer_name}!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">🎉 Great news — your Strong Spoon order has been delivered. Enjoy every spoonful!</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Delivery Info</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              📦 <strong>Order:</strong> ${orderData.order_number}<br>
              🕐 <strong>Delivered:</strong> ${deliveredAt}<br>
              🚚 <strong>By:</strong> ${deliveryPerson}
            </div>
          </td></tr>
        </table>

        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Your Items</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 20px;">
          <tbody>${itemsHTML}</tbody>
        </table>

        ${proofImageHTML}

        <p style="margin:24px 0 0;font-size:14px;color:#555;">Questions about your delivery? Simply reply to this email and we'll get back to you.</p>
      </td></tr>

      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

    const emailOptions = {
      from: FROM_EMAIL,
      to: [orderData.customer_email],
      subject: `✅ Delivered! Your Order ${orderData.order_number} Has Arrived`,
      html: emailHTML,
    };

    // Add attachments if we have the proof image
    if (attachments.length > 0) {
      emailOptions.attachments = attachments;
    }

    const { data, error } = await resend.emails.send(emailOptions);

    if (error) {
      console.error('Error sending delivery notification:', error);
      return { success: false, error };
    }

    console.log('✅ Delivery notification email sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (error) {
    console.error('Error in sendDeliveryNotification:', error);
    return { success: false, error: error.message };
  }
}

// ── Reschedule confirmation email ─────────────────────────────────────────
async function sendRescheduleEmail(orderData, newDate, newSlot) {
  if (!resend) return { success: false, reason: 'No email service' };
  try {
    let items = [];
    try { items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]'); } catch (e) {}
    const itemsHTML = items.map(item => `
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;font-weight:700;">${item.name || 'Item'} ×${item.quantity || 1}</td></tr>
    `).join('');
    const formattedDate = new Date(newDate + 'T12:00:00').toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const emailHTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Delivery Rescheduled</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Delivery Rescheduled</div>
      </td></tr>
      <tr><td style="padding:28px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi ${orderData.customer_name}!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">Your delivery date has been updated. Here are your new delivery details:</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Updated Delivery Info</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              📦 <strong>Order:</strong> ${orderData.order_number}<br>
              📅 <strong>New Date:</strong> ${formattedDate}<br>
              📍 <strong>Address:</strong> ${orderData.customer_address || 'On file'}
            </div>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Your Items</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 20px;"><tbody>${itemsHTML}</tbody></table>
        <p style="margin:24px 0 0;font-size:14px;color:#555;">Questions? Simply reply to this email and we'll get back to you right away.</p>
      </td></tr>
      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [orderData.customer_email],
      subject: `📅 Your Delivery Has Been Rescheduled — ${orderData.order_number}`,
      html: emailHTML
    });
    if (error) { console.error('Reschedule email error:', error); return { success: false, error }; }
    console.log('✅ Reschedule email sent:', data.id);
    return { success: true, emailId: data.id };
  } catch (err) {
    console.error('sendRescheduleEmail error:', err);
    return { success: false, error: err.message };
  }
}

// ── 24-hour delivery reminder email ──────────────────────────────────────────
async function sendDeliveryReminderEmail(orderData) {
  if (!resend) return { success: false, reason: 'No email service' };
  try {
    let items = [];
    try { items = Array.isArray(orderData.items) ? orderData.items : JSON.parse(orderData.items || '[]'); } catch (e) {}
    const itemsHTML = items.map(item => `
      <tr><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;font-weight:700;">${item.name || 'Item'} ×${item.quantity || 1}</td></tr>
    `).join('');
    const formattedDate = new Date(orderData.delivery_date + 'T12:00:00').toLocaleDateString('en-CA', { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const emailHTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Delivery Tomorrow</title></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Your Delivery Is Coming Tomorrow!</div>
      </td></tr>
      <tr><td style="padding:28px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi ${orderData.customer_name}!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">Just a friendly reminder — your Strong Spoon order is arriving <strong>tomorrow</strong>. Make sure someone is available to receive it!</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Delivery Details</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              📦 <strong>Order:</strong> ${orderData.order_number}<br>
              📅 <strong>Date:</strong> ${formattedDate}<br>
              📍 <strong>Address:</strong> ${orderData.customer_address || 'On file'}
            </div>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Your Order</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 20px;"><tbody>${itemsHTML}</tbody></table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
          <tr><td style="background:#f5fafa;border:1px solid #e0eeee;border-radius:10px;padding:18px 20px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#555;">Need to change your delivery date?</p>
            <a href="https://strongspoon.ca/manage-order.html?order=${encodeURIComponent(orderData.order_number)}&email=${encodeURIComponent(orderData.customer_email)}"
               style="display:inline-block;background:#015A64;color:#ffffff;text-decoration:none;padding:11px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-top:6px;">
              📅 Manage My Order
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [orderData.customer_email],
      subject: `🚚 Reminder: Your Strong Spoon Delivery Is Tomorrow — ${orderData.order_number}`,
      html: emailHTML
    });
    if (error) { console.error('Reminder email error:', error); return { success: false, error }; }
    console.log('✅ Delivery reminder sent to', orderData.customer_email);
    return { success: true, emailId: data.id };
  } catch (err) {
    console.error('sendDeliveryReminderEmail error:', err);
    return { success: false, error: err.message };
  }
}

// ── 24-hour delivery reminder cron (runs every 30 min) ───────────────────────
setInterval(async () => {
  try {
    const result = await pool.query(`
      SELECT * FROM orders
      WHERE order_type = 'delivery'
        AND order_status != 'delivered'
        AND reminder_sent = FALSE
        AND delivery_date IS NOT NULL
        AND created_at < (NOW() - INTERVAL '12 hours')
        AND delivery_date::timestamp AT TIME ZONE 'America/Toronto'
            BETWEEN (NOW() AT TIME ZONE 'America/Toronto' + INTERVAL '20 hours')
                AND (NOW() AT TIME ZONE 'America/Toronto' + INTERVAL '26 hours')
    `);
    for (const order of result.rows) {
      const emailResult = await sendDeliveryReminderEmail(order);
      if (emailResult.success) {
        await pool.query('UPDATE orders SET reminder_sent = TRUE WHERE id = $1', [order.id]);
        console.log(`✅ 24h reminder sent for order ${order.order_number}`);
      }
    }
  } catch (err) {
    console.error('Reminder cron error:', err.message);
  }
}, 30 * 60 * 1000);

const PRODUCTS = {
  'brownie': {
    id: 'brownie',
    name: 'Brownie Issues',
    get price() { return getCurrentPrice(); },
    size: PRODUCT_SIZE
  },
  'powerMix': {
    id: 'powerMix',
    name: 'Power Mix',
    get price() { return getCurrentPrice(); },
    size: PRODUCT_SIZE
  },
  'goldenScoop': {
    id: 'goldenScoop',
    name: 'Golden Scoop',
    get price() { return getCurrentPrice(); },
    size: PRODUCT_SIZE
  },
  'spoonCrumble': {
    id: 'spoonCrumble',
    name: 'Spoon Crumble',
    get price() { return getCurrentPrice(); },
    size: PRODUCT_SIZE
  }
};

const TOPPINGS = {
  'almonds':       { name: 'Almonds',       price: 0 },
  'cashews':       { name: 'Cashews',       price: 0 },
  'peanuts':       { name: 'Peanuts',       price: 0 },
  'raisins':       { name: 'Raisins',       price: 0 },
  'walnut':        { name: 'Walnut',        price: 0 },
  'apple':         { name: 'Apple',         price: 0 },
  'blueberries':   { name: 'Blueberries',   price: 0 },
  'nutty-crumble': { name: 'Nutty Crumble', price: 0, freeTill: '2026-05-10' }
};
// Toppings that are complimentary (don't trigger $1 fee) within their free window
const NUTTY_CRUMBLE_FREE_TILL = new Date('2026-05-10T23:59:59-05:00');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// Create waitlist table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('Waitlist table error:', err));

// Create page_views table for traffic tracking
pool.query(`
  CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    page VARCHAR(255),
    path VARCHAR(500),
    referrer VARCHAR(500),
    viewed_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('Page views table error:', err));

// Add reminder_sent column if it doesn't exist
pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE`)
  .catch(err => console.error('reminder_sent column error:', err));

// Create promo_codes table
pool.query(`
  CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('flat','percent')),
    value NUMERIC(8,2) NOT NULL,
    min_spend TEXT,
    max_uses INTEGER DEFAULT NULL,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('Promo codes table error:', err));

// Add min_spend column if it doesn't exist (safe migration for existing tables)
pool.query(`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_spend TEXT`)
  .catch(err => console.error('Promo min_spend migration error:', err));

// Create app_settings table
pool.query(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
  )
`).catch(err => console.error('App settings table error:', err));

// Create feedback table
pool.query(`
  CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    flavor VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('Feedback table error:', err));

// Waitlist signup
app.post('/waitlist', async (req, res) => {
  try {
    const { name, city } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'Name and city required' });
    await pool.query('INSERT INTO waitlist (name, city) VALUES ($1, $2)', [name.trim(), city.trim()]);
    res.json({ success: true });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ─── Traffic Tracking ───────────────────────────────────────────────────────

// Record a page view (public, no auth)
app.post('/api/track', async (req, res) => {
  try {
    const { page, path, referrer } = req.body;
    await pool.query(
      'INSERT INTO page_views (page, path, referrer) VALUES ($1, $2, $3)',
      [
        (page || 'Unknown').substring(0, 255),
        (path || '/').substring(0, 500),
        (referrer || '').substring(0, 500)
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get traffic data (admin only)
app.get('/admin/traffic', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
  const password = decoded.split(':')[1];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const range = req.query.range || '7d';
  let where = '';
  if      (range === '1d')  where = "WHERE viewed_at > NOW() - INTERVAL '24 hours'";
  else if (range === '7d')  where = "WHERE viewed_at > NOW() - INTERVAL '7 days'";
  else if (range === '30d') where = "WHERE viewed_at > NOW() - INTERVAL '30 days'";

  try {
    const [totalRes, todayRes, topPagesRes, hourlyRes, referrersRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total FROM page_views ${where}`),
      pool.query(`SELECT COUNT(*) AS count FROM page_views WHERE viewed_at > NOW() - INTERVAL '24 hours'`),
      pool.query(`SELECT page, COUNT(*) AS count FROM page_views ${where} GROUP BY page ORDER BY count DESC LIMIT 10`),
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('hour', viewed_at AT TIME ZONE 'America/Toronto'), 'HH12AM') AS hr,
               COUNT(*) AS count
        FROM page_views
        WHERE viewed_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', viewed_at AT TIME ZONE 'America/Toronto')
        ORDER BY DATE_TRUNC('hour', viewed_at AT TIME ZONE 'America/Toronto')
      `),
      pool.query(`SELECT referrer, COUNT(*) AS count FROM page_views ${where ? where + " AND referrer != ''" : "WHERE referrer != ''"} GROUP BY referrer ORDER BY count DESC LIMIT 5`)
    ]);

    res.json({
      total:     parseInt(totalRes.rows[0].total),
      today:     parseInt(todayRes.rows[0].count),
      topPages:  topPagesRes.rows,
      hourly:    hourlyRes.rows,
      referrers: referrersRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Feedback API ───────────────────────────────────────────────────────────

// Submit feedback (public)
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, rating, comment, flavor } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1–5 required' });
    const result = await pool.query(
      `INSERT INTO feedback (name, email, rating, comment, flavor, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, created_at`,
      [name?.trim() || null, email?.trim() || null, rating, comment?.trim() || null, flavor?.trim() || null]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Feedback submit error:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Public: get featured reviews (4–5 stars, max 10, newest first)
app.get('/api/feedback/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, rating, comment, flavor, created_at
       FROM feedback WHERE rating >= 4
       ORDER BY created_at DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Feedback featured error:', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Admin: get all feedback (requires ADMIN_PASSWORD)
app.get('/admin/feedback', async (req, res) => {
  const auth = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!auth || auth !== `Bearer ${adminPassword}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT id, name, email, rating, comment, flavor, created_at
       FROM feedback ORDER BY created_at DESC`
    );
    res.json({ feedback: result.rows });
  } catch (err) {
    console.error('Admin feedback error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Root endpoint for deployment health checks
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Health check endpoint for deployment verification
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: PORT,
    services: {
      stripe: stripe ? 'configured' : 'not configured',
      database: 'checking...',
      email: resend ? 'configured' : 'not configured'
    }
  };
  
  // Test database connection
  if (pool) {
    try {
      await pool.query('SELECT 1');
      health.services.database = 'connected';
    } catch (err) {
      health.services.database = 'error: ' + err.message;
      health.status = 'degraded';
    }
  } else {
    health.services.database = 'not configured';
    health.status = 'degraded';
  }
  
  res.json(health);
});

app.get('/get-stripe-key', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

// ── Public: validate promo code ──────────────────────────────────────────────
app.post('/api/validate-promo', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });
    const result = await pool.query(
      `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND active = TRUE`, [code.trim()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid promo code' });
    const promo = result.rows[0];
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ error: 'This promo code has reached its usage limit' });
    }
    // Check minimum spend requirement
    const minSpend = promo.min_spend ? parseFloat(promo.min_spend) : null;
    if (minSpend !== null && subtotal !== undefined) {
      const cartTotal = parseFloat(subtotal) || 0;
      if (cartTotal < minSpend) {
        const gap = (minSpend - cartTotal).toFixed(2);
        return res.status(400).json({
          error: `Spend $${minSpend.toFixed(2)} to unlock this code — add $${gap} more`,
          min_spend: minSpend,
          subtotal: cartTotal
        });
      }
    }
    res.json({
      valid: true,
      type: promo.type,
      value: parseFloat(promo.value),
      code: promo.code,
      min_spend: minSpend
    });
  } catch (err) {
    console.error('Promo validate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Public: daily order cap status ───────────────────────────────────────────
app.get('/api/order-status', async (req, res) => {
  try {
    const capRow = await pool.query(`SELECT value FROM app_settings WHERE key = 'daily_order_cap'`);
    const cap = capRow.rows.length ? parseInt(capRow.rows[0].value) : 0;
    if (!cap || cap === 0) return res.json({ capped: false, cap: 0, today: 0 });
    const todayRow = await pool.query(
      `SELECT COUNT(*) AS count FROM orders WHERE created_at >= NOW()::date AND order_status != 'test'`
    );
    const today = parseInt(todayRow.rows[0].count);
    res.json({ capped: today >= cap, cap, today });
  } catch (err) {
    console.error('Order status error:', err);
    res.json({ capped: false });
  }
});

// ── Admin: app settings ───────────────────────────────────────────────────────
function requireAdmin(req, res) {
  if (!ADMIN_PASSWORD) { res.status(503).json({ error: 'Admin not configured' }); return false; }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).json({ error: 'Authentication required' }); return false;
  }
  const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  if (username !== 'admin' || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid credentials' }); return false;
  }
  return true;
}

app.get('/admin/settings', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: 'Failed to load settings' }); }
});

app.post('/admin/settings', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`, [key, String(value)]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save setting' }); }
});

// ── Admin: promo codes CRUD ───────────────────────────────────────────────────
app.get('/admin/promo-codes', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json({ codes: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to load promo codes' }); }
});

app.post('/admin/promo-codes', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { code, type, value, min_spend, max_uses, expires_at } = req.body;
    if (!code || !type || !value) return res.status(400).json({ error: 'code, type, and value required' });
    if (!['flat','percent'].includes(type)) return res.status(400).json({ error: 'type must be flat or percent' });
    if (type === 'percent' && (parseFloat(value) < 1 || parseFloat(value) > 100)) {
      return res.status(400).json({ error: 'Percent value must be between 1–100' });
    }
    const result = await pool.query(
      `INSERT INTO promo_codes (code, type, value, min_spend, max_uses, expires_at)
       VALUES (UPPER($1), $2, $3, $4, $5, $6) RETURNING *`,
      [code.trim(), type, parseFloat(value), min_spend ? String(parseFloat(min_spend)) : null, max_uses || null, expires_at || null]
    );
    res.json({ success: true, promo: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code already exists' });
    console.error('Create promo error:', err);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

app.patch('/admin/promo-codes/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { active } = req.body;
    await pool.query('UPDATE promo_codes SET active = $1 WHERE id = $2', [active, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to update promo code' }); }
});

app.delete('/admin/promo-codes/:id', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete promo code' }); }
});

// ── Admin: customers CRM ──────────────────────────────────────────────────────
app.get('/admin/customers', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await pool.query(`
      SELECT
        customer_email AS email,
        MAX(customer_name) AS name,
        MAX(customer_phone) AS phone,
        COUNT(*) AS total_orders,
        SUM(CAST(total_amount AS NUMERIC)) AS total_spent,
        MAX(created_at) AS last_order_at,
        MIN(created_at) AS first_order_at,
        STRING_AGG(DISTINCT order_status, ', ') AS statuses
      FROM orders
      WHERE customer_email IS NOT NULL AND customer_email != ''
      GROUP BY customer_email
      ORDER BY total_orders DESC, total_spent DESC
    `);
    res.json({ customers: result.rows });
  } catch (err) {
    console.error('Customers error:', err);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { customer, items, orderType, deliveryDate, deliveryTimeSlot, cardBrand, testMode, promoCode } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const validatedItems = [];
    let totalCups = 0;
    let anyToppings = false;

    for (const item of items) {
      const product = PRODUCTS[item.id];
      if (!product) {
        console.warn(`Invalid product ID: ${item.id}`);
        return res.status(400).json({ error: `Invalid product: ${item.id}` });
      }

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        console.warn(`Invalid quantity for ${item.id}: ${item.quantity}`);
        return res.status(400).json({ error: `Invalid quantity for ${item.name}` });
      }

      const validatedToppings = [];
      if (item.toppings && item.toppings.length > 0) {
        for (const topping of item.toppings) {
          const validTopping = Object.values(TOPPINGS).find(t => t.name === topping.name);
          if (validTopping) {
            validatedToppings.push(validTopping.name);
          } else {
            console.warn(`Invalid topping rejected: ${topping.name}`);
            return res.status(400).json({ error: `Invalid topping: ${topping.name}` });
          }
        }
      }

      totalCups += item.quantity;
      // Nutty Crumble is free (doesn't trigger $1 fee) until May 10 2026
      const paidToppings = validatedToppings.filter(t =>
        !(t === 'Nutty Crumble' && Date.now() <= NUTTY_CRUMBLE_FREE_TILL.getTime())
      );
      if (paidToppings.length > 0) anyToppings = true;

      validatedItems.push({
        name: product.name,
        size: product.size,
        quantity: item.quantity,
        toppings: validatedToppings
      });
    }

    // Flat $1 topping fee — free during 24-hour launch window
    const isLaunchDay = Date.now() >= new Date('2026-04-10T08:00:00-05:00').getTime() &&
                        Date.now() <  new Date('2026-04-11T08:00:00-05:00').getTime();
    const toppingsFee = (anyToppings && !isLaunchDay) ? 1 : 0;

    // Flat per-cup pricing — $12.99/cup (tax included)
    const cupsTotal = Math.round(totalCups * getCurrentPrice() * 100) / 100;
    const itemsSubtotal = Math.round((cupsTotal + toppingsFee) * 100) / 100;
    const deliveryFee = (orderType === 'pickup') ? 0 : (itemsSubtotal < 25 ? 4.99 : 0);

    // Apply promo code discount (server-side validation)
    let promoDiscount = 0;
    let validatedPromo = null;
    if (promoCode) {
      try {
        const promoResult = await pool.query(
          `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND active = TRUE`, [promoCode.trim()]
        );
        if (promoResult.rows.length > 0) {
          const promo = promoResult.rows[0];
          const notExpired = !promo.expires_at || new Date(promo.expires_at) > new Date();
          const hasUses = promo.max_uses === null || promo.uses_count < promo.max_uses;
          const meetsMinSpend = !promo.min_spend || itemsSubtotal >= parseFloat(promo.min_spend);
          if (notExpired && hasUses && meetsMinSpend) {
            if (promo.type === 'flat') {
              promoDiscount = Math.min(parseFloat(promo.value), itemsSubtotal);
            } else {
              promoDiscount = Math.round(itemsSubtotal * (parseFloat(promo.value) / 100) * 100) / 100;
            }
            promoDiscount = Math.round(promoDiscount * 100) / 100;
            validatedPromo = promo;
          }
        }
      } catch (promoErr) {
        console.warn('Promo validation error (non-fatal):', promoErr.message);
      }
    }

    const baseTotal = Math.max(0, Math.round((itemsSubtotal + deliveryFee - promoDiscount) * 100) / 100);
    const amexFee = (cardBrand === 'amex') ? Math.round(baseTotal * 0.006 * 100) / 100 : 0;
    const serverTotal = Math.round((baseTotal + amexFee) * 100) / 100;

    // Test mode: charge exactly $1.00 CAD for payment flow testing
    const isTestMode = testMode === true;
    const amountInCents = isTestMode ? 100 : Math.round(serverTotal * 100);
    const chargeTotal = isTestMode ? '1.00' : serverTotal.toFixed(2);

    if (isTestMode) {
      console.log('🧪 TEST MODE: Charging $1.00 instead of $' + serverTotal.toFixed(2));
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'cad',
      metadata: {
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_address: customer.address,
        order_type: orderType || 'delivery',
        delivery_date: deliveryDate || '',
        delivery_time_slot: deliveryTimeSlot || '',
        items: JSON.stringify(validatedItems),
        total: chargeTotal,
        delivery_fee: deliveryFee.toFixed(2),
        amex_fee: amexFee > 0 ? amexFee.toFixed(2) : '0',
        card_brand: cardBrand || 'unknown',
        pricing: `$${getCurrentPrice().toFixed(2)} per cup (tax included)`,
        test_mode: isTestMode ? 'true' : 'false',
        promo_code: validatedPromo ? validatedPromo.code : '',
        promo_discount: promoDiscount > 0 ? promoDiscount.toFixed(2) : '0'
      },
    });

    // Increment promo code uses
    if (validatedPromo) {
      await pool.query('UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = $1', [validatedPromo.id]);
    }

    console.log('Payment Intent Created:', paymentIntent.id, 
                'Amount:', serverTotal.toFixed(2), 'CAD',
                'Items:', validatedItems.length);

    res.json({
      clientSecret: paymentIntent.client_secret,
      promoDiscount,
      promoCode: validatedPromo ? validatedPromo.code : null
    });
  } catch (error) {
    console.error('Payment Intent Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save order to database after verifying payment with Stripe
app.post('/save-order', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID required' });
    }
    
    // Retrieve and verify payment from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      console.warn('Payment not succeeded:', paymentIntentId, paymentIntent.status);
      return res.status(400).json({ error: 'Payment not completed' });
    }
    
    // Get order data from Stripe metadata (trusted source)
    const metadata = paymentIntent.metadata;
    const totalAmount = (paymentIntent.amount / 100).toFixed(2);
    
    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const query = `
      INSERT INTO orders (
        order_number, 
        customer_name, 
        customer_email, 
        customer_phone, 
        customer_address, 
        items, 
        total_amount, 
        stripe_payment_id, 
        order_status,
        order_type,
        delivery_date,
        delivery_time_slot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, order_number, created_at
    `;
    
    const values = [
      orderNumber,
      metadata.customer_name || '',
      metadata.customer_email || '',
      metadata.customer_phone || '',
      metadata.customer_address || '',
      metadata.items || '[]',
      totalAmount,
      paymentIntentId,
      'pending',
      metadata.order_type || 'delivery',
      metadata.delivery_date || null,
      metadata.delivery_time_slot || null
    ];
    
    const result = await pool.query(query, values);
    
    console.log('Order saved after payment verification:', result.rows[0].order_number);
    
    // Send order confirmation email
    const orderData = {
      order_number: result.rows[0].order_number,
      customer_name: metadata.customer_name || '',
      customer_email: metadata.customer_email || '',
      customer_phone: metadata.customer_phone || '',
      customer_address: metadata.customer_address || '',
      items: metadata.items || '[]',
      total_amount: totalAmount,
      created_at: result.rows[0].created_at
    };
    
    const emailResult = await sendOrderConfirmation(orderData);
    if (emailResult.success) {
      console.log('✅ Confirmation email sent to:', metadata.customer_email);
    }

    // Owner alert email
    await sendOwnerAlertEmail({
      ...orderData,
      order_type: metadata.order_type || 'delivery'
    });

    // Auto-sync drop status based on daily cap
    await syncDropStatusFromCap();
    
    res.json({
      success: true,
      orderNumber: result.rows[0].order_number,
      orderId: result.rows[0].id,
      emailSent: emailResult.success
    });
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

// Auto-syncs the drop status (green/yellow/red) based on the daily order cap
async function syncDropStatusFromCap() {
  try {
    const capRow = await pool.query(`SELECT value FROM app_settings WHERE key = 'daily_order_cap'`);
    const cap = parseInt(capRow.rows[0]?.value || '0');
    if (cap === 0) return; // 0 = unlimited, skip auto-sync

    const countRow = await pool.query(
      `SELECT COUNT(*) AS count FROM orders WHERE created_at >= NOW()::date AND order_status != 'test'`
    );
    const count = parseInt(countRow.rows[0].count);

    let newStatus;
    if (count >= cap) {
      newStatus = 'red';
    } else if (count >= Math.ceil(cap * 0.7)) {
      newStatus = 'yellow';
    } else {
      newStatus = 'green';
    }

    const prev = await pool.query("SELECT value FROM drop_settings WHERE key = 'status'");
    const prevStatus = prev.rows[0]?.value;

    if (newStatus !== prevStatus) {
      await pool.query(
        "INSERT INTO drop_settings (key, value) VALUES ('status', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
        [newStatus]
      );
      console.log(`🔄 Drop status auto-synced: ${prevStatus || 'none'} → ${newStatus} (${count}/${cap} orders today)`);
    }
  } catch (err) {
    console.error('Error syncing drop status from cap:', err);
  }
}

// Admin authentication - REQUIRED in environment variables
if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  WARNING: ADMIN_PASSWORD not set! Admin endpoint will be inaccessible.');
  console.warn('⚠️  Set ADMIN_PASSWORD environment variable to enable order management.');
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Delivery authentication - REQUIRED in environment variables
if (!process.env.DELIVERY_PASSWORD) {
  console.warn('⚠️  WARNING: DELIVERY_PASSWORD not set! Delivery endpoint will be inaccessible.');
  console.warn('⚠️  Set DELIVERY_PASSWORD environment variable to enable delivery access.');
}
const DELIVERY_PASSWORD = process.env.DELIVERY_PASSWORD;

// ─── Drop Status ────────────────────────────────────────────────────────────

// Public: get current drop status + waitlist count
app.get('/api/drop-status', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM drop_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    const wl = await pool.query('SELECT COUNT(*) FROM notify_waitlist WHERE notified_at IS NULL');
    res.json({
      status: settings.status || 'green',
      nextDropTime: settings.next_drop_time || '',
      waitlistCount: parseInt(wl.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update drop status (Basic auth required)
app.post('/api/drop-status', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const b64 = authHeader.replace('Basic ', '');
  const [username, password] = Buffer.from(b64, 'base64').toString().split(':');
  if (username !== 'admin' || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { status, nextDropTime } = req.body;
  if (!['green', 'yellow', 'red'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    // Check previous status
    const prev = await pool.query("SELECT value FROM drop_settings WHERE key = 'status'");
    const prevStatus = prev.rows[0]?.value;

    await pool.query("INSERT INTO drop_settings (key, value) VALUES ('status', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [status]);
    await pool.query("INSERT INTO drop_settings (key, value) VALUES ('next_drop_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [nextDropTime || '']);

    // If switching TO green, notify waitlist
    if (status === 'green' && prevStatus !== 'green') {
      const waitlist = await pool.query('SELECT email FROM notify_waitlist WHERE notified_at IS NULL');
      if (waitlist.rows.length > 0 && resend) {
        for (const row of waitlist.rows) {
          try {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: [row.email],
              subject: '💪 Fresh Batch Is Ready — Order Now!',
              html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fresh Batch Is Ready</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Fuel your strength. · Regina, SK</div>
      </td></tr>
      <tr><td style="padding:28px 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">🎉 Fresh Batch Is Ready!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">You asked us to let you know — and here we are. A fresh batch of our high-protein desserts is ready and waiting. Don't wait, these go fast!</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:15px;font-weight:700;color:#013e4a;">🟢 Now Accepting Orders</div>
            <div style="font-size:14px;color:#555;margin-top:4px;">Available in Regina, SK only</div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
          <tr><td align="center">
            <a href="https://strongspoon.ca" style="display:inline-block;background:#015A64;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:700;font-size:16px;letter-spacing:0.5px;">Order Now →</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#aaa;">You received this because you signed up for drop alerts at strongspoon.ca</p>
      </td></tr>
      <tr><td style="padding-top:24px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
            });
          } catch(e) { console.error('Waitlist email error:', e.message); }
        }
        await pool.query('UPDATE notify_waitlist SET notified_at = NOW() WHERE notified_at IS NULL');
        console.log(`✅ Notified ${waitlist.rows.length} waitlist subscribers`);
      }
    }

    res.json({ success: true, status, waitlistNotified: status === 'green' && prevStatus !== 'green' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: join notify waitlist
app.post('/api/notify-waitlist', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  try {
    await pool.query(
      'INSERT INTO notify_waitlist (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET notified_at = NULL',
      [email.trim().toLowerCase()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Orders ─────────────────────────────────────────────────────────────────

// Get all orders (admin endpoint with basic auth)
app.get('/admin/orders', async (req, res) => {
  try {
    // Check if admin password is configured
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ 
        error: 'Admin access not configured. Set ADMIN_PASSWORD environment variable.' 
      });
    }
    
    // Basic authentication check
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Try query with delivery scheduling columns first, fallback to basic query
    let result;
    try {
      const fullQuery = `
        SELECT 
          id,
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          items,
          total_amount,
          stripe_payment_id,
          order_status,
          order_type,
          delivery_proof,
          delivery_person,
          delivered_at,
          delivery_date,
          delivery_time_slot,
          created_at
        FROM orders
        ORDER BY created_at DESC
      `;
      result = await pool.query(fullQuery);
    } catch (columnError) {
      // Fallback query without newer columns
      console.log('Using fallback query (newer columns may not exist)');
      const basicQuery = `
        SELECT 
          id,
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          customer_address,
          items,
          total_amount,
          stripe_payment_id,
          order_status,
          'delivery' as order_type,
          delivery_proof,
          delivery_person,
          delivered_at,
          created_at
        FROM orders
        ORDER BY created_at DESC
      `;
      result = await pool.query(basicQuery);
    }
    
    res.json({
      orders: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});


// Export all orders as CSV (admin endpoint)
app.get('/admin/orders/export', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin not configured' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const result = await pool.query(`
      SELECT
        order_number, customer_name, customer_email, customer_phone,
        customer_address, items, total_amount, order_status, order_type,
        delivery_date, delivery_time_slot, delivery_person, delivered_at,
        stripe_payment_id, created_at
      FROM orders
      ORDER BY created_at ASC
    `);

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n\r]/.test(s) ? `"${s}"` : s;
    };

    const headers = [
      'Order #', 'Date', 'Customer Name', 'Email', 'Phone', 'Address',
      'Items', 'Toppings', 'Total (CAD)', 'Status', 'Type',
      'Delivery Date', 'Time Slot', 'Delivered By', 'Delivered At',
      'Stripe Payment ID'
    ];

    const rows = result.rows.map(o => {
      let itemsSummary = '';
      let toppingsSummary = '';
      try {
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
        itemsSummary = items.map(i => `${i.name || 'Item'} x${i.quantity || 1}`).join('; ');
        const allToppings = items.flatMap(i => i.toppings || []);
        toppingsSummary = allToppings.length ? [...new Set(allToppings)].join(', ') : 'None';
      } catch (e) {}
      const createdAt = o.created_at ? new Date(o.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' }) : '';
      const deliveredAt = o.delivered_at ? new Date(o.delivered_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' }) : '';
      const deliveryDate = o.delivery_date ? new Date(new Date(o.delivery_date).toISOString().split('T')[0] + 'T12:00:00').toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) : '';
      return [
        o.order_number, createdAt, o.customer_name, o.customer_email, o.customer_phone,
        o.customer_address, itemsSummary, toppingsSummary,
        o.total_amount ? `$${parseFloat(o.total_amount).toFixed(2)}` : '',
        o.order_status, o.order_type, deliveryDate, o.delivery_time_slot,
        o.delivery_person, deliveredAt, o.stripe_payment_id
      ].map(escape).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');
    const filename = `StrongSpoon_Orders_${new Date().toISOString().slice(0,10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

// Get order statistics (admin endpoint)
app.get('/admin/orders/stats', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'Admin access not configured' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const statsQuery = `
      SELECT 
        order_status,
        COUNT(*) as count,
        SUM(total_amount) as total_revenue
      FROM orders
      GROUP BY order_status
    `;
    
    const todayQuery = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
    `;
    
    const statsResult = await pool.query(statsQuery);
    const todayResult = await pool.query(todayQuery);
    
    const stats = {
      pending: 0,
      completed: 0,
      delivered: 0,
      totalRevenue: 0,
      todayOrders: parseInt(todayResult.rows[0]?.count || 0)
    };
    
    statsResult.rows.forEach(row => {
      stats[row.order_status] = parseInt(row.count);
      stats.totalRevenue += parseFloat(row.total_revenue || 0);
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get past deliveries - last 24 hours (admin endpoint)
app.get('/admin/orders/past-deliveries', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'Admin access not configured' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const query = `
      SELECT 
        id, order_number, customer_name, customer_email, customer_phone, customer_address,
        items, total_amount, order_status, delivery_proof, delivery_person, delivered_at,
        delivery_date, delivery_time_slot, created_at
      FROM orders
      WHERE order_status = 'delivered' 
        AND delivered_at >= NOW() - INTERVAL '24 hours'
      ORDER BY delivered_at DESC
    `;
    
    const result = await pool.query(query);
    res.json({ orders: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching past deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch past deliveries' });
  }
});

// Get waitlist signups (admin only)
app.get('/admin/waitlist', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'Admin access not configured' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const result = await pool.query('SELECT id, name, city, created_at FROM waitlist ORDER BY created_at DESC');
    res.json({ signups: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

function generatePickupReadyHtml(orderNumber, customerName, pickupAddress, pickupPhone, total) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ready for Pickup</title>
</head>
<body style="margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

      <!-- Logo / Brand header -->
      <tr><td align="center" style="padding-bottom:28px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Fuel your strength. · Regina, SK</div>
      </td></tr>

      <!-- Main message -->
      <tr><td style="padding:32px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi ${customerName},</p>
        <p style="margin:0 0 24px;font-size:16px;color:#333;">Great news — your Strong Spoon order is freshly prepared and <strong>ready for pickup right now!</strong></p>

        <!-- Address box -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:18px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">📍 Pickup Address</div>
            <div style="font-size:17px;font-weight:700;color:#1a1a1a;">${pickupAddress}</div>
          </td></tr>
        </table>

        ${pickupPhone ? `
        <!-- Phone -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:6px;">📞 When you arrive</div>
            <div style="font-size:16px;color:#1a1a1a;">Call or text us: <strong>${pickupPhone}</strong></div>
          </td></tr>
        </table>
        ` : ''}

        <!-- Order ref -->
        <p style="margin:0 0 6px;font-size:13px;color:#888;">Order reference</p>
        <p style="margin:0 0 32px;font-size:15px;color:#333;"><strong>#${orderNumber}</strong> &nbsp;·&nbsp; $${total} CAD</p>

        <p style="margin:0;font-size:15px;color:#555;">We look forward to seeing you. Enjoy your Strong Spoon!</p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// Notify pickup customer that order is ready
app.post('/admin/notify-pickup-ready', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { orderId, pickupAddress, pickupPhone } = req.body;
    if (!orderId || !pickupAddress) {
      return res.status(400).json({ error: 'orderId and pickupAddress are required' });
    }

    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];

    if (!resend) return res.status(503).json({ error: 'Email service not configured' });

    const html = generatePickupReadyHtml(
      order.order_number,
      order.customer_name,
      pickupAddress,
      pickupPhone,
      parseFloat(order.total_amount).toFixed(2)
    );

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [order.customer_email],
      subject: `🏪 Your Order #${order.order_number} is Ready for Pickup!`,
      html
    });

    if (error) return res.status(500).json({ error: error.message });
    console.log(`✅ Pickup ready email sent to ${order.customer_email} for order #${order.order_number}`);

    await pool.query('UPDATE orders SET order_status = $1 WHERE id = $2', ['completed', orderId]);
    console.log(`✅ Order #${order.order_number} marked as completed after pickup notification`);

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending pickup ready email:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get analytics with timeframes (admin endpoint)
app.get('/admin/orders/analytics', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'Admin access not configured' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const range = req.query.range || 'all';
    let dateFilter = '';
    
    switch(range) {
      case '1d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '1 day'";
        break;
      case '7d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '14d':
        dateFilter = "AND created_at >= NOW() - INTERVAL '14 days'";
        break;
      default:
        dateFilter = '';
    }
    
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN order_status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN order_status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600), 0) as avg_delivery_hours
      FROM orders
      WHERE 1=1 ${dateFilter}
    `;
    
    const dailyRevenueQuery = `
      SELECT 
        DATE(created_at AT TIME ZONE 'America/Toronto') as date,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(created_at AT TIME ZONE 'America/Toronto')
      ORDER BY date DESC
      LIMIT 14
    `;
    
    const topProductsQuery = `
      SELECT 
        item->>'name' as product_name,
        COUNT(*) as order_count
      FROM orders, jsonb_array_elements(items::jsonb) as item
      WHERE 1=1 ${dateFilter}
      GROUP BY item->>'name'
      ORDER BY order_count DESC
      LIMIT 5
    `;
    
    const [metricsResult, dailyResult, topProductsResult] = await Promise.all([
      pool.query(metricsQuery),
      pool.query(dailyRevenueQuery),
      pool.query(topProductsQuery)
    ]);
    
    const metrics = metricsResult.rows[0];
    const completionRate = metrics.total_orders > 0 
      ? ((parseInt(metrics.delivered_orders) / parseInt(metrics.total_orders)) * 100).toFixed(1)
      : 0;
    
    res.json({
      range,
      metrics: {
        totalOrders: parseInt(metrics.total_orders) || 0,
        deliveredOrders: parseInt(metrics.delivered_orders) || 0,
        pendingOrders: parseInt(metrics.pending_orders) || 0,
        completedOrders: parseInt(metrics.completed_orders) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
        avgOrderValue: parseFloat(metrics.avg_order_value) || 0,
        avgDeliveryHours: parseFloat(metrics.avg_delivery_hours) || 0,
        completionRate: parseFloat(completionRate) || 0
      },
      dailyRevenue: dailyResult.rows.map(row => ({
        date: row.date,
        orders: parseInt(row.orders),
        revenue: parseFloat(row.revenue)
      })),
      topProducts: topProductsResult.rows.map(row => ({
        name: row.product_name,
        count: parseInt(row.order_count)
      }))
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Update order status (admin endpoint)
app.put('/admin/orders/:id/status', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) {
      return res.status(503).json({ error: 'Admin access not configured' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'admin' || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'completed', 'delivered'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const query = `
      UPDATE orders
      SET order_status = $1
      WHERE id = $2
      RETURNING id, order_number, order_status
    `;
    
    const result = await pool.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ── Reschedule delivery date (admin) ─────────────────────────────────────────
app.patch('/admin/orders/:id/reschedule', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) return res.status(401).json({ error: 'Unauthorized' });
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (username !== 'admin' || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid credentials' });

    const { id } = req.params;
    const { delivery_date, delivery_time_slot } = req.body;
    if (!delivery_date) return res.status(400).json({ error: 'delivery_date required' });

    const result = await pool.query(
      `UPDATE orders SET delivery_date = $1, delivery_time_slot = $2, reminder_sent = FALSE WHERE id = $3
       RETURNING id, order_number, customer_name, customer_email, customer_address, items, total_amount, delivery_date, delivery_time_slot, order_type`,
      [delivery_date, delivery_time_slot || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error('Reschedule error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Send reschedule confirmation email (admin-triggered) ──────────────────────
app.post('/admin/orders/:id/reschedule-email', async (req, res) => {
  try {
    if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin not configured' });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) return res.status(401).json({ error: 'Unauthorized' });
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    if (username !== 'admin' || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid credentials' });

    const { id } = req.params;
    const { delivery_date, delivery_time_slot } = req.body;
    if (!delivery_date) return res.status(400).json({ error: 'delivery_date required' });

    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    const result = await sendRescheduleEmail(order, delivery_date, delivery_time_slot);
    if (!result.success) return res.status(500).json({ error: 'Email failed to send', detail: result.error });
    res.json({ success: true, message: `Reschedule email sent to ${order.customer_email}` });
  } catch (err) {
    console.error('Reschedule email error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: manually send the 24h reminder email for an order ─────────────────
app.post('/admin/orders/:id/send-reminder', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];
    if (order.order_type !== 'delivery') return res.status(400).json({ error: 'Pickup orders cannot get a delivery reminder.' });
    if (!order.delivery_date) return res.status(400).json({ error: 'No delivery date set on this order.' });
    if (order.order_status === 'delivered') return res.status(400).json({ error: 'Order is already delivered.' });

    const r = await sendDeliveryReminderEmail(order);
    if (!r.success) return res.status(500).json({ error: r.error || 'Failed to send reminder.' });
    await pool.query('UPDATE orders SET reminder_sent = TRUE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Manual reminder error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Customer: look up order by order_number + email ───────────────────────────
app.post('/api/customer/order-lookup', async (req, res) => {
  try {
    const { order_number, email } = req.body;
    if (!order_number || !email) return res.status(400).json({ error: 'order_number and email required' });
    const result = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, customer_address, items, total_amount,
              delivery_date, order_type, order_status
       FROM orders
       WHERE UPPER(order_number) = UPPER($1) AND LOWER(customer_email) = LOWER($2)`,
      [order_number.trim(), email.trim()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No order found with that order number and email.' });
    const order = result.rows[0];
    if (order.order_status === 'delivered') return res.status(400).json({ error: 'This order has already been delivered and cannot be rescheduled.' });
    if (order.order_type !== 'delivery') return res.status(400).json({ error: 'This order is a pickup and does not have a delivery date.' });
    res.json({ order });
  } catch (err) {
    console.error('Order lookup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Customer: self-service reschedule ─────────────────────────────────────────
app.post('/api/customer/reschedule', async (req, res) => {
  try {
    const { order_number, email, new_date } = req.body;
    if (!order_number || !email || !new_date) return res.status(400).json({ error: 'order_number, email and new_date required' });

    // Validate date is in the future
    const today = new Date().toISOString().split('T')[0];
    if (new_date <= today) return res.status(400).json({ error: 'Please choose a future date.' });

    // Find and verify the order
    const orderRes = await pool.query(
      `SELECT * FROM orders WHERE UPPER(order_number) = UPPER($1) AND LOWER(customer_email) = LOWER($2)`,
      [order_number.trim(), email.trim()]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderRes.rows[0];
    if (order.order_status === 'delivered') return res.status(400).json({ error: 'Order already delivered.' });
    if (order.order_type !== 'delivery') return res.status(400).json({ error: 'Pickup orders cannot be rescheduled.' });

    // Update the delivery date and reset reminder
    await pool.query(
      `UPDATE orders SET delivery_date = $1, delivery_time_slot = NULL, reminder_sent = FALSE WHERE id = $2`,
      [new_date, order.id]
    );

    // Send confirmation email to customer (non-blocking)
    const updatedOrder = { ...order, delivery_date: new_date, delivery_time_slot: null };
    sendRescheduleEmail(updatedOrder, new_date, null).catch(e => console.error('Reschedule email error:', e));

    // Notify the owner (non-blocking)
    const formattedDate = new Date(new_date + 'T12:00:00').toLocaleDateString('en-CA', {
      timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    if (resend) {
      resend.emails.send({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        subject: `🔄 Customer Rescheduled — ${order.order_number}`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;padding:20px;">
          <div style="max-width:520px;margin:auto;">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#013e4a;margin-bottom:16px;">💪 STRONG SPOON — Delivery Rescheduled</div>
            <p style="font-size:15px;margin-bottom:16px;">A customer has rescheduled their own delivery:</p>
            <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
              <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:700;width:40%;border:1px solid #e0e0e0;">Order #</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${order.order_number}</td></tr>
              <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:700;border:1px solid #e0e0e0;">Customer</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${order.customer_name}</td></tr>
              <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:700;border:1px solid #e0e0e0;">Email</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${order.customer_email}</td></tr>
              <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:700;border:1px solid #e0e0e0;">Address</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${order.customer_address || '—'}</td></tr>
              <tr><td style="padding:8px 12px;background:#f0fafa;font-weight:700;border:1px solid #e0e0e0;">New Date</td><td style="padding:8px 12px;border:1px solid #e0e0e0;color:#015A64;font-weight:700;">${formattedDate}</td></tr>
            </table>
            <p style="font-size:13px;color:#777;">Check the admin dashboard to confirm.</p>
          </div>
        </body></html>`
      }).catch(e => console.error('Owner reschedule alert error:', e));
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Customer reschedule error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── Test reschedule email ──────────────────────────────────────────────────────
app.get('/api/send-test-reschedule-email', async (req, res) => {
  if (!resend) return res.status(503).json({ error: 'Email service not configured' });
  const to = req.query.to || OWNER_EMAIL;
  const fakeOrder = {
    order_number: 'SS-RESCHEDULE-TEST',
    customer_name: 'Test Customer',
    customer_email: to,
    customer_address: '123 Main Street, Regina, SK',
    total_amount: '23.98',
    items: JSON.stringify([{ name: 'Brownie Issues', quantity: 2 }, { name: 'Power Mix', quantity: 1 }])
  };
  const result = await sendRescheduleEmail(fakeOrder, '2026-04-20', 'Afternoon 12PM-4PM');
  if (result.success) res.json({ success: true, message: `Test reschedule email sent to ${to}` });
  else res.status(500).json({ success: false, error: result.error });
});

// ── Test 24h delivery reminder email ──────────────────────────────────────────
app.get('/api/send-test-reminder-email', async (req, res) => {
  if (!resend) return res.status(503).json({ error: 'Email service not configured' });
  const to = req.query.to || OWNER_EMAIL;
  const fakeOrder = {
    order_number: 'SS-REMINDER-TEST',
    customer_name: 'Test Customer',
    customer_email: to,
    customer_address: '123 Main Street, Regina, SK',
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    delivery_time_slot: 'Morning 8AM-12PM',
    items: JSON.stringify([{ name: 'Brownie Issues', quantity: 2 }, { name: 'Power Mix', quantity: 1 }])
  };
  const result = await sendDeliveryReminderEmail(fakeOrder);
  if (result.success) res.json({ success: true, message: `Test reminder email sent to ${to}` });
  else res.status(500).json({ success: false, error: result.error });
});

// Get orders for delivery (authenticated endpoint for delivery personnel)
app.get('/delivery/orders', async (req, res) => {
  try {
    // Check if delivery password is configured
    if (!DELIVERY_PASSWORD) {
      return res.status(503).json({ 
        error: 'Delivery access not configured. Set DELIVERY_PASSWORD environment variable.' 
      });
    }
    
    // Basic authentication check
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Delivery Access"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'delivery' || password !== DELIVERY_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Try query with delivery scheduling columns first, fallback to basic query
    let result;
    try {
      const fullQuery = `
        SELECT 
          id,
          order_number,
          customer_name,
          customer_address,
          customer_phone,
          items,
          total_amount,
          order_status,
          order_type,
          delivery_date,
          delivery_time_slot,
          created_at
        FROM orders
        WHERE order_status = 'completed'
        ORDER BY created_at ASC
      `;
      result = await pool.query(fullQuery);
    } catch (columnError) {
      // Fallback query without newer columns
      console.log('Using fallback query for delivery (newer columns may not exist)');
      const basicQuery = `
        SELECT 
          id,
          order_number,
          customer_name,
          customer_address,
          customer_phone,
          items,
          total_amount,
          order_status,
          'delivery' as order_type,
          created_at
        FROM orders
        WHERE order_status = 'completed'
        ORDER BY created_at ASC
      `;
      result = await pool.query(basicQuery);
    }
    
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Error fetching delivery orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get past deliveries - last 24 hours (delivery personnel endpoint)
app.get('/delivery/past-deliveries', async (req, res) => {
  try {
    if (!DELIVERY_PASSWORD) {
      return res.status(503).json({ error: 'Delivery access not configured' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Delivery Access"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'delivery' || password !== DELIVERY_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const query = `
      SELECT 
        id, order_number, customer_name, customer_address, customer_phone,
        items, total_amount, order_status, delivery_proof, delivery_person, 
        delivered_at, delivery_date, delivery_time_slot, created_at
      FROM orders
      WHERE order_status = 'delivered' 
        AND delivered_at >= NOW() - INTERVAL '24 hours'
      ORDER BY delivered_at DESC
    `;
    
    const result = await pool.query(query);
    res.json({ orders: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error fetching past deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch past deliveries' });
  }
});

// Submit delivery proof (authenticated delivery personnel endpoint)
app.post('/delivery/orders/:id/proof', async (req, res) => {
  try {
    // Check if delivery password is configured
    if (!DELIVERY_PASSWORD) {
      return res.status(503).json({ 
        error: 'Delivery access not configured. Set DELIVERY_PASSWORD environment variable.' 
      });
    }
    
    // Basic authentication check
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Delivery Access"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');
    
    if (username !== 'delivery' || password !== DELIVERY_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const { id } = req.params;
    const { deliveryProof, deliveryPerson } = req.body;
    
    if (!deliveryProof || !deliveryPerson) {
      return res.status(400).json({ error: 'Delivery proof and person name required' });
    }
    
    // Validate base64 image
    if (!deliveryProof.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    const query = `
      UPDATE orders
      SET 
        order_status = 'delivered',
        delivery_proof = $1,
        delivery_person = $2,
        delivered_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, order_number, order_status, delivered_at, customer_name, customer_email, items, total_amount
    `;
    
    const result = await pool.query(query, [deliveryProof, deliveryPerson, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const updatedOrder = result.rows[0];
    console.log('✅ Delivery proof uploaded for order:', updatedOrder.order_number);
    
    // Send delivery notification email with proof (fail soft - don't block response)
    // Wrapped in try-catch with explicit promise handling to prevent unhandled rejections
    if (updatedOrder.customer_email) {
      (async () => {
        try {
          const emailResult = await sendDeliveryNotification(updatedOrder, deliveryProof, deliveryPerson);
          if (emailResult.success) {
            console.log(`📧 Delivery notification sent to ${updatedOrder.customer_email}`);
          } else {
            console.warn(`⚠️ Failed to send delivery notification: ${JSON.stringify(emailResult.error || emailResult.reason)}`);
          }
        } catch (err) {
          console.error('Error sending delivery notification:', err.message || err);
        }
      })();
    }
    
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error submitting delivery proof:', error);
    res.status(500).json({ error: 'Failed to submit delivery proof' });
  }
});

// Test database connection before starting server
async function startServer() {
  // Test database connection
  if (pool) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connection verified');
    } catch (err) {
      console.error('❌ Database connection failed:', err.message);
      console.error('Server will start but database features may not work');
    }
  }
  
  // Test email route — sends a sample order confirmation
  app.get('/api/send-test-email', async (req, res) => {
    if (!resend) return res.status(503).json({ error: 'Email service not configured' });
    const to = req.query.to || OWNER_EMAIL;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Confirmed</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Order Confirmed ✓</div>
      </td></tr>
      <tr><td style="padding:28px 0 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">Hi Test Customer!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">Your order has been confirmed and will be prepared shortly. Thank you for choosing Strong Spoon!</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Order Reference</div>
            <div style="font-size:16px;font-weight:700;color:#1a1a1a;">#SS-SAMPLE-001</div>
            <div style="font-size:13px;color:#666;margin-top:4px;">📅 April 10, 2026 at 10:30 AM</div>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;">Items Ordered</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#e8e8e8;margin:0 0 20px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Item</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#555;font-weight:700;">Toppings</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:15px;color:#1a1a1a;font-weight:700;">Brownie Issues ×2</td><td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:14px;color:#666;">Almonds, Cashews</td></tr>
            <tr><td style="padding:10px 12px;font-size:15px;color:#1a1a1a;font-weight:700;">Golden Scoop ×1</td><td style="padding:10px 12px;font-size:14px;color:#666;">No toppings</td></tr>
          </tbody>
        </table>
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#013e4a;">Total Paid: $35.97 CAD</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#015A64;margin-bottom:8px;">Your Details</div>
            <div style="font-size:15px;color:#1a1a1a;line-height:1.9;">
              👤 Test Customer<br>📧 ${to}<br>📞 (306) 555-0199<br>📍 123 Wascana St, Regina, SK
            </div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td style="background:#f5fafa;border:1px solid #e0eeee;border-radius:10px;padding:18px 20px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#555;">Need to change your delivery date?</p>
            <a href="https://strongspoon.ca/manage-order.html?order=SS-SAMPLE-001&email=${encodeURIComponent(to)}"
               style="display:inline-block;background:#015A64;color:#ffffff;text-decoration:none;padding:11px 28px;border-radius:8px;font-weight:700;font-size:14px;margin-top:4px;">
              📅 Manage My Order
            </a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:14px;color:#555;">Questions? Simply reply to this email and we'll get back to you.</p>
      </td></tr>
      <tr><td style="padding-top:32px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    // Generate sample PDF invoice
    const sampleOrder = {
      order_number: 'SS-SAMPLE-001',
      customer_name: 'Arsh',
      customer_email: to,
      customer_phone: '+1 (306) 555-0199',
      customer_address: '123 Wascana St, Regina, SK',
      items: JSON.stringify([
        { name: 'Brownie Issues', quantity: 2, price: 12.99, toppings: [{ name: 'Almonds' }, { name: 'Cashews' }] },
        { name: 'Golden Scoop', quantity: 1, price: 12.99, toppings: [] },
      ]),
      total_amount: '35.97',
      created_at: new Date().toISOString(),
      order_type: 'delivery',
      delivery_date: 'April 10, 2026',
      delivery_time_slot: 'Next Day Delivery',
    };
    let pdfAttachments = [];
    try {
      const pdfBuffer = await generateInvoicePDF(sampleOrder);
      pdfAttachments = [{ filename: 'StrongSpoon-Invoice-SS-SAMPLE-001.pdf', content: pdfBuffer, contentType: 'application/pdf' }];
    } catch(e) { console.error('Test PDF error:', e.message); }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: '📧 Strong Spoon — Sample Email Design',
      html,
      attachments: pdfAttachments,
    });
    if (error) return res.status(500).json({ error });
    res.json({ success: true, message: `Test email sent to ${to}`, id: data?.id });
  });

  // Test owner alert email
  app.get('/api/send-test-owner-alert', async (req, res) => {
    if (!resend) return res.status(503).json({ error: 'Email service not configured' });
    const result = await sendOwnerAlertEmail({
      order_number: 'ORD-TEST-001',
      customer_name: 'Test Customer',
      customer_email: 'testcustomer@example.com',
      customer_phone: '+1 (306) 555-0199',
      customer_address: '123 Wascana St, Regina, SK',
      total_amount: '23.98',
      items: JSON.stringify([
        { name: 'Brownie Issues', quantity: 2, toppings: [{ name: 'Almonds' }] },
        { name: 'Golden Scoop', quantity: 1, toppings: [] }
      ]),
      order_type: 'delivery',
      delivery_date: 'April 10, 2026',
      delivery_time_slot: 'Next Day Delivery'
    });
    if (result.success) {
      res.json({ success: true, message: `Test owner alert sent to ${OWNER_EMAIL}` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  });

  // Test pickup ready email
  app.get('/api/send-test-pickup-email', async (req, res) => {
    if (!resend) return res.status(503).json({ error: 'Email service not configured' });
    const to = req.query.to || OWNER_EMAIL;
    const fakeOrder = {
      order_number: 'SS-PICKUP-TEST',
      customer_name: 'Test Customer',
      customer_email: to,
      total_amount: '23.98'
    };
    const pickupAddress = '456 Broad St, Regina, SK S4R 1X3';
    const pickupPhone = '(306) 555-0100';

    const html = generatePickupReadyHtml(
      fakeOrder.order_number,
      fakeOrder.customer_name,
      pickupAddress,
      pickupPhone,
      fakeOrder.total_amount
    );

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `🏪 Your Order #${fakeOrder.order_number} is Ready for Pickup! (TEST)`,
      html
    });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: `Test pickup ready email sent to ${to}` });
  });

  // Test waitlist drop alert email
  app.get('/api/send-test-waitlist-email', async (req, res) => {
    if (!resend) return res.status(503).json({ error: 'Email service not configured' });
    const to = req.query.to || OWNER_EMAIL;
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: '💪 Fresh Batch Is Ready — Order Now!',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fresh Batch Is Ready</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#1a1a1a;background:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:30px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
      <tr><td align="center" style="padding-bottom:24px;border-bottom:2px solid #013e4a;">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#013e4a;">💪 STRONG SPOON</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#017d8e;margin-top:4px;">Fuel your strength. · Regina, SK</div>
      </td></tr>
      <tr><td style="padding:28px 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1a1a1a;">🎉 Fresh Batch Is Ready!</p>
        <p style="margin:0 0 24px;font-size:15px;color:#333;">You asked us to let you know — and here we are. A fresh batch of our high-protein desserts is ready and waiting. Don't wait, these go fast!</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
          <tr><td style="background:#f0fafa;border-left:4px solid #015A64;padding:16px 20px;border-radius:0 8px 8px 0;">
            <div style="font-size:15px;font-weight:700;color:#013e4a;">🟢 Now Accepting Orders</div>
            <div style="font-size:14px;color:#555;margin-top:4px;">Available in Regina, SK only</div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
          <tr><td align="center">
            <a href="https://strongspoon.ca" style="display:inline-block;background:#015A64;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:700;font-size:16px;letter-spacing:0.5px;">Order Now →</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#aaa;">You received this because you signed up for drop alerts at strongspoon.ca</p>
      </td></tr>
      <tr><td style="padding-top:24px;border-top:1px solid #e8e8e8;text-align:center;">
        <p style="margin:0;font-size:12px;color:#999;letter-spacing:1px;">STRONG SPOON &nbsp;·&nbsp; Regina, SK &nbsp;·&nbsp; strongspoon.ca</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
    });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, message: `Test waitlist drop alert sent to ${to}` });
  });

  // Test delivery notification email
  app.get('/api/send-test-delivery-email', async (req, res) => {
    if (!resend) return res.status(503).json({ error: 'Email service not configured' });
    const to = req.query.to || OWNER_EMAIL;
    const fakeOrder = {
      order_number: 'SS-DELIVERY-TEST',
      customer_name: 'Test Customer',
      customer_email: to,
      total_amount: '23.98',
      items: JSON.stringify([
        { name: 'Brownie Issues', quantity: 2 },
        { name: 'Power Mix', quantity: 1 }
      ]),
      delivered_at: new Date().toISOString()
    };
    const result = await sendDeliveryNotification(fakeOrder, null, 'Strong Spoon Team');
    if (result.success) {
      res.json({ success: true, message: `Test delivery email sent to ${to}` });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  });

  // Start the server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Strong Spoon server running on port ${PORT}`);
    console.log(`Stripe configured: ${stripe ? '✓' : '✗'}`);
    console.log(`Email service: ${resend ? '✓ Enabled' : '✗ Disabled'}`);
    console.log(`Health check available at: /health`);
  });
  
  server.on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
    process.exit(1);
  });
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
