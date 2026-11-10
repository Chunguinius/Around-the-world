// Shared header, footer, auth modal and toast. Auth is a front-end demo (stored in localStorage).
const BRAND = 'Orbit360';
const page = document.body.dataset.page || '';
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const user = () => store.get('o360-user', null);

function header() {
  const links = [['index.html', 'Home', 'home'], ['explore.html', 'Explore', 'explore'], ['create.html', 'Create', 'create'], ['create.html#my-tours', 'My tours', 'mine'], ['pricing.html', 'Pricing', 'pricing']];
  const u = user();
  const h = document.createElement('header'); h.className = 'site-header';
  h.innerHTML = `<div class="container">
    <a class="logo" href="index.html"><span class="logo-mark"></span>${BRAND}</a>
    <nav class="nav" id="nav">${links.map(([href, t, k]) => `<a href="${href}" class="${k === page ? 'active' : ''}">${t}</a>`).join('')}</nav>
    <div class="header-actions">
      <a class="btn btn-sm btn-ghost hide-sm" href="pricing.html">Go PRO</a>
      ${u ? `<button class="btn btn-sm" id="logout-btn" title="Log out">${u.email.split('@')[0]}</button>`
          : `<button class="btn btn-sm btn-ghost hide-sm" data-auth="login">Log in</button><button class="btn btn-sm btn-primary" data-auth="signup">Sign up</button>`}
    </div>
    <button class="menu-btn" id="menu-btn" aria-label="Menu">☰</button>
  </div>`;
  document.body.prepend(h);
  h.querySelector('#menu-btn').onclick = () => h.querySelector('#nav').classList.toggle('open');
  const lo = h.querySelector('#logout-btn'); if (lo) lo.onclick = () => { store.set('o360-user', null); location.reload(); };
}

function footer() {
  const f = document.createElement('footer'); f.className = 'site-footer';
  f.innerHTML = `<div class="container">
    <div class="footer-grid">
      <div><a class="logo" href="index.html"><span class="logo-mark"></span>${BRAND}</a>
        <p style="margin-top:1em;max-width:300px">Turn any panoramic photo into an immersive tour, then share it anywhere.</p></div>
      <div><h4>Product</h4><ul><li><a href="explore.html">Explore tours</a></li><li><a href="create.html">Create a tour</a></li><li><a href="create.html#my-tours">My tours</a></li><li><a href="pricing.html">Pricing</a></li></ul></div>
      <div><h4>Resources</h4><ul><li><a href="index.html#how">How it works</a></li><li><a href="index.html#faq">FAQ</a></li><li><a href="tour.html?id=lakeside-retreat">Live demo</a></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="#" data-soon>About</a></li><li><a href="#" data-soon>Terms</a></li><li><a href="#" data-soon>Privacy</a></li><li><a href="#" data-soon>Contact</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${BRAND}. All rights reserved.</span><span>Built for photographers, agents and storytellers.</span></div>
  </div>`;
  document.body.append(f);
}

function authModal() {
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'auth-modal';
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="tabs"><button data-tab="login" class="on">Log in</button><button data-tab="signup">Sign up</button></div>
    <form id="auth-form">
      <label class="field">Email<input type="email" name="email" required placeholder="you@example.com"></label>
      <label class="field">Password<input type="password" name="password" required minlength="6" placeholder="At least 6 characters"></label>
      <label class="field signup-only" hidden>Confirm password<input type="password" name="confirm" minlength="6"></label>
      <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit">Continue</button>
      <p class="small" style="margin-top:1em;text-align:center">By continuing you agree to the Terms and Privacy Policy.</p>
    </form></div>`;
  document.body.append(m);
  let mode = 'login';
  const setMode = md => { mode = md; m.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === md)); m.querySelector('.signup-only').hidden = md !== 'signup'; };
  m.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.tab));
  m.querySelector('.modal-close').onclick = () => m.classList.remove('open');
  m.onclick = e => { if (e.target === m) m.classList.remove('open'); };
  m.querySelector('form').onsubmit = e => {
    e.preventDefault(); const d = new FormData(e.target);
    if (mode === 'signup' && d.get('password') !== d.get('confirm')) return toast('Passwords do not match');
    store.set('o360-user', { email: d.get('email') }); toast(mode === 'signup' ? 'Account created' : 'Welcome back'); setTimeout(() => location.reload(), 700);
  };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-auth]'); if (t) { e.preventDefault(); setMode(t.dataset.auth); m.classList.add('open'); }
    if (e.target.closest('[data-soon]')) { e.preventDefault(); toast('Coming soon'); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')); });
}

export function toast(msg) {
  let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
export { store };

if (!document.body.classList.contains('tour-page')) { header(); if (!document.body.dataset.nofooter) footer(); }
authModal();
