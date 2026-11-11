// Shared header, footer, account modal and toast.
import { cloudEnabled, currentUser, displayName, signIn, signUp, signOut, resetPassword } from './cloud.js';
import { escapeHtml } from './viewer.js';

const BRAND = 'Around the World';
// the Android app is built by the repository's workflow and attached to this release
export const APK_URL = 'https://github.com/Chunguinius/Around-the-world/releases/download/android-latest/around-the-world.apk';
// install links stay hidden inside the app itself, and until the first build has been published
const APK_PUBLISHED = false;
export const inApp = /AroundTheWorldApp/.test(navigator.userAgent) || !APK_PUBLISHED;
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

// small stroke icons, drawn for this site
const P = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  tag: '<path d="M4 4h8l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1.2"/>', crown: '<path d="M4 18h16M4 8l4 4 4-7 4 7 4-4-2 10H6z"/>',
  login: '<path d="M14 4h5v16h-5M4 12h11M11 8l4 4-4 4"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  upload: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4 4 0 0 1-1 8.5M12 12v8M9 15l3-3 3 3"/>', user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1-3 10-3 11 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  image: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M4 16l5-4 4 3 3-2 4 3"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
  dots: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>', edit: '<path d="M11 5H5v14h14v-6M18.5 3.5l2 2L12 14l-3 1 1-3z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>', bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>', storage: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M4 12h16M8 15h.01"/>'
};
export const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
// the site's own mark: a little globe with an orbit line
export const MARK = '<span class="logo-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><path d="M5.5 12h13M12 5.5c2.2 2 2.2 11 0 13M12 5.5c-2.2 2-2.2 11 0 13"/><path d="M2.5 16.5c4 3.5 15 1 19-6" stroke-width="1.6"/></svg></span>';
export const logoHTML = (href = 'index.html', extra = '') => `<a class="logo" href="${href}" ${extra}>${MARK}${BRAND}</a>`;

function header() {
  const links = [['index.html', 'Home', 'home', 'home'], ['explore.html', 'Explore', 'explore', 'compass'], ['create.html', 'Create', 'create', 'plus'], ['tours.html', 'My virtual tours', 'mine', 'grid'], ['pricing.html', 'Pricing', 'pricing', 'tag']];
  const h = document.createElement('header'); h.className = 'site-header';
  h.innerHTML = `<div class="bar">
    ${logoHTML()}
    <nav class="nav" id="nav">${links.map(([href, t, k, ic]) => `<a href="${href}" class="${k === page ? 'active' : ''}">${icon(ic)}${t}</a>`).join('')}</nav>
    <button class="menu-btn" id="menu-btn" aria-label="Menu">☰</button>
    <div class="header-actions" id="header-actions"><a class="pro-pill" href="pricing.html">${icon('crown')}Upgrade PRO</a></div>
  </div>`;
  document.body.prepend(h);
  h.querySelector('#menu-btn').onclick = () => h.querySelector('#nav').classList.toggle('open');
  whoami.then(u => {
    const box = h.querySelector('#header-actions');
    if (!u) return box.insertAdjacentHTML('beforeend', `<button class="login-link" data-auth="login">${icon('login')}Log in</button>`);
    box.insertAdjacentHTML('beforeend', `<div class="avatar-wrap"><button class="avatar" id="avatar" title="${escapeHtml(u.email)}" aria-label="Account">${escapeHtml((u.name || '?')[0].toUpperCase())}</button>
      <div class="user-menu" id="user-menu" hidden><b>${escapeHtml(u.name)}</b><span>${escapeHtml(u.email)}</span><a href="tours.html">My virtual tours</a><a href="create.html">Create a tour</a><button id="logout-btn">Log out</button></div></div>`);
    const menu = box.querySelector('#user-menu');
    box.querySelector('#avatar').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener('click', e => { if (!e.target.closest('#user-menu')) menu.hidden = true; });
    box.querySelector('#logout-btn').onclick = async () => { if (cloudEnabled) await signOut(); else store.set('atw-user', null); location.reload(); };
  });
}

