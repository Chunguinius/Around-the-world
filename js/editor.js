// Tour editor: a full-screen panorama with the tool menu on the right and the scene strip along the bottom.
import { toast, whoami, openAuth, takeAfterLogin, logoHTML } from './layout.js';
import { PanoViewer, escapeHtml, yawDiff } from './viewer.js';
import { saveDraft, getDraft } from './db.js';
import { cloudEnabled, uploadFile, saveNewTour, updateTour, getTourRow, pruneFiles } from './cloud.js';
import { sceneSrc, sceneThumb, planSrc, linkLabel } from './tours.js';
import { processPano, processPlan, isImage, settingsOf, qrSvg, copyText, downloadSvg, tourLink, embedCode } from './pano.js';

const $ = id => document.getElementById(id);
const user = await whoami;
$('brand').innerHTML = logoHTML('index.html');

// ---------- load the tour ----------
const q = new URLSearchParams(location.search);
const editId = q.get('id') || q.get('edit');
let tour = editId ? await getDraft(editId).catch(() => null) : null;
if (!tour && editId && cloudEnabled) {
  const row = await getTourRow(editId).catch(() => null);
  if (row && user && row.owner === user.id) {
    const scenes = row.data?.scenes || [];
    tour = { id: row.id, title: row.title, location: row.location, description: row.description, category: row.category, visibility: row.visibility, owner: row.owner, author: row.author,
      published: true, scenes, floorplan: row.data?.floorplan || null, settings: row.data?.settings, cover: scenes.find(s => s.thumb === row.cover)?.id };
  } else if (row) toast('You can only edit your own tours');
}
if (!tour || !tour.scenes?.length) { location.replace('create.html'); await new Promise(() => {}); }
tour.scenes.forEach(s => s.hotspots ||= []);
if (tour.floorplan) tour.floorplan.markers ||= {};

let cur = null, dirty = false, saveTimer = null, panel = null, hsTab = 'scene', openRow = -1, pendingSpot = null, planSel = null;
const scene = () => tour.scenes.find(s => s.id === cur);
const byId = id => tour.scenes.find(s => s.id === id);
const links = s => s.hotspots.filter(h => h.type === 'scene');
const coverScene = () => byId(tour.cover) || tour.scenes[0];

// ---------- saving ----------
function touch() { dirty = true; tour.pending = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 700); renderStatus(); }
async function saveNow(quiet = true) {
  clearTimeout(saveTimer); tour.updated = Date.now();
  try { await saveDraft(tour); dirty = false; renderStatus(); if (!quiet) toast('Saved in this browser'); return true; }
  catch (e) { $('status').textContent = 'Could not save: ' + e.message; return false; }
}
function renderStatus() {
  $('status').textContent = dirty ? 'Saving…' : !tour.published ? 'Draft saved in this browser' : tour.pending ? 'Changes not published yet' : 'Published';
  $('publish').textContent = tour.published ? 'Publish changes' : 'Publish';
}
let tipTimer;
function tip(text, ms = 4500) { clearTimeout(tipTimer); const t = $('tip'); t.textContent = text; t.hidden = !text; if (text && ms) tipTimer = setTimeout(() => t.hidden = true, ms); }

// ---------- panorama ----------
const viewer = new PanoViewer($('viewer'), { autoRotate: 0, editable: true, keyboard: 'global' });
viewer.on('hotspotmove', touch);
viewer.on('hotspot', h => { hsTab = h.type === 'scene' ? 'scene' : 'info'; openRow = scene().hotspots.indexOf(h); setPanel('hotspot'); });
viewer.on('dblclick', p => { setPanel('hotspot'); hsTab = 'scene'; renderSpots(); openPicker({ yaw: p.yaw, pitch: p.pitch }); });
viewer.on('walk', ({ dir, link }) => { if (dir > 0 && link) select(link.target); });
// the viewer shows the stored hotspot objects directly (so dragging edits them); labels are filled in on the nodes
function labelSpots() { viewer.hotspots.forEach(hs => { hs.node.querySelector('.pv-label').textContent = linkLabel(hs.data, tour.scenes); }); }
function refreshSpots() { viewer.setHotspots(scene().hotspots); labelSpots(); renderSpots(); }
function select(id) {
  const s = byId(id); if (!s) return;
  cur = id; openRow = -1; closePicker(); renderStrip(); renderSpots();
  viewer.load(sceneSrc(s), { yaw: s.yaw, pitch: s.pitch, fov: s.fov, hotspots: s.hotspots }).then(() => { labelSpots(); syncFov(); }).catch(() => toast('This panorama could not be loaded'));
}

