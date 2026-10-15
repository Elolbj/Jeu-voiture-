// Terrain : relief naturel selon le thème, raccordé au circuit (remblais / déblais),
// couleurs par sommet (herbe, champs, roche, neige, sable), décor lointain.
import * as THREE from 'three';
import { Noise2D } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/utils.js';
import { terrainDetail } from './textures.js';
import { surfaceY } from './trackMesh.js';

export class Terrain {
  constructor(track, theme, quality, seed = 7) {
    this.track = track;
    this.theme = theme;
    this.noise = new Noise2D(seed);
    this.noise2 = new Noise2D(seed + 17);
    // Plan moyen (moindres carrés) des altitudes du circuit
    let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
    const n = track.count;
    for (let i = 0; i < n; i++) {
      const x = track.px[i], z = track.pz[i], y = track.py[i];
      sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y;
    }
    const mx = sx / n, mz = sz / n, my = sy / n;
    const cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz;
    const cxy = sxy / n - mx * my, czy = szy / n - mz * my;
    const det = cxx * czz - cxz * cxz;
    this.pb = Math.abs(det) > 1e-6 ? (cxy * czz - czy * cxz) / det : 0;
    this.pc = Math.abs(det) > 1e-6 ? (czy * cxx - cxy * cxz) / det : 0;
    this.pa = my - this.pb * mx - this.pc * mz;
    this.center = new THREE.Vector3(mx, my, mz);
    const b = track.bounds;
    this.coastZ = b.maxZ + 120;
    this.minZ = b.minZ;
    this.margin = theme === 'mountain' ? 1400 : theme === 'coast' ? 900 : 800;
    this.blend = theme === 'mountain' ? 45 : theme === 'city' ? 20 : 70;
    this.res = quality.terrainRes * (theme === 'city' ? 1.6 : 1);
    this.build();
  }

  natural(x, z) {
    const N = this.noise;
    const base = this.pa + this.pb * x + this.pc * z;
    switch (this.theme) {
      case 'countryside':
        return base + 24 * N.fbm(x / 800, z / 800, 4) + 5 * N.fbm(x / 150 + 9, z / 150, 3) - 4;
      case 'gp':
        return base + 7 * N.fbm(x / 600, z / 600, 3) + 1.5 * N.fbm(x / 90, z / 90, 2);
      case 'city':
        return 0.0 + 0.4 * N.fbm(x / 300, z / 300, 2);
      case 'coast': {
        const inland = Math.max(0, this.coastZ - z);
        let h = base + 30 * N.fbm(x / 600, z / 600, 4) + 8 * N.fbm(x / 120, z / 120, 3);
        h += Math.max(0, this.minZ - z) * 0.18; // collines en arrière-pays
        // Falaises puis plage vers la mer (z croissant)
        const cliff = smoothstep(0, 140, inland);
        const coastLine = 1.5 + 4 * N.fbm(x / 200, 3, 2);
        h = lerp(coastLine - Math.max(0, z - this.coastZ) * 0.35, h, cliff);
        return h;
      }
      case 'mountain': {
        const d = Math.hypot(x - this.center.x, z - this.center.z);
        let h = base + 90 * N.fbm(x / 900, z / 900, 4) + 18 * N.fbm(x / 160, z / 160, 3);
        h += 520 * N.ridged(x / 2600 + 3, z / 2600 + 7, 5) * smoothstep(300, 2200, d);
        return h;
      }
      default:
        return base;
    }
  }

