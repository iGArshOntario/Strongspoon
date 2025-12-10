// OFFER MODE SWITCH: Set to true to show "Tax Included" message, false to hide it
const OFFER_MODE = true;

// Product pricing: $9.99 flat rate (tax included) - 250g
const PRODUCT_PRICE = 9.99;
const PRODUCT_SIZE = '250g';

const PRODUCTS = {
  'brownie': {
    id: 'brownie',
    name: 'Brownie Issues',
    description: 'Chocolate high-protein yogurt',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'Chocolate.png'
  },
  'powerMix': {
    id: 'powerMix',
    name: 'Power Mix',
    description: 'Peanut butter high-protein yogurt',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'Peanut.png'
  },
  'goldenScoop': {
    id: 'goldenScoop',
    name: 'Golden Scoop',
    description: 'Vanilla high-protein yogurt',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'vanilla.png'
  },
  'spoonCrumble': {
    id: 'spoonCrumble',
    name: 'Spoon Crumble',
    description: 'Cookie high-protein yogurt',
    price: PRODUCT_PRICE,
    size: PRODUCT_SIZE,
    image: 'cookie.png'
  }
};

// All toppings are included in base price - no extra charge
const TOPPINGS = {
  'almonds': { name: 'Almonds', price: 0 },
  'cashews': { name: 'Cashews', price: 0 },
  'peanuts': { name: 'Peanuts', price: 0 },
  'raisins': { name: 'Raisins', price: 0 },
  'walnut': { name: 'Walnut', price: 0 },
  'apple': { name: 'Apple', price: 0 },
  'blueberries': { name: 'Blueberries', price: 0 }
};