// ---------- scene strip ----------
function renderStrip() {
  $('strip').innerHTML = tour.scenes.map(s => `<button data-s="${s.id}" draggable="true" class="${s.id === cur ? 'on' : ''}"><img src="${sceneThumb(s)}" alt="" draggable="false"><span>${escapeHtml(s.title)}</span><em>${escapeHtml(s.title)}</em></button>`).join('')
    + '<button class="add" id="strip-add" title="Add panoramas" aria-label="Add panoramas">+</button>';
}
$('strip').addEventListener('click', e => {
  if (e.target.closest('#strip-add')) return $('file').click();
  const b = e.target.closest('[data-s]'); if (b && b.dataset.s !== cur) select(b.dataset.s);
});
$('strip').addEventListener('dragstart', e => { const b = e.target.closest('[data-s]'); if (!b) return; e.dataTransfer.setData('text/scene', b.dataset.s); e.dataTransfer.effectAllowed = 'link'; });
$('b-scenes').onclick = () => $('band').classList.toggle('shut');
const stage = $('stage');
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => {
  e.preventDefault();
  const id = e.dataTransfer.getData('text/scene');
  if (id) { if (id === cur) return toast('Drop a different scene to link to it'); return placeLink(id, viewer.pick(e.clientX, e.clientY)); }
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

async function addFiles(files) {
  const imgs = [...files].filter(isImage);
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
  renderStrip(); renderSceneGrid(); renderSpots(); touch();
}
$('file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };

// ---------- tool menu ----------
const MODALS = ['info', 'scenes', 'plan', 'browse', 'share'];
function markMenu() { $('menu').querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === panel || !!$('m-' + b.dataset.m)?.classList.contains('open'))); }
function setPanel(p) {
  panel = p; closePicker();
  $('p-hotspot').hidden = p !== 'hotspot'; $('p-view').hidden = p !== 'view'; $('frame').hidden = p !== 'view'; stage.classList.toggle('viewing', p === 'view');
  if (p === 'hotspot') renderSpots();
  if (p === 'view') syncFov();
  markMenu();
}
function openModal(name) {
  setPanel(null);
  ({ info: fillInfo, scenes: renderSceneGrid, plan: () => { planSel = cur; renderPlan(); }, browse: fillBrowse, share: fillShare })[name]();
  $('m-' + name).classList.add('open'); markMenu();
}
$('menu').addEventListener('click', async e => {
  const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
  if (m === 'view' || m === 'hotspot') return setPanel(panel === m ? null : m);
  if (MODALS.includes(m)) return openModal(m);
  if (m === 'save') return saveNow(false);
  if (m === 'preview') { if (await saveNow()) location.href = 'tour.html?local=' + tour.id; return; }
  if (m === 'publish') publish();
});
// dialogs are closed by shared handlers (the × button, Cancel, Escape), so re-check the menu highlight afterwards
['click', 'keyup'].forEach(t => document.addEventListener(t, () => setTimeout(markMenu)));

