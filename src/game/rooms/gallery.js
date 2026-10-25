// 肖像画の回廊 — the Ashcombes in a row down a long west gallery, from the
// captain who built the house to the boy who drowned under it. One frame is
// empty: Jonah's, cut out of the family. Hang him back and they all look
// to the chapel door.
import * as THREE from 'three';
import * as F from '../furniture.js';
import { M, spriteMat } from '../mats.js';

const H = 4.2;
// the family, north (oldest) to south: x of the wall, z, art, size, words
const FAMILY = [
  { id: 'pEzekiel', x: 1.8, z: -6.2, art: 'portraitCaptain', w: 0.8, h: 1.0, text: '船長服の男。「エゼキエル・アシュコム　一七五八―一八〇二」。\n屋敷を建て、嵐の夜に消えた男だ。' },
  { id: 'pMargaret', x: -1.8, z: -7.0, art: 'portraitWoman', w: 0.7, h: 0.9, text: '「マーガレット・アシュコム　一七六二―一八〇一」。\n夫より一年早く、この屋敷で死んでいる。' },
  { id: 'pJonah', x: 1.8, z: -3.2, art: null, w: 0.8, h: 1.0 },
  { id: 'pRuth', x: -1.8, z: -2.5, art: 'portraitLady', w: 0.7, h: 0.9, text: '「ルース・アシュコム　一七八四―一八三〇」。\n隣の空の額縁の方を、悲しげに見ている。' },
  { id: 'pSamuel', x: 1.8, z: 3.2, art: 'portraitMan', w: 0.7, h: 0.9, text: '「サミュエル・アシュコム　一八一二―一八六六」。\n額の下に、黒い喪章の跡が残っている。' },
  { id: 'pNathaniel', x: -1.8, z: 2.5, art: 'portraitOld', w: 0.7, h: 0.9, text: '「ナサニエル・アシュコム　一八四〇―一九〇三」。\nサイラスの父親だ。目元がよく似ている。' },
  { id: 'pSilas', x: 1.8, z: 6.2, art: 'portraitMan', w: 0.7, h: 0.9, text: '「サイラス・アシュコム　一九〇六年」。\n書斎の肖像よりも、ずっと穏やかな顔をしている。' },
  { id: 'pThomas', x: -1.8, z: 7.0, art: 'portraitBoy', w: 0.48, h: 0.6, text: '黒い喪章のかかった、小さな男の子の肖像画。\n「トマス・アシュコム　一九〇六―一九一二」。' },
];

