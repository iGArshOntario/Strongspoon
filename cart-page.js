function renderCart() {
  const cartItemsContainer = document.getElementById('cartItems');
  const totalEl = document.getElementById('total');
  const taxIncludedEl = document.getElementById('taxIncluded');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (cart.items.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h2>Your cart is empty</h2>
        <p>Add some delicious Strong Spoon dessert to get started!</p>
        <a href="Html2.html" class="btn teal">Browse Products</a>
      </div>
    `;
    totalEl.textContent = '$0.00';
    if (taxIncludedEl) taxIncludedEl.style.display = 'none';
    checkoutBtn.style.display = 'none';
    const savingsEl = document.getElementById('bundleSavingsBanner');
    if (savingsEl) savingsEl.style.display = 'none';
    return;
  }

  checkoutBtn.style.display = 'inline-block';

  const totalCups = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const savings = getBundleSavings(totalCups);

  cartItemsContainer.innerHTML = cart.items.map((item, index) => {
    const hasToppings = item.toppings && item.toppings.length > 0;

    return `
      <div class="cart-item">
        <div class="item-info">
          <h3>${item.name}</h3>
          <p class="item-description">${item.description || ''} — ${PRODUCT_SIZE}</p>
          ${hasToppings ? `
            <p class="item-toppings">
              <strong>Toppings:</strong> ${item.toppings.map(t => t.name).join(', ')}
              <span class="topping-fee-note">+$1 flat</span>
            </p>
          ` : ''}
        </div>
        <div class="item-controls">
          <div class="quantity-controls">
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity - 1})">−</button>
            <span class="quantity">${item.quantity}</span>
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity + 1})">+</button>
          </div>
          <button class="remove-btn" onclick="removeCartItem(${index})">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Bundle savings banner
  const savingsEl = document.getElementById('bundleSavingsBanner');
  if (savingsEl) {
    if (savings > 0) {
      savingsEl.innerHTML = `🎉 Bundle deal applied — you're saving <strong>$${savings.toFixed(2)}</strong>!`;
      savingsEl.style.display = 'block';
    } else {
      savingsEl.style.display = 'none';
    }
  }

  const total = cart.getTotal();
  totalEl.textContent = `$${total.toFixed(2)}`;
  
  if (taxIncludedEl) {
    taxIncludedEl.style.display = OFFER_MODE ? 'block' : 'none';
  }
}

function updateItemQuantity(index, newQuantity) {
  cart.updateQuantity(index, newQuantity);
  renderCart();
}

function removeCartItem(index) {
  if (confirm('Remove this item from your cart?')) {
    cart.removeItem(index);
    renderCart();
  }
}

document.getElementById('clearCart').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear your entire cart?')) {
    cart.clear();
    renderCart();
  }
});

renderCart();
