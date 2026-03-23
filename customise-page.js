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
      .map(checkbox => {
        const toppingId = checkbox.value;
        return TOPPINGS[toppingId] || null;
      })
      .filter(t => t !== null);

    const hasToppings = selectedToppings.length > 0;

    const item = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price + (hasToppings ? 1 : 0),
      toppings: selectedToppings,
      image: product.image
    };

    cart.addItem(item);

    const toppingsText = hasToppings
      ? selectedToppings.map(t => t.name).join(', ')
      : 'No toppings';

    const cartPopupOverlay = document.getElementById('cartPopupOverlay');
    const cartItemName     = document.getElementById('cartItemName');
    const cartItemToppings = document.getElementById('cartItemToppings');
    const continueBtn      = document.getElementById('continueBtn');

    if (cartPopupOverlay && cartItemName && cartItemToppings) {
      cartItemName.textContent     = product.name;
      cartItemToppings.textContent = toppingsText;
      cartPopupOverlay.classList.add('active');

      continueBtn.onclick = () => {
        cartPopupOverlay.classList.remove('active');
      };

      cartPopupOverlay.onclick = (ev) => {
        if (ev.target === cartPopupOverlay) {
          cartPopupOverlay.classList.remove('active');
        }
      };
    }

    customiseForm.reset();
    flavourPlaceholder.style.display = 'inline';
    flavourSelected.style.display    = 'none';
    flavourInput.value = '';
    flavourOptions.forEach(opt => opt.classList.remove('selected'));
  });
}
