const TAX_RATE = 0.13;

function renderCart() {
  const cartItemsContainer = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('subtotal');
  const taxEl = document.getElementById('tax');
  const totalEl = document.getElementById('total');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (cart.items.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h2>Your cart is empty</h2>
        <p>Add some delicious Strong Spoon yogurt to get started!</p>
        <a href="Html2.html" class="btn teal">Browse Products</a>
      </div>
    `;
    subtotalEl.textContent = '$0.00';
    taxEl.textContent = '$0.00';
    totalEl.textContent = '$0.00';
    checkoutBtn.style.display = 'none';
    return;
  }

  checkoutBtn.style.display = 'inline-block';

  cartItemsContainer.innerHTML = cart.items.map((item, index) => {
    const basePrice = item.price || 0;
    const toppingsPrice = (item.toppings || []).reduce((sum, t) => sum + (t.price || 0), 0);
    const itemTotal = (basePrice + toppingsPrice) * item.quantity;

    return `
      <div class="cart-item">
        <div class="item-info">
          <h3>${item.name}</h3>
          <p class="item-description">${item.description || ''}</p>
          ${item.toppings && item.toppings.length > 0 ? `
            <p class="item-toppings">
              <strong>Toppings:</strong> ${item.toppings.map(t => `${t.name} (+$${t.price.toFixed(2)})`).join(', ')}
            </p>
          ` : ''}
        </div>
        <div class="item-controls">
          <div class="quantity-controls">
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity - 1})">−</button>
            <span class="quantity">${item.quantity}</span>
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity + 1})">+</button>
          </div>
          <div class="item-price">$${itemTotal.toFixed(2)}</div>
          <button class="remove-btn" onclick="removeCartItem(${index})">✕</button>
        </div>
      </div>
    `;
  }).join('');

  const subtotal = cart.getTotal();
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  taxEl.textContent = `$${tax.toFixed(2)}`;
  totalEl.textContent = `$${total.toFixed(2)}`;
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
