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

    const flavour = orderForm.querySelector('select:nth-of-type(1)').value;
    const protein = orderForm.querySelector('select:nth-of-type(2)').value;
    const toppings = Array.from(orderForm.querySelectorAll('input[type="checkbox"]:checked'))
      .map(t => t.parentNode.textContent.trim());
    const sweetness = orderForm.querySelector('input[type="range"]') ? 
      orderForm.querySelector('input[type="range"]').value : "default";

    const note = orderForm.querySelector('textarea') ? 
      orderForm.querySelector('textarea').value.trim() : "";

    const summary = `
🧾 STRONG SPOON ORDER
---------------------
Flavour: ${flavour}
Protein: ${protein}
Toppings: ${toppings.join(', ') || 'None'}
Sweetness: ${sweetness}/10
Notes: ${note || 'None'}
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

const orderForm = document.getElementById('orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('name')?.value || '',
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
      flavor: document.getElementById('flavor').value,
      protein: document.getElementById('protein').value,
      toppings: Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(t => t.parentNode.textContent.trim())
        .join(', '),
      sweetness: document.getElementById('sweetness').value,
      notes: document.getElementById('notes').value
    };

    const url = "YOUR_WEB_APP_URL_HERE"; // from Apps Script deploy step
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res.ok) {
        alert("✅ Order placed successfully!");
        orderForm.reset();
      } else {
        alert("❌ Something went wrong.");
      }
    } catch (err) {
      alert("⚠️ Network error: " + err.message);
    }
  });
}
MailApp.sendEmail({
  to: "your@email.com",
  subject: "New Strong Spoon Order",
  htmlBody: `
    <p><b>New Order Received:</b></p>
    <p><b>Name:</b> ${data.name}<br>
    <b>Email:</b> ${data.email}<br>
    <b>Phone:</b> ${data.phone}<br>
    <b>Flavor:</b> ${data.flavor}<br>
    <b>Toppings:</b> ${data.toppings}</p>
  `
});