// ---------- hotspots ----------
const CHEV = '<svg viewBox="0 0 24 24"><path d="M5 8l7 6 7-6M5 14l7 6 7-6" opacity=".95"/></svg>', INFO = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>';
function viewSpot() { const v = viewer.getView(); return { yaw: v.yaw, pitch: Math.max(-45, Math.min(v.pitch, 0) - 8) }; }
function addLink(from, targetId, spot, wayBack) {
  from.hotspots.push({ type: 'scene', target: targetId, yaw: spot.yaw, pitch: spot.pitch, label: '' });
  const target = byId(targetId);
  if (wayBack && target && !links(target).some(h => h.target === from.id)) {
    // put the return hotspot behind the target scene's opening view, nudged aside if something is already there
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
$('picker-grid').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; const spot = pendingSpot || viewSpot(); closePicker(); placeLink(b.dataset.t, spot); };
function placeLink(targetId, spot) {
  const back = addLink(scene(), targetId, spot, $('way-back').checked);
  hsTab = 'scene'; openRow = scene().hotspots.length - 1;
  if (panel !== 'hotspot') setPanel('hotspot');
  refreshSpots(); renderSceneGrid(); touch();
  tip(`Hotspot to “${byId(targetId).title}” added. Drag it onto the doorway or path.` + (back ? ' The way back was added in that scene too.' : ''), 6000);
}
function autoLink() {
  let n = 0;
  for (let i = 0; i < tour.scenes.length - 1; i++) {
    const a = tour.scenes[i], b = tour.scenes[i + 1];
    if (links(a).some(h => h.target === b.id)) continue;
    let yaw = a.yaw || 0; while (links(a).some(h => Math.abs(yawDiff(h.yaw, yaw)) < 18)) yaw += 30;
    addLink(a, b.id, { yaw: ((yaw + 540) % 360) - 180, pitch: -8 }, true); n++;
  }
  refreshSpots(); renderSceneGrid(); if (n) touch();
  tip(n ? `Connected ${tour.scenes.length} scenes in order. Open each scene and drag its hotspots onto the real doorways.` : 'These scenes are already connected in order.', 7000);
}
function reachable() {
  const seen = new Set(), todo = [tour.scenes[0].id];
  while (todo.length) { const id = todo.pop(); if (seen.has(id)) continue; seen.add(id); links(byId(id) || { hotspots: [] }).forEach(h => byId(h.target) && todo.push(h.target)); }
  return seen;
}
function renderSpots() {
  const s = scene(); if (!s || panel !== 'hotspot') return;
  $('hs-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === hsTab));
  const rows = s.hotspots.map((h, i) => [h, i]).filter(([h]) => (h.type === 'scene') === (hsTab === 'scene'));
  $('hs-count').textContent = `${s.hotspots.length}/300`;
  $('hs-list').innerHTML = rows.map(([h, i]) => `<div class="hrow ${i === openRow ? 'on' : ''}" data-i="${i}">
      <div class="hrow-top" data-look="${i}">${h.type === 'scene' ? CHEV : INFO}<b>${escapeHtml(linkLabel(h, tour.scenes))}</b><button data-rename="${i}">Rename</button><button data-edit="${i}">Edit</button><button data-rm="${i}">Delete</button></div>
      ${i !== openRow ? '' : h.type === 'scene'
        ? `<div class="hrow-edit"><input class="dk" data-label="${i}" value="${escapeHtml(h.label || '')}" placeholder="Label (optional): ${escapeHtml(byId(h.target)?.title || '')}" maxlength="60" aria-label="Label">
            <select class="dk" data-target="${i}" aria-label="Leads to">${tour.scenes.filter(x => x.id !== s.id).map(x => `<option value="${x.id}" ${x.id === h.target ? 'selected' : ''}>Leads to: ${escapeHtml(x.title)}</option>`).join('')}</select></div>`
        : `<div class="hrow-edit"><input class="dk" data-label="${i}" value="${escapeHtml(h.label || '')}" placeholder="Title" maxlength="60" aria-label="Title">
            <textarea class="dk" data-text="${i}" rows="3" maxlength="400" placeholder="Text shown when visitors open this hotspot" aria-label="Text">${escapeHtml(h.text || '')}</textarea></div>`}
    </div>`).join('');
  $('hs-note').innerHTML = hsTab === 'scene'
    ? (tour.scenes.length < 2 ? 'Add another panorama with the + tile in the scene strip, then link them here.'
      : 'Look toward a doorway and press “Add hotspot”, or drag a scene from the strip onto the view. Drag a hotspot to move it.' + ' <button class="ed-link" id="auto-link">Connect all scenes in order</button>')
    : 'Text hotspots open a short note, for example a material, a price or a detail worth a closer look.';
}
$('hs-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { hsTab = b.dataset.tab; openRow = -1; closePicker(); renderSpots(); } };
$('hs-add').onclick = () => {
  if (hsTab === 'scene') return $('picker').hidden ? openPicker() : closePicker();
  const v = viewer.getView(), s = scene();
  s.hotspots.push({ type: 'info', yaw: v.yaw, pitch: v.pitch, label: 'Info', text: '' });
  openRow = s.hotspots.length - 1; refreshSpots(); touch();
  $('hs-list').querySelector('[data-label]')?.select();
  tip('Text hotspot added. Drag it into place and write its text in the panel.', 5000);
};
$('p-hotspot').addEventListener('click', e => {
  if (e.target.closest('#auto-link')) return autoLink();
  const s = scene(), rm = e.target.closest('[data-rm]'), ren = e.target.closest('[data-rename]'), ed = e.target.closest('[data-edit]'), look = e.target.closest('[data-look]');
  if (rm) { s.hotspots.splice(+rm.dataset.rm, 1); openRow = -1; refreshSpots(); renderSceneGrid(); return touch(); }
  if (ren || ed) { openRow = +(ren || ed).dataset[ren ? 'rename' : 'edit']; renderSpots(); return $('hs-list').querySelector(ren ? '[data-label]' : '[data-target],[data-text]')?.focus(); }
  if (look) { const i = +look.dataset.look, h = s.hotspots[i]; viewer.flyTo(h.yaw, h.pitch); openRow = openRow === i ? -1 : i; renderSpots(); }
});
$('hs-list').addEventListener('input', e => {
  const s = scene(), t = e.target;
  if (t.dataset.label !== undefined) { const h = s.hotspots[+t.dataset.label]; h.label = t.value; t.closest('.hrow').querySelector('b').textContent = linkLabel(h, tour.scenes); }
  if (t.dataset.text !== undefined) s.hotspots[+t.dataset.text].text = t.value;
  if (t.dataset.target !== undefined) { s.hotspots[+t.dataset.target].target = t.value; renderSpots(); renderSceneGrid(); }
  labelSpots(); touch();
});

// ---------- initial view ----------
function syncFov() { const v = Math.round(viewer.fov); $('fov').value = v; $('fov-out').textContent = v; }
stage.addEventListener('wheel', () => setTimeout(syncFov, 30), { passive: true });
$('fov').oninput = e => { viewer.fov = +e.target.value; $('fov-out').textContent = e.target.value; };
$('view-save').onclick = () => { const v = viewer.getView(); Object.assign(scene(), { yaw: v.yaw, pitch: v.pitch, fov: Math.round(v.fov) }); touch(); tip('Opening view saved. Visitors will first see this scene from here.', 3500); };
$('view-reset').onclick = () => { const s = scene(); s.yaw = 0; s.pitch = 0; delete s.fov; viewer.flyTo(0, 0, 75).then(syncFov); touch(); tip('Opening view restored to the default.', 3000); };
$('fov-save').onclick = () => {
  const v = +$('fov').value, all = document.querySelector('[name=fov-scope]:checked').value === 'all';
  (all ? tour.scenes : [scene()]).forEach(s => s.fov = v); touch();
  tip(all ? 'Default zoom saved for all scenes.' : 'Default zoom saved for this scene.', 3000);
};
$('fov-reset').onclick = () => { viewer.fov = 75; syncFov(); };
$('fov-cancel').onclick = $('frame-x').onclick = () => { viewer.fov = scene().fov || 75; setPanel(null); };

// ---------- information ----------
function fillInfo() {
  $('i-title').value = tour.title || ''; $('i-author').value = tour.author || user?.name || ''; $('i-location').value = tour.location || ''; $('i-desc').value = tour.description || '';
  $('i-category').value = tour.category || 'Other';
  document.querySelectorAll('[name=i-vis]').forEach(r => r.checked = r.value === (tour.visibility || 'public'));
  $('cover').style.backgroundImage = `url('${sceneThumb(coverScene())}')`;
}
function applyInfo() {
  const title = $('i-title').value.trim(); if (!title) { $('i-title').focus(); toast('The tour needs a title'); return false; }
  Object.assign(tour, { title, author: $('i-author').value.trim(), location: $('i-location').value.trim(), description: $('i-desc').value.trim(), category: $('i-category').value, visibility: document.querySelector('[name=i-vis]:checked')?.value || 'public' });
  document.title = title + ' · Edit'; touch(); return true;
}
$('i-save').onclick = () => { if (applyInfo()) { $('m-info').classList.remove('open'); toast('Information saved'); } };
$('cover-change').onclick = () => { if (!applyInfo()) return; $('m-info').classList.remove('open'); openModal('scenes'); toast('Press “Cover” on the scene you want'); };
$('cover-reset').onclick = () => { delete tour.cover; fillInfo(); touch(); };

// ---------- scenes ----------
let dragScene = null;
function renderSceneGrid() {
  const ok = reachable(), n = tour.scenes.length, cover = coverScene().id;
  $('sc-count').textContent = `${n}/200`; $('sc-link').hidden = n < 2;
  $('sgrid').innerHTML = '<div class="scard add"><div class="im" id="sc-add" role="button" tabindex="0"><div><b>+</b>Add scene</div></div></div>'
    + tour.scenes.map((s, i) => `<div class="scard ${s.id === cur ? 'cur' : ''}" data-id="${s.id}">
      <div class="im" draggable="true" style="background-image:url('${sceneThumb(s)}')">${i === 0 ? '<span class="first">Start</span>' : ''}${ok.has(s.id) ? '' : '<span class="warn" title="No hotspot leads to this scene yet">No way in</span>'}
        <div class="bar"><button data-cover="${s.id}">${cover === s.id ? '✓ Cover' : 'Cover'}</button><button data-open="${s.id}">Open</button><button data-del="${s.id}">Delete</button></div></div>
      <label>Name<input data-rename="${s.id}" value="${escapeHtml(s.title)}" maxlength="60"></label>
      <label>Order<input type="number" min="1" max="${n}" data-order="${s.id}" value="${i + 1}"></label></div>`).join('');
}
function moveScene(id, to) {
  const from = tour.scenes.findIndex(s => s.id === id); if (from < 0) return;
  to = Math.max(0, Math.min(tour.scenes.length - 1, to)); if (to === from) return renderSceneGrid();
  tour.scenes.splice(to, 0, tour.scenes.splice(from, 1)[0]); renderSceneGrid(); renderStrip(); touch();
}
const sgrid = $('sgrid');
sgrid.addEventListener('click', e => {
  if (e.target.closest('#sc-add')) return $('file').click();
  const cov = e.target.closest('[data-cover]'), open = e.target.closest('[data-open]'), del = e.target.closest('[data-del]');
  if (cov) { tour.cover = cov.dataset.cover; renderSceneGrid(); return touch(); }
  if (open) { $('m-scenes').classList.remove('open'); return select(open.dataset.open); }
  if (del) {
    const id = del.dataset.del;
    if (tour.scenes.length === 1) return toast('A tour needs at least one scene');
    if (!confirm('Delete this scene and the hotspots that lead to it?')) return;
    tour.scenes = tour.scenes.filter(s => s.id !== id);
    tour.scenes.forEach(s => s.hotspots = s.hotspots.filter(h => h.target !== id));
    if (tour.floorplan) delete tour.floorplan.markers[id];
    if (tour.cover === id) delete tour.cover;
    renderSceneGrid(); touch();
    if (cur === id) select(tour.scenes[0].id); else { renderStrip(); refreshSpots(); }
  }
});
sgrid.addEventListener('input', e => { const s = byId(e.target.dataset.rename); if (s) { s.title = e.target.value; renderStrip(); labelSpots(); touch(); } });
sgrid.addEventListener('change', e => { if (e.target.dataset.order) moveScene(e.target.dataset.order, (+e.target.value || 1) - 1); });
sgrid.addEventListener('dragstart', e => { dragScene = e.target.closest('[data-id]')?.dataset.id || null; e.dataTransfer.effectAllowed = 'move'; });
sgrid.addEventListener('dragover', e => { const c = e.target.closest('[data-id]'); if (!dragScene || !c) return; e.preventDefault(); sgrid.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); c.classList.add('drop'); });
sgrid.addEventListener('drop', e => { const c = e.target.closest('[data-id]'); e.preventDefault(); e.stopPropagation(); if (dragScene && c) moveScene(dragScene, tour.scenes.findIndex(s => s.id === c.dataset.id)); dragScene = null; });
sgrid.addEventListener('dragend', () => { dragScene = null; sgrid.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });
$('sc-link').onclick = () => { autoLink(); toast('Scenes connected in order'); };

// ---------- floor plan ----------
function renderPlan() {
  const fp = tour.floorplan; if (!byId(planSel)) planSel = cur;
  $('fp-n').textContent = fp ? '1/1' : '0/1'; $('fp-add').hidden = !!fp; $('fp-delete').disabled = !fp; $('plan-file2').parentElement.hidden = !fp;
  $('fp-box').innerHTML = fp
    ? `<div class="fplan" id="plan"><img src="${planSrc(fp)}" alt="Floor plan" draggable="false">${tour.scenes.map((x, i) => fp.markers[x.id] ? `<button class="pin ${x.id === planSel ? 'on' : ''}" style="left:${fp.markers[x.id].x * 100}%;top:${fp.markers[x.id].y * 100}%" data-pin="${x.id}" title="${escapeHtml(x.title)}">${i + 1}</button>` : '').join('')}</div>`
    : '<label class="fp-drop"><div><b>+</b>Upload a floor plan, site plan or map<br><span class="small">JPG, PNG or WebP</span></div><input type="file" id="plan-file3" accept="image/jpeg,image/png,image/webp" hidden></label>';
  $('fp-count').textContent = fp ? Object.keys(fp.markers).length : 0;
  $('fp-points').innerHTML = tour.scenes.map((s, i) => `<button data-p="${s.id}" class="${fp?.markers[s.id] ? 'placed' : ''} ${s.id === planSel ? 'on' : ''}"><i>${i + 1}</i>${escapeHtml(s.title)}</button>`).join('');
  $('fp-clear').disabled = !fp?.markers[planSel];
}
const mPlan = $('m-plan');
mPlan.addEventListener('change', async e => {
  const f = e.target.files?.[0]; if (!f || !/^plan-file/.test(e.target.id)) return;
  try { tour.floorplan = { blob: await processPlan(f), markers: tour.floorplan?.markers || {} }; renderPlan(); touch(); } catch { toast('That image could not be read'); }
  e.target.value = '';
});
mPlan.addEventListener('click', e => {
  const fp = tour.floorplan, p = e.target.closest('[data-p]'), pin = e.target.closest('[data-pin]');
  if (p) { planSel = p.dataset.p; return renderPlan(); }
  if (!fp) return;
  if (e.target.id === 'fp-delete') { if (confirm('Delete the floor plan?')) { tour.floorplan = null; renderPlan(); touch(); } return; }
  if (e.target.id === 'fp-clear') { delete fp.markers[planSel]; renderPlan(); return touch(); }
  if (pin) { if (!pin._moved) { planSel = pin.dataset.pin; renderPlan(); } return; }
  const plan = e.target.closest('#plan'); if (!plan) return;
  const r = plan.getBoundingClientRect();
  fp.markers[planSel] = { x: +((e.clientX - r.left) / r.width).toFixed(4), y: +((e.clientY - r.top) / r.height).toFixed(4) };
  const next = tour.scenes.find(s => !fp.markers[s.id]); if (next) planSel = next.id;   // move on to the next scene that has no point yet
  renderPlan(); touch();
});
// drag a point to move it
mPlan.addEventListener('pointerdown', e => { const pin = e.target.closest('[data-pin]'); if (!pin) return; pin.setPointerCapture(e.pointerId); pin._drag = true; pin._moved = false; });
mPlan.addEventListener('pointermove', e => {
  const pin = e.target.closest?.('[data-pin]'); if (!pin?._drag) return;
  const r = $('plan').getBoundingClientRect(), x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  pin._moved = true; pin.style.left = x * 100 + '%'; pin.style.top = y * 100 + '%'; tour.floorplan.markers[pin.dataset.pin] = { x: +x.toFixed(4), y: +y.toFixed(4) };
});
mPlan.addEventListener('pointerup', e => { const pin = e.target.closest?.('[data-pin]'); if (pin?._drag) { pin._drag = false; if (pin._moved) touch(); } });

// ---------- browse settings ----------
function fillBrowse() {
  const s = settingsOf(tour);
  $('browse-form').querySelectorAll('[data-s]').forEach(c => c.checked = !!s[c.dataset.s]);
  document.querySelectorAll('[name=s-dir]').forEach(r => r.checked = +r.value === (s.dir < 0 ? -1 : 1));
  document.querySelectorAll('[name=s-speed]').forEach(r => r.checked = r.value === s.speed);
}
$('browse-save').onclick = () => {
  const s = {}; $('browse-form').querySelectorAll('[data-s]').forEach(c => s[c.dataset.s] = c.checked);
  s.dir = +document.querySelector('[name=s-dir]:checked').value; s.speed = document.querySelector('[name=s-speed]:checked').value;
  tour.settings = s; touch(); $('m-browse').classList.remove('open'); toast('Browse settings saved');
};

// ---------- share and publish ----------
function fillShare(justPublished = false) {
  $('share-title').textContent = justPublished ? 'Your tour is live' : 'Share';
  $('share-live').hidden = !tour.published; $('share-draft').hidden = !!tour.published;
  if (!tour.published) return;
  const link = tourLink(tour.id);
  $('s-link').value = link; $('s-embed').value = embedCode(link); $('s-open').href = link; $('qr').innerHTML = qrSvg(link, 4);
  $('share-note').textContent = tour.pending ? 'You have changes that are not published yet. Press Publish changes to update the live tour.' : tour.visibility === 'unlisted' ? 'Only people with this link can open the tour.' : 'This tour is listed on the Explore page.';
}
const copy = async (el, msg) => { if (!await copyText(el.value)) { el.select(); document.execCommand('copy'); } toast(msg); };
$('s-copy').onclick = () => copy($('s-link'), 'Link copied');
$('s-copy-embed').onclick = () => copy($('s-embed'), 'Embed code copied');
$('qr-dl').onclick = () => downloadSvg($('qr').innerHTML, (tour.title || 'tour').replace(/[^\w-]+/g, '-') + '-qr.svg');
$('share-publish').onclick = () => { $('m-share').classList.remove('open'); publish(); };

async function publish() {
  tour.title = (tour.title || '').trim() || 'Untitled tour';
  await saveNow();
  if (!cloudEnabled) return toast('Publishing is not switched on for this site yet. Your tour is saved as a draft in this browser.');
  if (!user) { toast('Create a free account to publish'); return openAuth('signup', 'publish'); }
  const btn = $('publish'); btn.disabled = true;
  try {
    const folder = `${user.id}/${tour.id}`, keep = [];
    const todo = tour.scenes.filter(s => !s.image).length; let done = 0;
    for (const s of tour.scenes) {
      if (!s.image) {
        btn.textContent = `Uploading ${++done}/${todo}…`;
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
      author: tour.author || user.name, title: tour.title, description: tour.description || '', location: tour.location || '', category: tour.category || 'Other',
      visibility: tour.visibility || 'public', cover: coverScene().thumb, scene_count: tour.scenes.length,
      data: { scenes: tour.scenes.map(({ id, title, yaw, pitch, fov, hotspots, image, thumb }) => ({ id, title, yaw, pitch, fov, hotspots, image, thumb })), floorplan: fp ? { image: fp.image, markers: fp.markers } : null, settings: tour.settings || null }
    };
    if (tour.published) await updateTour(tour.id, row); else await saveNewTour({ id: tour.id, ...row });
    tour.published = true; tour.owner = user.id; tour.pending = false;
    await saveDraft(tour); dirty = false;
    pruneFiles(folder, keep).catch(() => {});
    fillShare(true); $('m-share').classList.add('open'); markMenu();
  } catch (e) { toast('Publishing failed: ' + e.message + '. Your draft is safe in this browser.'); }
  finally { btn.disabled = false; renderStatus(); }
}

// ---------- start ----------
document.title = (tour.title || 'Untitled tour') + ' · Edit';
renderStatus(); renderSceneGrid();
select(tour.scenes[0].id);
if (q.get('new')) {
  q.delete('new'); history.replaceState(null, '', 'edit.html?' + q);
  if (tour.scenes.length > 1) { setPanel('hotspot'); tip('Connect your scenes: look toward a doorway and press “Add hotspot”, or drag a scene from the strip onto the view.', 12000); }
  else tip('Add more panoramas with the + tile below, then connect them with hotspots.', 9000);
}
if (location.hash === '#browse') openModal('browse');
if (location.hash === '#share') openModal('share');
if (location.hash === '#info') openModal('info');
if (takeAfterLogin() === 'publish' && user) publish();
addEventListener('beforeunload', () => { if (dirty) saveDraft(tour); });
