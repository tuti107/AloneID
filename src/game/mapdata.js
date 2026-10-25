// The house as the map screen draws it. Each room is a box on its floor
// (metres, north up), standing for the room's own floor rectangle `rect`:
// a point in the room is drawn at the same place in its box, so the
// corridor can be drawn a little longer than it is and doors still meet.
// Links are the doors and stairs between rooms, each end given in its own
// room's coordinates; ends on different floors are drawn as arrows.
export const FLOORS = [
  { id: 'roof', name: '屋根裏' },
  { id: '2f', name: '2階' },
  { id: '1f', name: '1階' },
  { id: 'b1', name: '地下' },
];

export const MAP_ROOMS = {
  attic: { floor: 'roof', rect: [-4, -3, 4, 3], box: [-4, -3, 4, 3] },
  corridor: { floor: '2f', rect: [-8, -1.3, 8, 1.3], box: [-10.4, -1.3, 10.4, 1.3] },
  bathroom: { floor: '2f', rect: [-2, -1.75, 2, 1.75], box: [-5.55, -4.8, -1.55, -1.3] },
  bedroom: { floor: '2f', rect: [-3.5, -3, 3.5, 3], box: [-1.4, -7.3, 5.6, -1.3] },
  library: { floor: '2f', rect: [-4, -3.5, 4, 3.5], box: [-0.85, 1.3, 7.15, 8.3] },
  hall: { floor: '1f', rect: [-7, -5, 7, 5], box: [-7, -5, 7, 5] },
  dining: { floor: '1f', rect: [-5, -3, 5, 3], box: [-17, -1.8, -7, 4.2] },
  kitchen: { floor: '1f', rect: [-4, -3, 4, 3], box: [8.5, -5.4, 16.5, 0.6] },
  music: { floor: '1f', rect: [-4, -3.5, 4, 3.5], box: [8.5, 1.4, 16.5, 8.4] },
  gallery: { floor: '1f', rect: [-1.8, -8, 1.8, 8], box: [-20.6, -8.8, -17, 7.2] },
  chapel: { floor: '1f', rect: [-4.5, -6, 4.5, 6], box: [-23.3, -20.8, -14.3, -8.8] },
  conservatory: { floor: '1f', rect: [-5, -4.5, 5, 4.5], box: [-23.8, 7.2, -13.8, 16.2] },
  cellar: { floor: 'b1', rect: [-5, -3, 5, 3], box: [-5, -3, 5, 3] },
  cavern: { floor: 'b1', rect: [-7.2, -6.2, 6.8, 4.8], box: [6.4, -7, 20.4, 4] },
};

// door: the door's id where it can be locked (drawn red once found locked)
export const MAP_LINKS = [
  { a: 'attic', ap: [4, 1.6], b: 'corridor', bp: [8, 0] },
  { a: 'corridor', ap: [-8, 0], b: 'hall', bp: [-6.1, -5] },
  { a: 'corridor', ap: [-3.5, -1.3], b: 'bathroom', bp: [-1, 1.75] },
  { a: 'corridor', ap: [3, -1.3], b: 'bedroom', bp: [1.8, 3], door: 'bedroomDoor' },
  { a: 'corridor', ap: [0.5, 1.3], b: 'library', bp: [-2.5, -3.5] },
  { a: 'hall', ap: [-7, 1.2], b: 'dining', bp: [5, 0] },
  { a: 'hall', ap: [7, 2.6], b: 'music', bp: [-4, 1.5] },
  { a: 'hall', ap: [7, -0.8], b: 'kitchen', bp: [-4, 1.6] },
  { a: 'hall', ap: [7, -3.9], b: 'cellar', bp: [-5, 0.3], door: 'cellarDoor' },
  { a: 'cellar', ap: [5, 0.2], b: 'cavern', bp: [-7.2, 1] },
  { a: 'dining', ap: [-5, -2], b: 'gallery', bp: [1.8, 0], door: 'galleryDoor' },
  { a: 'gallery', ap: [0, -8], b: 'chapel', bp: [0, 6], door: 'chapelDoor' },
  { a: 'gallery', ap: [0, 8], b: 'conservatory', bp: [0, -4.5] },
];

// Marks drawn on a room's wall that lead nowhere you can go.
export const MAP_MARKS = [
  { room: 'hall', at: [0, 5], label: '玄関', kind: 'front' },
];