// left menu of the account pages
export function sidebar(active) {
  const el = document.getElementById('side'); if (!el) return;
  const a = (href, label, key, ic, cls = '') => `<a href="${href}" class="${cls} ${key === active ? 'on' : ''}">${ic ? `<span class="tile">${icon(ic)}</span>` : ''}${label}</a>`;
  el.innerHTML = a('index.html', 'Home', 'home', 'home')
    + `<h5>${icon('upload')}Upload</h5>` + a('create.html', 'Create tour', 'create', '', 'sub')
    + `<h5>${icon('user')}Profile</h5>` + a('tours.html', 'My Tours', 'tours', '', 'sub')
    + '<hr>' + a('explore.html', 'Explore', 'explore', 'globe')
    + '<hr>' + a('pricing.html', 'Pro', 'pro', 'crown', 'pro') + a('index.html#faq', 'Help', 'help', 'help');
}

function footer() {
  const f = document.createElement('footer'); f.className = 'site-footer';
  f.innerHTML = `<div class="container">
    <div class="footer-grid">
      <div>${logoHTML()}
        <p style="margin-top:1em;max-width:300px">Build 360° tours from your panoramas and renders, then share them with a link.</p></div>
      <div><h4>Product</h4><ul><li><a href="index.html">Home</a></li><li><a href="explore.html">Explore</a></li><li><a href="create.html">Create a tour</a></li><li><a href="tours.html">My virtual tours</a></li><li><a href="pricing.html">Pricing</a></li>${inApp ? '' : `<li><a href="${APK_URL}">Android app</a></li>`}</ul></div>
      <div><h4>Support</h4><ul><li><a href="index.html#how">How it works</a></li><li><a href="index.html#faq">FAQ</a></li><li><a href="tour.html?id=lakeside-retreat">Live demo</a></li></ul></div>
      <div><h4>Legal</h4><ul><li><a href="#" data-soon>Terms</a></li><li><a href="#" data-soon>Privacy</a></li><li><a href="#" data-soon>Contact</a></li></ul></div>
    </div>
    <div class="footer-bottom">${BRAND} © ${new Date().getFullYear()}. All rights reserved.</div>
  </div>`;
  document.body.append(f);
}

function authModal() {
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'auth-modal';
  m.innerHTML = `<div class="dlg" style="width:min(400px,100%)" role="dialog" aria-modal="true" aria-label="Account">
    <div class="dlg-head"><span>Your account</span><button class="x modal-close" aria-label="Close">×</button></div>
    <div class="dlg-body"><div class="tabs"><button data-tab="login" class="on">Log in</button><button data-tab="signup">Sign up</button></div>
    <form id="auth-form">
      <label class="field signup-only" hidden>Display name<input type="text" name="name" maxlength="40" placeholder="Shown on your tours" autocomplete="nickname"></label>
      <label class="field">Email<input type="email" name="email" required placeholder="you@example.com" autocomplete="email"></label>
      <label class="field">Password<input type="password" name="password" required minlength="6" placeholder="At least 6 characters" autocomplete="current-password"></label>
      <label class="field signup-only" hidden>Confirm password<input type="password" name="confirm" minlength="6" autocomplete="new-password"></label>
      <button class="b b-green" style="width:100%;padding:.7em" type="submit">Continue</button>
      <p class="small login-only" style="margin-top:1em;text-align:center"><a href="#" id="forgot" style="color:var(--green-d)">Forgot your password?</a></p>
      <p class="small" style="margin-top:1em;text-align:center">${cloudEnabled ? 'By continuing you agree to the Terms and Privacy Policy.' : 'Demo mode: this account lives only in this browser.'}</p>
    </form></div></div>`;
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
  document.addEventListener('click', e => { const c = e.target.closest('[data-close]'); if (c) c.closest('.modal')?.classList.remove('open'); });
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
if (document.body.dataset.side) sidebar(document.body.dataset.side);
authModal();
