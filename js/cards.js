import { escapeHtml } from './viewer.js';
import { tourHref } from './tours.js';
export const cardHTML = t => `<a class="card" href="${tourHref(t)}">
  <div class="card-media">${t.cover ? `<img loading="lazy" src="${escapeHtml(t.cover)}" alt="${escapeHtml(t.title)} preview">` : ''}<span class="badge">${escapeHtml(t.category || 'Tour')}</span><span class="badge badge-360">360°</span></div>
  <div class="card-body"><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.description || t.location || '')}</p>
  <div class="card-meta"><span>by ${escapeHtml(t.author || 'Unknown')}</span><span>${t.sceneCount} scene${t.sceneCount === 1 ? '' : 's'} · ${(t.views || 0).toLocaleString()} views</span></div></div></a>`;
