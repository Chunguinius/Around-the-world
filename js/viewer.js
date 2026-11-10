// Orbit360 panorama viewer: equirectangular images on an inverted sphere (three.js)
import * as THREE from './vendor/three.module.min.js';

const DEG = Math.PI / 180;

export class PanoViewer {
  constructor(container, opts = {}) {
    this.el = container;
    this.opts = Object.assign({ autoRotate: 0.04, fov: 75, minFov: 30, maxFov: 100, interactive: true }, opts);
    this.lon = opts.yaw ?? 0; this.lat = opts.pitch ?? 0; this.fov = this.opts.fov;
    this.hotspots = []; this.listeners = {};
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserve });
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
    this.loader = new THREE.TextureLoader();
    this._idleSince = performance.now();
    if (this.opts.interactive) this._bind(); else this.el.classList.add('pv-static');
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this.el);
    this.resize();
    this._loop = this._loop.bind(this); this._raf = requestAnimationFrame(this._loop);
  }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  _emit(evt, d) { (this.listeners[evt] || []).forEach(f => f(d)); }

  load(src, { yaw, pitch, hotspots = [] } = {}) {
    return new Promise((resolve, reject) => {
      this.el.classList.add('pv-loading');
      this.loader.load(src, tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        const old = this.mat.map;
        this.mat.map = tex; this.mat.color.set(0xffffff); this.mat.needsUpdate = true;
        if (old) old.dispose();
        if (yaw !== undefined) this.lon = yaw;
        if (pitch !== undefined) this.lat = pitch;
        this.setHotspots(hotspots);
        this.mat.opacity = 0; this._fade = performance.now();
        this.el.classList.remove('pv-loading');
        this._emit('load', src); resolve();
      }, undefined, err => { this.el.classList.remove('pv-loading'); reject(err); });
    });
  }

  setHotspots(list) {
    this.layer.innerHTML = '';
    this.hotspots = list.map(h => {
      const b = document.createElement('button');
      b.className = 'pv-hotspot ' + (h.type === 'scene' ? 'is-scene' : 'is-info');
      b.innerHTML = `<span class="pv-dot">${h.type === 'scene' ? '➜' : 'i'}</span><span class="pv-label">${escapeHtml(h.label || '')}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); this._emit('hotspot', h); });
      b.addEventListener('pointerdown', e => e.stopPropagation());
      this.layer.appendChild(b);
      return { ...h, node: b };
    });
  }

  // yaw/pitch in degrees for the current view centre
  getView() { return { yaw: round(this.lon), pitch: round(this.lat), fov: round(this.fov) }; }
  lookAt(yaw, pitch, fov) { this.lon = yaw; this.lat = pitch; if (fov) this.fov = fov; }
  setAutoRotate(v) { this.opts.autoRotate = v; }
  // convert a client point to yaw/pitch
  pick(clientX, clientY) {
    const r = this.el.getBoundingClientRect();
    const v = new THREE.Vector3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5);
    v.unproject(this.camera).sub(this.camera.position).normalize();
    const pitch = Math.asin(v.y) / DEG;
    const yaw = Math.atan2(v.z, v.x) / DEG;
    return { yaw: round(yaw), pitch: round(pitch) };
  }

  _bind() {
    const c = this.renderer.domElement, box = this.el; let down = null; const pointers = new Map(); let pinch0 = null;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId); pointers.set(e.pointerId, e);
      down = { x: e.clientX, y: e.clientY, lon: this.lon, lat: this.lat, moved: false };
      this._idleSince = Infinity; box.classList.add('pv-grabbing');
    });
    c.addEventListener('pointermove', e => {
      if (!down) return; pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch0) this.fov = clamp(pinch0.fov * pinch0.d / d, this.opts.minFov, this.opts.maxFov); else pinch0 = { d, fov: this.fov };
        return;
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
    c.addEventListener('wheel', e => { e.preventDefault(); this.fov = clamp(this.fov + e.deltaY * 0.05, this.opts.minFov, this.opts.maxFov); }, { passive: false });
    c.tabIndex = 0;
    c.addEventListener('keydown', e => {
      const s = 5; const m = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key];
      if (m) { e.preventDefault(); this.lon += m[0]; this.lat = clamp(this.lat + m[1], -85, 85); }
      if (e.key === '+' || e.key === '=') this.zoom(-5); if (e.key === '-') this.zoom(5);
    });
  }
  zoom(d) { this.fov = clamp(this.fov + d, this.opts.minFov, this.opts.maxFov); }

  enableGyro() {
    const handler = e => {
      if (e.alpha == null) return;
      this.lon = -e.alpha; this.lat = clamp(e.beta - 90, -85, 85); this._idleSince = Infinity;
    };
    const start = () => window.addEventListener('deviceorientation', handler);
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      return DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') start(); return p === 'granted'; });
    }
    start(); this._gyro = handler; return Promise.resolve(true);
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _loop(t) {
    this._raf = requestAnimationFrame(this._loop);
    if (this.opts.autoRotate && t - this._idleSince > 2500) this.lon += this.opts.autoRotate;
    if (this._fade) { const p = Math.min(1, (t - this._fade) / 450); this.mat.opacity = p; if (p >= 1) this._fade = 0; }
    this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    const phi = (90 - this.lat) * DEG, th = this.lon * DEG;
    this.camera.lookAt(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    this.renderer.render(this.scene, this.camera);
    const w = this.el.clientWidth, h = this.el.clientHeight;
    for (const hs of this.hotspots) {
      const p = (90 - hs.pitch) * DEG, y = hs.yaw * DEG;
      const v = new THREE.Vector3(Math.sin(p) * Math.cos(y), Math.cos(p), Math.sin(p) * Math.sin(y)).multiplyScalar(100);
      const inFront = v.clone().normalize().dot(this.camera.getWorldDirection(new THREE.Vector3())) > 0;
      v.project(this.camera);
      if (!inFront) { hs.node.style.display = 'none'; continue; }
      hs.node.style.display = '';
      hs.node.style.transform = `translate(${(v.x + 1) / 2 * w}px, ${(1 - v.y) / 2 * h}px) translate(-50%, -50%)`;
    }
  }
  destroy() { cancelAnimationFrame(this._raf); this._ro.disconnect(); this.renderer.dispose(); this.el.innerHTML = ''; }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = v => Math.round(v * 10) / 10;
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