  // Hauteur finale (avec raccord au circuit) : également utilisée pour poser le décor
  heightAt(x, z) {
    const t = this.track;
    const hn = this.natural(x, z);
    const reach = 32 + this.blend;
    let best = null, second = null;
    t.forEachNear(x, z, reach, (i) => {
      const d2 = (t.px[i] - x) ** 2 + (t.pz[i] - z) ** 2;
      if (!best || d2 < best.d2) {
        if (best && Math.abs(t.sArr[best.i] - t.sArr[i]) > 80) second = best;
        best = { i, d2 };
      } else if (Math.abs(t.sArr[best.i] - t.sArr[i]) > 80 && (!second || d2 < second.d2)) {
        second = { i, d2 };
      }
    });
    if (!best) return { h: hn, w: 0, nearTrack: Infinity };
    let num = 0, den = 0, W = 0;
    let minEdgeDist = Infinity;
    for (const c of [best, second]) {
      if (!c) continue;
      const i = c.i;
      const hl = Math.hypot(t.rx[i], t.rz[i]) || 1;
      const lat = ((x - t.px[i]) * t.rx[i] + (z - t.pz[i]) * t.rz[i]) / hl;
      const along = (x - t.px[i]) * t.dx[i] + (z - t.pz[i]) * t.dz[i];
      const wall = lat > 0 ? t.wallR[i] : t.wallL[i];
      const edge = wall + 3;
      const d = Math.abs(lat) + Math.max(0, Math.abs(along) - 1.5) * 0.5;
      const latC = clamp(lat, -edge, edge);
      const hr = surfaceY(t, i, latC) - 0.35 - Math.max(0, d - edge) * 0.0;
      const w = 1 - smoothstep(edge, edge + this.blend, d);
      const idw = w / Math.pow(Math.max(0.5, d - edge + 1), 3);
      num += idw * hr;
      den += idw;
      W = Math.max(W, w);
      minEdgeDist = Math.min(minEdgeDist, d - edge);
    }
    const hc = den > 0 ? num / den : hn;
    return { h: lerp(hn, hc, W), w: W, nearTrack: minEdgeDist };
  }

