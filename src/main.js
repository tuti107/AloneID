import { Game } from './game/game.js';

const hot = window.claude && window.claude.hot;
let game = null;
if (hot && hot.snapshot) {
  // When the page is republished while open, carry the current run over.
  hot.snapshot(() => (game && game.state === 'play' && game.room && game.player.alive ? { save: game.serialize() } : {}));
}
function boot(data) {
  game = new Game(document.getElementById('app'));
  window.__game = game;
  game.start();
  if (data && data.save) game.loadState(data.save);
}
if (hot && hot.ready) hot.ready(boot);
else boot((hot && hot.data) || {});
const params = new URLSearchParams(location.search);
if (params.get('room') && game) {
  game.debugStart(params.get('room'), params.get('entry') || null, {
    items: (params.get('items') || '').split(',').filter(Boolean),
    ammo: +(params.get('ammo') || 0),
    flags: JSON.parse(params.get('flags') || '{}'),
  });
  if (params.get('god')) game.godMode = true;
  if (params.get('enter')) {
    const r = game.room;
    game.run(() => r.def.enter && r.def.enter(r, game, params.get('entry')));
  }
}
