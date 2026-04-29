const FLAVOUR_EMOJIS = {
  brownie:      '🍫',
  powerMix:     '🥜',
  goldenScoop:  '🍦',
  spoonCrumble: '🍪'
};

const TOPPING_EMOJIS = {
  almonds:        '🌰',
  cashews:        '🥜',
  peanuts:        '🥜',
  raisins:        '🍇',
  walnut:         '🌰',
  apple:          '🍏',
  blueberries:    '🫐',
  'nutty-crumble':'🥐'
};

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
    return;
  }

  checkoutBtn.style.display = 'inline-block';

  const totalCups = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  cartItemsContainer.innerHTML = cart.items.map((item, index) => {
    const hasToppings = item.toppings && item.toppings.length > 0;
    const emoji = FLAVOUR_EMOJIS[item.id] || '💪';

    return `
      <div class="cart-item">
        <div class="item-info">
          <h3>${emoji} ${item.name}</h3>
          <p class="item-description">${item.description || ''} — ${PRODUCT_SIZE}</p>
          ${hasToppings ? `
            <p class="item-toppings">
              <strong>Toppings:</strong> ${item.toppings.map(t => t.name).join(', ')}
              <span class="topping-fee-note">+$1 each</span>
            </p>
          ` : '<p class="item-toppings" style="color:#888;font-size:0.8rem;">No toppings</p>'}
        </div>
        <div class="item-controls">
          <div class="quantity-controls">
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity - 1})">−</button>
            <span class="quantity">${item.quantity}</span>
            <button class="qty-btn" onclick="updateItemQuantity(${index}, ${item.quantity + 1})">+</button>
          </div>
          <div class="item-action-row">
            <button class="edit-item-btn" onclick="openEditModal(${index})">✏️ Edit</button>
            <button class="remove-btn" onclick="removeCartItem(${index})">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

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

// ── Edit Modal ────────────────────────────────────────────────────────────────
let editingIndex = null;
let editQty = 1;
let editFlavourId = null;
let editSelectedToppings = [];

function openEditModal(index) {
  editingIndex = index;
  const item = cart.items[index];
  editQty = item.quantity;
  editFlavourId = item.id;
  editSelectedToppings = (item.toppings || []).map(t => t.name);

  document.getElementById('editQtyDisplay').textContent = editQty;

  // Render flavour cards
  const flavourGrid = document.getElementById('editFlavourGrid');
  flavourGrid.innerHTML = Object.values(PRODUCTS).map(p => `
    <button class="edit-flavour-card ${p.id === editFlavourId ? 'selected' : ''}"
            data-id="${p.id}"
            onclick="selectEditFlavour('${p.id}', this)">
      <span class="edit-flavour-emoji">${FLAVOUR_EMOJIS[p.id] || '💪'}</span>
      <span class="edit-flavour-name">${p.name}</span>
    </button>
  `).join('');

  // Render topping checkboxes
  const ncFreeTill = new Date('2026-05-10T23:59:59-05:00').getTime();
  const isNcFree = Date.now() <= ncFreeTill;
  const toppingGrid = document.getElementById('editToppingsGrid');
  toppingGrid.innerHTML = Object.entries(TOPPINGS).map(([key, t]) => {
    const checked = editSelectedToppings.includes(t.name);
    const isNutty = t.name === 'Nutty Crumble';
    const freeTag = isNutty && isNcFree ? '<span class="nutty-free-tag">FREE</span>' : '';
    return `
      <label class="edit-topping-card ${checked ? 'checked' : ''}" data-name="${t.name}" onclick="toggleEditTopping('${t.name}', this)">
        <input type="checkbox" ${checked ? 'checked' : ''} style="display:none;">
        <span class="edit-topping-emoji">${TOPPING_EMOJIS[key] || '•'}</span>
        <span class="edit-topping-name">${t.name}${freeTag}</span>
      </label>`;
  }).join('');

  document.getElementById('editModalOverlay').classList.add('active');
}

function selectEditFlavour(id, btn) {
  editFlavourId = id;
  document.querySelectorAll('.edit-flavour-card').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
}

function toggleEditTopping(name, card) {
  card.classList.toggle('checked');
  if (editSelectedToppings.includes(name)) {
    editSelectedToppings = editSelectedToppings.filter(t => t !== name);
  } else {
    editSelectedToppings.push(name);
  }
}

function editQtyChange(delta) {
  editQty = Math.max(1, editQty + delta);
  document.getElementById('editQtyDisplay').textContent = editQty;
}

function saveEditModal() {
  if (editingIndex === null) return;
  const product = PRODUCTS[editFlavourId];
  if (!product) return;

  const toppings = editSelectedToppings.map(name => ({ name }));

  cart.items[editingIndex] = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    image: product.image,
    toppings,
    quantity: editQty
  };
  cart.saveCart();
  closeEditModal();
  renderCart();
}

function closeEditModal(event) {
  if (event && event.target !== document.getElementById('editModalOverlay')) return;
  document.getElementById('editModalOverlay').classList.remove('active');
  editingIndex = null;
}

renderCart();
