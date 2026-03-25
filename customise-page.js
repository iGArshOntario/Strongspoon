const customiseForm = document.getElementById('orderForm');

const flavorMapping = {
  'Brownie Issues': 'brownie',
  'Power Mix': 'powerMix',
  'Golden Scoop': 'goldenScoop',
  'Spoon Crumble': 'spoonCrumble'
};

// ── Premium Custom Dropdown ──
const flavourInput    = document.getElementById('flavour');
const flavourSelect   = document.getElementById('flavourSelect');
const flavourTrigger  = document.getElementById('flavourTrigger');
const flavourDropdown = document.getElementById('flavourDropdown');
const flavourPlaceholder = document.getElementById('flavourPlaceholder');
const flavourSelected    = document.getElementById('flavourSelected');
const flavourSelEmoji    = document.getElementById('flavourSelEmoji');
const flavourSelName     = document.getElementById('flavourSelName');
const flavourSelDesc     = document.getElementById('flavourSelDesc');
const flavourOptions     = document.querySelectorAll('.flavour-option');

function selectFlavour(value, name, emoji, desc) {
  flavourInput.value = value;
  flavourPlaceholder.style.display = 'none';
  flavourSelected.style.display    = 'flex';
  flavourSelEmoji.textContent = emoji;
  flavourSelName.textContent  = name;
  flavourSelDesc.textContent  = desc;

  flavourOptions.forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.value === value);
  });

  flavourSelect.classList.remove('open');
}

if (flavourTrigger) {
  flavourTrigger.addEventListener('click', () => {
    flavourSelect.classList.toggle('open');
  });
}

flavourOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    selectFlavour(
      opt.dataset.value,
      opt.dataset.name,
      opt.dataset.emoji,
      opt.dataset.desc
    );
  });
});

document.addEventListener('click', e => {
  if (flavourSelect && !flavourSelect.contains(e.target)) {
    flavourSelect.classList.remove('open');
  }
});

// Pre-select flavour from URL param
const urlParams      = new URLSearchParams(window.location.search);
const flavorFromUrl  = urlParams.get('flavor');
if (flavorFromUrl) {
  const match = document.querySelector(`.flavour-option[data-name="${flavorFromUrl}"]`);
  if (match) {
    selectFlavour(
      match.dataset.value,
      match.dataset.name,
      match.dataset.emoji,
      match.dataset.desc
    );
  }
}

// ── Form Submission ──
let pendingItem = null;
let pendingToppingsText = '';

const qtyPickerOverlay = document.getElementById('qtyPickerOverlay');
const cartPopupOverlay = document.getElementById('cartPopupOverlay');
const cancelQtyBtn     = document.getElementById('cancelQtyBtn');
const cartItemName     = document.getElementById('cartItemName');
const cartItemToppings = document.getElementById('cartItemToppings');
const continueBtn      = document.getElementById('continueBtn');

if (cancelQtyBtn) {
  cancelQtyBtn.onclick = () => qtyPickerOverlay.classList.remove('active');
}
if (qtyPickerOverlay) {
  qtyPickerOverlay.addEventListener('click', ev => {
    if (ev.target === qtyPickerOverlay) qtyPickerOverlay.classList.remove('active');
  });
}

document.querySelectorAll('#qtyPickerOverlay .qty-tier-card').forEach(card => {
  card.addEventListener('click', () => {
    if (!pendingItem) return;
    const qty = parseInt(card.dataset.qty);
    triggerQtyCardAnimation(card, () => {
      cart.addItem({ ...pendingItem, quantity: qty });
      if (cartItemName)     cartItemName.textContent = pendingItem.name;
      if (cartItemToppings) cartItemToppings.textContent = qty + (qty > 1 ? ' cups' : ' cup') + (pendingToppingsText ? ' · ' + pendingToppingsText : ' — no toppings');
      qtyPickerOverlay.classList.remove('active');
      cartPopupOverlay.classList.add('active');
      pendingItem = null;
    });
  });
});

if (continueBtn) {
  continueBtn.onclick = () => cartPopupOverlay.classList.remove('active');
}
if (cartPopupOverlay) {
  cartPopupOverlay.addEventListener('click', ev => {
    if (ev.target === cartPopupOverlay) cartPopupOverlay.classList.remove('active');
  });
}

if (customiseForm) {
  customiseForm.addEventListener('submit', e => {
    e.preventDefault();

    const flavourId = flavourInput ? flavourInput.value : '';

    if (!flavourId || !PRODUCTS[flavourId]) {
      alert('Please select a flavour');
      return;
    }

    const product = PRODUCTS[flavourId];

    const selectedToppings = Array.from(customiseForm.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => TOPPINGS[checkbox.value] || null)
      .filter(t => t !== null);

    const hasToppings = selectedToppings.length > 0;

    pendingItem = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price + (hasToppings ? 1 : 0),
      toppings: selectedToppings,
      image: product.image
    };
    pendingToppingsText = hasToppings ? selectedToppings.map(t => t.name).join(', ') : '';

    qtyPickerOverlay.classList.add('active');

    customiseForm.reset();
    flavourPlaceholder.style.display = 'inline';
    flavourSelected.style.display    = 'none';
    flavourInput.value = '';
    flavourOptions.forEach(opt => opt.classList.remove('selected'));
  });
}
