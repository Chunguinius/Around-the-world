// Tour editor: upload panoramas, connect them with checkpoints, add a floor plan, publish.
import { toast, whoami, openAuth, takeAfterLogin } from './layout.js';
import { PanoViewer, escapeHtml, yawDiff } from './viewer.js';
import { saveDraft, getDraft, deleteDraft } from './db.js';
import { cloudEnabled, uploadFile, saveNewTour, updateTour, getTourRow, deleteTour, pruneFiles } from './cloud.js';
import { sceneSrc, sceneThumb, planSrc, linkLabel, myCards, tourHref } from './tours.js';

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID();
const user = await whoami;

let tour = { id: uid(), title: '', location: '', description: '', category: 'Other', visibility: 'public', scenes: [], floorplan: null, published: false };
let cur = null, viewer = null, pendingSpot = null, dirty = false, saveTimer = null;
const scene = () => tour.scenes.find(s => s.id === cur);
const byId = id => tour.scenes.find(s => s.id === id);
const links = s => s.hotspots.filter(h => h.type === 'scene');

// ---------- persistence ----------
function touch() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); renderGuide(); }
async function saveNow(quiet = true) {
  clearTimeout(saveTimer);
  if (!tour.scenes.length) return false;
  tour.updated = Date.now();
  try {
    await saveDraft(tour); dirty = false;
    if (!new URLSearchParams(location.search).get('edit')) history.replaceState(null, '', 'create.html?edit=' + tour.id);
    $('status').textContent = 'Draft saved in this browser at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (tour.published ? '. Publish again to update the live tour.' : '.');
    if (!quiet) { toast('Draft saved'); renderMine(); }
    return true;
  } catch (e) { $('status').textContent = 'Could not save the draft: ' + e.message; return false; }
}

// ---------- images ----------
function canvasBlob(c, type, q) { return new Promise(r => c.toBlob(r, type, q)); }
async function processPano(file) {
  const bmp = await createImageBitmap(file);
  const ratio = bmp.width / bmp.height;
  const gl = document.createElement('canvas').getContext('webgl');
  const maxW = Math.min(gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096, 8192);
  const w = Math.min(bmp.width, maxW), h = Math.round(w / 2);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await canvasBlob(c, 'image/jpeg', 0.88);
  const t = document.createElement('canvas'); t.width = 480; t.height = 270;
  t.getContext('2d').drawImage(bmp, bmp.width * .25, bmp.height * .2, bmp.width * .5, bmp.height * .6, 0, 0, 480, 270);
  const thumbBlob = await canvasBlob(t, 'image/jpeg', 0.8);
  bmp.close?.();
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Scene';
  return { scene: { id: uid(), title, blob, thumbBlob, yaw: 0, pitch: 0, hotspots: [] }, stretched: Math.abs(ratio - 2) > 0.15 };
}
async function addFiles(files) {
  const imgs = [...files].filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (!imgs.length) return toast('Please choose JPG, PNG or WebP images');
  if (tour.scenes.length + imgs.length > 200) return toast('A tour can hold up to 200 scenes');
  let odd = 0, failed = 0;
  for (const [i, f] of imgs.entries()) {
    tip(`Preparing panorama ${i + 1} of ${imgs.length}…`, 0);
    try { const r = await processPano(f); tour.scenes.push(r.scene); if (r.stretched) odd++; } catch { failed++; }
  }
  tip('');
  if (failed) toast(`${failed} file${failed > 1 ? 's' : ''} could not be read`);
  else if (odd) toast(`${odd} image${odd > 1 ? 's are' : ' is'} not 2:1, so ${odd > 1 ? 'they' : 'it'} may look stretched`);
  if (!tour.scenes.length) return;
  if (!tour.title) $('title').value = tour.title = tour.scenes[0].title;
  showEditor(); select(cur || tour.scenes[0].id); touch();
  if (tour.scenes.length > 1 && !tour.scenes.some(s => links(s).length)) tip('Next: look toward a doorway and press “＋ Checkpoint”, or drag a scene from the list onto the view.', 9000);
}

