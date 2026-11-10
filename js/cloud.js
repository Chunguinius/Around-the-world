// Accounts, shared tours and panorama storage, backed by Supabase.
import { SUPABASE_URL, SUPABASE_KEY, BUCKET } from './config.js';

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
let clientPromise;
function sb() {
  if (!cloudEnabled) return Promise.reject(new Error('Cloud is not configured'));
  return clientPromise ||= import('./vendor/supabase.js').then(m => m.createClient(SUPABASE_URL, SUPABASE_KEY));
}
const ok = ({ data, error }) => { if (error) throw new Error(error.message || 'Request failed'); return data; };
const COLS = 'id, owner, author, title, description, location, category, visibility, cover, scene_count, views, created_at, updated_at';

export async function currentUser() {
  if (!cloudEnabled) return null;
  const { data } = await (await sb()).auth.getSession();
  return data.session?.user || null;
}
export const displayName = u => u?.user_metadata?.name || u?.email?.split('@')[0] || 'Creator';
export async function signUp(email, password, name) {
  const data = ok(await (await sb()).auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin } }));
  return { user: data.user, needsConfirmation: !data.session };
}
export async function signIn(email, password) { return ok(await (await sb()).auth.signInWithPassword({ email, password })).user; }
export async function signOut() { await (await sb()).auth.signOut(); }
export async function resetPassword(email) { ok(await (await sb()).auth.resetPasswordForEmail(email, { redirectTo: location.origin })); }

export const fileUrl = path => path ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` : '';
export async function uploadFile(path, blob) {
  ok(await (await sb()).storage.from(BUCKET).upload(path, blob, { upsert: true, cacheControl: '31536000', contentType: blob.type || 'image/jpeg' }));
  return path;
}
// delete stored files of a tour that are no longer referenced
export async function pruneFiles(folder, keep) {
  const s = (await sb()).storage.from(BUCKET);
  const { data } = await s.list(folder, { limit: 1000 });
  const stale = (data || []).map(f => `${folder}/${f.name}`).filter(p => !keep.includes(p));
  if (stale.length) await s.remove(stale);
}

// The owner is filled in by the database from the signed-in user; it is never sent from the browser.
export async function saveNewTour(row) {
  const db = await sb(), { error } = await db.from('tours').insert(row);
  if (error?.code === '23505') { const { id, ...rest } = row; return updateTour(id, rest); }   // already published once
  if (error) throw new Error(error.message);
}
export async function updateTour(id, row) {
  const data = ok(await (await sb()).from('tours').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select('id'));
  if (!data.length) throw new Error('This tour belongs to another account');
}
export async function listPublicTours(limit = 60) {
  return ok(await (await sb()).from('tours').select(COLS).eq('visibility', 'public').order('created_at', { ascending: false }).limit(limit));
}
export async function listMyTours() {
  const u = await currentUser(); if (!u) return [];
  return ok(await (await sb()).from('tours').select(COLS).eq('owner', u.id).order('updated_at', { ascending: false }));
}
// works for public and unlisted tours alike: knowing the id is the key
export async function getTourRow(id) {
  const rows = ok(await (await sb()).rpc('get_tour', { tour_id: id }));
  return (Array.isArray(rows) ? rows[0] : rows) || null;
}
export async function deleteTour(id) {
  const u = await currentUser(); if (!u) throw new Error('Please log in');
  ok(await (await sb()).from('tours').delete().eq('id', id));
  await pruneFiles(`${u.id}/${id}`, []).catch(() => {});
}
export async function bumpViews(id) { try { await (await sb()).rpc('bump_views', { tour_id: id }); } catch {} }
