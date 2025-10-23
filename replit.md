# Strong Spoon - High-Protein Yogurt Ordering Platform

## Overview

Strong Spoon is a full-stack e-commerce website for a Canadian health-focused yogurt brand. The platform allows customers to browse yogurt flavors, customize their orders with various toppings and fruits, add items to a shopping cart, and complete purchases using Stripe payment processing. The site features a responsive design with a complete shopping cart system and secure checkout flow.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (October 23, 2025)

### Flat Pricing Model - $9.99 (Tax Included) (Latest)
- **New Pricing Structure**: Changed from $8.99 + toppings + 13% tax to flat $9.99 per cup (tax-included)
- **Product Size**: All yogurt cups are now standardized at 250g
- **Free Toppings**: All toppings (almonds, cashews, peanuts, raisins, walnut, apple, blueberries) are now included at no extra charge
- **OFFER_MODE Toggle**: Added simple boolean switch in products.js to enable/disable "Tax Included" message display
- **Simplified Cart**: Removed tax calculation rows, now shows just Total with optional "Tax Included" note
- **Server Validation**: Updated payment processing to validate $9.99 flat rate per item
- **Product Pages**: Display "Price: $9.99 (Tax Included) - Size: 250g" with conditional visibility

## Recent Changes (October 23, 2025)

### Shopping Cart & Payment System Implementation
- **Added Complete Shopping Cart System**: Implemented full cart functionality with localStorage persistence
- **Stripe Payment Integration**: Integrated Stripe for secure payment processing with test and live mode support
- **Product Pricing Structure**: Flat $9.99 per cup (tax-included) with all toppings included
- **Cart Management**: Add, remove, update quantities, and calculate totals with flat pricing
- **Checkout Flow**: Complete checkout page with customer information and Stripe card element
- **Backend Server**: Created Node.js/Express server to handle Stripe payment intents and API key management
- **Cart Navigation**: Added cart icon with item counter across all pages
- **Responsive Cart UI**: Created cart and checkout pages with modern, responsive design

### Design & Typography Enhancements (Latest)
- **Premium Typography**: Added Playfair Display serif font for all major headings and titles
- **Enhanced Visual Hierarchy**: Improved font weights, sizes, and letter spacing across all pages
- **Gradient Title**: Main tagline "BITE INTO BETTER" now features gradient effect with teal accent
- **Button Improvements**: Enhanced button styling with better shadows, hover effects, and active states
- **Form Styling**: Upgraded input fields with better borders, focus states, and transitions
- **Checkbox Design**: Improved checkbox styling with teal accent color and hover effects
- **Fixed 404 Error**: Added emoji favicon (💪) to all pages to eliminate console errors
- **CSS Bug Fixes**: Corrected rgba() syntax error in box-shadow property
- **Better Spacing**: Improved padding, margins, and line-height throughout for better readability
- **Professional Polish**: Overall refinement of UI for a more premium, cohesive look

### Floating Cart Icon (Apple Assistive Touch Style)
- **Draggable Cart**: Cart icon can now be dragged anywhere on the screen
- **Touch Support**: Works with both mouse and touch gestures
- **Position Memory**: Remembers your preferred position using localStorage
- **Smooth Animations**: Fluid drag-and-drop with smooth transitions
- **Enhanced Shadows**: Deeper shadows and backdrop blur for floating effect
- **Grab Cursor**: Visual feedback showing it's draggable
- **Mobile Optimized**: Smaller size on mobile with touch-action controls

### Premium Customization UI
- **Custom Checkboxes**: Replaced default browser checkboxes with premium custom-designed checkboxes
- **Animated Checkmarks**: Smooth bounce animation when selecting toppings
- **Card-style Layout**: Each topping in its own card with hover effects
- **Gradient Fills**: Checked boxes have beautiful teal gradients with glow effects
- **Slide Animation**: Cards slide right on hover for interactive feedback
- **Mobile Responsive**: Optimized sizing and spacing for mobile devices
- **Better Typography**: Section titles use Playfair Display serif font

### Premium Animation System (Latest)
- **Entrance Animations**: Added slideUp, slideInLeft, slideInRight, scaleIn, fadeIn, and bounceIn animations for page load
- **Staggered Button Animations**: Flavor selection buttons animate in sequence with progressive delays
- **Floating Product Images**: Yogurt cup images have continuous floating animation with hover scale effect
- **Animated Gradient Title**: "BITE INTO BETTER" features color-shifting gradient animation
- **Button Hover Enhancements**: Buttons lift up, scale, and glow on hover with smooth transitions
- **Cart Icon Animations**: Slides in from right on page load, cart counter pulses when items added
- **Cart Item Animations**: Each cart item slides in from left with hover effects
- **Form Focus Effects**: Input fields lift slightly on focus with glowing border
- **Price Bounce**: Product prices bounce in for attention-grabbing effect
- **Smooth Transitions**: All interactive elements have 0.3-0.4s smooth transitions
- **Mobile Optimized**: All animations work smoothly on mobile devices without performance issues

## System Architecture

### Frontend Architecture

**Technology Stack:**
- HTML5, CSS3, and vanilla JavaScript
- No frontend frameworks or build tools required
- Stripe.js for payment processing
- LocalStorage for cart persistence

**Page Structure:**
- `index.html` - Landing page with brand introduction and "Bite Into Better" tagline
- `Html2.html` - Product selection page listing available flavors
- `Brown issues.html` - Product detail page for the Brownie Issues flavor with pricing
- `Customise.html` - Order customization form with add-to-cart functionality
- `cart.html` - Shopping cart page with item management and totals
- `checkout.html` - Checkout page with Stripe payment integration