// ---------- viewer ----------
function ensureViewer() {
  if (viewer) return;
  viewer = new PanoViewer($('stage'), { autoRotate: 0, editable: true, keyboard: 'global' });
  viewer.on('hotspotmove', () => { renderSpots(); touch(); });
  viewer.on('hotspot', h => focusSpot(scene().hotspots.indexOf(h)));
  viewer.on('dblclick', p => openPicker({ yaw: p.yaw, pitch: p.pitch }));
  viewer.on('walk', ({ dir, link }) => { if (dir > 0 && link) select(link.target); });
}
function showEditor() {
  const has = tour.scenes.length > 0;
  $('drop').hidden = has; $('tools').hidden = !has; $('auto-link').hidden = tour.scenes.length < 2;
  if (has) ensureViewer();
  renderScenes(); renderGuide(); renderPlan();
}
function refreshSpots() { const s = scene(); if (s) viewer.setHotspots(s.hotspots.map(h => Object.assign(h, { label: h.label || '' }))); labelSpots(); renderSpots(); }
// viewer shows the stored hotspot objects directly (so dragging edits them); fill in display labels on the nodes
function labelSpots() { viewer?.hotspots.forEach(hs => { hs.node.querySelector('.pv-label').textContent = linkLabel(hs.data, tour.scenes); }); }
function select(id) {
  const s = byId(id); if (!s) return;
  cur = id; closePicker(); renderScenes(); renderPlan();
  viewer.load(sceneSrc(s), { yaw: s.yaw, pitch: s.pitch, hotspots: s.hotspots }).then(labelSpots).catch(() => toast('This panorama could not be loaded'));
  renderSpots();
}

// ---------- scenes list ----------
function reachable() {
  const seen = new Set(); const q = tour.scenes[0] ? [tour.scenes[0].id] : [];
  while (q.length) { const id = q.pop(); if (seen.has(id)) continue; seen.add(id); links(byId(id) || { hotspots: [] }).forEach(h => byId(h.target) && q.push(h.target)); }
  return seen;
}
function renderScenes() {
  const ok = reachable();
  $('scene-count').textContent = tour.scenes.length ? `(${tour.scenes.length})` : '';
  $('scenes').innerHTML = tour.scenes.length ? tour.scenes.map((s, i) => `<div class="scene-item ${s.id === cur ? 'on' : ''}" data-id="${s.id}" draggable="true" title="Drag onto the panorama to add a checkpoint leading here">
      <img src="${sceneThumb(s)}" alt="" draggable="false">
      <div class="scene-main"><input value="${escapeHtml(s.title)}" data-rename="${s.id}" aria-label="Scene name" maxlength="60">
        <span class="small">${i === 0 ? '<b class="tag">Start</b> ' : ''}${links(s).length} checkpoint${links(s).length === 1 ? '' : 's'}${!ok.has(s.id) ? ' · <span class="warn" title="No checkpoint leads here yet">⚠ unreachable</span>' : ''}</span></div>
      <div class="scene-actions"><button data-up="${s.id}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-down="${s.id}" title="Move down" ${i === tour.scenes.length - 1 ? 'disabled' : ''}>↓</button><button data-del="${s.id}" title="Remove scene">×</button></div></div>`).join('') : '<p class="empty">No scenes yet.</p>';
}
$('scenes').addEventListener('click', e => {
  const del = e.target.closest('[data-del]'), up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]');
  if (del) {
    const id = del.dataset.del; if (links(byId(id)).length && !confirm('Remove this scene and the checkpoints that lead to it?')) return;
    tour.scenes = tour.scenes.filter(s => s.id !== id);
    tour.scenes.forEach(s => s.hotspots = s.hotspots.filter(h => h.target !== id));
    if (tour.floorplan) delete tour.floorplan.markers[id];
    if (cur === id) cur = null;
    showEditor(); if (tour.scenes[0]) select(cur || tour.scenes[0].id); else { viewer?.setHotspots([]); renderSpots(); }
    return touch();
  }
  if (up || down) {
    const i = tour.scenes.findIndex(s => s.id === (up || down).dataset[up ? 'up' : 'down']), j = i + (up ? -1 : 1);
    [tour.scenes[i], tour.scenes[j]] = [tour.scenes[j], tour.scenes[i]]; renderScenes(); renderPlan(); return touch();
  }
  const it = e.target.closest('[data-id]'); if (it && !e.target.matches('input') && it.dataset.id !== cur) select(it.dataset.id);
});
$('scenes').addEventListener('input', e => { const s = byId(e.target.dataset.rename); if (s) { s.title = e.target.value; labelSpots(); renderSpots(); touch(); } });
$('scenes').addEventListener('dragstart', e => { const it = e.target.closest('[data-id]'); if (!it) return; e.dataTransfer.setData('text/scene', it.dataset.id); e.dataTransfer.effectAllowed = 'link'; });

