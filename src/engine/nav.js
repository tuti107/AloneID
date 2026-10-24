// Grid A* navigation for monsters inside a single room.
import { lineOfSight } from './collision.js';

export class NavGrid {
  constructor(bounds, cell = 0.25) {
    this.cell = cell;
    this.x0 = bounds[0];
    this.z0 = bounds[1];
    this.w = Math.max(1, Math.ceil((bounds[2] - bounds[0]) / cell));
    this.h = Math.max(1, Math.ceil((bounds[3] - bounds[1]) / cell));
    this.blocked = new Uint8Array(this.w * this.h);
    this.g = new Float32Array(this.w * this.h);
    this.f = new Float32Array(this.w * this.h);
    this.parent = new Int32Array(this.w * this.h);
    this.stamp = new Uint32Array(this.w * this.h);
    this.closed = new Uint32Array(this.w * this.h);
    this.gen = 1;
    this.boxes = [];
    this.radius = 0.3;
  }

  rebuild(boxes, radius = 0.3) {
    this.boxes = boxes;
    this.radius = radius;
    const { w, h, cell } = this;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = this.x0 + (i + 0.5) * cell;
        const z = this.z0 + (j + 0.5) * cell;
        let blk = 0;
        for (const b of boxes) {
          if (!b.enabled || !b.solid) continue;
          if (b.distance(x, z) < radius) { blk = 1; break; }
        }
        this.blocked[j * w + i] = blk;
      }
    }
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.x0) / this.cell);
    const j = Math.floor((z - this.z0) / this.cell);
    return [Math.max(0, Math.min(this.w - 1, i)), Math.max(0, Math.min(this.h - 1, j))];
  }

  nearestFree(i, j) {
    const { w, h } = this;
    if (!this.blocked[j * w + i]) return [i, j];
    for (let r = 1; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          if (!this.blocked[jj * w + ii]) return [ii, jj];
        }
      }
    }
    return [i, j];
  }

  center(i, j) {
    return { x: this.x0 + (i + 0.5) * this.cell, z: this.z0 + (j + 0.5) * this.cell };
  }

  // Returns array of {x, z} waypoints (excluding start), or null.
  findPath(sx, sz, tx, tz) {
    const { w, h } = this;
    let [si, sj] = this.nearestFree(...this.cellOf(sx, sz));
    let [ti, tj] = this.nearestFree(...this.cellOf(tx, tz));
    const start = sj * w + si, goal = tj * w + ti;
    if (start === goal) return [{ x: tx, z: tz }];
    const gen = ++this.gen;
    const open = [start];
    this.g[start] = 0;
    this.f[start] = this.heur(si, sj, ti, tj);
    this.stamp[start] = gen;
    this.parent[start] = -1;
    let iter = 0;
    while (open.length && iter++ < 6000) {
      // Linear scan for the lowest f (grids are small).
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (this.f[open[k]] < this.f[open[bi]]) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === goal) return this.reconstruct(cur, tx, tz);
      this.closed[cur] = gen;
      const ci = cur % w, cj = (cur / w) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const n = nj * w + ni;
          if (this.blocked[n] || this.closed[n] === gen) continue;
          if (di && dj && (this.blocked[cj * w + ni] || this.blocked[nj * w + ci])) continue;
          const cost = this.g[cur] + (di && dj ? 1.4142 : 1);
          if (this.stamp[n] !== gen || cost < this.g[n]) {
            if (this.stamp[n] !== gen) open.push(n);
            this.stamp[n] = gen;
            this.g[n] = cost;
            this.f[n] = cost + this.heur(ni, nj, ti, tj);
            this.parent[n] = cur;
          }
        }
      }
    }
    return null;
  }

  heur(i, j, ti, tj) {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
  }

  reconstruct(node, tx, tz) {
    const cells = [];
    while (node !== -1) {
      cells.push(node);
      node = this.parent[node];
    }
    cells.reverse();
    const pts = cells.map((n) => this.center(n % this.w, (n / this.w) | 0));
    pts[pts.length - 1] = { x: tx, z: tz };
    // String-pull: drop waypoints that are directly visible.
    const out = [];
    let anchor = pts[0];
    for (let k = 1; k < pts.length; k++) {
      if (k === pts.length - 1) { out.push(pts[k]); break; }
      if (!this.clear(anchor.x, anchor.z, pts[k + 1].x, pts[k + 1].z)) {
        out.push(pts[k]);
        anchor = pts[k];
      }
    }
    return out;
  }

  // Walkable straight line (sampled on the grid).
  clear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const [i, j] = this.cellOf(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (this.blocked[j * this.w + i]) return false;
    }
    return true;
  }

  sight(x0, z0, x1, z1) {
    return lineOfSight(this.boxes, x0, z0, x1, z1);
  }
}
