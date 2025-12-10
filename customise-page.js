const customiseForm = document.getElementById('orderForm');

const flavorMapping = {
  'Brownie Issues': 'brownie',
  'Power Mix': 'powerMix',
  'Golden Scoop': 'goldenScoop',
  'Spoon Crumble': 'spoonCrumble'
};

const urlParams = new URLSearchParams(window.location.search);
const flavorFromUrl = urlParams.get('flavor');
if (flavorFromUrl && flavorMapping[flavorFromUrl]) {
  const flavourSelect = document.getElementById('flavour');
  if (flavourSelect) {
    flavourSelect.value = flavorMapping[flavorFromUrl];
  }
}

if (customiseForm) {
  customiseForm.addEventListener('submit', e => {
    e.preventDefault();

    const flavourSelect = customiseForm.querySelector('#flavour');
    const flavourId = flavourSelect ? flavourSelect.value : '';
    
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

    const item = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      toppings: selectedToppings,
      image: product.image
    };

    cart.addItem(item);
    
    const toppingsText = selectedToppings.length > 0 
      ? `\nToppings: ${selectedToppings.map(t => t.name).join(', ')}`
      : '';
    
    const total = product.price + selectedToppings.reduce((sum, t) => sum + t.price, 0);
    
    alert(`✅ Added to cart!\n\n${product.name}${toppingsText}\n\nTotal: $${total.toFixed(2)}`);
    
    customiseForm.reset();
  });
}
