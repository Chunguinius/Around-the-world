# Around the World

A website for creating, publishing and exploring 360° panoramic virtual tours.

## Pages

- `index.html` – landing page with a live 360° hero
- `explore.html` – community tours plus built-in demos, with search and category filters
- `create.html` – start a tour: title, visibility and the first panoramas
- `edit.html?id=<id>` – the full-screen editor (tool menu on the right, scene strip along the bottom)
- `tours.html` – "My virtual tours": rename, privacy, share link, QR code, embed code, delete
- `tour.html` – full-screen viewer. `?t=<id>` opens a published tour, `?id=<slug>` a demo, `?local=<id>` a draft. Add `&embed=1` for iframes.
- `pricing.html` – plans (placeholder, no checkout)

## Viewer controls

- Drag, swipe or arrow keys to look around; scroll, pinch or `+`/`-` to zoom
- `A` / `D` turn, `W` walks to the checkpoint you are facing, `S` goes back the way you came
- `F` fullscreen, `M` floor plan
- An on-screen W/A/S/D pad does the same on touch screens

## Building a tour

1. On Create, name the tour and add 2:1 equirectangular panoramas (renders or camera exports), then press Create.
2. In the editor, open **Hotspot** and press "Add hotspot" to pick the destination, drag a scene from the strip onto the view, or double-click the spot. The way back is added automatically, and "Connect all scenes in order" links a whole sequence at once. Drag any hotspot to fine-tune it.
3. **Initial View** sets where each scene opens and its zoom. **Scene** sorts, renames, adds and deletes panoramas and picks the cover. **Floor Plans** pins scenes on a plan. **Browse** controls auto-rotation and which buttons visitors see.
4. **Publish**. Drafts are saved in the browser as you work.

## Cloud setup (accounts, shared uploads)

The site runs without a backend (tours stay in the visitor's browser). To let people sign up and publish:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL editor. It creates the `tours` table, row-level security rules and the `panoramas` storage bucket.
3. Put the project URL and anon/publishable key in `js/config.js`. Both are public values; access is enforced by the rules in the schema.
4. Optional: in Supabase Auth settings, turn off "Confirm email" for instant sign-ups, and add the site URL to the allowed redirect URLs.

## Tech

No build step. The viewer (`js/viewer.js`) uses three.js; `js/vendor/` holds three.js, the Supabase client bundle and a QR generator. Demo panoramas in `assets/pano` are original, procedurally generated images.
