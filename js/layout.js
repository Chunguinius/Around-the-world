// Shared header, footer, account modal and toast.
import { cloudEnabled, currentUser, displayName, signIn, signUp, signOut, resetPassword } from './cloud.js';
import { escapeHtml } from './viewer.js';

const BRAND = 'Around the World';
const page = document.body.dataset.page || '';
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
// Without a cloud backend, accounts are a browser-only demo.
const demoUser = () => store.get('atw-user', null);
// resolves to { id, email, name } or null
export const whoami = (async () => {
  if (!cloudEnabled) { const u = demoUser(); return u && { id: 'local', email: u.email, name: u.email.split('@')[0], demo: true }; }
  const u = await currentUser().catch(() => null);
  return u && { id: u.id, email: u.email, name: displayName(u) };
})();

function header() {
  const links = [['index.html', 'Home', 'home'], ['explore.html', 'Explore', 'explore'], ['create.html', 'Create', 'create'], ['create.html#my-tours', 'My tours', 'mine'], ['pricing.html', 'Pricing', 'pricing']];
  const h = document.createElement('header'); h.className = 'site-header';
  h.innerHTML = `<div class="container">
    <a class="logo" href="index.html"><span class="logo-mark"></span>${BRAND}</a>
    <nav class="nav" id="nav">${links.map(([href, t, k]) => `<a href="${href}" class="${k === page ? 'active' : ''}">${t}</a>`).join('')}</nav>
    <div class="header-actions" id="header-actions"></div>
    <button class="menu-btn" id="menu-btn" aria-label="Menu">☰</button>
  </div>`;
  document.body.prepend(h);
  h.querySelector('#menu-btn').onclick = () => h.querySelector('#nav').classList.toggle('open');
  const onScroll = () => h.classList.toggle('scrolled', scrollY > 8); addEventListener('scroll', onScroll, { passive: true }); onScroll();
  whoami.then(u => {
    const box = h.querySelector('#header-actions');
    box.innerHTML = u
      ? `<a class="btn btn-sm btn-ghost hide-sm" href="create.html#my-tours">My tours</a><button class="btn btn-sm" id="logout-btn" title="Log out of ${escapeHtml(u.email)}">${escapeHtml(u.name)} · Log out</button>`
      : `<button class="btn btn-sm btn-ghost hide-sm" data-auth="login">Log in</button><button class="btn btn-sm btn-primary" data-auth="signup">Sign up</button>`;
    const lo = box.querySelector('#logout-btn');
    if (lo) lo.onclick = async () => { if (cloudEnabled) await signOut(); else store.set('atw-user', null); location.reload(); };
  });
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
  m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="Account">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="tabs"><button data-tab="login" class="on">Log in</button><button data-tab="signup">Sign up</button></div>
    <form id="auth-form">
      <label class="field signup-only" hidden>Display name<input type="text" name="name" maxlength="40" placeholder="Shown on your tours" autocomplete="nickname"></label>
      <label class="field">Email<input type="email" name="email" required placeholder="you@example.com" autocomplete="email"></label>
      <label class="field">Password<input type="password" name="password" required minlength="6" placeholder="At least 6 characters" autocomplete="current-password"></label>
      <label class="field signup-only" hidden>Confirm password<input type="password" name="confirm" minlength="6" autocomplete="new-password"></label>
      <button class="btn btn-primary" style="width:100%;justify-content:center" type="submit">Continue</button>
      <p class="small login-only" style="margin-top:1em;text-align:center"><a href="#" id="forgot">Forgot your password?</a></p>
      <p class="small" style="margin-top:1em;text-align:center">${cloudEnabled ? 'By continuing you agree to the Terms and Privacy Policy.' : 'Demo mode: this account lives only in this browser.'}</p>
    </form></div>`;
  document.body.append(m);
  let mode = 'login', after = null;
  const form = m.querySelector('form');
  const setMode = md => {
    mode = md; m.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === md));
    m.querySelectorAll('.signup-only').forEach(x => x.hidden = md !== 'signup'); m.querySelectorAll('.login-only').forEach(x => x.hidden = md !== 'login' || !cloudEnabled);
  };
  setMode('login');
  m.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setMode(b.dataset.tab));
  m.querySelector('.modal-close').onclick = () => m.classList.remove('open');
  m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.remove('open'); });
  m.querySelector('#forgot').onclick = async e => {
    e.preventDefault(); const email = form.email.value.trim(); if (!email) return toast('Type your email first');
    try { await resetPassword(email); toast('Password reset email sent'); } catch (err) { toast(err.message); }
  };
  form.onsubmit = async e => {
    e.preventDefault(); const d = new FormData(form), email = d.get('email').trim(), password = d.get('password');
    if (mode === 'signup' && password !== d.get('confirm')) return toast('Passwords do not match');
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (!cloudEnabled) store.set('atw-user', { email });
      else if (mode === 'signup') {
        const r = await signUp(email, password, (d.get('name') || '').trim() || email.split('@')[0]);
        if (r.needsConfirmation) { m.classList.remove('open'); return toast('Check your email to confirm your account, then log in'); }
      } else await signIn(email, password);
      toast(mode === 'signup' ? 'Account created' : 'Welcome back');
      if (after) sessionStorage.setItem('atw-after-login', after);
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  };
  openAuth = (md = 'login', then = null) => { after = then; setMode(md); m.classList.add('open'); };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-auth]'); if (t) { e.preventDefault(); openAuth(t.dataset.auth); }
    if (e.target.closest('[data-soon]')) { e.preventDefault(); toast('Coming soon'); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(x => x.classList.remove('open')); });
}
// open the account dialog; `then` is remembered across the reload so a page can resume what the visitor was doing
export let openAuth = () => {};
export const takeAfterLogin = () => { const v = sessionStorage.getItem('atw-after-login'); sessionStorage.removeItem('atw-after-login'); return v; };

export function toast(msg) {
  let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
export { store, BRAND };

if (!document.body.classList.contains('tour-page')) { header(); if (!document.body.dataset.nofooter) footer(); }
authModal();
