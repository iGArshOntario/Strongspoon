const DELIVERY_FEE = 4.99;
const FREE_DELIVERY_THRESHOLD = 25;
const AMEX_SURCHARGE_RATE = 0.006;

const IS_TEST_MODE = new URLSearchParams(window.location.search).get('test') === '1';

let orderType = 'delivery';
let cartSubtotal = 0;
let cardBrand = null;
let appliedPromo = null; // { code, type, value }

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

function getAmexFee() {
  if (cardBrand !== 'amex') return 0;
  const afterPromo = Math.max(0, getBaseTotal() - getPromoDiscount());
  return Math.round(afterPromo * AMEX_SURCHARGE_RATE * 100) / 100;
}

function getFinalTotal() {
  if (IS_TEST_MODE) return 1.00;
  const afterPromo = Math.max(0, getBaseTotal() - getPromoDiscount());
  return Math.round((afterPromo + getAmexFee()) * 100) / 100;
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
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      appliedPromo = { code: data.code, type: data.type, value: data.value };
      msg.textContent = `✅ ${data.code} applied — ${data.type === 'flat' ? '$' + data.value.toFixed(2) + ' off' : data.value + '% off'}`;
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
  const savings = getBundleSavings(totalCups);

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
  if (savingsEl) {
    if (savings > 0) {
      savingsEl.innerHTML = `🎉 Bundle savings applied — <strong>$${savings.toFixed(2)} off</strong>`;
      savingsEl.style.display = 'block';
    } else {
      savingsEl.style.display = 'none';
    }
  }

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