// ---------- checkpoints and info points ----------
function viewSpot() { const v = viewer.getView(); return { yaw: v.yaw, pitch: Math.max(-45, Math.min(v.pitch, 0) - 8) }; }
function addLink(from, targetId, spot, wayBack) {
  from.hotspots.push({ type: 'scene', target: targetId, yaw: spot.yaw, pitch: spot.pitch, label: '' });
  const target = byId(targetId);
  if (wayBack && target && !links(target).some(h => h.target === from.id)) {
    // put the return checkpoint behind the target scene's starting view, nudged aside if something is already there
    let yaw = (target.yaw || 0) + 180;
    while (links(target).some(h => Math.abs(yawDiff(h.yaw, yaw)) < 18)) yaw += 30;
    target.hotspots.push({ type: 'scene', target: from.id, yaw: ((yaw + 540) % 360) - 180, pitch: -8, label: '' });
    return true;
  }
  return false;
}
function openPicker(spot = null) {
  if (tour.scenes.length < 2) return toast('Add another panorama first, then connect them');
  pendingSpot = spot;
  $('picker-grid').innerHTML = tour.scenes.filter(s => s.id !== cur).map(s => `<button data-t="${s.id}"><img src="${sceneThumb(s)}" alt=""><span>${escapeHtml(s.title)}</span>${links(scene()).some(h => h.target === s.id) ? '<em>linked</em>' : ''}</button>`).join('');
  $('picker').hidden = false;
}
function closePicker() { $('picker').hidden = true; pendingSpot = null; }
$('picker-x').onclick = closePicker;
$('picker-grid').onclick = e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  placeLink(b.dataset.t, pendingSpot || viewSpot()); closePicker();
};
function placeLink(targetId, spot) {
  const back = addLink(scene(), targetId, spot, $('way-back').checked);
  refreshSpots(); renderScenes(); touch();
  focusSpot(scene().hotspots.length - 1, false);
  tip(`Checkpoint to “${byId(targetId).title}” added. Drag it onto the doorway or path.` + (back ? ' A way back was added in that scene too.' : ''), 6000);
}
$('t-link').onclick = () => $('picker').hidden ? openPicker() : closePicker();
$('t-info').onclick = () => {
  const v = viewer.getView();
  scene().hotspots.push({ type: 'info', yaw: v.yaw, pitch: v.pitch, label: 'Info', text: '' });
  refreshSpots(); touch(); focusSpot(scene().hotspots.length - 1, true);
  tip('Info point added. Drag it into place and write its text on the right.', 5000);
};
$('t-start').onclick = () => { const v = viewer.getView(); Object.assign(scene(), { yaw: v.yaw, pitch: v.pitch }); touch(); tip('Start view saved: visitors will first see this scene from here.', 3500); };
$('t-preview').onclick = async () => { if (await saveNow()) location.href = 'tour.html?local=' + tour.id; };
$('auto-link').onclick = () => {
  let n = 0;
  for (let i = 0; i < tour.scenes.length - 1; i++) {
    const a = tour.scenes[i], b = tour.scenes[i + 1];
    if (links(a).some(h => h.target === b.id)) continue;
    let yaw = a.yaw || 0; while (links(a).some(h => Math.abs(yawDiff(h.yaw, yaw)) < 18)) yaw += 30;
    addLink(a, b.id, { yaw: ((yaw + 540) % 360) - 180, pitch: -8 }, true); n++;
  }
  refreshSpots(); renderScenes(); touch();
  tip(n ? `Connected ${n + 1} scenes in order. Open each scene and drag its checkpoints onto the real doorways.` : 'These scenes are already connected in order.', 7000);
};
// drop a scene from the list onto the panorama
const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); if (!tour.scenes.length) $('drop').classList.add('over'); });
stage.addEventListener('dragleave', () => $('drop').classList.remove('over'));
stage.addEventListener('drop', e => {
  e.preventDefault(); $('drop').classList.remove('over');
  const id = e.dataTransfer.getData('text/scene');
  if (id) { if (id === cur) return toast('Drop a different scene to link to it'); return placeLink(id, viewer.pick(e.clientX, e.clientY)); }
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

function renderSpots() {
  const s = scene();
  if (!s || !s.hotspots.length) { $('hs-list').innerHTML = `<p class="empty">${tour.scenes.length > 1 ? 'No checkpoints here yet. Press “＋ Checkpoint” and pick where it leads.' : 'Checkpoints and info points for the current scene show up here.'}</p>`; return; }
  $('hs-list').innerHTML = s.hotspots.map((h, i) => h.type === 'scene' ? `<div class="hs-item" data-i="${i}">
      <div class="row"><b>➜ Checkpoint</b><span><button class="mini" data-look="${i}" title="Show in the panorama">◎</button><button class="mini" data-go="${i}" title="Open that scene">↗</button><button class="mini" data-rm="${i}" title="Delete">×</button></span></div>
      <label class="field">Leads to<select data-target="${i}">${tour.scenes.filter(x => x.id !== s.id).map(x => `<option value="${x.id}" ${x.id === h.target ? 'selected' : ''}>${escapeHtml(x.title)}</option>`).join('')}</select></label>
      <label class="field">Label<input data-label="${i}" value="${escapeHtml(h.label || '')}" placeholder="${escapeHtml(byId(h.target)?.title || '')}" maxlength="60"></label></div>`
    : `<div class="hs-item" data-i="${i}">
      <div class="row"><b>ⓘ Info point</b><span><button class="mini" data-look="${i}" title="Show in the panorama">◎</button><button class="mini" data-rm="${i}" title="Delete">×</button></span></div>
      <label class="field">Title<input data-label="${i}" value="${escapeHtml(h.label || '')}" maxlength="60"></label>
      <label class="field">Text<textarea data-text="${i}" rows="2" maxlength="400">${escapeHtml(h.text || '')}</textarea></label></div>`).join('');
}
function focusSpot(i, edit = true) {
  const card = $('hs-list').querySelector(`[data-i="${i}"]`); if (!card) return;
  $('hs-list').querySelectorAll('.hs-item').forEach(c => c.classList.toggle('on', c === card));
  card.scrollIntoView({ block: 'nearest' }); if (edit) card.querySelector('input, select')?.focus({ preventScroll: true });
}
$('hs-list').addEventListener('click', e => {
  const s = scene(); const rm = e.target.closest('[data-rm]'), look = e.target.closest('[data-look]'), go = e.target.closest('[data-go]');
  if (rm) { s.hotspots.splice(+rm.dataset.rm, 1); refreshSpots(); renderScenes(); return touch(); }
  if (look) { const h = s.hotspots[+look.dataset.look]; return viewer.flyTo(h.yaw, h.pitch); }
  if (go) return select(s.hotspots[+go.dataset.go].target);
});
$('hs-list').addEventListener('input', e => {
  const s = scene(), t = e.target;
  if (t.dataset.label !== undefined) s.hotspots[+t.dataset.label].label = t.value;
  if (t.dataset.text !== undefined) s.hotspots[+t.dataset.text].text = t.value;
  if (t.dataset.target !== undefined) { s.hotspots[+t.dataset.target].target = t.value; renderScenes(); renderSpots(); }
  labelSpots(); touch();
});

// ---------- guide ----------
function renderGuide() {
  const n = tour.scenes.length, ok = reachable(), missing = n - ok.size;
  const steps = [
    [n > 0, n ? `${n} panorama${n > 1 ? 's' : ''} added` : 'Add your panoramas'],
    [n > 0 && (n === 1 || missing === 0), n < 2 ? 'Connect scenes with checkpoints' : missing ? `Connect scenes: ${missing} can’t be reached yet` : 'Every scene is connected'],
    [tour.published && !dirty, tour.published ? (dirty ? 'Publish again to update the live tour' : 'Published') : 'Publish and share the link']
  ];
  $('guide').innerHTML = steps.map(([done, text]) => `<li class="${done ? 'done' : ''}">${escapeHtml(text)}</li>`).join('');
}
let tipTimer;
function tip(text, ms = 4000) { clearTimeout(tipTimer); const t = $('tip'); t.textContent = text; t.hidden = !text; if (text && ms) tipTimer = setTimeout(() => t.hidden = true, ms); }

// ---------- floor plan ----------
function renderPlan() {
  const fp = tour.floorplan, box = $('plan-box');
  if (!fp) { box.innerHTML = `<label class="btn btn-sm" style="width:100%;justify-content:center">Upload a floor plan<input type="file" id="plan-file" accept="image/jpeg,image/png,image/webp" hidden></label><p class="small" style="margin-top:8px">Visitors get a mini map and can jump between rooms.</p>`; return; }
  const s = scene();
  box.innerHTML = `<div class="plan" id="plan"><img src="${planSrc(fp)}" alt="Floor plan" draggable="false">${tour.scenes.map((x, i) => fp.markers[x.id] ? `<button class="pin ${x.id === cur ? 'on' : ''}" style="left:${fp.markers[x.id].x * 100}%;top:${fp.markers[x.id].y * 100}%" data-pin="${x.id}" title="${escapeHtml(x.title)}">${i + 1}</button>` : '').join('')}</div>
    <p class="small" style="margin-top:8px">${s ? `Click the plan to place <b>${escapeHtml(s.title)}</b>. ` : ''}${Object.keys(fp.markers).length} of ${tour.scenes.length} scenes placed.</p>
    <div class="row"><button class="btn btn-sm btn-ghost" id="plan-clear" ${s && fp.markers[s.id] ? '' : 'disabled'}>Remove this marker</button><button class="btn btn-sm btn-ghost" id="plan-remove">Remove plan</button></div>`;
}
$('plan-box').addEventListener('change', async e => {
  if (e.target.id !== 'plan-file' || !e.target.files[0]) return;
  try {
    const bmp = await createImageBitmap(e.target.files[0]); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    tour.floorplan = { blob: await canvasBlob(c, 'image/jpeg', 0.9), markers: {} }; renderPlan(); touch();
    tip('Floor plan added. Select a scene, then click its spot on the plan.', 6000);
  } catch { toast('That image could not be read'); }
});
$('plan-box').addEventListener('click', e => {
  const fp = tour.floorplan; if (!fp) return;
  if (e.target.id === 'plan-remove') { if (confirm('Remove the floor plan?')) { tour.floorplan = null; renderPlan(); touch(); } return; }
  if (e.target.id === 'plan-clear') { delete fp.markers[cur]; renderPlan(); return touch(); }
  const pin = e.target.closest('[data-pin]'); if (pin) { if (pin.dataset.pin !== cur) select(pin.dataset.pin); return; }
  const plan = e.target.closest('#plan'); if (!plan || !scene()) return;
  const r = plan.getBoundingClientRect();
  fp.markers[cur] = { x: +((e.clientX - r.left) / r.width).toFixed(4), y: +((e.clientY - r.top) / r.height).toFixed(4) }; renderPlan(); touch();
});

// ---------- details ----------
for (const [id, key] of [['title', 'title'], ['location', 'location'], ['desc', 'description'], ['category', 'category'], ['visibility', 'visibility']]) $(id).addEventListener('input', e => { tour[key] = e.target.value; touch(); });
function fillDetails() { $('title').value = tour.title || ''; $('location').value = tour.location || ''; $('desc').value = tour.description || ''; $('category').value = tour.category || 'Other'; $('visibility').value = tour.visibility || 'public'; }
$('file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('file2').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('sample').onclick = async () => {
  const names = ['alpine-lake', 'night-sky', 'desert-dusk'];
  addFiles(await Promise.all(names.map(async n => new File([await (await fetch('assets/pano/' + n + '.jpg')).blob()], n + '.jpg', { type: 'image/jpeg' }))));
};
$('save').onclick = () => tour.scenes.length ? saveNow(false) : toast('Add at least one panorama first');

// ---------- publishing ----------
$('publish').onclick = publish;
async function publish() {
  if (!tour.scenes.length) return toast('Add at least one panorama first');
  tour.title = (tour.title || '').trim() || 'Untitled tour'; $('title').value = tour.title;
  await saveNow();
  if (!cloudEnabled) return toast('Publishing is not switched on for this site yet. Your tour is saved as a draft in this browser.');
  if (!user) { toast('Create a free account to publish'); return openAuth('signup', 'publish'); }
  const btn = $('publish'); btn.disabled = true;
  try {
    const folder = `${user.id}/${tour.id}`, keep = [];
    const todo = tour.scenes.filter(s => !s.image).length; let done = 0;
    for (const s of tour.scenes) {
      if (!s.image) {
        btn.textContent = `Uploading ${++done} of ${todo}…`;
        const image = await uploadFile(`${folder}/${s.id}.jpg`, s.blob), thumb = await uploadFile(`${folder}/${s.id}_t.jpg`, s.thumbBlob);
        Object.assign(s, { image, thumb });
      }
      keep.push(s.image, s.thumb);
    }
    const fp = tour.floorplan;
    if (fp && !fp.image) fp.image = await uploadFile(`${folder}/plan_${Date.now()}.jpg`, fp.blob);
    if (fp) keep.push(fp.image);
    btn.textContent = 'Publishing…';
    const row = {
      author: user.name, title: tour.title, description: tour.description || '', location: tour.location || '', category: tour.category || 'Other',
      visibility: tour.visibility || 'public', cover: tour.scenes[0].thumb, scene_count: tour.scenes.length,
      data: { scenes: tour.scenes.map(({ id, title, yaw, pitch, hotspots, image, thumb }) => ({ id, title, yaw, pitch, hotspots, image, thumb })), floorplan: fp ? { image: fp.image, markers: fp.markers } : null }
    };
    if (tour.published) await updateTour(tour.id, row); else await saveNewTour({ id: tour.id, ...row });
    tour.published = true; tour.owner = user.id;
    await saveDraft(tour); dirty = false;
    pruneFiles(folder, keep).catch(() => {});
    const link = new URL('tour.html?t=' + tour.id, location.href).href;
    $('done-link').value = link; $('done-open').href = link; $('done-modal').classList.add('open');
    $('status').textContent = 'Published. Changes you make from now on stay in your draft until you publish again.';
    renderGuide(); renderMine();
  } catch (e) { toast('Publishing failed: ' + e.message); $('status').textContent = 'Publishing failed: ' + e.message + ' Your draft is safe in this browser.'; }
  finally { btn.disabled = false; btn.textContent = tour.published ? 'Publish changes' : 'Publish tour'; }
}
$('done-copy').onclick = () => navigator.clipboard?.writeText($('done-link').value).then(() => toast('Link copied'), () => { $('done-link').select(); document.execCommand('copy'); toast('Link copied'); });
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) e.target.closest('.modal').classList.remove('open'); });

