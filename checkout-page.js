const DELIVERY_FEE = 4.99;
const FREE_DELIVERY_THRESHOLD = 25;
const AMEX_SURCHARGE_RATE = 0.006;

const IS_TEST_MODE = new URLSearchParams(window.location.search).get('test') === '1';

let orderType = 'delivery';
let cartSubtotal = 0;
let cardBrand = null;
let appliedPromo = null; // { code, type, value, min_spend }
let appliedTrainer = null; // { code, trainerName, loyaltyCount, isNewCustomer, freeCupThisOrder }
let totalCupsGlobal = 0;

function getDeliveryFee() {
  if (orderType === 'pickup') return 0;
  return cartSubtotal < FREE_DELIVERY_THRESHOLD ? DELIVERY_FEE : 0;
}

function getBaseTotal() {
  return Math.round((cartSubtotal + getDeliveryFee()) * 100) / 100;
}

function getPromoDiscount() {
  if (!appliedPromo) return 0;
  if (appliedPromo.type === 'flat') return Math.min(appliedPromo.value, cartSubtotal);
  return Math.round(cartSubtotal * (appliedPromo.value / 100) * 100) / 100;
}

function hasPaidToppingsInCart() {
  if (!cart || !cart.items) return false;
  const ncFreeTill = new Date('2026-05-10T23:59:59-05:00').getTime();
  const isLaunch = Date.now() >= new Date('2026-04-10T08:00:00-05:00').getTime() &&
                   Date.now() <  new Date('2026-04-11T08:00:00-05:00').getTime();
  if (isLaunch) return false;
  return cart.items.some(item =>
    (item.toppings || []).some(t => !(t.name === 'Nutty Crumble' && Date.now() <= ncFreeTill))
  );
}

function getTrainerDiscount() {
  if (!appliedTrainer) return 0;
  let discount = 0;
  if (appliedTrainer.isNewCustomer && hasPaidToppingsInCart()) discount += 1;
  if (appliedTrainer.freeCupThisOrder) discount += PRODUCT_PRICE;
  return Math.min(Math.round(discount * 100) / 100, cartSubtotal);
}

function getAmexFee() {
  if (cardBrand !== 'amex') return 0;
  const afterDiscount = Math.max(0, getBaseTotal() - getPromoDiscount() - getTrainerDiscount());
  return Math.round(afterDiscount * AMEX_SURCHARGE_RATE * 100) / 100;
}

function getFinalTotal() {
  if (IS_TEST_MODE) return 1.00;
  const afterDiscount = Math.max(0, getBaseTotal() - getPromoDiscount() - getTrainerDiscount());
  return Math.round((afterDiscount + getAmexFee()) * 100) / 100;
}

// Promo code validation
async function applyPromoCode() {
  const input = document.getElementById('promoCodeInput');
  const btn = document.getElementById('promoApplyBtn');
  const msg = document.getElementById('promoMessage');
  const code = input ? input.value.trim() : '';
  if (!code) return;
  btn.disabled = true;
  btn.textContent = '…';
  msg.textContent = '';
  try {
    const res = await fetch('/api/validate-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: cartSubtotal })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      appliedPromo = { code: data.code, type: data.type, value: data.value, min_spend: data.min_spend };
      const discountLabel = data.type === 'flat' ? `$${data.value.toFixed(2)} off` : `${data.value}% off`;
      const minNote = data.min_spend ? ` (min. $${data.min_spend.toFixed(2)})` : '';
      msg.textContent = `✅ ${data.code} applied — ${discountLabel}${minNote}`;
      msg.style.color = '#4caf50';
      input.disabled = true;
      btn.textContent = 'Remove';
      btn.disabled = false;
      btn.onclick = removePromoCode;
      updateDeliveryFeeDisplay();
    } else {
      msg.textContent = data.error || 'Invalid code';
      msg.style.color = '#f44336';
      btn.textContent = 'Apply';
      btn.disabled = false;
    }
  } catch (e) {
    msg.textContent = 'Could not validate code';
    msg.style.color = '#f44336';
    btn.textContent = 'Apply';
    btn.disabled = false;
  }
}