export default {
  id: 'gallery',
  name: '肖像画の回廊',
  bounds: [-2.0, -8.2, 2.0, 8.2],
  floorType: 'wood',
  ambience: 'tide',
  build(r, g) {
    r.shell(-1.8, -8, 1.8, 8, {
      h: H, floor: 'woodFloorDark', ceil: 'plasterDark', mat: 'wallpaperBlue', wainscot: 'wainscot', wainscotH: 1.3, crown: true,
      openings: {
        e: [{ at: 0, w: 1.0, h: 2.15 }],
        n: [{ at: 0, w: 1.3, h: 2.5 }],
        s: [{ at: 0, w: 1.1, h: 2.3 }],
        w: [{ at: -4.8, w: 0.9, h: 2.4, sill: 0.9 }, { at: 0, w: 0.9, h: 2.4, sill: 0.9 }, { at: 4.8, w: 0.9, h: 2.4, sill: 0.9 }],
      },
    });
    F.rug(r, 'carpetRunner', 0, 0, 1.2, 14.6, 0);

    // ---- doors
    r.door(1.8, 0, -Math.PI / 2, { to: 'dining', entry: 'fromGallery', label: '食堂への扉', wallMat: 'wallpaperBlue', panel: 'woodRed' });
    r.entry('fromDining', 1.2, 0, -Math.PI / 2);
    r.door(0, -8, 0, {
      id: 'chapelDoor', w: 1.3, h: 2.5, double: true, to: 'chapel', entry: 'fromGallery', label: '礼拝堂の扉', wallMat: 'wallpaperBlue', panel: 'woodBlack', panelInset: 'wood', sound: 'doorHeavy',
      locked: (gg) => !gg.flags.canvasHung,
      lockedMsg: '重い樫の扉。鍵穴は無く、扉の中央に、大きく見開いた目の浮き彫りがある。\n……押しても引いても、びくともしない。',
    });
    r.entry('fromChapel', 0, -7.3, 0);
    r.door(0, 8, Math.PI, { to: 'conservatory', entry: 'fromGallery', label: '温室への扉', wallMat: 'wallpaperBlue', panel: 'wood', glass: true });
    r.entry('fromConservatory', 0, 7.3, Math.PI);

    // ---- windows on the storm, west
    for (const z of [-4.8, 0, 4.8]) r.window(-1.8, z, Math.PI / 2, { w: 0.9, h: 2.4, sill: 0.9, curtains: 'curtainGreen', curtainW: 0.4, intensity: 40, angle: 0.5, beam: false, shadow: z === 0 ? 'lo' : false });

    // ---- the family, and their eyes
    r.eyes = [];
    for (const p of FAMILY) {
      const ry = p.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      const nx = p.x > 0 ? -1 : 1;
      const y = 2.15;
      const frame = F.painting({ w: p.w, h: p.h, art: p.art || 'portraitOld' });
      frame.position.set(p.x + nx * 0.03, y, p.z);
      frame.rotation.y = ry;
      r.dynamic.add(frame);
      // a brass plate under each
      r.box(M('brass', { phong: true, shininess: 40 }), 0.03, 0.06, 0.22, p.x + nx * 0.025, y - p.h / 2 - 0.2, p.z, { cast: false });
      if (p.id === 'pJonah') {
        r.jonahCanvas = frame.userData.canvas;
        r.jonahCanvas.visible = !!g.flags.canvasHung;
      }
      // two pin-pricks of light where the eyes are painted, that brighten
      // as he passes
      for (const sx of [-1, 1]) {
        const e = new THREE.Sprite(spriteMat('glow', 0xd8e4a8, 0));
        const s = p.w * 0.06;
        e.scale.set(s, s, 1);
        e.position.set(p.x + nx * 0.06, y + p.h * 0.1, p.z + sx * p.w * 0.0625 * -nx);
        r.dynamic.add(e);
        r.eyes.push({ e, p, k: 0, ph: Math.random() * 10 });
      }
      if (p.id === 'pJonah') {
        r.interact({
          id: 'pJonah', x: p.x + nx * 0.55, z: p.z, r: 0.45, label: (gg) => (gg.flags.canvasHung ? '肖像画' : '空の額縁'),
          use: (gg) => emptyFrame(r, gg),
          item: async (gg, id) => {
            if (id !== 'canvas') return false;
            await hangCanvas(r, gg);
            return true;
          },
        });
      } else r.interact({ id: p.id, x: p.x + nx * 0.55, z: p.z, r: 0.45, label: '肖像画', use: (gg) => gg.say(p.text) });
    }
    r.updaters.push((dt, t) => {
      const pp = g.player.pos;
      for (const it of r.eyes) {
        const dz = pp.z - it.p.z, dx = Math.abs(pp.x - it.p.x);
        const near = Math.max(0, 1 - Math.abs(dz) / 2.6) * (dx > 0.5 ? 1 : 0);
        const want = r.allEyes ? 1 : near * (0.55 + 0.45 * Math.sin(t * 3 + it.ph));
        it.k += (want - it.k) * Math.min(1, dt * 3);
        it.e.material.opacity = it.k * (it.p.id === 'pJonah' && !g.flags.canvasHung ? 0 : 0.85);
      }
    });

    // ---- light: sconces between the frames, and the storm
    for (const [x, z] of [[1.8, -4.7], [1.8, 4.7], [-1.8, -6.0], [-1.8, 6.0]]) {
      const sc = F.sconce();
      const ry = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      sc.position.set(x, 2.0, z);
      sc.rotation.y = ry;
      r.static.add(sc);
      const f = sc.userData.flames[0];
      const c = Math.cos(ry), s = Math.sin(ry);
      r.flame(x + f[2] * s, 2.0 + f[1], z + f[2] * c, { size: 0.06, intensity: 2.0, distance: 6 });
    }
    r.place(F.bench({ w: 1.3 }), 1.45, -1.6, -Math.PI / 2, { collide: true });
    r.pickup('ammo', 1.45, 0.46, -1.9, { id: 'galleryAmmo', label: '弾の箱', ry: 0.5, give: { count: 6 } });
    r.place(F.pedestal({ h: 1.0 }), -1.45, -6.0 + 0.0, 0, { collide: true });
    r.place(F.vase({ h: 0.4, color: 0x3a2a4a }), -1.45, -6.0, 0, { y: 1.0 });
    F.cobweb(r, 1.75, H, -7.95, -Math.PI / 2, 0.8);
    F.cobweb(r, -1.75, H, 7.95, Math.PI / 2, 0.7);
    r.hemi(0x4a5a80, 0x141218, 2.8);
    r.point(0, 3.4, 0, { color: 0x6a7aa0, intensity: 5, distance: 12 });

    // one of the Black Gull's men, walking the gallery
    if (!g.flags['dead:galleryThrall']) {
      g.spawn(r, { id: 'galleryThrall', type: 'thrall', seed: 2, x: 0.3, z: 4.6, rot: Math.PI, onDeath: () => { g.flags['dead:galleryThrall'] = true; } });
    }

    r.shot({ id: 'north', pos: [1.2, 3.3, 1.6], look: [-0.4, 0.8, -6.4], fov: 56, zone: [-2, -8.2, 2, -2.6] });
    r.shot({ id: 'mid', pos: [-1.2, 3.4, -7.4], look: [0.3, 0.9, 1.2], fov: 52, zone: [-2, -2.6, 2, 2.6] });
    r.shot({ id: 'south', pos: [1.2, 3.3, -1.6], look: [-0.4, 0.8, 6.4], fov: 56, zone: [-2, 2.6, 2, 8.2] });
  },

  async enter(r, g) {
    if (g.flags.gallerySeen) return;
    g.flags.gallerySeen = true;
    g.lock();
    g.cut({ pos: [1.2, 1.7, 1.4], look: [-0.2, 1.9, -6.5], fov: 50 });
    await g.wait(1.2);
    await g.say('アシュコム家の肖像画が、長い回廊に並んでいる。\n……どの目も、こちらを追っている気がする。');
    g.cut(null);
    g.unlock();
  },
};

