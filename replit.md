# Strong Spoon - High-Protein Dessert Ordering Platform

## Overview
Strong Spoon is an e-commerce platform for a Canadian health-focused dessert brand operating in Regina, SK. It allows customers to browse high-protein dessert flavors, customize orders, add to a shopping cart, and purchase using Stripe. The platform supports both delivery and pickup options. The business aims to offer a premium online ordering experience for health-conscious consumers, focusing on a responsive design, a comprehensive shopping cart, and a secure checkout process.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a modern, responsive design with a dark theme (black background, white text), accented by teal (#009688) for interactive elements. It uses premium serif typography (Playfair Display) for headings. Interactive elements include custom checkboxes, card-style layouts, enhanced buttons with shadows and hover effects, and micro-animations for various interactions. A draggable, floating cart icon is implemented for accessibility. Mobile optimization is a key focus, ensuring a seamless experience across devices with touch-friendly controls.

### Technical Implementations
The frontend is built with HTML5, CSS3, and vanilla JavaScript, using localStorage for shopping cart persistence and Stripe.js for client-side payments. The backend is a Node.js Express.js server handling Stripe payment intents and managing API keys via environment variables. Email order confirmations are sent using the Resend API with HTML templates. The platform functions as a Progressive Web App (PWA) with service worker caching for offline capabilities and mobile installation.

### Feature Specifications
- **Product Catalog**: Displays dessert flavors with a flat pricing model.
- **Order Customization**: Allows customers to select from various toppings.
- **Shopping Cart System**: Provides full functionality for adding, removing, and updating quantities, with real-time total calculations and persistent state.
- **Delivery Scheduling**: Customers can select preferred delivery dates and time slots, with a minimum advance order requirement and timezone-aware validation.
- **Secure Checkout**: Integrates with Stripe's Payment Intents API for secure payment processing.
- **Order Confirmation**: Automated email confirmations sent via Resend API post-purchase.
- **Order Management System**: An admin dashboard (`orders.html`) for tracking order status, managing statistics, viewing delivery proofs, and analyzing order data. Includes features for customer feedback review.
- **Customer Feedback System**: Allows customers to submit star ratings and comments, with featured reviews displayed publicly and all reviews accessible in the admin dashboard.
- **Delivery Tracking Portal**: A mobile-friendly interface (`delivery.html`) for delivery personnel, including camera integration for proof of delivery and secure authentication.
- **Instant Delivery Notifications**: Customers receive email notifications with proof of delivery photos immediately upon order completion.
- **Trainer Codes & Loyalty System**: Supports trainer-specific discount codes, offering free toppings for new customers and free cups for repeat loyalty. Tracks commission for trainers in the admin dashboard.
- **Customer Self-Service Reschedule**: Customers can look up and reschedule their delivery orders via a dedicated page (`manage-order.html`).
- **Admin Reschedule & Reminders**: Admin users can reschedule delivery dates and notify customers. Automated 24-hour delivery reminder emails are sent to customers.
- **Promo/Discount Code System**: Supports promotional codes for discounts, managed via the admin dashboard with real-time validation.
- **Daily Order Cap**: Limits the number of orders per day, with real-time tracking and a "Sold Out" display when the cap is reached.
- **Customer CRM**: Admin dashboard aggregates customer data, including order count and total spent.
- **Print Order Tickets**: Allows printing clean order tickets directly from the admin dashboard.
- **Contact & FAQ Page**: A dedicated page (`contact.html`) with an accordion FAQ and contact information.
- **Website Traffic Analytics**: Tracks page views and traffic sources, displayed in the admin dashboard with various timeframes.

### System Design Choices
The architecture emphasizes a client-side rich user experience combined with a server-side component for secure payment processing, separating sensitive data handling. Extensive animations and responsive design prioritize user engagement. The flat pricing model simplifies the customer purchasing journey.

## External Dependencies

### Frontend Libraries
- **Google Fonts API**: For "Poppins", "Playfair Display", and "Great Vibes" fonts.
- **Stripe.js (v3)**: Client-side payment processing.

### Backend Dependencies
- **Node.js**: Runtime environment.
- **Express.js**: Web framework.
- **Stripe Node.js SDK**: Server-side Stripe API interactions.
- **CORS**: Cross-Origin Resource Sharing middleware.
- **Resend API**: Transactional email sending.

### Assets
- `strongspoon-logo.jpeg`
- Product images (e.g., `Chocolate.png`)

### Database Schema
- **orders table**: Stores order details, customer info, items (JSONB), payment status, order type, delivery/pickup schedule, and delivery proof. Includes columns for trainer codes and loyalty.
- **trainer_codes table**: Stores trainer code details (code, trainer_name, active).
- **promo_codes DB table**: Manages promotional codes.
- **app_settings DB table**: Stores application-wide settings, such as daily order caps.
- **page_views DB table**: Stores website traffic data.

### Environment Variables
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `ADMIN_PASSWORD`
- `DELIVERY_PASSWORD`
- `PORT`