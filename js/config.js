// Cloud backend (Supabase). Both values are public by design: access is enforced by
// the row-level security policies in supabase/schema.sql, never by hiding these.
// Leave them empty to run the site in local-only mode (tours stay in the visitor's browser).
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';
export const BUCKET = 'panoramas';