// Trainer code validation
async function applyTrainerCode() {
  const input = document.getElementById('trainerCodeInput');
  const btn = document.getElementById('trainerApplyBtn');
  const msg = document.getElementById('trainerMessage');
  const loyaltyEl = document.getElementById('trainerLoyalty');
  const emailInput = document.getElementById('email');
  const code = input ? input.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  if (!code) return;
  if (!email) {
    msg.textContent = 'Please enter your email address first';
    msg.style.color = '#f44336';
    return;
  }
  btn.disabled = true;
  btn.textContent = '…';
  msg.textContent = '';
  if (loyaltyEl) loyaltyEl.style.display = 'none';
  try {
    const res = await fetch('/api/validate-trainer-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      appliedTrainer = { code: data.code, trainerName: data.trainerName, loyaltyCount: data.loyaltyCount, isNewCustomer: data.isNewCustomer, freeCupThisOrder: data.freeCupThisOrder };
      let perks = [];
      if (data.isNewCustomer && hasPaidToppingsInCart()) perks.push('1 topping free');
      if (data.freeCupThisOrder) perks.push('1 cup FREE 🎉');
      const perkNote = perks.length ? ` — ${perks.join(', ')}` : '';
      msg.textContent = `✅ ${data.trainerName}'s code applied${perkNote}`;
      msg.style.color = '#4caf50';
      input.disabled = true;
      btn.textContent = 'Remove';
      btn.disabled = false;
      btn.onclick = removeTrainerCode;
      // Show loyalty progress
      if (loyaltyEl) {
        const next = data.loyaltyCount;
        const pct = Math.round((next / 10) * 100);
        if (data.freeCupThisOrder) {
          loyaltyEl.innerHTML = `<div class="trainer-loyalty-bar-wrap"><span class="trainer-loyalty-label">🎁 This is your 10th order — enjoy your <strong>FREE cup</strong>!</span></div>`;
        } else {
          loyaltyEl.innerHTML = `
            <div class="trainer-loyalty-bar-wrap">
              <span class="trainer-loyalty-label">Loyalty: <strong>${next}/10</strong> orders towards a free cup</span>
              <div class="trainer-loyalty-track"><div class="trainer-loyalty-fill" style="width:${pct}%"></div></div>
            </div>`;
        }
        loyaltyEl.style.display = 'block';
      }
      updateDeliveryFeeDisplay();
    } else {
      msg.textContent = data.error || 'Invalid trainer code';
      msg.style.color = '#f44336';
      btn.textContent = 'Apply';
      btn.disabled = false;
    }
  } catch (e) {
    msg.textContent = 'Could not validate code';
    msg.style.color = '#f44336';
    btn.textContent = 'Apply';
    btn.disabled = false;
  }
}

function removeTrainerCode() {
  appliedTrainer = null;
  const input = document.getElementById('trainerCodeInput');
  const btn = document.getElementById('trainerApplyBtn');
  const msg = document.getElementById('trainerMessage');
  const loyaltyEl = document.getElementById('trainerLoyalty');
  if (input) { input.value = ''; input.disabled = false; }
  if (btn) { btn.textContent = 'Apply'; btn.onclick = applyTrainerCode; btn.disabled = false; }
  if (msg) msg.textContent = '';
  if (loyaltyEl) loyaltyEl.style.display = 'none';
  updateDeliveryFeeDisplay();
}

function removePromoCode() {
  appliedPromo = null;
  const input = document.getElementById('promoCodeInput');
  const btn = document.getElementById('promoApplyBtn');
  const msg = document.getElementById('promoMessage');
  if (input) { input.value = ''; input.disabled = false; }
  if (btn) { btn.textContent = 'Apply'; btn.onclick = applyPromoCode; }
  if (msg) { msg.textContent = ''; }
  updateDeliveryFeeDisplay();
}

