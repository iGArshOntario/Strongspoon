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
           .text(`${orderData.delivery_date}  ${orderData.delivery_time_slot || ''}`, 350, 145);
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

function getCurrentPrice() {
  const now = Date.now();
  const launchStart = new Date('2026-04-10T08:00:00-05:00').getTime();
  const launchEnd   = new Date('2026-04-11T08:00:00-05:00').getTime();
  return (now >= launchStart && now < launchEnd) ? 7.00 : 11.99;
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
      <div style="background: #f8f8f8; padding: 15px; margin: 10px 0; border-radius: 8px;">
        <strong style="color: #015A64; font-size: 16px;">${item.name}</strong>
        ${item.toppings && item.toppings.length > 0 ? `
          <div style="margin-top: 8px; color: #666;">
            <strong>Toppings:</strong> ${item.toppings.map(t => t.name).join(', ')}
          </div>
        ` : ''}
        <div style="margin-top: 8px; color: #333;">
          Quantity: ${item.quantity} × $${getCurrentPrice().toFixed(2)} = $${(item.quantity * getCurrentPrice()).toFixed(2)}
        </div>
      </div>
    `).join('');

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .wrapper { background: #f5f5f5; padding: 30px 15px; }
    .container { max-width: 580px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #015A64 0%, #013e4a 100%); color: #EFE8D8; padding: 36px 30px 28px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif; }
    .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.88; }
    .content { background: #ffffff; padding: 32px 30px; }
    .greeting { font-size: 20px; font-weight: 700; color: #015A64; margin: 0 0 8px; }
    .section-title { color: #015A64; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 10px; border-bottom: 2px solid #d0eaed; padding-bottom: 6px; }
    .order-badge { background: #d0eaed; border-left: 4px solid #015A64; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 18px 0; font-size: 14px; }
    .total-box { background: linear-gradient(135deg, #015A64 0%, #013e4a 100%); color: #EFE8D8; padding: 16px; text-align: center; font-size: 20px; font-weight: 700; border-radius: 10px; margin: 20px 0; }
    .info-row { background: #f0f8f9; padding: 14px 16px; border-radius: 8px; font-size: 14px; line-height: 1.8; }
    .footer { background: #1a1a1a; color: #aaa; padding: 24px 30px; text-align: center; font-size: 13px; }
    .footer strong { color: #017d8e; }
    .item-card { border: 1px solid #e8e8e8; border-radius: 8px; padding: 14px; margin: 10px 0; background: #fafafa; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
  <div class="container">
    <div class="header">
      ${LOGO_IMG_TAG}
      <h1>Order Confirmed ✓</h1>
      <p>Your Strong Spoon order is on its way!</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${orderData.customer_name}!</p>
      <p style="color:#555;margin:0 0 4px;">Your order has been confirmed and will be prepared shortly.</p>

      <p class="section-title">Order Reference</p>
      <div class="order-badge">
        <strong>Order #${orderData.order_number}</strong><br>
        📅 ${new Date(orderData.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long', timeStyle: 'short' })}
      </div>

      <p class="section-title">Items Ordered</p>
      ${itemsHTML}

      <div class="total-box">Total Paid: $${orderData.total_amount} CAD</div>

      <p class="section-title">Your Details</p>
      <div class="info-row">
        👤 ${orderData.customer_name}<br>
        📧 ${orderData.customer_email}<br>
        ${orderData.customer_phone ? `📞 ${orderData.customer_phone}<br>` : ''}
        ${orderData.customer_address ? `📍 ${orderData.customer_address}` : ''}
      </div>
    </div>
    <div class="footer">
      <strong>💪 Strong Spoon</strong><br>
      High-Protein Dessert for Champions<br>
      <span style="font-size:12px;color:#666;margin-top:10px;display:block;">Questions? Reply to this email · Regina, SK</span>
    </div>
  </div>
  </div>
</body>
</html>
    `;

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
      from: 'Strong Spoon <orders@resend.dev>',
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
      <div style="background: #f0fdf4; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #22c55e;">
        <strong style="color: #166534;">${item.name || 'Item'}</strong>
        <span style="color: #666; margin-left: 10px;">× ${item.quantity || 1}</span>
      </div>
    `).join('');

    // Prepare the proof image as an inline attachment
    let attachments = [];
    let proofImageHTML = '';
    
    if (deliveryProof && deliveryProof.startsWith('data:image/')) {
      // Extract content type and base64 data
      const matches = deliveryProof.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        const contentType = matches[1];
        const base64Data = matches[2];
        const extension = contentType.split('/')[1] || 'jpeg';
        
        // Convert base64 to Buffer for Resend API
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        attachments = [{
          filename: `delivery-proof.${extension}`,
          content: imageBuffer,
          contentType: contentType,
          cid: 'deliveryproof'
        }];
        
        proofImageHTML = `
          <div style="margin: 20px 0; text-align: center;">
            <p style="color: #666; margin-bottom: 10px; font-size: 14px;">📷 Proof of Delivery</p>
            <img src="cid:deliveryproof" alt="Delivery Proof" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          </div>
        `;
      }
    }

    const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .wrapper { background: #f5f5f5; padding: 30px 15px; }
    .container { max-width: 580px; margin: 0 auto; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #015A64 0%, #013e4a 100%); color: #EFE8D8; padding: 36px 30px 28px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; font-family: 'Playfair Display', Georgia, serif; }
    .header p { margin: 6px 0 0; font-size: 14px; opacity: 0.88; }
    .content { background: #ffffff; padding: 32px 30px; }
    .greeting { font-size: 20px; font-weight: 700; color: #015A64; margin: 0 0 8px; }
    .section-title { color: #015A64; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 10px; border-bottom: 2px solid #d0eaed; padding-bottom: 6px; }
    .delivered-badge { display: inline-block; background: #d0eaed; color: #00695c; padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 15px; margin-bottom: 20px; }
    .info-box { background: #f0f8f9; border-left: 4px solid #015A64; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 15px 0; font-size: 14px; line-height: 1.9; }
    .footer { background: #1a1a1a; color: #aaa; padding: 24px 30px; text-align: center; font-size: 13px; }
    .footer strong { color: #017d8e; }
    .item-card { border: 1px solid #e8e8e8; border-radius: 8px; padding: 14px; margin: 10px 0; background: #fafafa; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
  <div class="container">
    <div class="header">
      ${LOGO_IMG_TAG}
      <h1>✅ Your Order Has Arrived!</h1>
      <p>Strong Spoon delivered — enjoy every spoonful</p>
    </div>
    <div class="content">
      <div style="text-align:center;">
        <span class="delivered-badge">🎉 Successfully Delivered</span>
      </div>
      <p class="greeting">Hi ${orderData.customer_name}!</p>
      <p style="color:#555;margin:0 0 4px;">Great news! Your order has been delivered. We hope you enjoy your high-protein dessert!</p>

      <p class="section-title">Delivery Info</p>
      <div class="info-box">
        📦 <strong>Order:</strong> ${orderData.order_number}<br>
        🕐 <strong>Delivered:</strong> ${deliveredAt}<br>
        🚚 <strong>Delivered by:</strong> ${deliveryPerson}
      </div>

      <p class="section-title">Your Items</p>
      ${itemsHTML}

      ${proofImageHTML}

      <div style="background:#fff8e1;padding:14px 16px;border-radius:8px;margin-top:20px;border-left:4px solid #f59e0b;font-size:14px;">
        <strong style="color:#7c4f00;">💡 Questions about your delivery?</strong><br>
        <span style="color:#78350f;">Simply reply to this email and we'll get back to you.</span>
      </div>
    </div>
    <div class="footer">
      <strong>💪 Strong Spoon</strong><br>
      High-Protein Dessert for Champions<br>
      <span style="font-size:12px;color:#666;margin-top:10px;display:block;">Thank you for choosing Strong Spoon · Regina, SK</span>
    </div>
  </div>
  </div>
</body>
</html>
    `;

    const emailOptions = {
      from: 'Strong Spoon <orders@resend.dev>',
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
  }
};

