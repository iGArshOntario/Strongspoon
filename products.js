// OFFER MODE SWITCH: Set to true to show "Tax Included" message, false to hide it
const OFFER_MODE = true;

// Dynamic pricing: $7 launch special (Apr 10–11, 2026), $12 regular
function getCurrentPrice() {
  const now = Date.now();
  const launchStart = new Date('2026-04-10T08:00:00-05:00').getTime();
  const launchEnd   = new Date('2026-04-11T08:00:00-05:00').getTime();
  return (now >= launchStart && now < launchEnd) ? 7.00 : 12.00;
}
const PRODUCT_PRICE = getCurrentPrice();
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
