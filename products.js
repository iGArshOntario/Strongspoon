// OFFER MODE SWITCH: Set to true to show "Tax Included" message, false to hide it
const OFFER_MODE = false;

// Dynamic pricing: $7 launch special (Apr 10–11, 2026), $12.99 regular
function getCurrentPrice() {
  const now = Date.now();
  const launchStart = new Date('2026-04-10T08:00:00-05:00').getTime();
  const launchEnd   = new Date('2026-04-11T08:00:00-05:00').getTime();
  return (now >= launchStart && now < launchEnd) ? 7.00 : 12.99;
}
const PRODUCT_PRICE = getCurrentPrice();
const PRODUCT_SIZE = '250g';

// Flat per-cup pricing — no bundles
function getBundleBaseTotal(totalCups) {
  return Math.round(totalCups * getCurrentPrice() * 100) / 100;
}

function getBundleSavings() {
  return 0;
}

const PRODUCTS = {
  'brownie': {
    id: 'brownie',
    name: 'Brownie Issues',
    description: 'Chocolate high-protein dessert',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'Chocolate.png'
  },
  'powerMix': {
    id: 'powerMix',
    name: 'Power Mix',
    description: 'Peanut butter high-protein dessert',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'Peanut.png'
  },
  'goldenScoop': {
    id: 'goldenScoop',
    name: 'Golden Scoop',
    description: 'Vanilla high-protein dessert',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'vanilla.png'
  },
  'spoonCrumble': {
    id: 'spoonCrumble',
    name: 'Spoon Crumble',
    description: 'Cookie high-protein dessert',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'cookie.png'
  }
};

// All toppings are included in base price - no extra charge
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
