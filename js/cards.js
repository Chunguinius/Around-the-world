import { escapeHtml } from './viewer.js';
export const cardHTML = t => `<a class="card" href="tour.html?id=${encodeURIComponent(t.id)}">
  <div class="card-media"><img loading="lazy" src="${t.cover}" alt="${escapeHtml(t.title)} preview"><span class="badge">${escapeHtml(t.category)}</span><span class="badge badge-360">360°</span></div>
  <div class="card-body"><h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.description)}</p>
  <div class="card-meta"><span>by ${escapeHtml(t.author)}</span><span>${t.scenes.length} scene${t.scenes.length > 1 ? 's' : ''} · ${(t.views || 0).toLocaleString()} views</span></div></div></a>`;
