// OFFER MODE SWITCH: Set to true to show "Tax Included" message, false to hide it
const OFFER_MODE = false;

// Dynamic pricing: $7 launch special (Apr 10–11, 2026), $11.99 regular
function getCurrentPrice() {
  const now = Date.now();
  const launchStart = new Date('2026-04-10T08:00:00-05:00').getTime();
  const launchEnd   = new Date('2026-04-11T08:00:00-05:00').getTime();
  return (now >= launchStart && now < launchEnd) ? 7.00 : 11.99;
}
const PRODUCT_PRICE = getCurrentPrice();
const PRODUCT_SIZE = '250g';

// Bundle pricing tiers (base cups only, toppings added separately)
// 1 cup: $11.99 | 2 cups: $19.99 | 4 cups: $35.99
function getBundleBaseTotal(totalCups) {
  let cups = totalCups;
  let total = 0;
  const singlePrice = getCurrentPrice();
  // Launch day has no bundle discount — bundles only apply at regular price
  const isLaunchDay = Date.now() >= new Date('2026-04-10T08:00:00-05:00').getTime() &&
                      Date.now() <  new Date('2026-04-11T08:00:00-05:00').getTime();
  if (isLaunchDay) return cups * singlePrice;
  while (cups >= 4) { total += 35.99; cups -= 4; }
  if (cups >= 2)    { total += 19.99; cups -= 2; }
  total += cups * 11.99;
  return Math.round(total * 100) / 100;
}

function getBundleSavings(totalCups) {
  const singlePrice = getCurrentPrice();
  const regular = Math.round(totalCups * singlePrice * 100) / 100;
  const bundle  = getBundleBaseTotal(totalCups);
  return Math.round((regular - bundle) * 100) / 100;
}

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
