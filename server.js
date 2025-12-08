const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Resend email client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!process.env.RESEND_API_KEY) {
  console.warn('⚠️  WARNING: RESEND_API_KEY not set! Email confirmations will be disabled.');
  console.warn('⚠️  Add RESEND_API_KEY to Replit Secrets to enable order confirmation emails.');
}

const PRODUCT_PRICE = 9.99;
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
          Quantity: ${item.quantity} × $${PRODUCT_PRICE} = $${(item.quantity * PRODUCT_PRICE).toFixed(2)}
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

const PRODUCTS = {
  'brownie': {
    id: 'brownie',
    name: 'Brownie Issues',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE
  },
  'powerMix': {
    id: 'powerMix',
    name: 'Power Mix',
    price: PRODUCT_PRICE,
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
app.use(express.json());
app.use(express.static('.'));

app.get('/get-stripe-key', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { customer, items, deliveryDate, deliveryTimeSlot } = req.body;
    
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

      const itemTotal = PRODUCT_PRICE * item.quantity;
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
        delivery_date: deliveryDate || '',
        delivery_time_slot: deliveryTimeSlot || '',
        items: JSON.stringify(validatedItems),
        total: serverTotal.toFixed(2),
        pricing: 'Flat rate $9.99 per cup (tax included)'
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
        delivery_date,
        delivery_time_slot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      // Fallback query without delivery scheduling columns
      console.log('Using fallback query (delivery columns may not exist)');
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
          delivery_date,
          delivery_time_slot,
          created_at
        FROM orders
        WHERE order_status IN ('pending', 'completed')
        ORDER BY created_at ASC
      `;
      result = await pool.query(fullQuery);
    } catch (columnError) {
      // Fallback query without delivery scheduling columns
      console.log('Using fallback query for delivery (delivery columns may not exist)');
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
          created_at
        FROM orders
        WHERE order_status IN ('pending', 'completed')
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
      RETURNING id, order_number, order_status, delivered_at
    `;
    
    const result = await pool.query(query, [deliveryProof, deliveryPerson, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    console.log('✅ Delivery proof uploaded for order:', result.rows[0].order_number);
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    console.error('Error submitting delivery proof:', error);
    res.status(500).json({ error: 'Failed to submit delivery proof' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Strong Spoon server running on port ${PORT}`);
  console.log(`Stripe configured: ${process.env.STRIPE_SECRET_KEY ? '✓' : '✗'}`);
  console.log(`Email service: ${resend ? '✓ Enabled' : '✗ Disabled (set RESEND_API_KEY)'}`);
});