// ---------- my tours ----------
async function renderMine() {
  const list = await myCards();
  $('mine').innerHTML = list.length ? list.map(t => `<div class="card">
      <a class="card-media" href="${tourHref(t)}">${t.cover ? `<img src="${escapeHtml(t.cover)}" alt="">` : ''}<span class="badge">${t.kind === 'draft' ? 'Draft' : t.visibility === 'unlisted' ? 'Unlisted' : 'Public'}</span><span class="badge badge-360">360°</span></a>
      <div class="card-body"><h3>${escapeHtml(t.title || 'Untitled tour')}</h3><p>${t.sceneCount} scene${t.sceneCount === 1 ? '' : 's'}${t.kind === 'cloud' ? ` · ${(t.views || 0).toLocaleString()} views` : ' · only in this browser'}</p>
      <div class="row"><a class="btn btn-sm" href="${tourHref(t)}">View</a><a class="btn btn-sm" href="create.html?edit=${t.id}">Edit</a><button class="btn btn-sm btn-ghost" data-delete="${t.id}" data-kind="${t.kind}">Delete</button></div></div></div>`).join('')
    : `<p class="empty" style="grid-column:1/-1">${cloudEnabled && !user ? 'Log in to see the tours you have published. Drafts you save in this browser show up here too.' : 'Tours you save or publish will show up here.'}</p>`;
}
$('mine').onclick = async e => {
  const b = e.target.closest('[data-delete]'); if (!b) return;
  if (!confirm(b.dataset.kind === 'cloud' ? 'Delete this tour for everyone? Its link will stop working.' : 'Delete this draft?')) return;
  try { if (b.dataset.kind === 'cloud') await deleteTour(b.dataset.delete); await deleteDraft(b.dataset.delete); if (b.dataset.delete === tour.id) location.href = 'create.html'; else renderMine(); }
  catch (err) { toast('Could not delete: ' + err.message); }
};

