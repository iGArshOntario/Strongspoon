const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const PRODUCTS = {
  'brownie': {
    id: 'brownie',
    name: 'Brownie Issues',
    price: 8.99
  },
  'powerMix': {
    id: 'powerMix',
    name: 'Power Mix',
    price: 8.99
  }
};

const TOPPINGS = {
  'almonds': { name: 'Almonds', price: 1.50 },
  'cashews': { name: 'Cashews', price: 1.50 },
  'peanuts': { name: 'Peanuts', price: 1.00 },
  'raisins': { name: 'Raisins', price: 1.00 },
  'dryFruits': { name: 'Crushed Dry Fruits', price: 2.00 },
  'apple': { name: 'Apple', price: 1.50 },
  'blueberries': { name: 'Blueberries', price: 2.00 }
};

const TAX_RATE = 0.13;

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

    let serverSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = PRODUCTS[item.id];
      if (!product) {
        console.warn(`Invalid product ID: ${item.id}`);
        return res.status(400).json({ error: `Invalid product: ${item.id}` });
      }

      let itemPrice = product.price;
      let toppingsPrice = 0;
      const validatedToppings = [];

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        console.warn(`Invalid quantity for ${item.id}: ${item.quantity}`);
        return res.status(400).json({ error: `Invalid quantity for ${item.name}` });
      }

      if (item.toppings && item.toppings.length > 0) {
        for (const topping of item.toppings) {
          const validTopping = Object.values(TOPPINGS).find(t => t.name === topping.name);
          if (validTopping) {
            toppingsPrice += validTopping.price;
            validatedToppings.push(validTopping);
          } else {
            console.warn(`Invalid topping rejected: ${topping.name}`);
            return res.status(400).json({ error: `Invalid topping: ${topping.name}` });
          }
        }
      }

      const itemTotal = (itemPrice + toppingsPrice) * item.quantity;
      serverSubtotal += itemTotal;

      validatedItems.push({
        name: product.name,
        quantity: item.quantity,
        basePrice: itemPrice,
        toppings: validatedToppings,
        itemTotal: itemTotal
      });
    }

    const serverTax = serverSubtotal * TAX_RATE;
    const serverTotal = serverSubtotal + serverTax;

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
        subtotal: serverSubtotal.toFixed(2),
        tax: serverTax.toFixed(2),
        total: serverTotal.toFixed(2)
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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Strong Spoon server running on port ${PORT}`);
  console.log(`Stripe configured: ${process.env.STRIPE_SECRET_KEY ? '✓' : '✗'}`);
});
