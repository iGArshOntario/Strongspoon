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
   ORDER FORM (CUSTOMISE)
------------------------------ */
const orderForm = document.getElementById('orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', e => {
    e.preventDefault();

    const flavour = orderForm.querySelector('#flavour') ? 
      orderForm.querySelector('#flavour').value : 'Not selected';
    const toppings = Array.from(orderForm.querySelectorAll('input[type="checkbox"]:checked'))
      .map(t => t.value);
    const note = orderForm.querySelector('#notes') ? 
      orderForm.querySelector('#notes').value.trim() : "";
    const email = orderForm.querySelector('#email') ? 
      orderForm.querySelector('#email').value : "";
    const phone = orderForm.querySelector('#phone') ? 
      orderForm.querySelector('#phone').value : "";
    const address = orderForm.querySelector('#address') ? 
      orderForm.querySelector('#address').value : "";

    const summary = `
🧾 STRONG SPOON ORDER
---------------------
Flavour: ${flavour}
Toppings: ${toppings.join(', ') || 'None'}
Notes: ${note || 'None'}

DELIVERY INFO
---------------------
Email: ${email}
Phone: ${phone}
Address: ${address}
`;

    alert(summary);
    orderForm.reset();
  });
}

/* -----------------------------
   OPTIONAL: SAVE GUEST ORDER
------------------------------ */
function saveGuestOrder(data) {
  let orders = JSON.parse(localStorage.getItem('guestOrders')) || [];
  orders.push(data);
  localStorage.setItem('guestOrders', JSON.stringify(orders));
}

/* -----------------------------
   FADE-IN ON LOAD
------------------------------ */
window.addEventListener('load', () => {
  document.body.style.opacity = 0;
  document.body.style.transition = 'opacity 1s ease';
  requestAnimationFrame(() => (document.body.style.opacity = 1));
});
