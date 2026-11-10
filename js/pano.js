// Turning uploaded image files into tour scenes and floor plans.
export const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
export const uid = () => crypto.randomUUID();
export const isImage = f => /^image\/(jpeg|png|webp)$/.test(f.type);

// One panorama file becomes a scene: resized to what the graphics card can show, plus a small thumbnail.
export async function processPano(file) {
  const bmp = await createImageBitmap(file);
  const ratio = bmp.width / bmp.height;
  const gl = document.createElement('canvas').getContext('webgl');
  const maxW = Math.min(gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096, 8192);
  const w = Math.min(bmp.width, maxW), h = Math.round(w / 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await canvasBlob(c, 'image/jpeg', 0.88);
  const t = document.createElement('canvas'); t.width = 320; t.height = 320;
  const side = Math.min(bmp.height * .62, bmp.width * .31);
  t.getContext('2d').drawImage(bmp, bmp.width / 2 - side / 2, bmp.height / 2 - side / 2, side, side, 0, 0, 320, 320);
  const thumbBlob = await canvasBlob(t, 'image/jpeg', 0.82);
  bmp.close?.();
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Scene';
  return { scene: { id: uid(), title, blob, thumbBlob, yaw: 0, pitch: 0, hotspots: [] }, stretched: Math.abs(ratio - 2) > 0.15 };
}
export async function processPlan(file) {
  const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasBlob(c, 'image/jpeg', 0.9);
}
export const sampleFiles = () => Promise.all(['alpine-lake', 'night-sky', 'desert-dusk'].map(async n => new File([await (await fetch('assets/pano/' + n + '.jpg')).blob()], n + '.jpg', { type: 'image/jpeg' })));
// what the visitor's screen does by default; a tour stores only what its owner changed
export const DEFAULT_SETTINGS = { views: true, strip: true, rotate: true, dir: 1, speed: 'medium', next: false, fullscreen: true, share: true, pad: true, plan: true };
export const settingsOf = tour => ({ ...DEFAULT_SETTINGS, ...(tour?.settings || {}) });
export const SPEEDS = { fast: 0.09, medium: 0.04, slow: 0.018 };
export function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => false).then(r => r !== false) ?? Promise.resolve(false);
}
export function qrSvg(text, cell = 3) { if (!window.qrcode) return ''; const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag(cell, 0); }
export function downloadSvg(svg, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const tourLink = id => new URL('tour.html?t=' + id, location.href).href;
export const embedCode = link => `<iframe src="${link}${link.includes('?') ? '&' : '?'}embed=1" width="100%" height="480" style="border:0" allow="fullscreen; gyroscope; accelerometer" allowfullscreen loading="lazy"></iframe>`;