**JavaScript Files:**
- `script.js` - Core functionality including ShoppingCart class, smooth scrolling, cart counter
- `products.js` - Product and topping data structure with prices
- `cart-page.js` - Cart page logic for rendering items and managing quantities
- `customise-page.js` - Customization form handler to add items to cart
- `checkout-page.js` - Checkout and Stripe payment processing logic

**Design Decisions:**
- Modern e-commerce architecture with client-side cart and server-side payment processing
- Single CSS file (`style.css`) for global styling using Google Fonts (Poppins, Playfair Display, Great Vibes)
- Black background (#000) with white text for brand aesthetic
- Teal accent color (#009688) for buttons and highlights with gradient effects
- Premium serif typography (Playfair Display) for headings creating elegant hierarchy
- Enhanced interactive elements with smooth transitions and micro-animations
- Emoji favicon (💪) representing the "Strong Spoon" brand strength theme
- Mobile-responsive design using viewport meta tags and flexible layouts
- Fixed cart icon in top-right corner across all pages with floating effect

**Client-Side Logic:**
- ShoppingCart class managing add/remove/update operations
- LocalStorage persistence for cart across page refreshes
- Dynamic cart counter badge showing item count
- Real-time price calculations including tax (13% HST)
- Stripe Elements integration for secure card input
- Form validation for customer information

### Backend Architecture

**Technology Stack:**
- Node.js v20 with Express.js web framework
- Stripe Node.js SDK for payment processing
- CORS enabled for API access
- Environment variables for API key management

**Server Implementation (server.js):**
- Express server running on port 5000
- Static file serving for HTML/CSS/JS assets
- RESTful API endpoints for Stripe integration

**API Endpoints:**
- `GET /get-stripe-key` - Returns Stripe publishable key to frontend
- `POST /create-payment-intent` - Creates Stripe payment intent with order details
- Static file serving for all HTML, CSS, JS, and image assets

**Payment Processing Flow:**
1. Customer completes checkout form with card details
2. Frontend calls `/create-payment-intent` with order data
3. Server creates Stripe PaymentIntent with amount in cents (CAD)
4. Server returns clientSecret to frontend
5. Frontend confirms card payment using Stripe.js
6. On success, cart is cleared and customer redirected to homepage

**Security:**
- Stripe secret key stored in environment variable (STRIPE_SECRET_KEY)
- Payment processing handled server-side
- No sensitive card data touches the server (handled by Stripe.js)
- CORS configured for API access

**Future Considerations:**
- Add order history storage in database
- Implement user authentication for saved orders
- Add email confirmation using SendGrid or similar
- Webhook handling for payment confirmations
- Admin dashboard for order management

### Data Storage Solutions

**Current Implementation:**
- Browser localStorage for shopping cart persistence
- Cart items stored as JSON with product details, toppings, quantities
- No persistent database for order history

**Data Schema:**

**Products (products.js):**
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  image: string
}
```

**Toppings (products.js):**
```javascript
{
  name: string,
  price: number
}
```

**Cart Items (localStorage):**
```javascript
{
  id: string,
  name: string,
  description: string,
  price: number,
  toppings: [{name, price}],
  quantity: number,
  addedAt: timestamp
}
```

**Order Data (sent to Stripe):**
```javascript
{
  customer: {name, email, phone, address},
  items: [...cartItems],
  subtotal: number,
  tax: number,
  total: number
}
```

**Future Requirements:**
- Persistent database for order history (PostgreSQL recommended)
- Tables: users, orders, products, toppings, order_items
- Consider inventory management for toppings and flavors
- Store completed orders for customer reference
- Admin dashboard for viewing and managing orders

### Authentication and Authorization

**Current State:**
- No user authentication required for purchases (guest checkout)
- Customer information collected at checkout only
- No user accounts or login system
- Cart stored in browser localStorage (device-specific)

**Payment Security:**
- Stripe handles all payment card data (PCI compliant)
- Server-side payment processing with secret key
- No card data stored on our servers
- HTTPS required in production

**Future Needs:**
- Optional user accounts for order history
- Password hashing with bcrypt
- JWT or session-based authentication
- Save delivery addresses and payment methods
- Order tracking for registered users
- Admin authentication for order management dashboard

## External Dependencies

### Frontend Libraries
- **Google Fonts API** - Poppins (body text), Playfair Display (headings), and Great Vibes (decorative) font families for typography
- **Stripe.js (v3)** - Stripe's official JavaScript library for secure payment processing
- Vanilla JavaScript (no framework dependencies)

### Backend Dependencies (package.json)
- **express** (^4.x) - Web server framework
- **stripe** (latest) - Stripe Node.js SDK for payment processing
- **cors** (latest) - Cross-Origin Resource Sharing middleware

### Assets
- `strongspoon-logo.jpeg` - Brand logo image
- `Chocolate.png` - Product image for Brownie Issues flavor

### Environment Variables (Replit Secrets)
- `STRIPE_PUBLISHABLE_KEY` - Public key for Stripe.js (client-side)
- `STRIPE_SECRET_KEY` - Private key for Stripe API (server-side)
- `PORT` - Server port (defaults to 5000)

### Stripe Integration
- **Type**: Full payment processing with Payment Intents API
- **Currency**: CAD (Canadian Dollar)
- **Features Used**: 
  - Stripe Elements for secure card input
  - Payment Intents for server-side charge creation
  - Metadata storage for order details

### Future Integrations
- Email service for order confirmations (SendGrid, Mailgun, or Resend)
- SMS notifications via Twilio
- Analytics tracking (Google Analytics or Plausible)
- Delivery/logistics API integration
- Order management webhook handlers