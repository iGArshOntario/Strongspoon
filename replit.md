# Strong Spoon - High-Protein Dessert Ordering Platform

## Overview
Strong Spoon is a full-stack e-commerce platform for a Canadian health-focused dessert brand **serving Regina, SK only**. It enables customers to browse high-protein dessert flavors, customize orders with toppings, add items to a shopping cart, and complete purchases using Stripe. The platform features a responsive design, a complete shopping cart system, and a secure checkout flow, with a dynamic pricing model of $12 per 250g cup (tax-included), dropping to $7 during the 24-hour launch window (April 10–11, 2026), including all toppings and taxes. Customers can choose between **delivery** or **pickup** during checkout. The business vision is to provide a seamless and premium online ordering experience for health-conscious consumers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a modern, responsive design with a black background and white text aesthetic, accented by a teal color (#009688) for buttons and highlights. Premium serif typography (Playfair Display) is used for headings, creating an elegant visual hierarchy. Interactive elements include custom checkboxes with bounce animations, card-style layouts for toppings, and enhanced button styling with shadows and hover effects. Micro-animations are used throughout for entrance effects, floating product images, and cart interactions. A draggable, floating cart icon, inspired by Apple Assistive Touch, enhances user accessibility and convenience. Mobile optimization is a core focus, ensuring a seamless experience across various devices, including iPhones and tablets, with touch-friendly controls and responsive typography.

### Technical Implementations
The frontend is built using HTML5, CSS3, and vanilla JavaScript, leveraging localStorage for shopping cart persistence and Stripe.js for secure client-side payment processing. There are no frontend frameworks or build tools. The backend is a Node.js Express.js server that handles Stripe payment intents and manages API keys securely using environment variables. Email order confirmations are sent automatically using the Resend API, featuring professional HTML templates. The platform is deployed as a Progressive Web App (PWA) at strongspoon.ca with service worker caching for offline functionality and installability on mobile devices.

### Feature Specifications
- **Product Catalog**: Allows browsing of dessert flavors with flat pricing — $12.99 per 250g cup (tax-included), $7 during the 24-hour launch window (April 10, 2026 8 AM – April 11, 2026 8 AM CST). No bundle system — flat rate per cup. Toppings are +$1 flat per order.
- **Order Customization**: Customers can select from a variety of toppings at +$1 per cup (almonds, cashews, peanuts, raisins, walnut, apple, blueberries).
- **Shopping Cart System**: Full cart functionality with add, remove, update quantities, and real-time total calculations. Cart state persists across sessions using localStorage.
- **Delivery Scheduling**: Customers can select preferred delivery date and time slot (Morning 8AM-12PM, Afternoon 12PM-4PM, Evening 4PM-8PM) during checkout. System enforces 12-hour minimum advance order requirement with timezone-aware validation. Scheduled delivery information is displayed in admin dashboard and delivery portal.
- **Secure Checkout**: Integration with Stripe for secure payment processing using Payment Intents API.
- **Order Confirmation**: Automatic email confirmations sent to customers via Resend API after successful payment, including detailed order information.
- **Order Management System**: Complete admin dashboard (orders.html) with order status tracking (Pending/Completed/Delivered), statistics cards, status management, and delivery proof viewing. All orders start as "Pending" for proper workflow management. Includes Analytics section with multiple timeframes (All Time, 24 Hours, 7 Days, 14 Days) showing total orders, revenue, completion rate, average order value, delivery lead time, and top products. Also includes Past Deliveries section showing orders delivered in the last 24 hours with proof photos.
- **Customer Feedback System**: Customers can leave star ratings (1–5), comments, name, and flavour via feedback.html. Featured reviews (4–5 stars) display publicly on the flavours listing page. All reviews visible in the admin dashboard (orders.html). API: POST /api/feedback (public), GET /api/feedback/featured (public), GET /admin/feedback (admin auth).
- **Delivery Tracking Portal**: Mobile-friendly delivery interface (delivery.html) for delivery personnel with camera integration for proof of delivery photos, secured with DELIVERY_PASSWORD authentication to protect customer PII. Includes Past Deliveries (24 hours) section showing recently completed deliveries.
- **Instant Delivery Notifications**: Customers receive automatic email notifications immediately when their order is marked as delivered. The email includes the proof of delivery photo embedded inline, delivery person name, order details, and timestamp (Toronto timezone).
- **Responsive Design**: Optimized for various screen sizes, from mobile (iPhone SE, iPhone 15 Pro) to tablets.
- **Interactive UI**: Features premium animations, custom form elements, and a draggable cart icon.
- **Progressive Web App (PWA)**: Installable as a mobile app on iOS and Android. Includes manifest.json, service worker for offline caching, and Apple-specific meta tags for home screen installation. Runs in standalone mode when installed.

### System Design Choices
The architecture follows a modern e-commerce pattern with a client-side rich user experience and a server-side component primarily for secure payment processing. This separation ensures that sensitive payment information never touches the application's server, enhancing security. The system prioritizes a smooth and engaging user experience through extensive use of animations and responsive design principles. The flat pricing model simplifies the purchasing process for customers.

## External Dependencies

### Frontend Libraries
- **Google Fonts API**: For "Poppins", "Playfair Display", and "Great Vibes" font families.
- **Stripe.js (v3)**: Official JavaScript library for secure client-side payment processing.

### Backend Dependencies
- **Node.js**: Runtime environment.
- **Express.js**: Web framework for Node.js.
- **Stripe Node.js SDK**: For server-side Stripe API interactions.
- **CORS**: Middleware for Cross-Origin Resource Sharing.
- **Resend API**: For sending transactional emails (order confirmations).

### Assets
- `strongspoon-logo.jpeg`
- `Chocolate.png` (example product image)

### Database Schema
- **orders table**: Stores order information with fields for customer details, items (JSONB), payment tracking, order status (pending/completed/delivered), order type (delivery/pickup), delivery scheduling (delivery_date, delivery_time_slot), and delivery proof (delivery_proof, delivery_person, delivered_at).

### Environment Variables (Replit Secrets)
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `ADMIN_PASSWORD` - Secures admin dashboard access
- `DELIVERY_PASSWORD` - Secures delivery portal access
- `PORT`

**Note:** Owner order alert emails are sent to `Strongspoon.ca@gmail.com` via Resend (no SMS / no Twilio needed). Test alert available at `/api/send-test-owner-alert`.

### Test Email Routes
- `GET /api/send-test-email` — Order confirmation
- `GET /api/send-test-owner-alert` — Owner new order alert
- `GET /api/send-test-pickup-email` — Pickup ready notification
- `GET /api/send-test-delivery-email` — Delivery notification
- `GET /api/send-test-waitlist-email` — Waitlist drop alert
- `GET /api/send-test-reschedule-email` — Delivery reschedule confirmation
- `GET /api/send-test-reminder-email` — 24-hour delivery reminder

### Customer Self-Service Reschedule (v82)
- **manage-order.html**: Standalone page where customers look up their order by order number + email, see their current delivery date, pick a new date, and submit. Auto-populates from URL params (`?order=XXX&email=YYY`).
- **"Manage My Order" button** added to order confirmation email (delivery orders only). Links directly to manage-order.html pre-filled with the customer's order number and email.
- **POST /api/customer/order-lookup**: Public endpoint. Validates order# + email, returns order details if found and not yet delivered.
- **POST /api/customer/reschedule**: Public endpoint. Updates delivery_date, resets reminder_sent, sends reschedule confirmation email to customer, and sends owner alert email to Strongspoon.ca@gmail.com.
- Owner receives an email immediately when any customer self-reschedules, showing name, address, order#, and new date.
- Admin dashboard shows the updated date automatically.

### Delivery Rescheduling & Reminders (v81)
- **Admin Reschedule UI**: Each delivery order row in the admin dashboard has a gold "✏️ Reschedule" button. Clicking opens a modal to pick a new date and time window. Two actions: "Save Date" (no email) and "Save & Notify Customer" (saves + sends reschedule confirmation email to customer).
- **Admin Order Search**: Search bar above the orders table filters by order number or customer name in real time.
- **Reschedule Email**: Professional email sent to customer when admin clicks "Save & Notify". Includes new date, time slot, address, and order items.
- **24-Hour Reminder Email**: Automated reminder sent ~24 hours before scheduled delivery. Runs every 30 minutes via server cron. Each order gets reminded once (tracked via `reminder_sent` column). Resets to `FALSE` when delivery date is rescheduled.
- **DB**: `reminder_sent BOOLEAN DEFAULT FALSE` added to orders table.
- **Endpoints**: `PATCH /admin/orders/:id/reschedule`, `POST /admin/orders/:id/reschedule-email`

### UI Fixes & Updates (v74)
- **Savings line items in checkout**: Bundle discount and promo discount now each appear as separate `-$X.XX` line items in the order summary; a green "💚 You save $X.XX" highlighted row appears below them whenever any savings are active (bundle + promo combined); floating savings banner removed in favour of inline rows; service worker bumped to v74

### UI Fixes & Updates (v73)
- **Promo / Discount Code System**: `promo_codes` DB table; `/api/validate-promo` (public POST), `/admin/promo-codes` CRUD endpoints; promo code input field on checkout with real-time validation, discount shown in summary, applied server-side in payment intent; Promo Codes section in admin dashboard (create, toggle active/pause, delete)
- **Daily Order Cap**: `app_settings` DB table; `/api/order-status` (public GET); `/admin/settings` GET+POST; Settings section in admin dashboard with live today count; checkout shows red "Sold Out for Today" banner and disables submit button when cap hit
- **Customer CRM in Admin**: `/admin/customers` endpoint aggregates all unique buyers with order count, total spent, first/last order; Customers section in admin dashboard with Loyal/Repeat badges
- **Print Order Tickets**: 🖨️ button on every order row in admin table; opens browser print dialog with a clean teal-header ticket (order #, type, customer, address, items+toppings, total, footer)
- **Contact & FAQ page** (`contact.html`): 10-question accordion FAQ (delivery area, protein, gluten-free, sugar, advance notice, delivery fee, cancellations, bundles, promos, payment security); contact info; links to order now; "❓ FAQ" link added to Our Flavours nav
- Service worker bumped to v73, contact.html added to cache

### UI Fixes & Updates (v72)
- **Website Traffic Analytics** (fully implemented): `track.js` IIFE script injected into all public pages; `page_views` DB table; `/api/track` (public POST) and `/admin/traffic?range=1d|7d|30d|all` (admin GET) endpoints; Traffic section in admin dashboard shows total visits, today's visits, top visited page, top pages bar chart, 24-hour hourly bar chart, and traffic sources; auto-refreshes every 30 seconds with the rest of the dashboard
- Service worker bumped to v72

### UI Fixes & Updates (v71 — prior)
- All 4 flavour pages consistent layout: ingredients, image, price, buttons always visible
- Checkout form spacing fixed: all form-groups have 18px margin-bottom
- Pickup info box has 20px bottom margin; order-ahead note has 24px bottom margin
- Toppings correctly priced: flat $1 for entire order (server + frontend both updated)
- Toppings labelled "+$1 flat" on Customise page and cart
- "Brownie Issues" correctly capitalised
- Html2.html title updated to "Our Flavours | Strong Spoon"
- New order-success.html page shown after successful payment with order number display
- $1 Test Payment Mode: append ?test=1 to checkout URL to charge $1 instead of full price (full order flow fires — email, DB, admin dashboard all work)
- Service worker bumped to v71

### Test Payment URL
Add these params to checkout URL to test the full order flow for $1:
`/checkout.html?preview=strongspoon&test=1`
A yellow "TEST MODE" banner appears in the form; Stripe charges exactly $1.00 CAD.