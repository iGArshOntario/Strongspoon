function renderCheckoutItems() {
  const checkoutItemsContainer = document.getElementById('checkoutItems');
  const totalEl = document.getElementById('checkoutTotal');
  const taxIncludedEl = document.getElementById('taxIncluded');

  if (cart.items.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  checkoutItemsContainer.innerHTML = cart.items.map(item => {
    const itemPrice = PRODUCT_PRICE;
    const itemTotal = itemPrice * item.quantity;

    return `
      <div class="checkout-item">
        <div class="checkout-item-details">
          <strong>${item.name}</strong> (${PRODUCT_SIZE}) × ${item.quantity}
          ${item.toppings && item.toppings.length > 0 ? `
            <br><small>+ ${item.toppings.map(t => t.name).join(', ')}</small>
          ` : ''}
        </div>
        <div class="checkout-item-price">$${itemTotal.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  const total = cart.getTotal();

  totalEl.textContent = `$${total.toFixed(2)}`;
  
  if (taxIncludedEl) {
    taxIncludedEl.style.display = OFFER_MODE ? 'block' : 'none';
  }

  return { total };
}

const amounts = renderCheckoutItems();

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
  const customerAddress = document.getElementById('customerAddress').value;

  const orderData = {
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: customerAddress
    },
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
