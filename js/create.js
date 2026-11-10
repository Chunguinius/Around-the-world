// First step of making a tour: name it, add panoramas, then continue in the editor.
import { toast } from './layout.js';
import { escapeHtml } from './viewer.js';
import { saveDraft } from './db.js';
import { blobUrl } from './tours.js';
import { processPano, isImage, sampleFiles, uid } from './pano.js';

const q = new URLSearchParams(location.search);
if (q.get('edit')) location.replace('edit.html?id=' + q.get('edit'));       // links from the earlier version of the site
else if (location.hash === '#my-tours') location.replace('tours.html');

const $ = id => document.getElementById(id);
const scenes = [];
let working = false;

function render() {
  $('count').textContent = `${scenes.length}/200`;
  $('thumbs').innerHTML = scenes.map((s, i) => `<figure><img src="${blobUrl(s.thumbBlob)}" alt=""><button class="x" data-rm="${i}" title="Remove">×</button><figcaption>${i + 1}. ${escapeHtml(s.title)}</figcaption></figure>`).join('');
}
async function addFiles(files) {
  const imgs = [...files].filter(isImage);
  if (!imgs.length) return toast('Please choose JPG, PNG or WebP images');
  if (scenes.length + imgs.length > 200) return toast('A tour can hold up to 200 scenes');
  working = true; let odd = 0, failed = 0;
  for (const [i, f] of imgs.entries()) {
    $('progress').textContent = `Preparing panorama ${i + 1} of ${imgs.length}…`;
    try { const r = await processPano(f); scenes.push(r.scene); if (r.stretched) odd++; render(); } catch { failed++; }
  }
  working = false;
  $('progress').textContent = failed ? `${failed} file${failed > 1 ? 's' : ''} could not be read.` : odd ? `${odd} image${odd > 1 ? 's are' : ' is'} not 2:1, so ${odd > 1 ? 'they' : 'it'} may look stretched.` : scenes.length ? 'Ready. Press Create to open the editor.' : '';
  if (!$('title').value.trim() && scenes[0]) $('title').value = scenes[0].title;
}
$('file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('sample').onclick = async () => addFiles(await sampleFiles());
$('thumbs').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { scenes.splice(+b.dataset.rm, 1); render(); } };
const drop = $('drop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

$('go').onclick = async () => {
  if (working) return toast('Still preparing your panoramas');
  if (!scenes.length) return toast('Add at least one panorama first');
  const title = $('title').value.trim();
  if (!title) { $('title').focus(); return toast('Give your tour a title'); }
  const tour = { id: uid(), title, location: '', description: '', category: $('category').value, visibility: $('public').checked ? 'public' : 'unlisted', scenes, floorplan: null, published: false, updated: Date.now() };
  try { await saveDraft(tour); location.href = 'edit.html?id=' + tour.id + '&new=1'; }
  catch (err) { toast('Could not save the tour in this browser: ' + err.message); }
};
render();