function updateDeliveryFeeDisplay() {
  const fee = getDeliveryFee();
  const feeRow = document.getElementById('deliveryFeeRow');
  const freeRow = document.getElementById('freeDeliveryRow');
  const amexRow = document.getElementById('amexFeeRow');
  const amexDisplay = document.getElementById('amexFeeDisplay');
  const promoRow = document.getElementById('promoDiscountRow');
  const promoDisplay = document.getElementById('promoDiscountDisplay');
  const totalEl = document.getElementById('checkoutTotal');

  if (orderType === 'pickup') {
    if (feeRow) feeRow.style.display = 'none';
    if (freeRow) freeRow.style.display = 'none';
  } else if (fee > 0) {
    if (feeRow) feeRow.style.display = 'flex';
    if (freeRow) freeRow.style.display = 'none';
  } else {
    if (feeRow) feeRow.style.display = 'none';
    if (freeRow) freeRow.style.display = 'flex';
  }

  const amexFee = getAmexFee();
  if (amexRow) amexRow.style.display = amexFee > 0 ? 'flex' : 'none';
  if (amexDisplay) amexDisplay.textContent = `$${amexFee.toFixed(2)}`;

  const discount = getPromoDiscount();
  if (promoRow) promoRow.style.display = discount > 0 ? 'flex' : 'none';
  if (promoDisplay) promoDisplay.textContent = `-$${discount.toFixed(2)}`;

  const trainerDiscountRow = document.getElementById('trainerDiscountRow');
  const trainerDiscountDisplay = document.getElementById('trainerDiscountDisplay');
  const trainerDiscountLabel = document.getElementById('trainerDiscountLabel');
  const td = getTrainerDiscount();
  if (trainerDiscountRow) trainerDiscountRow.style.display = td > 0 ? 'flex' : 'none';
  if (trainerDiscountDisplay) trainerDiscountDisplay.textContent = `-$${td.toFixed(2)}`;
  if (trainerDiscountLabel && appliedTrainer) {
    let label = `🏋️ ${appliedTrainer.trainerName}'s code`;
    if (appliedTrainer.isNewCustomer && hasPaidToppingsInCart()) label += ' (free topping)';
    if (appliedTrainer.freeCupThisOrder) label += ' (free cup)';
    trainerDiscountLabel.textContent = label;
  }

  // "You save" total row — shown when any discount active
  const totalSavingsRow = document.getElementById('totalSavingsRow');
  const totalSavingsDisplay = document.getElementById('totalSavingsDisplay');
  const totalSaved = discount + td;
  if (totalSavingsRow) totalSavingsRow.style.display = totalSaved > 0 ? 'flex' : 'none';
  if (totalSavingsDisplay) totalSavingsDisplay.textContent = `$${totalSaved.toFixed(2)}`;

  const total = getFinalTotal();
  if (totalEl) {
    totalEl.textContent = `$${total.toFixed(2)}`;
    totalEl.classList.remove('pop');
    void totalEl.offsetWidth;
    totalEl.classList.add('pop');
  }
  const btnText = document.getElementById('button-text');
  if (btnText) btnText.textContent = `Complete Order · $${total.toFixed(2)}`;
}

function setOrderType(type) {
  orderType = type;
  const deliveryBtn = document.getElementById('deliveryBtn');
  const pickupBtn = document.getElementById('pickupBtn');
  const deliveryFields = document.getElementById('deliveryFields');
  const pickupFields = document.getElementById('pickupFields');
  const addressField = document.getElementById('customerAddress');
  const nextDayBadgeBlock = document.getElementById('nextDayBadgeBlock');
  const deliveryDateLabel = document.getElementById('deliveryDateLabel');
  const orderAheadNote = document.getElementById('orderAheadNote');

  document.body.setAttribute('data-order-type', type);

  if (type === 'delivery') {
    deliveryBtn.classList.add('active');
    pickupBtn.classList.remove('active');
    deliveryFields.style.display = 'block';
    pickupFields.style.display = 'none';
    addressField.required = true;
    if (nextDayBadgeBlock) nextDayBadgeBlock.style.display = 'block';
    if (deliveryDateLabel) deliveryDateLabel.innerHTML = 'Preferred Delivery Date *';
    if (orderAheadNote) orderAheadNote.innerHTML = '<span style="color:#EFE8D8;">📅 Select your preferred delivery date</span> <span style="color:#4caf50;">— each cup is prepared fresh for you.</span>';
    document.getElementById('deliveryTimeSlot').value = 'Next Day Delivery';
  } else {
    deliveryBtn.classList.remove('active');
    pickupBtn.classList.add('active');
    deliveryFields.style.display = 'none';
    pickupFields.style.display = 'block';
    addressField.required = false;
    if (nextDayBadgeBlock) nextDayBadgeBlock.style.display = 'none';
    if (deliveryDateLabel) deliveryDateLabel.innerHTML = 'Preferred Pickup Date *';
    if (orderAheadNote) orderAheadNote.innerHTML = '<span style="color:#EFE8D8;">📅 Select your preferred pickup date</span> <span style="color:#4caf50;">— each cup is prepared fresh for you.</span>';
    document.getElementById('deliveryTimeSlot').value = 'Pickup';
  }
  updateDeliveryFeeDisplay();
}

