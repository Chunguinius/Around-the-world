// Demo tours shipped with the site. Panoramas are original, procedurally generated images.
export const TOURS = [
  {
    id: 'lakeside-retreat', title: 'Lakeside Retreat', category: 'Hospitality', author: 'Around the World Studio',
    location: 'Alpine valley', views: 12840, cover: 'assets/thumbs/alpine-lake.jpg',
    description: 'A two-scene walkthrough of a mountain lodge: the lakefront at golden hour and the campfire meadow after dark.',
    scenes: [
      { id: 'lake', title: 'Lakefront', src: 'assets/pano/alpine-lake.jpg', yaw: 0, pitch: 0,
        hotspots: [
          { type: 'scene', target: 'meadow', yaw: 150, pitch: -6, label: 'Walk to the meadow' },
          { type: 'info', yaw: 25, pitch: 4, label: 'Golden hour', text: 'Sunset light over the eastern ridge. Best viewed between 6 and 8 pm in summer.' }
        ] },
      { id: 'meadow', title: 'Campfire meadow', src: 'assets/pano/night-sky.jpg', yaw: 60, pitch: 15,
        hotspots: [
          { type: 'scene', target: 'lake', yaw: -40, pitch: -8, label: 'Back to the lake' },
          { type: 'info', yaw: 70, pitch: 35, label: 'Milky Way', text: 'Zero light pollution here. The galactic core rises around 10 pm.' }
        ] }
    ]
  },
  {
    id: 'dune-expedition', title: 'Dune Expedition', category: 'Travel', author: 'Nomad Lens',
    location: 'Sand sea', views: 9310, cover: 'assets/thumbs/desert-dusk.jpg',
    description: 'Ride the ridge line at dusk, then camp under a sky full of stars.',
    scenes: [
      { id: 'dunes', title: 'Ridge at dusk', src: 'assets/pano/desert-dusk.jpg', yaw: 0, pitch: 0,
        hotspots: [
          { type: 'scene', target: 'camp', yaw: 100, pitch: -10, label: 'Go to camp' },
          { type: 'info', yaw: -60, pitch: 3, label: 'Sunset', text: 'Temperatures drop fast once the sun is below the dunes.' }
        ] },
      { id: 'camp', title: 'Night camp', src: 'assets/pano/night-sky.jpg', yaw: 120, pitch: 10,
        hotspots: [ { type: 'scene', target: 'dunes', yaw: 200, pitch: -8, label: 'Back to the ridge' } ] }
    ]
  },
  {
    id: 'island-escape', title: 'Island Escape', category: 'Travel', author: 'Blue Hour Media',
    location: 'Coral coast', views: 15022, cover: 'assets/thumbs/tropical-beach.jpg',
    description: 'White sand, turquoise water and a quiet island on the horizon.',
    scenes: [
      { id: 'beach', title: 'Beachfront', src: 'assets/pano/tropical-beach.jpg', yaw: 0, pitch: 0,
        hotspots: [ { type: 'info', yaw: 120, pitch: 2, label: 'Snorkel spot', text: 'The reef starts about 40 metres from shore.' } ] }
    ]
  },
  {
    id: 'stargazing-camp', title: 'Stargazing Camp', category: 'Nature', author: 'Dark Sky Collective',
    location: 'Highland plateau', views: 6427, cover: 'assets/thumbs/night-sky.jpg',
    description: 'A single-scene night panorama captured for an astronomy club open evening.',
    scenes: [
      { id: 'sky', title: 'Plateau', src: 'assets/pano/night-sky.jpg', yaw: 30, pitch: 20, hotspots: [] }
    ]
  },
  {
    id: 'mountain-lodge', title: 'Mountain Lake', category: 'Nature', author: 'Peak Frames',
    location: 'Northern range', views: 4381, cover: 'assets/thumbs/alpine-lake.jpg',
    description: 'Mirror-still water reflecting snow-capped peaks.',
    scenes: [ { id: 'lake', title: 'Lake', src: 'assets/pano/alpine-lake.jpg', yaw: 180, pitch: 0, hotspots: [] } ]
  },
  {
    id: 'desert-event', title: 'Desert Festival Grounds', category: 'Events', author: 'Around the World Studio',
    location: 'Open desert', views: 7790, cover: 'assets/thumbs/desert-dusk.jpg',
    description: 'Preview the festival site before you arrive.',
    scenes: [ { id: 'site', title: 'Main stage area', src: 'assets/pano/desert-dusk.jpg', yaw: 90, pitch: 0, hotspots: [] } ]
  }
];
export const getTour = id => TOURS.find(t => t.id === id);
