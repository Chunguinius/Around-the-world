// Panorama viewer: equirectangular images on an inverted sphere (three.js)
import * as THREE from './vendor/three.module.min.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = v => Math.round(v * 10) / 10;
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// signed shortest difference between two yaw angles, in degrees (-180..180)
export const yawDiff = (a, b) => ((a - b + 540) % 360) - 180;
const typing = () => { const a = document.activeElement; return a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };

export class PanoViewer {
  constructor(container, opts = {}) {
    this.el = container;
    // keyboard: false | 'focus' (arrow keys when focused) | 'global' (arrows + WASD anywhere on the page)
    this.opts = Object.assign({ autoRotate: 0.04, fov: 75, minFov: 30, maxFov: 100, interactive: true, editable: false, keyboard: 'focus', walkCone: 50 }, opts);
    this.lon = opts.yaw ?? 0; this.lat = opts.pitch ?? 0; this.fov = this.opts.fov;
    this.hotspots = []; this.listeners = {}; this.keys = new Set(); this.ahead = null;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.el.classList.add('pv');
    this.el.appendChild(this.renderer.domElement);
    this.layer = document.createElement('div'); this.layer.className = 'pv-layer';
    this.el.appendChild(this.layer);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 1100);
    const geo = new THREE.SphereGeometry(500, 96, 64); geo.scale(-1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 1 });
    this.mesh = new THREE.Mesh(geo, this.mat); this.scene.add(this.mesh);
    this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin('anonymous');
    this._idleSince = performance.now(); this._last = performance.now();
    if (this.opts.interactive) this._bind(); else this.el.classList.add('pv-static');
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.el);
    this.resize();
    this._loop = this._loop.bind(this); this._raf = requestAnimationFrame(this._loop);
  }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  _emit(evt, d) { (this.listeners[evt] || []).forEach(f => f(d)); }

  load(src, { yaw, pitch, hotspots = [] } = {}) {
    const token = this._loadToken = Symbol();
    return new Promise((resolve, reject) => {
      this.el.classList.add('pv-loading');
      this.loader.load(src, tex => {
        if (token !== this._loadToken) { tex.dispose(); return resolve(false); }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        const old = this.mat.map;
        this.mat.map = tex; this.mat.color.set(0xffffff); this.mat.needsUpdate = true;
        if (old) old.dispose();
        if (yaw !== undefined) this.lon = yaw;
        if (pitch !== undefined) this.lat = pitch;
        this.fov = this.opts.fov; this._tween = null;
        this.setHotspots(hotspots);
        this.mat.opacity = 0; this._fade = performance.now();
        this.el.classList.remove('pv-loading');
        this._emit('load', src); resolve(true);
      }, undefined, err => { this.el.classList.remove('pv-loading'); this._emit('error', err); reject(err); });
    });
  }

  setHotspots(list) {
    this.layer.innerHTML = ''; this.ahead = null;
    this.hotspots = list.map((h, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pv-hotspot ' + (h.type === 'scene' ? 'is-scene' : 'is-info') + (this.opts.editable ? ' is-editable' : '');
      b.innerHTML = `<span class="pv-dot">${h.type === 'scene' ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4l7 8h-4.5v8h-5v-8H5z" fill="currentColor"/></svg>' : 'i'}</span><span class="pv-label">${escapeHtml(h.label || '')}</span>`;
      const hs = { data: h, index, node: b };
      this._bindHotspot(hs);
      this.layer.appendChild(b);
      return hs;
    });
  }

  _bindHotspot(hs) {
    const b = hs.node; let drag = null;
    b.addEventListener('pointerdown', e => {
      e.stopPropagation(); this._idleSince = Infinity;
      if (!this.opts.editable) return;
      b.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, moved: false };
    });
    b.addEventListener('pointermove', e => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
      if (drag.moved) { const p = this.pick(e.clientX, e.clientY); hs.data.yaw = p.yaw; hs.data.pitch = clamp(p.pitch, -85, 85); b.classList.add('is-dragging'); }
    });
    const end = e => {
      if (!drag) { this._idleSince = performance.now(); return; }
      const moved = drag.moved; drag = null; b.classList.remove('is-dragging'); this._idleSince = performance.now();
      if (moved) { hs._justDragged = true; this._emit('hotspotmove', { hotspot: hs.data, index: hs.index }); }
    };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (hs._justDragged) { hs._justDragged = false; return; }
      this._emit('hotspot', hs.data);
    });
  }

  getView() { return { yaw: round(((this.lon % 360) + 540) % 360 - 180), pitch: round(this.lat), fov: round(this.fov) }; }
  lookAt(yaw, pitch, fov) { this.lon = yaw; this.lat = pitch; if (fov) this.fov = fov; }
  setAutoRotate(v) { this.opts.autoRotate = v; }
  zoom(d) { this.fov = clamp(this.fov + d, this.opts.minFov, this.opts.maxFov); }

  // smoothly turn toward a direction; resolves when done
  flyTo(yaw, pitch, fov, ms = 450) {
    return new Promise(res => {
      this._tween = { t0: performance.now(), ms, lon0: this.lon, lat0: this.lat, fov0: this.fov,
        dLon: yawDiff(yaw, this.lon), dLat: pitch - this.lat, dFov: (fov ?? this.fov) - this.fov, res };
    });
  }

  // the scene link closest to where the camera is looking (offset 180 = directly behind)
  nearestLink(offset = 0, cone = this.opts.walkCone) {
    let best = null, bestD = cone;
    for (const hs of this.hotspots) {
      if (hs.data.type !== 'scene') continue;
      const d = Math.abs(yawDiff(hs.data.yaw, this.lon + offset));
      if (d < bestD) { bestD = d; best = hs; }
    }
    return best;
  }

  // convert a client point to yaw/pitch
  pick(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    const v = new THREE.Vector3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5);
    v.unproject(this.camera).sub(this.camera.position).normalize();
    return { yaw: round(Math.atan2(v.z, v.x) / DEG), pitch: round(Math.asin(clamp(v.y, -1, 1)) / DEG) };
  }

  _bind() {
    const c = this.renderer.domElement, box = this.el; let down = null; const pointers = new Map(); let pinch0 = null;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e);
      down = { x: e.clientX, y: e.clientY, lon: this.lon, lat: this.lat, moved: false };
      this._idleSince = Infinity; this._tween = null; box.classList.add('pv-grabbing');
    });
    c.addEventListener('pointermove', e => {
      if (!down) return; pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch0) this.fov = clamp(pinch0.fov * pinch0.d / d, this.opts.minFov, this.opts.maxFov); else pinch0 = { d, fov: this.fov };
        down.moved = true; return;
      }
      const k = this.fov / c.clientHeight;
      this.lon = down.lon - (e.clientX - down.x) * k;
      this.lat = clamp(down.lat + (e.clientY - down.y) * k, -85, 85);
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) down.moved = true;
    });
    const up = e => {
      pointers.delete(e.pointerId); pinch0 = null;
      if (down && !down.moved && e.type === 'pointerup') this._emit('click', { ...this.pick(e.clientX, e.clientY), event: e });
      if (pointers.size === 0) { down = null; this._idleSince = performance.now(); box.classList.remove('pv-grabbing'); }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('dblclick', e => this._emit('dblclick', { ...this.pick(e.clientX, e.clientY), event: e }));
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY * 0.05); }, { passive: false });

    if (!this.opts.keyboard) return;
    const global = this.opts.keyboard === 'global';
    const target = global ? window : c; if (!global) c.tabIndex = 0;
    const LOOK = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 };
    const WASD = { KeyA: 1, KeyD: 1 };
    this._onKeyDown = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing() || document.querySelector('.modal.open')) return;
      if (LOOK[e.key] || (global && WASD[e.code])) { e.preventDefault(); this.keys.add(LOOK[e.key] ? e.key : e.code); this._idleSince = Infinity; this._tween = null; return; }
      if (e.key === '+' || e.key === '=') this.zoom(-5);
      if (e.key === '-') this.zoom(5);
      if (global && !e.repeat && (e.code === 'KeyW' || e.code === 'KeyS')) { e.preventDefault(); this.walk(e.code === 'KeyW' ? 1 : -1); }
    };
    this._onKeyUp = e => { this.keys.delete(e.key); this.keys.delete(e.code); if (!this.keys.size && this._idleSince === Infinity) this._idleSince = performance.now(); };
    this._onBlur = () => this.keys.clear();
    target.addEventListener('keydown', this._onKeyDown); target.addEventListener('keyup', this._onKeyUp); window.addEventListener('blur', this._onBlur);
    this._keyTarget = target;
  }

  // dir 1 = forward (W), -1 = back (S). The page decides what walking means; we report the link in that direction.
  walk(dir) { this._emit('walk', { dir, link: (dir > 0 ? this.nearestLink(0) : this.nearestLink(180))?.data || null }); }

  enableGyro() {
    const handler = e => { if (e.alpha == null) return; this.lon = -e.alpha; this.lat = clamp(e.beta - 90, -85, 85); this._idleSince = Infinity; };
    const start = () => window.addEventListener('deviceorientation', handler);
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      return DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') start(); return p === 'granted'; });
    }
    start(); return Promise.resolve(true);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _loop(t) {
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(64, t - this._last) / 16.67; this._last = t;
    if (this.keys.size) {
      const s = 1.6 * dt * (this.fov / 75);
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.lon -= s;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.lon += s;
      if (this.keys.has('ArrowUp')) this.lat = clamp(this.lat + s, -85, 85);
      if (this.keys.has('ArrowDown')) this.lat = clamp(this.lat - s, -85, 85);
    }
    if (this._tween) {
      const w = this._tween, p = Math.min(1, (t - w.t0) / w.ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.lon = w.lon0 + w.dLon * e; this.lat = w.lat0 + w.dLat * e; this.fov = w.fov0 + w.dFov * e;
      if (p >= 1) { this._tween = null; w.res(); }
    } else if (this.opts.autoRotate && t - this._idleSince > 2500) this.lon += this.opts.autoRotate * dt;
    if (this._fade) { const p = Math.min(1, (t - this._fade) / 450); this.mat.opacity = p; if (p >= 1) this._fade = 0; }
    this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    const phi = (90 - this.lat) * DEG, th = this.lon * DEG;
    this.camera.lookAt(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    this.renderer.render(this.scene, this.camera);
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const ahead = this.opts.keyboard === 'global' && !this.opts.editable ? this.nearestLink(0) : null;
    if (ahead !== this.ahead) { this.ahead?.node.classList.remove('is-ahead'); ahead?.node.classList.add('is-ahead'); this.ahead = ahead; this._emit('ahead', ahead?.data || null); }
    for (const hs of this.hotspots) {
      const p = (90 - hs.data.pitch) * DEG, y = hs.data.yaw * DEG;
      const v = new THREE.Vector3(Math.sin(p) * Math.cos(y), Math.cos(p), Math.sin(p) * Math.sin(y));
      if (v.dot(dir) <= 0.05) { hs.node.style.display = 'none'; continue; }
      v.multiplyScalar(100).project(this.camera);
      hs.node.style.display = '';
      hs.node.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px) translate(-19px, -19px)`;
    }
  }
  destroy() {
    cancelAnimationFrame(this._raf); this._ro.disconnect();
    if (this._keyTarget) { this._keyTarget.removeEventListener('keydown', this._onKeyDown); this._keyTarget.removeEventListener('keyup', this._onKeyUp); window.removeEventListener('blur', this._onBlur); }
    this.mat.map?.dispose(); this.renderer.dispose(); this.el.innerHTML = '';
  }
}
