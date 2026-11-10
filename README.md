# Around the World

A static website for creating and sharing 360° panoramic virtual tours.

- `index.html` – landing page with a live 360° hero
- `explore.html` – searchable gallery of demo tours
- `tour.html?id=<tour>` – full-screen viewer with scene links, info points, auto-rotate, zoom, gyroscope, fullscreen, and share (link, embed, QR). Add `&embed=1` for iframe use.
- `create.html` – browser-based editor: upload panoramas, add hotspots, set start views; tours are stored locally in IndexedDB
- `pricing.html` – plans and comparison

The viewer (`js/viewer.js`) is built on three.js. Demo panoramas in `assets/pano` are original, procedurally generated images.

No build step: deploy the folder as-is (e.g. `vercel --prod`).