window.setOrderType = setOrderType;

function selectTimeSlot(card) {}
window.selectTimeSlot = selectTimeSlot;

const ITEM_ICONS = { brownie: '🍫', powerMix: '⚡', goldenScoop: '✨', spoonCrumble: '🌾' };

function renderCheckoutItems() {
  const checkoutItemsContainer = document.getElementById('checkoutItems');
  const totalEl = document.getElementById('checkoutTotal');
  const taxIncludedEl = document.getElementById('taxIncluded');

  if (cart.items.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  const totalCups = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  totalCupsGlobal = totalCups;

  checkoutItemsContainer.innerHTML = cart.items.map((item, i) => {
    const hasToppings = item.toppings && item.toppings.length > 0;
    const icon = ITEM_ICONS[item.id] || '💪';
    const itemTotal = (PRODUCT_PRICE * item.quantity).toFixed(2);
    return `
      <div class="checkout-item" style="animation-delay:${i * 0.07}s">
        <div class="checkout-item-inner">
          <div class="checkout-item-icon">${icon}</div>
          <div class="checkout-item-text">
            <div class="item-name">${item.name}</div>
            <div class="item-sub">${PRODUCT_SIZE} · Qty ${item.quantity}</div>
            ${hasToppings ? `<div class="item-toppings">+ ${item.toppings.map(t => t.name).join(', ')}</div>` : ''}
          </div>
        </div>
        <div class="checkout-item-price-col">$${itemTotal}</div>
      </div>
    `;
  }).join('');

  const total = cart.getTotal();
  cartSubtotal = total;
  updateDeliveryFeeDisplay();

  const savingsEl = document.getElementById('checkoutSavingsBanner');
  if (savingsEl) savingsEl.style.display = 'none';

  if (taxIncludedEl) {
    taxIncludedEl.style.display = OFFER_MODE ? 'block' : 'none';
  }

  return { total };
}

const amounts = renderCheckoutItems();

function setMinimumDeliveryDate() {
  const deliveryDateInput = document.getElementById('deliveryDate');
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowString = tomorrow.toISOString().split('T')[0];
  deliveryDateInput.min = tomorrowString;
  deliveryDateInput.value = tomorrowString;
  document.getElementById('deliveryTimeSlot').value = 'Next Day Delivery';
}

function validateDeliveryDate() {
  const deliveryDate = document.getElementById('deliveryDate').value;

  if (!deliveryDate) {
    return { valid: false, error: 'Please select a delivery date.' };
  }

  const [year, month, day] = deliveryDate.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  selectedDate.setHours(23, 59, 59, 999);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (selectedDate < tomorrow) {
    return { valid: false, error: 'Please select a delivery date of tomorrow or later.' };
  }

  document.getElementById('deliveryTimeSlot').value = 'Next Day Delivery';
  return { valid: true };
}

setMinimumDeliveryDate();

let stripe, elements, cardElement;

async function initializeStripe() {
  try {
    const response = await fetch('/get-stripe-key');
    const data = await response.json();

    stripe = Stripe(data.publishableKey);
    elements = stripe.elements();

    cardElement = elements.create('card', {
      style: {
        base: {
          color: '#EFE8D8',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '15px',
          fontWeight: '400',
          '::placeholder': { color: 'rgba(239,232,216,0.3)' },
        },
        invalid: { color: '#ff5722' },
      },
    });

    cardElement.mount('#card-element');

    cardElement.on('change', (event) => {
      const displayError = document.getElementById('card-errors');
      displayError.textContent = event.error ? event.error.message : '';

      // Detect card brand for Amex surcharge
      const newBrand = event.brand || null;
      if (newBrand !== cardBrand) {
        cardBrand = newBrand;
        updateDeliveryFeeDisplay();
      }
    });
  } catch (error) {
    console.error('Stripe initialization error:', error);
    document.getElementById('card-errors').textContent = 'Payment system initialization failed. Using test mode.';
    initializeTestMode();
  }
}

function initializeTestMode() {
  const cardElementDiv = document.getElementById('card-element');
  cardElementDiv.innerHTML = `
    <input type="text" placeholder="4242 4242 4242 4242 (Test Card)"
           class="test-card-input" id="testCardNumber" required>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <input type="text" placeholder="MM/YY" class="test-card-input" style="flex:1;" id="testExpiry" required>
      <input type="text" placeholder="CVC"   class="test-card-input" style="flex:1;" id="testCvc" required>
    </div>
  `;
}

const form = document.getElementById('payment-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitButton = document.getElementById('submit-payment');
  const buttonText = document.getElementById('button-text');
  const spinner = document.getElementById('spinner');
  const messageDiv = document.getElementById('payment-message');

  submitButton.disabled = true;
  buttonText.style.display = 'none';
  const payArrow = submitButton.querySelector('.pay-arrow');
  const payLock = submitButton.querySelector('.pay-lock');
  if (payArrow) payArrow.style.display = 'none';
  if (payLock) payLock.style.display = 'none';
  spinner.style.display = 'inline-block';

  const customerName = document.getElementById('customerName').value;
  const customerEmail = document.getElementById('customerEmail').value;
  const customerPhone = document.getElementById('customerPhone').value;
  const customerAddress = orderType === 'delivery'
    ? document.getElementById('customerAddress').value
    : 'PICKUP - Regina, SK';
  const deliveryDate = document.getElementById('deliveryDate').value;
  const deliveryTimeSlot = document.getElementById('deliveryTimeSlot').value;

  const dateValidation = validateDeliveryDate();
  if (!dateValidation.valid) {
    messageDiv.textContent = dateValidation.error;
    messageDiv.className = 'payment-message error';
    submitButton.disabled = false;
    buttonText.style.display = 'inline';
    spinner.style.display = 'none';
    return;
  }

  const orderData = {
    customer: { name: customerName, email: customerEmail, phone: customerPhone, address: customerAddress },
    orderType,
    deliveryDate,
    deliveryTimeSlot,
    items: cart.items,
    total: getFinalTotal(),
    deliveryFee: getDeliveryFee(),
    cardBrand: cardBrand || 'unknown',
    testMode: IS_TEST_MODE,
    promoCode: appliedPromo ? appliedPromo.code : null,
    trainerCode: appliedTrainer ? appliedTrainer.code : null,
  };

  try {
    const response = await fetch('/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) throw new Error('Payment processing unavailable');

    const { clientSecret } = await response.json();

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: { name: customerName, email: customerEmail },
      },
    });

    if (result.error) {
      messageDiv.textContent = result.error.message;
      messageDiv.className = 'payment-message error';
    } else {
      try {
        const saveResponse = await fetch('/save-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: result.paymentIntent.id }),
        });

        if (!saveResponse.ok) throw new Error('Failed to save order');

        const saveData = await saveResponse.json();
        const testTag = IS_TEST_MODE ? ' (Test Order)' : '';
        messageDiv.textContent = `✅ Payment successful! Order #${saveData.orderNumber} confirmed${testTag}. Check your email — redirecting…`;
        messageDiv.className = 'payment-message success';
        cart.clear();
        if (appliedTrainer) {
          sessionStorage.setItem('ss_trainer_loyalty', JSON.stringify({
            trainerName: appliedTrainer.trainerName,
            loyaltyCount: appliedTrainer.loyaltyCount + 1, // +1 for this order
            freeCupThisOrder: appliedTrainer.freeCupThisOrder
          }));
        } else {
          sessionStorage.removeItem('ss_trainer_loyalty');
        }
        setTimeout(() => { window.location.href = `order-success.html?order=${encodeURIComponent(saveData.orderNumber)}`; }, 2500);
      } catch (saveError) {
        console.error('Error saving order:', saveError);
        messageDiv.textContent = '⚠️ Payment succeeded but order save failed. Contact support with payment ID: ' + result.paymentIntent.id;
        messageDiv.className = 'payment-message error';
      }
    }
  } catch (error) {
    console.error('Payment error:', error);
    messageDiv.textContent = 'Payment failed. Please check your card details and try again.';
    messageDiv.className = 'payment-message error';
  }

  submitButton.disabled = false;
  buttonText.style.display = 'inline';
  spinner.style.display = 'none';
});

initializeStripe();

document.addEventListener('DOMContentLoaded', function() {
  document.body.setAttribute('data-order-type', orderType);
});