const TOPPINGS = {
  'almonds': { name: 'Almonds', price: 0 },
  'cashews': { name: 'Cashews', price: 0 },
  'peanuts': { name: 'Peanuts', price: 0 },
  'raisins': { name: 'Raisins', price: 0 },
  'walnut': { name: 'Walnut', price: 0 },
  'apple': { name: 'Apple', price: 0 },
  'blueberries': { name: 'Blueberries', price: 0 }
};

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

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { customer, items, orderType, deliveryDate, deliveryTimeSlot } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const validatedItems = [];
    let totalCups = 0;
    let toppingsFee = 0;

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
      if (validatedToppings.length > 0) toppingsFee += item.quantity;

      validatedItems.push({
        name: product.name,
        size: product.size,
        quantity: item.quantity,
        toppings: validatedToppings
      });
    }

    // Bundle pricing: 1 cup $11.99 | 2 cups $19.99 | 4 cups $35.99
    function getBundleBaseTotal(cups) {
      const isLaunchDay = Date.now() >= new Date('2026-04-10T08:00:00-05:00').getTime() &&
                          Date.now() <  new Date('2026-04-11T08:00:00-05:00').getTime();
      if (isLaunchDay) return cups * getCurrentPrice();
      let c = cups, total = 0;
      while (c >= 4) { total += 35.99; c -= 4; }
      if (c >= 2)    { total += 19.99; c -= 2; }
      total += c * 11.99;
      return Math.round(total * 100) / 100;
    }

    const bundleBase = getBundleBaseTotal(totalCups);
    const serverTotal = Math.round((bundleBase + toppingsFee) * 100) / 100;
    const amountInCents = Math.round(serverTotal * 100);

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
        total: serverTotal.toFixed(2),
        pricing: `Flat rate $${getCurrentPrice().toFixed(2)} per cup (tax included)`
      },
    });

    console.log('Payment Intent Created:', paymentIntent.id, 
                'Amount:', serverTotal.toFixed(2), 'CAD',
                'Items:', validatedItems.length);

    res.json({
      clientSecret: paymentIntent.client_secret,
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
    const to = req.query.to || 'arsh99591@gmail.com';
    const html = `
<!DOCTYPE html><html><head>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
  body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5;}
  .wrapper{background:#f5f5f5;padding:30px 15px;}
  .container{max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.12);}
  .header{background:linear-gradient(135deg,#015A64 0%,#013e4a 100%);color: #EFE8D8;padding:36px 30px 28px;text-align:center;}
  .header h1{margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;font-family:'Playfair Display',Georgia,serif;}
  .header p{margin:6px 0 0;font-size:14px;opacity:.88;}
  .content{background:#fff;padding:32px 30px;}
  .greeting{font-size:20px;font-weight:700;color:#015A64;margin:0 0 8px;}
  .section-title{color:#015A64;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:24px 0 10px;border-bottom:2px solid #d0eaed;padding-bottom:6px;}
  .order-badge{background:#d0eaed;border-left:4px solid #015A64;padding:14px 16px;border-radius:0 8px 8px 0;margin:18px 0;font-size:14px;}
  .total-box{background:linear-gradient(135deg,#015A64 0%,#013e4a 100%);color: #EFE8D8;padding:16px;text-align:center;font-size:20px;font-weight:700;border-radius:10px;margin:20px 0;}
  .info-row{background:#f0f8f9;padding:14px 16px;border-radius:8px;font-size:14px;line-height:1.8;}
  .footer{background:#1a1a1a;color:#aaa;padding:24px 30px;text-align:center;font-size:13px;}
  .footer strong{color:#017d8e;}
  .item-card{border:1px solid #e8e8e8;border-radius:8px;padding:14px;margin:10px 0;background:#fafafa;font-size:14px;}
</style></head>
<body><div class="wrapper"><div class="container">
  <div class="header">
    ${LOGO_IMG_TAG}
    <h1>Order Confirmed ✓</h1>
    <p>Your Strong Spoon order is on its way!</p>
  </div>
  <div class="content">
    <p class="greeting">Hi Arsh!</p>
    <p style="color:#555;margin:0 0 4px;">This is a sample order confirmation email showing the new design with your logo.</p>
    <p class="section-title">Order Reference</p>
    <div class="order-badge"><strong>Order #SS-SAMPLE-001</strong><br>📅 March 25, 2026 at 10:30 AM</div>
    <p class="section-title">Items Ordered</p>
    <div class="item-card"><strong>Brownie Issues</strong> — Chocolate high-protein dessert<br>
      <span style="color:#777;font-size:13px;">Toppings: Almonds, Cashews</span><br>
      <span style="margin-top:6px;display:block;">Quantity: 2 × $11.99 = $23.98</span>
    </div>
    <div class="total-box">Total Paid: $23.98 CAD</div>
    <p class="section-title">Your Details</p>
    <div class="info-row">👤 Arsh<br>📧 ${to}<br>📍 Regina, SK</div>
  </div>
  <div class="footer">
    <strong>💪 Strong Spoon</strong><br>
    High-Protein Dessert for Champions<br>
    <span style="font-size:12px;color:#666;margin-top:10px;display:block;">Questions? Reply to this email · Regina, SK</span>
  </div>
</div></div></body></html>`;
    // Generate sample PDF invoice
    const sampleOrder = {
      order_number: 'SS-SAMPLE-001',
      customer_name: 'Arsh',
      customer_email: to,
      customer_phone: '+1 (306) 555-0199',
      customer_address: '123 Wascana St, Regina, SK',
      items: JSON.stringify([
        { name: 'Brownie Issues', quantity: 2, price: 11.99, toppings: [{ name: 'Almonds' }, { name: 'Cashews' }] },
        { name: 'Golden Scoop', quantity: 1, price: 11.99, toppings: [] },
      ]),
      total_amount: '35.97',
      created_at: new Date().toISOString(),
      order_type: 'delivery',
      delivery_date: 'April 10, 2026',
      delivery_time_slot: 'Morning 8AM–12PM',
    };
    let pdfAttachments = [];
    try {
      const pdfBuffer = await generateInvoicePDF(sampleOrder);
      pdfAttachments = [{ filename: 'StrongSpoon-Invoice-SS-SAMPLE-001.pdf', content: pdfBuffer, contentType: 'application/pdf' }];
    } catch(e) { console.error('Test PDF error:', e.message); }

    const { data, error } = await resend.emails.send({
      from: 'Strong Spoon <orders@resend.dev>',
      to: [to],
      subject: '📧 Strong Spoon — Sample Email Design',
      html,
      attachments: pdfAttachments,
    });
    if (error) return res.status(500).json({ error });
    res.json({ success: true, message: `Test email sent to ${to}`, id: data?.id });
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
