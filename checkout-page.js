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

  checkoutItemsContainer.innerHTML = cart.items.map(item => {
    const hasToppings = item.toppings && item.toppings.length > 0;
    return `
      <div class="checkout-item">
        <div class="checkout-item-details">
          <strong>${item.name}</strong> (${PRODUCT_SIZE}) × ${item.quantity}
          ${hasToppings ? `<br><small>+ ${item.toppings.map(t => t.name).join(', ')} <span style="color:#017b86">+$${item.quantity}.00</span></small>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const total = cart.getTotal();

  totalEl.textContent = `$${total.toFixed(2)}`;

  const checkoutSavingsEl = document.getElementById('checkoutSavingsBanner');
  if (checkoutSavingsEl) {
    if (savings > 0) {
      checkoutSavingsEl.innerHTML = `🎉 Bundle savings applied: <strong>$${savings.toFixed(2)} off</strong>`;
      checkoutSavingsEl.style.display = 'block';
    } else {
      checkoutSavingsEl.style.display = 'none';
    }
  }
  
  if (taxIncludedEl) {
    taxIncludedEl.style.display = OFFER_MODE ? 'block' : 'none';
  }

  return { total };
}

const amounts = renderCheckoutItems();

// Set minimum delivery date to 12 hours from now
function setMinimumDeliveryDate() {
  const deliveryDateInput = document.getElementById('deliveryDate');
  const now = new Date();
  
  // Add 12 hours to current time
  const minDate = new Date(now.getTime() + (12 * 60 * 60 * 1000));
  
  // Format as YYYY-MM-DD for input min attribute
  const minDateString = minDate.toISOString().split('T')[0];
  deliveryDateInput.min = minDateString;
  
  // Set default to tomorrow or min date, whichever is later
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow > minDate ? tomorrow : minDate;
  deliveryDateInput.value = defaultDate.toISOString().split('T')[0];
}

// Validate delivery date is at least 12 hours from now
function validateDeliveryDate() {
  const deliveryDate = document.getElementById('deliveryDate').value;
  const deliveryTimeSlot = document.getElementById('deliveryTimeSlot').value;
  
  if (!deliveryDate || !deliveryTimeSlot) {
    return { valid: false, error: 'Please select both delivery date and time slot' };
  }
  
  // Parse delivery date in local timezone (not UTC)
  const [year, month, day] = deliveryDate.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day); // month is 0-indexed
  
  // Get earliest delivery slot start time based on selected time slot
  let deliveryStartHour = 8; // Default to morning start
  if (deliveryTimeSlot.includes('Afternoon')) {
    deliveryStartHour = 12;
  } else if (deliveryTimeSlot.includes('Evening')) {
    deliveryStartHour = 16;
  }
  
  // Set the time to the start of the selected delivery window
  selectedDate.setHours(deliveryStartHour, 0, 0, 0);
  
  const now = new Date();
  const minDateTime = new Date(now.getTime() + (12 * 60 * 60 * 1000));
  
  if (selectedDate < minDateTime) {
    return { valid: false, error: 'Please select a delivery date and time at least 12 hours from now' };
  }
  
  return { valid: true };
}

// Initialize date picker when page loads
setMinimumDeliveryDate();

const stripePublishableKey = 'STRIPE_PUBLISHABLE_KEY_PLACEHOLDER';
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
          color: '#fff',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '16px',
          '::placeholder': {
            color: '#aaa',
          },
        },
        invalid: {
          color: '#ff5722',
        },
      },
    });
    
    cardElement.mount('#card-element');
    
    cardElement.on('change', (event) => {
      const displayError = document.getElementById('card-errors');
      if (event.error) {
        displayError.textContent = event.error.message;
      } else {
        displayError.textContent = '';
      }
    });
  } catch (error) {
    console.error('Stripe initialization error:', error);
    document.getElementById('card-errors').textContent = 
      'Payment system initialization failed. Using test mode.';
    initializeTestMode();
  }
}

function initializeTestMode() {
  const cardElementDiv = document.getElementById('card-element');
  cardElementDiv.innerHTML = `
    <input type="text" placeholder="4242 4242 4242 4242 (Test Card)" 
           class="test-card-input" id="testCardNumber" required>
    <div style="display: flex; gap: 10px; margin-top: 10px;">
      <input type="text" placeholder="MM/YY" class="test-card-input" 
             style="flex: 1;" id="testExpiry" required>
      <input type="text" placeholder="CVC" class="test-card-input" 
             style="flex: 1;" id="testCvc" required>
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
  const customerAddress = orderType === 'delivery' ? document.getElementById('customerAddress').value : 'PICKUP - Regina, SK';
  const deliveryDate = document.getElementById('deliveryDate').value;
  const deliveryTimeSlot = document.getElementById('deliveryTimeSlot').value;

  // Validate delivery date and time slot
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
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: customerAddress
    },
    orderType: orderType,
    deliveryDate: deliveryDate,
    deliveryTimeSlot: deliveryTimeSlot,
    items: cart.items,
    total: amounts.total
  };

  try {
    const response = await fetch('/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      throw new Error('Payment processing unavailable');
    }

    const { clientSecret } = await response.json();

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: customerName,
          email: customerEmail,
        },
      },
    });

    if (result.error) {
      messageDiv.textContent = result.error.message;
      messageDiv.className = 'payment-message error';
    } else {
      // Payment successful - save order to database
      try {
        const saveResponse = await fetch('/save-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: result.paymentIntent.id
          }),
        });
        
        if (!saveResponse.ok) {
          throw new Error('Failed to save order');
        }
        
        const saveData = await saveResponse.json();
        console.log('Order saved:', saveData.orderNumber);
        
        messageDiv.textContent = `✅ Payment successful! Order #${saveData.orderNumber}. Thank you!`;
        messageDiv.className = 'payment-message success';
        cart.clear();
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 3000);
      } catch (saveError) {
        console.error('Error saving order:', saveError);
        messageDiv.textContent = '⚠️ Payment succeeded but order save failed. Please contact support with payment ID: ' + result.paymentIntent.id;
        messageDiv.className = 'payment-message error';
        // Don't clear cart in case user needs the info
      }
    }
  } catch (error) {
    console.error('Payment error:', error);
    messageDiv.textContent = 'Payment processing failed. Please check your card details and try again.';
    messageDiv.className = 'payment-message error';
  }

  submitButton.disabled = false;
  buttonText.style.display = 'inline';
  spinner.style.display = 'none';
});

initializeStripe();
