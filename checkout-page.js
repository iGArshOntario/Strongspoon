let orderType = 'delivery';

function setOrderType(type) {
  orderType = type;
  const deliveryBtn = document.getElementById('deliveryBtn');
  const pickupBtn = document.getElementById('pickupBtn');
  const deliveryFields = document.getElementById('deliveryFields');
  const pickupFields = document.getElementById('pickupFields');
  const addressField = document.getElementById('customerAddress');

  if (type === 'delivery') {
    deliveryBtn.classList.add('active');
    pickupBtn.classList.remove('active');
    deliveryFields.style.display = 'block';
    pickupFields.style.display = 'none';
    addressField.required = true;
  } else {
    deliveryBtn.classList.remove('active');
    pickupBtn.classList.add('active');
    deliveryFields.style.display = 'none';
    pickupFields.style.display = 'block';
    addressField.required = false;
  }
}

window.setOrderType = setOrderType;

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
  totalEl.textContent = `$${total.toFixed(2)}`;

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
  const minDate = new Date(now.getTime() + (12 * 60 * 60 * 1000));
  const minDateString = minDate.toISOString().split('T')[0];
  deliveryDateInput.min = minDateString;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow > minDate ? tomorrow : minDate;
  deliveryDateInput.value = defaultDate.toISOString().split('T')[0];
}

function validateDeliveryDate() {
  const deliveryDate = document.getElementById('deliveryDate').value;
  const deliveryTimeSlot = document.getElementById('deliveryTimeSlot').value;

  if (!deliveryDate || !deliveryTimeSlot) {
    return { valid: false, error: 'Please select both a delivery date and time slot.' };
  }

  const [year, month, day] = deliveryDate.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);

  let deliveryStartHour = 8;
  if (deliveryTimeSlot.includes('Afternoon')) deliveryStartHour = 12;
  else if (deliveryTimeSlot.includes('Evening')) deliveryStartHour = 16;

  selectedDate.setHours(deliveryStartHour, 0, 0, 0);

  const now = new Date();
  const minDateTime = new Date(now.getTime() + (12 * 60 * 60 * 1000));

  if (selectedDate < minDateTime) {
    return { valid: false, error: 'Please select a delivery date and time at least 12 hours from now.' };
  }

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
    total: amounts.total,
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
        messageDiv.textContent = `✅ Payment successful! Order #${saveData.orderNumber} confirmed. Redirecting…`;
        messageDiv.className = 'payment-message success';
        cart.clear();
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
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