  build() {
    const t = this.track;
    const b = t.bounds;
    const M = this.margin;
    const x0 = b.minX - M, x1 = b.maxX + M, z0 = b.minZ - M, z1 = b.maxZ + M;
    const res = this.res;
    const nx = Math.ceil((x1 - x0) / res) + 1;
    const nz = Math.ceil((z1 - z0) / res) + 1;
    this.grid = { x0, z0, nx, nz, res };
    const pos = new Float32Array(nx * nz * 3);
    const uv = new Float32Array(nx * nz * 2);
    const col = new Float32Array(nx * nz * 3);
    const heights = new Float32Array(nx * nz);
    const near = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * res, z = z0 + j * res;
        const r = this.heightAt(x, z);
        const k = j * nx + i;
        heights[k] = r.h;
        near[k] = r.nearTrack;
        pos[k * 3] = x; pos[k * 3 + 1] = r.h; pos[k * 3 + 2] = z;
        uv[k * 2] = x / 14; uv[k * 2 + 1] = z / 14;
      }
    }
    this.heights = heights;
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, bb = a + 1, c = a + nx, d = c + 1;
        idx[p++] = a; idx[p++] = c; idx[p++] = bb;
        idx[p++] = bb; idx[p++] = c; idx[p++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    for (let k = 0; k < nx * nz; k++) {
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      const c = this.colorAt(x, y, z, nrm[k * 3 + 1], near[k]);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const det = terrainDetail();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: det.map,
      normalMap: det.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.97,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    this.mesh = mesh;
  }

  colorAt(x, y, z, ny, nearDist) {
    const N = this.noise2;
    const v = N.fbm(x / 60, z / 60, 3);
    const v2 = N.fbm(x / 13 + 4, z / 13, 2);
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const slope = 1 - ny; // 0 plat, ~0.3 raide
    let c;
    switch (this.theme) {
      case 'countryside': {
        c = [0.27 + v * 0.04, 0.38 + v * 0.05, 0.14];
        if (nearDist > 40) {
          // Parcelles agricoles
          const ang = 0.5;
          const u = x * Math.cos(ang) - z * Math.sin(ang), w = x * Math.sin(ang) + z * Math.cos(ang);
          const fi = Math.floor(u / 160), fj = Math.floor(w / 110);
          const hsh = Math.abs(Math.sin(fi * 127.1 + fj * 311.7) * 43758.5) % 1;
          const fields = [[0.62, 0.55, 0.27], [0.36, 0.27, 0.17], [0.42, 0.52, 0.2], [0.3, 0.41, 0.15], [0.55, 0.5, 0.3]];
          const f = fields[Math.floor(hsh * fields.length)];
          const edgeU = Math.min(u - fi * 160, (fi + 1) * 160 - u), edgeW = Math.min(w - fj * 110, (fj + 1) * 110 - w);
          const inField = smoothstep(1, 5, Math.min(edgeU, edgeW));
          c = mix(c, f, inField * smoothstep(40, 90, nearDist) * 0.9);
          // sillons
          if (inField > 0.5 && hsh < 0.4) c = mix(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85], (Math.sin(w * 1.6) * 0.5 + 0.5) * 0.5);
        }
        c = mix(c, [0.42, 0.38, 0.3], smoothstep(0.12, 0.3, slope));
        break;
      }
      case 'gp': {
        c = [0.26 + v * 0.03, 0.4 + v * 0.05, 0.15];
        if (nearDist < 60) {
          const stripe = Math.floor((x * 0.7 + z * 0.7) / 9) % 2 === 0 ? 1.08 : 0.94;
          c = [c[0] * stripe, c[1] * stripe, c[2] * stripe];
        }
        break;
      }
      case 'city': {
        const g = 0.24 + v * 0.05 + v2 * 0.02;
        c = [g, g, g * 1.05];
        if (v > 0.35 && nearDist > 30) c = mix(c, [0.2, 0.3, 0.14], 0.8);
        break;
      }
      case 'coast': {
        c = [0.42 + v * 0.06, 0.41 + v * 0.05, 0.22];
        c = mix(c, [0.3, 0.36, 0.16], smoothstep(0, 0.5, v2 + 0.2) * 0.5); // garrigue
        c = mix(c, [0.58, 0.53, 0.46], smoothstep(0.1, 0.28, slope)); // roche calcaire
        c = mix(c, [0.86, 0.79, 0.62], 1 - smoothstep(1.5, 4, y)); // sable
        if (y < 0.2) c = mix(c, [0.32, 0.38, 0.33], smoothstep(0.2, -4, y));
        break;
      }
      case 'mountain': {
        c = [0.26 + v * 0.04, 0.35 + v * 0.05, 0.16];
        c = mix(c, [0.16, 0.22, 0.12], smoothstep(-0.1, 0.4, v2) * 0.6); // sous-bois
        c = mix(c, [0.44, 0.42, 0.4], smoothstep(0.12, 0.3, slope)); // roche
        const snow = smoothstep(1350, 1500, y + v * 60) * (1 - smoothstep(0.35, 0.55, slope));
        c = mix(c, [0.93, 0.95, 0.99], snow);
        break;
      }
      default:
        c = [0.3, 0.42, 0.18];
    }
    // Légère variation fine
    const k = 0.92 + v2 * 0.1;
    return [c[0] * k, c[1] * k, c[2] * k];
  }

  // Hauteur interpolée sur la grille (rapide)
  sampleGrid(x, z) {
    const { x0, z0, nx, nz, res } = this.grid;
    const fx = (x - x0) / res, fz = (z - z0) / res;
    const i = clamp(Math.floor(fx), 0, nx - 2), j = clamp(Math.floor(fz), 0, nz - 2);
    const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
    const h = this.heights;
    const a = h[j * nx + i], b = h[j * nx + i + 1], c = h[(j + 1) * nx + i], d = h[(j + 1) * nx + i + 1];
    // même découpage en triangles que le maillage
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  // Relief lointain (silhouettes) au-delà du terrain détaillé
  buildBackdrop(skyColor, fogColor) {
    const t = this.track;
    const b = t.bounds;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const r0 = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + this.margin * 0.85;
    const r1 = r0 + (this.theme === 'mountain' ? 9000 : 5000);
    const seg = 160, rings = 6;
    const pos = [], col = [], idx = [];
    const N = this.noise;
    const amp = { mountain: 1400, coast: 260, countryside: 160, gp: 120, city: 40 }[this.theme] ?? 150;
    const fc = new THREE.Color(fogColor);
    for (let r = 0; r <= rings; r++) {
      const u = r / rings;
      const rad = lerp(r0, r1, Math.pow(u, 0.8));
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad;
        let h;
        if (r === 0) h = this.sampleGrid(x, z) - 5;
        else {
          const ridge = N.ridged(Math.cos(a) * 3 + 11, Math.sin(a) * 3 + u * 2, 5);
          h = this.pa + amp * ridge * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (this.theme === 'mountain' ? 1 : 0.8);
          if (this.theme === 'coast' && Math.sin(a) > 0.25) h = -2; // la mer au sud
        }
        pos.push(x, h, z);
        // perspective atmosphérique
        const k = smoothstep(0, 1, u) * 0.85;
        const base = this.theme === 'mountain' && h > this.pa + amp * 0.45 ? [0.9, 0.92, 0.96] : this.theme === 'city' ? [0.12, 0.12, 0.14] : [0.22, 0.3, 0.2];
        col.push(lerp(base[0], fc.r, k), lerp(base[1], fc.g, k), lerp(base[2], fc.b, k));
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s, bq = a + 1, c = a + seg + 1, d = c + 1;
        idx.push(a, bq, c, bq, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
    void skyColor;
    return m;
  }
}
