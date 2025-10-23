/* -----------------------------
   SMOOTH SCROLL NAVIGATION
------------------------------ */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      window.scrollTo({
        top: target.offsetTop - 40,
        behavior: "smooth"
      });
    }
  });
});

/* -----------------------------
   SIGN-UP HANDLER (LOCAL)
------------------------------ */
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!name || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    localStorage.setItem('user', JSON.stringify({ name, email, password }));
    alert(`Welcome, ${name}! Account created successfully.`);
    document.getElementById('signupForm').reset();
  });
}

/* -----------------------------
   LOGIN HANDLER (IF YOU ADD ONE)
------------------------------ */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const savedUser = JSON.parse(localStorage.getItem('user'));

    if (savedUser && savedUser.email === email && savedUser.password === password) {
      alert(`Welcome back, ${savedUser.name}!`);
      window.location.hash = "#customise";
    } else {
      alert("Invalid email or password.");
    }
  });
}

/* -----------------------------
   SHOPPING CART FUNCTIONALITY
------------------------------ */
class ShoppingCart {
  constructor() {
    this.items = this.loadCart();
  }

  loadCart() {
    const saved = localStorage.getItem('strongSpoonCart');
    return saved ? JSON.parse(saved) : [];
  }

  saveCart() {
    localStorage.setItem('strongSpoonCart', JSON.stringify(this.items));
    this.updateCartCount();
  }

  addItem(item) {
    const existingIndex = this.items.findIndex(i => 
      i.id === item.id && 
      JSON.stringify(i.toppings || []) === JSON.stringify(item.toppings || [])
    );

    if (existingIndex !== -1) {
      this.items[existingIndex].quantity += item.quantity || 1;
    } else {
      this.items.push({
        ...item,
        quantity: item.quantity || 1,
        addedAt: Date.now()
      });
    }
    
    this.saveCart();
    return true;
  }

  removeItem(index) {
    this.items.splice(index, 1);
    this.saveCart();
  }

  updateQuantity(index, quantity) {
    if (quantity <= 0) {
      this.removeItem(index);
    } else {
      this.items[index].quantity = quantity;
      this.saveCart();
    }
  }

  getTotal() {
    return this.items.reduce((total, item) => {
      const itemPrice = PRODUCT_PRICE;
      return total + (itemPrice * item.quantity);
    }, 0);
  }

  getItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  updateCartCount() {
    const countElements = document.querySelectorAll('.cart-count');
    const count = this.getItemCount();
    countElements.forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'inline-block' : 'none';
    });
  }

  clear() {
    this.items = [];
    this.saveCart();
  }
}

const cart = new ShoppingCart();

/* -----------------------------
   INITIALIZE CART COUNT ON LOAD
------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  cart.updateCartCount();
  initFloatingCartIcon();
});

/* -----------------------------
   FLOATING CART ICON (DRAGGABLE)
------------------------------ */
function initFloatingCartIcon() {
  const cartNav = document.querySelector('.cart-nav');
  if (!cartNav) return;

  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  // Load saved position
  const savedPos = localStorage.getItem('cartIconPosition');
  if (savedPos) {
    const { x, y } = JSON.parse(savedPos);
    xOffset = x;
    yOffset = y;
    setTranslate(x, y, cartNav);
  }

  // Mouse events
  cartNav.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch events
  cartNav.addEventListener('touchstart', dragStart, { passive: false });
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('touchend', dragEnd);

  function dragStart(e) {
    // Don't drag if clicking on the link itself
    if (e.target.closest('a.cart-icon')) {
      const rect = cartNav.getBoundingClientRect();
      
      if (e.type === 'touchstart') {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
      } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
      }

      isDragging = true;
      cartNav.style.transition = 'none';
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX - initialX;
        currentY = e.touches[0].clientY - initialY;
      } else {
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
      }

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, cartNav);
    }
  }

  function dragEnd(e) {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;

      // Snap to edges
      snapToEdge(cartNav);
      
      isDragging = false;
      cartNav.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      
      // Save position
      localStorage.setItem('cartIconPosition', JSON.stringify({ x: xOffset, y: yOffset }));
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  function snapToEdge(el) {
    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Keep within bounds
    const maxX = viewportWidth - rect.width - 20;
    const maxY = viewportHeight - rect.height - 20;
    const minX = -rect.left + 20;
    const minY = -rect.top + 20;
    
    xOffset = Math.max(minX, Math.min(xOffset, maxX));
    yOffset = Math.max(minY, Math.min(yOffset, maxY));
    
    setTranslate(xOffset, yOffset, el);
  }
}

/* -----------------------------
   FADE-IN ON LOAD
------------------------------ */
window.addEventListener('load', () => {
  document.body.style.opacity = 0;
  document.body.style.transition = 'opacity 1s ease';
  requestAnimationFrame(() => (document.body.style.opacity = 1));
});
