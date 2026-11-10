// "My virtual tours": every tour of the signed-in creator, plus drafts kept in this browser.
import { toast, whoami, icon } from './layout.js';
import { escapeHtml } from './viewer.js';
import { getDraft, saveDraft, deleteDraft } from './db.js';
import { cloudEnabled, updateTour, deleteTour } from './cloud.js';
import { myCards, tourHref } from './tours.js';
import { qrSvg, copyText, downloadSvg, tourLink, embedCode } from './pano.js';

const $ = id => document.getElementById(id);
const user = await whoami;
let list = [], renaming = null;

$('head-icon').innerHTML = icon('grid');
$('thead').innerHTML = [['image', 'Cover'], ['info', 'Information'], ['eye', 'Browse settings'], ['shield', 'Privacy'], ['code', 'Embed'], ['share', 'Share settings'], ['dots', 'More operations']].map(([i, t]) => `<th>${icon(i)}${t}</th>`).join('');
$('status').innerHTML = cloudEnabled && !user
  ? `${icon('user')} <span>Log in to see the tours you have published. Drafts saved in this browser are listed below.</span> <button class="b b-green" data-auth="login">Log in</button>`
  : `<span style="color:#c98a00">♛</span> Plan: <span class="tag-dark">Free</span> <span>${user ? 'Signed in as ' + escapeHtml(user.name) + '.' : ''} Publishing, share links and QR codes are included.</span>`;

const two = n => String(n).padStart(2, '0');
const when = t => { const d = new Date(t.updated_at || t.updated || t.created_at || Date.now()); return isNaN(d) ? '' : `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`; };
// keep the copy in this browser in step, so the editor does not bring back the old value
async function patchDraft(id, patch) { const d = await getDraft(id).catch(() => null); if (d) await saveDraft({ ...d, ...patch }); }

function row(t) {
  const live = t.kind === 'cloud', link = live ? tourLink(t.id) : '';
  return `<tr data-id="${t.id}">
    <td><a class="cover" href="edit.html?id=${t.id}#info" title="Change the cover in the editor">${t.cover ? `<img src="${escapeHtml(t.cover)}" alt="" loading="lazy">` : ''}<span>Change cover</span></a></td>
    <td><div class="tname"><a href="${tourHref(t)}">${escapeHtml(t.title || 'Untitled tour')}</a><button data-rename title="Rename">${icon('edit')}</button></div>
      ${live ? '' : '<span class="tag-dark" style="display:inline-block;margin-top:8px">Draft</span>'}
      <div class="tdate">${icon('clock')}${when(t)}</div></td>
    <td><div>${live ? `Views: &nbsp;${(t.views || 0).toLocaleString()}` : 'Not published yet'}</div><div>Scenes: &nbsp;${t.sceneCount}</div>
      <a class="soft" href="edit.html?id=${t.id}#browse">${icon('gear')}Browse settings</a></td>
    <td><label class="ck"><input type="checkbox" data-public ${t.visibility !== 'unlisted' ? 'checked' : ''}> Show on Explore page</label>
      <p class="small" style="margin:8px 0 0;max-width:180px">${t.visibility !== 'unlisted' ? 'Anyone can find it.' : 'Only people with the link.'}</p></td>
    <td>${live ? `<button class="lnk" data-embed>${icon('code')}Web embed</button>` : '<span class="small">Publish first</span>'}</td>
    <td>${live ? `<div class="share-cell"><div class="qr">${qrSvg(link, 2)}</div><div class="ops"><button class="lnk" data-qr>${icon('download')}Download QR code</button><button class="lnk" data-copy>${icon('link')}Copy link</button><a class="lnk" href="${tourHref(t)}" target="_blank" rel="noopener">${icon('eye')}Open tour</a></div></div>`
      : `<span class="small">Only in this browser.<br>Publish it from the editor to share it.</span>`}</td>
    <td><div class="ops"><a class="lnk go" href="edit.html?id=${t.id}">${icon('edit')}Edit virtual tour</a><a class="lnk" href="${tourHref(t)}">${icon('eye')}Preview</a><button class="lnk del" data-delete>${icon('trash')}Delete</button></div></td>
  </tr>`;
}
function render() {
  $('total').innerHTML = `${icon('storage')}Tours: ${list.length}`;
  $('rows').innerHTML = list.length ? list.map(row).join('')
    : `<tr><td colspan="7"><p class="empty" style="margin:20px">${cloudEnabled && !user ? 'No drafts in this browser yet. Log in to see your published tours.' : 'You have no tours yet.'} <a href="create.html" style="color:var(--green-d);font-weight:600">Create your first virtual tour</a></p></td></tr>`;
  $('tfoot').textContent = list.length ? `${list.length} tour${list.length === 1 ? '' : 's'}` : '';
}
async function load() { list = await myCards().catch(() => []); render(); }

$('rows').addEventListener('click', async e => {
  const tr = e.target.closest('tr[data-id]'); if (!tr) return; const t = list.find(x => x.id === tr.dataset.id); if (!t) return;
  if (e.target.closest('[data-rename]')) { renaming = t; $('rename-in').value = t.title || ''; $('m-rename').classList.add('open'); return $('rename-in').select(); }
  if (e.target.closest('[data-copy]')) { await copyText(tourLink(t.id)); return toast('Link copied'); }
  if (e.target.closest('[data-embed]')) { await copyText(embedCode(tourLink(t.id))); return toast('Embed code copied. Paste it into your website.'); }
  if (e.target.closest('[data-qr]')) return downloadSvg(tr.querySelector('.qr').innerHTML, (t.title || 'tour').replace(/[^\w-]+/g, '-') + '-qr.svg');
  if (e.target.closest('[data-delete]')) {
    if (!confirm(t.kind === 'cloud' ? `Delete “${t.title}” for everyone? Its link will stop working.` : `Delete the draft “${t.title || 'Untitled tour'}”?`)) return;
    try { if (t.kind === 'cloud') await deleteTour(t.id); await deleteDraft(t.id); toast('Tour deleted'); load(); } catch (err) { toast('Could not delete: ' + err.message); }
  }
});
$('rows').addEventListener('change', async e => {
  if (!e.target.matches('[data-public]')) return;
  const t = list.find(x => x.id === e.target.closest('tr').dataset.id), visibility = e.target.checked ? 'public' : 'unlisted';
  try { if (t.kind === 'cloud') await updateTour(t.id, { visibility }); await patchDraft(t.id, { visibility }); t.visibility = visibility; toast(visibility === 'public' ? 'Now shown on Explore' : 'Now only reachable with the link'); }
  catch (err) { toast('Could not change it: ' + err.message); }
  render();
});
$('rename-save').onclick = async () => {
  const title = $('rename-in').value.trim(); if (!title || !renaming) return;
  try { if (renaming.kind === 'cloud') await updateTour(renaming.id, { title }); await patchDraft(renaming.id, { title }); renaming.title = title; $('m-rename').classList.remove('open'); render(); toast('Renamed'); }
  catch (err) { toast('Could not rename: ' + err.message); }
};
$('rename-in').addEventListener('keydown', e => { if (e.key === 'Enter') $('rename-save').click(); });
load();
