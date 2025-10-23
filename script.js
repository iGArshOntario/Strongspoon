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
      const basePrice = item.price || 0;
      const toppingsPrice = (item.toppings || []).reduce((sum, topping) => 
        sum + (topping.price || 0), 0
      );
      return total + ((basePrice + toppingsPrice) * item.quantity);
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
});

/* -----------------------------
   FADE-IN ON LOAD
------------------------------ */
window.addEventListener('load', () => {
  document.body.style.opacity = 0;
  document.body.style.transition = 'opacity 1s ease';
  requestAnimationFrame(() => (document.body.style.opacity = 1));
});
