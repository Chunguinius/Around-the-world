// One shape for every tour, wherever it comes from: built-in demos, drafts in this browser, or the cloud.
import { TOURS } from './data.js';
import { getDraft, listDrafts } from './db.js';
import { cloudEnabled, fileUrl, getTourRow, listPublicTours, listMyTours } from './cloud.js';

const urls = new WeakMap();
export function blobUrl(blob) { if (!blob) return ''; if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob)); return urls.get(blob); }
export const sceneSrc = s => s.blob ? blobUrl(s.blob) : (s.src || fileUrl(s.image));
export const sceneThumb = s => s.thumbBlob ? blobUrl(s.thumbBlob) : (s.thumbUrl || (s.thumb ? fileUrl(s.thumb) : '') || (s.src ? s.src.replace('/pano/', '/thumbs/') : ''));
export const planSrc = fp => fp ? (fp.blob ? blobUrl(fp.blob) : fileUrl(fp.image)) : '';
// what a scene link shows: its own label, or the name of the scene it leads to
export const linkLabel = (h, scenes) => h.label || (h.type === 'scene' ? (scenes.find(s => s.id === h.target)?.title || 'Next scene') : 'Info');

function view(tour, kind) {
  const scenes = (tour.scenes || []).map(s => ({ ...s, hotspots: s.hotspots || [], src: sceneSrc(s), thumbUrl: sceneThumb(s) }));
  return { ...tour, kind, scenes, floorplan: tour.floorplan ? { ...tour.floorplan, src: planSrc(tour.floorplan) } : null, cover: tour.cover || scenes[0]?.thumbUrl || '' };
}
export const fromRow = row => view({ ...row, ...(row.data || {}), cover: row.cover ? fileUrl(row.cover) : '', data: undefined }, 'cloud');
export const cardFromRow = row => ({ ...row, kind: 'cloud', cover: fileUrl(row.cover), sceneCount: row.scene_count });

export async function loadTour(params) {
  if (params.get('t')) { const row = cloudEnabled ? await getTourRow(params.get('t')) : null; return row && fromRow(row); }
  if (params.get('local')) { const d = await getDraft(params.get('local')); return d && view(d, 'draft'); }
  const demo = TOURS.find(t => t.id === (params.get('id') || TOURS[0].id));
  return demo && view(demo, 'demo');
}
export const tourHref = t => t.kind === 'cloud' ? `tour.html?t=${t.id}` : t.kind === 'draft' ? `tour.html?local=${t.id}` : `tour.html?id=${encodeURIComponent(t.id)}`;
export const demoCards = () => TOURS.map(t => ({ ...t, kind: 'demo', sceneCount: t.scenes.length }));
export async function communityCards() { if (!cloudEnabled) return []; try { return (await listPublicTours()).map(cardFromRow); } catch (e) { console.warn(e); return []; } }
export async function myCards() {
  const cloud = cloudEnabled ? (await listMyTours().catch(() => [])).map(cardFromRow) : [];
  const ids = new Set(cloud.map(c => c.id));
  const drafts = (await listDrafts().catch(() => [])).filter(d => !ids.has(d.id)).sort((a, b) => (b.updated || 0) - (a.updated || 0))
    .map(d => ({ ...d, kind: 'draft', sceneCount: d.scenes.length, cover: d.scenes[0] ? sceneThumb(d.scenes[0]) : '' }));
  return [...cloud, ...drafts];
}
