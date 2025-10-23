# Strong Spoon - High-Protein Yogurt Ordering Platform

## Overview

Strong Spoon is a simple, static HTML website for a Canadian health-focused yogurt brand. The platform allows customers to browse yogurt flavors, customize their orders with various toppings and fruits, and learn about the brand's health-focused mission. The site currently consists of informational pages and a customization form, with basic client-side JavaScript for form handling and local storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- Pure HTML5, CSS3, and vanilla JavaScript
- No frontend frameworks or build tools
- Client-side only implementation

**Page Structure:**
- `index.html` - Landing page with brand introduction and "Bite Into Better" tagline
- `Html2.html` - Product selection page listing available flavors
- `Brown issues.html` - Product detail page for the Brownie Issues flavor
- `Customise.html` - Order customization form (incomplete)

**Design Decisions:**
- Static site architecture chosen for simplicity and minimal hosting requirements
- Single CSS file (`style.css`) for global styling using Google Fonts (Poppins, Great Vibes)
- Black background (#000) with white text for brand aesthetic
- Mobile-responsive design using viewport meta tags

**Client-Side Logic:**
- Smooth scroll navigation for anchor links
- Local storage used for basic user account persistence (sign-up functionality)
- Form validation handled in JavaScript before submission

**Limitations:**
- The customization form (`Customise.html`) has a form action pointing to `/submit-order` but no backend exists to handle this POST request
- Login functionality partially implemented but incomplete
- No actual order processing or payment integration

### Backend Architecture

**Current State: No Backend**
- The site is purely static HTML/CSS/JS
- Form submissions currently point to non-existent endpoints
- User data stored only in browser localStorage (not persistent or secure)

**Future Considerations:**
- Will need a backend server to handle form submissions
- Order processing system required for production use
- User authentication system needed for proper account management
- Database integration required for storing orders and user data

### Data Storage Solutions

**Current Implementation:**
- Browser localStorage for temporary user credentials (insecure, client-side only)
- No persistent database

**Data Schema (Implied from Forms):**
- User: name, email, password
- Order: flavour, toppings (array), notes/special instructions

**Future Requirements:**
- Persistent database needed (SQL or NoSQL)
- Tables/collections for: users, orders, products, toppings
- Consider inventory management for toppings and flavors

### Authentication and Authorization

**Current State:**
- Basic signup form storing credentials in localStorage
- Partial login handler implemented
- No password hashing or security measures
- No session management

**Security Concerns:**
- Passwords stored in plain text in localStorage
- No CSRF protection
- No input sanitization
- Client-side only validation

**Future Needs:**
- Proper authentication system (JWT, sessions, or OAuth)
- Password hashing (bcrypt recommended)
- Server-side validation
- Protected routes for user-specific data

## External Dependencies

### Frontend Libraries
- **Google Fonts API** - Poppins and Great Vibes font families for typography
- No other external JavaScript libraries (pure vanilla JS)

### Assets
- `strongspoon-logo.jpeg` - Brand logo image
- `Chocolate.png` - Product image for Brownie Issues flavor
- Images referenced but may be missing from repository

### Planned Integrations (Not Yet Implemented)
- Payment gateway needed for order processing
- Email service for order confirmations
- Potential delivery/logistics API integration
- Analytics tracking (Google Analytics or similar)

### Missing Backend Services
- Web server (Node.js/Express, Python/Flask, or similar needed)
- Database system (PostgreSQL, MongoDB, or MySQL recommended)
- Email service provider (SendGrid, Mailgun, etc.)
- Hosting infrastructure (currently could be static hosted, but needs backend for full functionality)