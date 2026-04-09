(function () {
  const path = window.location.pathname;
  if (path.includes('orders.html') || path.includes('delivery.html')) return;

  const sessionKey = 'ss_v_' + path;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');

  const rawTitle = document.title || '';
  const page = rawTitle.split('|')[0].trim() ||
    path.replace(/\.html$/, '').replace(/^\//, '') || 'Home';

  let referrer = '';
  try {
    if (document.referrer) referrer = new URL(document.referrer).hostname;
  } catch (e) {}

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, path, referrer })
  }).catch(function () {});
})();
