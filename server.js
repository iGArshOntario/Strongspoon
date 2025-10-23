const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const PRODUCT_PRICE = 9.99;
const PRODUCT_SIZE = '250g';

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
    const { customer, items } = req.body;
    
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
        order_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      'completed'
    ];
    
    const result = await pool.query(query, values);
    
    console.log('Order saved after payment verification:', result.rows[0].order_number);
    
    res.json({
      success: true,
      orderNumber: result.rows[0].order_number,
      orderId: result.rows[0].id
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
    
    const query = `
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
        created_at
      FROM orders
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      orders: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Strong Spoon server running on port ${PORT}`);
  console.log(`Stripe configured: ${process.env.STRIPE_SECRET_KEY ? '✓' : '✗'}`);
});