// ---------- start ----------
const editId = new URLSearchParams(location.search).get('edit');
if (editId) {
  let loaded = await getDraft(editId).catch(() => null);
  if (!loaded && cloudEnabled) {
    const row = await getTourRow(editId).catch(() => null);
    if (row && user && row.owner === user.id) loaded = { id: row.id, title: row.title, location: row.location, description: row.description, category: row.category, visibility: row.visibility, owner: row.owner, published: true, scenes: row.data?.scenes || [], floorplan: row.data?.floorplan || null };
    else if (row) toast('You can only edit your own tours');
  }
  if (loaded) { tour = { floorplan: null, ...loaded }; tour.scenes.forEach(s => s.hotspots ||= []); if (tour.floorplan) tour.floorplan.markers ||= {}; }
  else history.replaceState(null, '', 'create.html');
}
fillDetails(); showEditor(); renderSpots();
if (tour.scenes.length) select(tour.scenes[0].id);
$('publish').textContent = tour.published ? 'Publish changes' : 'Publish tour';
renderMine();
if (takeAfterLogin() === 'publish' && user && tour.scenes.length) publish();
addEventListener('beforeunload', () => { if (dirty) saveDraft(tour); });
if (location.hash === '#my-tours') setTimeout(() => $('my-tours').scrollIntoView(), 300);