async function emptyFrame(r, g) {
  if (g.flags.canvasHung) {
    await g.say('ジョナ・アシュコムの肖像画。\n厳めしい老人の目は、礼拝堂の扉を見据えている。');
    return;
  }
  await g.say('額縁だけが掛かっている。中のカンバスは、切り取られたように無い。\n名札は削り取られ、年号だけが読める。「一七八〇―一八四一」。');
  if (!g.flags.galleryNote) {
    g.flags.galleryNote = true;
    await g.say('額縁の裏に、紙片が挟まっていた。\n『ボストンのハートウェル画廊より買い戻す。修復の後、元の場所へ。\n　それまでは屋根裏の木箱に。――Ｓ・Ａ』');
  } else await g.say('サイラスの紙片には、カンバスは屋根裏の木箱にあると書かれていた。');
  if (g.has('canvas')) {
    const c = await g.ask('カンバスを額に戻しますか？', ['戻す', 'やめる']);
    if (c === 0) await hangCanvas(r, g);
  }
}

// Jonah back among his family: and all of them turn to the chapel door.
async function hangCanvas(r, g) {
  if (g.flags.canvasHung) return;
  g.lock();
  await g.reachAnim();
  g.inv.remove('canvas');
  g.flags.canvasHung = true;
  r.jonahCanvas.visible = true;
  g.audio.sfx('paper');
  await g.say('丸めたカンバスを広げ、空の額縁に収めた。\n厳めしい老人が、百年ぶりに一族の列に戻った。');
  g.cut({ pos: [0.6, 1.6, 2.6], look: [0.0, 1.9, -7.6], fov: 54 });
  await g.wait(0.6);
  r.allEyes = true;
  g.audio.sfx('sting');
  g.audio.sfx('neckCreak');
  await g.wait(1.6);
  g.audio.sfx('mechanism', { at: { x: 0, y: 1, z: -8 } });
  g.shake(0.05, 0.5);
  await g.wait(0.8);
  await g.say('並んだ肖像画の目が、一斉に北の扉へ向いた。\n……扉の奥で、重い閂が外れる音がした。');
  r.allEyes = false;
  g.cut(null);
  g.unlock();
}
