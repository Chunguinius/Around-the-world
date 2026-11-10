# Around the World

A website for creating, publishing and exploring 360° panoramic virtual tours.

## Pages

- `index.html` – landing page with a live 360° hero
- `explore.html` – community tours plus built-in demos, with search and category filters
- `tour.html` – full-screen viewer. `?t=<id>` opens a published tour, `?id=<slug>` a demo, `?local=<id>` a draft. Add `&embed=1` for iframes.
- `create.html` – the editor, plus "My tours"
- `pricing.html` – plans

## Viewer controls

- Drag, swipe or arrow keys to look around; scroll, pinch or `+`/`-` to zoom
- `A` / `D` turn, `W` walks to the checkpoint you are facing, `S` goes back the way you came
- `F` fullscreen, `M` floor plan
- An on-screen W/A/S/D pad does the same on touch screens

## Building a tour

1. Drop in 2:1 equirectangular panoramas (renders or camera exports).
2. Connect them with checkpoints: press "＋ Checkpoint" and pick the destination, drag a scene from the list onto the view, or double-click the spot. The way back is added automatically, and "Connect scenes in order" links a whole sequence at once. Drag any checkpoint to fine-tune it.
3. Optionally upload a floor plan and click it to pin each scene.
4. Publish. Drafts are saved in the browser as you work.

## Cloud setup (accounts, shared uploads)

The site runs without a backend (tours stay in the visitor's browser). To let people sign up and publish:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL editor. It creates the `tours` table, row-level security rules and the `panoramas` storage bucket.
3. Put the project URL and anon/publishable key in `js/config.js`. Both are public values; access is enforced by the rules in the schema.
4. Optional: in Supabase Auth settings, turn off "Confirm email" for instant sign-ups, and add the site URL to the allowed redirect URLs.

## Tech

No build step. The viewer (`js/viewer.js`) uses three.js; `js/vendor/` holds three.js, the Supabase client bundle and a QR generator. Demo panoramas in `assets/pano` are original, procedurally generated images.
