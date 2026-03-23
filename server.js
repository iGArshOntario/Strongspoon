const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { Resend } = require('resend');

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
  return (now >= launchStart && now < launchEnd) ? 7.00 : 12.00;
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
        <strong style="color: #009688; font-size: 16px;">${item.name}</strong>
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
  <style>
    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #009688; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .footer { background: #f4f4f4; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #666; }
    .order-number { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
    .total { background: #009688; color: white; padding: 15px; text-align: center; font-size: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">💪 Strong Spoon</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">Order Confirmation</p>
    </div>
    
    <div class="content">
      <h2 style="color: #009688;">Thank You, ${orderData.customer_name}!</h2>
      <p>Your order has been confirmed and will be prepared shortly.</p>
      
      <div class="order-number">
        <strong>Order Number:</strong> ${orderData.order_number}<br>
        <strong>Date:</strong> ${new Date(orderData.created_at).toLocaleString('en-CA', { 
          timeZone: 'America/Toronto',
          dateStyle: 'long',
          timeStyle: 'short'
        })}
      </div>
      
      <h3 style="color: #009688;">Order Details</h3>
      ${itemsHTML}
      
      <div class="total">
        <strong>Total Paid: $${orderData.total_amount} CAD</strong><br>
        <span style="font-size: 14px;">(Tax Included)</span>
      </div>
      
      <h3 style="color: #009688;">Delivery Information</h3>
      <div style="background: #f8f8f8; padding: 15px; border-radius: 8px;">
        <strong>Name:</strong> ${orderData.customer_name}<br>
        <strong>Email:</strong> ${orderData.customer_email}<br>
        ${orderData.customer_phone ? `<strong>Phone:</strong> ${orderData.customer_phone}<br>` : ''}
        ${orderData.customer_address ? `<strong>Address:</strong> ${orderData.customer_address}` : ''}
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Strong Spoon - High-Protein Yogurt</strong></p>
      <p>Questions about your order? Reply to this email or contact us.</p>
      <p style="font-size: 12px; color: #999;">This is an automated confirmation email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Strong Spoon <orders@resend.dev>',
      to: [orderData.customer_email],
      subject: `Order Confirmation - ${orderData.order_number}`,
      html: emailHTML,
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
  <style>
    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 14px; color: #6b7280; border: 1px solid #e5e7eb; border-top: none; }
    .success-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
    .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">✅ Order Delivered!</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Strong Spoon order has arrived</p>
    </div>
    
    <div class="content">
      <div style="text-align: center; margin-bottom: 25px;">
        <span class="success-badge">🎉 Successfully Delivered</span>
      </div>
      
      <h2 style="color: #166534; margin-top: 0;">Hi ${orderData.customer_name}!</h2>
      <p>Great news! Your order has been delivered. We hope you enjoy your high-protein yogurt!</p>
      
      <div class="info-box">
        <strong>📦 Order:</strong> ${orderData.order_number}<br>
        <strong>🕐 Delivered:</strong> ${deliveredAt}<br>
        <strong>🚚 Delivered by:</strong> ${deliveryPerson}
      </div>
      
      <h3 style="color: #166534;">Your Items</h3>
      ${itemsHTML}
      
      ${proofImageHTML}
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #f59e0b;">
        <strong style="color: #92400e;">💡 Questions about your delivery?</strong>
        <p style="margin: 5px 0 0 0; color: #78350f; font-size: 14px;">Simply reply to this email and we'll get back to you as soon as possible.</p>
      </div>
    </div>
    
    <div class="footer">
      <p style="margin: 0;"><strong>💪 Strong Spoon</strong></p>
      <p style="margin: 5px 0 0 0;">High-Protein Yogurt for Champions</p>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">Thank you for choosing Strong Spoon!</p>
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

    let serverTotal = 0;
    const validatedItems = [];

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

      const itemTotal = getCurrentPrice() * item.quantity;
      serverTotal += itemTotal;

      validatedItems.push({
        name: product.name,
        size: product.size,
        quantity: item.quantity,
        price: PRODUCT_PRICE,
        toppings: validatedToppings,
        itemTotal: itemTotal
      });
    }

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
