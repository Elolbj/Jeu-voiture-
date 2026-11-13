// Fusion des géométries d'une voiture par matériau (moins d'appels de dessin) : lots de géométries,
// matériau « garnitures » (couleur, rugosité, métal et canal lumineux par sommet), matériau des roues
// (pneu, jante et étrier dans un seul maillage à squelette), ombre portée par un proxy simplifié.
import * as THREE from 'three';

// Canaux du matériau garnitures : émission (phares, feux arrière, feux de jour) ou couleur (combinaison, casque)
export const CH = { none: 0, head: 1, tail: 2, drl: 3, suit: 4, helmet: 5 };

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const _c = new THREE.Color();

// Lot de géométries fusionnées en une seule (attributs normalisés, transformation, miroir, faces retournées)
export class Batch {
  constructor({ uv = false, color = true, trim = false, skin = false, sel = false } = {}) {
    this.o = { uv, color, trim, skin, sel };
    this.parts = [];
    this.nv = 0;
    this.ni = 0;
  }

  // opts : tint (couleur multipliée aux couleurs de sommet), solid (couleur imposée), trim [rugosité, métal, canal],
  //        matrix, flip (faces retournées), bone (indice d'os), sel (sélecteur du matériau des roues)
  add(g, opts = {}) {
    if (!g) return this;
    const n = g.attributes.position.count;
    if (!n) return this;
    this.parts.push({ g, opts: opts.matrix ? { ...opts, matrix: opts.matrix.clone() } : opts });
    this.nv += n;
    this.ni += g.index ? g.index.count : n;
    return this;
  }

  build() {
    if (!this.nv) return null;
    const O = this.o;
    const pos = new Float32Array(this.nv * 3);
    const nor = new Float32Array(this.nv * 3);
    const uv = O.uv ? new Float32Array(this.nv * 2) : null;
    const col = O.color ? new Float32Array(this.nv * 3) : null;
    const trim = O.trim ? new Float32Array(this.nv * 3) : null;
    const sel = O.sel ? new Float32Array(this.nv) : null;
    const si = O.skin ? new Uint16Array(this.nv * 4) : null;
    const sw = O.skin ? new Float32Array(this.nv * 4) : null;
    const idx = this.nv > 65535 ? new Uint32Array(this.ni) : new Uint16Array(this.ni);
    let v0 = 0, i0 = 0;
    for (const { g, opts } of this.parts) {
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color;
      const n = P.count;
      const m = opts.matrix || null;
      if (m) _nm.getNormalMatrix(m);
      const mirror = m ? m.determinant() < 0 : false;
      const flip = !!opts.flip !== mirror;
      const sgn = opts.flip ? -1 : 1;
      const tint = opts.tint ? _c.set(opts.tint) : null;
      const tr = tint ? tint.r : 1, tg = tint ? tint.g : 1, tb = tint ? tint.b : 1;
      const solid = opts.solid ? new THREE.Color(opts.solid) : null;
      for (let i = 0; i < n; i++) {
        _p.fromBufferAttribute(P, i);
        if (N) _n.fromBufferAttribute(N, i); else _n.set(0, 1, 0);
        if (m) { _p.applyMatrix4(m); _n.applyMatrix3(_nm).normalize(); }
        const k = (v0 + i) * 3;
        pos[k] = _p.x; pos[k + 1] = _p.y; pos[k + 2] = _p.z;
        nor[k] = _n.x * sgn; nor[k + 1] = _n.y * sgn; nor[k + 2] = _n.z * sgn;
        if (uv && U) { uv[(v0 + i) * 2] = U.getX(i); uv[(v0 + i) * 2 + 1] = U.getY(i); }
        if (col) {
          if (solid) { col[k] = solid.r; col[k + 1] = solid.g; col[k + 2] = solid.b; }
          else if (C && !opts.white) { col[k] = C.getX(i) * tr; col[k + 1] = C.getY(i) * tg; col[k + 2] = C.getZ(i) * tb; }
          else { col[k] = tr; col[k + 1] = tg; col[k + 2] = tb; }
        }
        if (trim) { const t = opts.trim || [0.5, 0, 0]; trim[k] = t[0]; trim[k + 1] = t[1]; trim[k + 2] = t[2]; }
        if (sel) sel[v0 + i] = opts.sel || 0;
        if (si) { si[(v0 + i) * 4] = opts.bone || 0; sw[(v0 + i) * 4] = 1; }
      }
      const I = g.index;
      const cnt = I ? I.count : n;
      for (let t = 0; t < cnt; t += 3) {
        const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2;
        idx[i0 + t] = v0 + a;
        idx[i0 + t + 1] = v0 + (flip ? c : b);
        idx[i0 + t + 2] = v0 + (flip ? b : c);
      }
      v0 += n;
      i0 += cnt;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (trim) out.setAttribute('aTrim', new THREE.BufferAttribute(trim, 3));
    if (sel) out.setAttribute('aSel', new THREE.BufferAttribute(sel, 1));
    if (si) {
      out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    out.__shared = true;
    return out;
  }
}

// ---------------------------------------------------------------------------
// Matériau « garnitures » : MeshStandardMaterial dont la rugosité, le métal et l'émission viennent des sommets
// ---------------------------------------------------------------------------
export function trimMaterial({ envMapIntensity = 1, polygonOffset = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0, envMapIntensity });
  if (polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }
  const U = {
    uHead: { value: new THREE.Color(0, 0, 0) },
    uTail: { value: new THREE.Color(0, 0, 0) },
    uDrl: { value: new THREE.Color(0, 0, 0) },
    uSuit: { value: new THREE.Color(0.5, 0.5, 0.5) },
    uHelmet: { value: new THREE.Color(0.8, 0.8, 0.8) },
  };
  m.userData.u = U;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aTrim;\nvarying vec3 vTrim;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrim = aTrim;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTrim;\nuniform vec3 uHead, uTail, uDrl, uSuit, uHelmet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vTrim.z > 3.5) diffuseColor.rgb = vTrim.z < 4.5 ? uSuit : uHelmet;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vTrim.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vTrim.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n'
        + 'totalEmissiveRadiance += vTrim.z < 0.5 ? vec3(0.0) : vTrim.z < 1.5 ? uHead : vTrim.z < 2.5 ? uTail : vTrim.z < 3.5 ? uDrl : vec3(0.0);');
  };
  m.customProgramCacheKey = () => 'carTrim';
  return m;
}

// ---------------------------------------------------------------------------
// Matériau des roues : atlas pneu/disque (sel 0), jante teintée (sel 1), étrier (sel 2)
// ---------------------------------------------------------------------------
export function wheelSetMaterial(atlas) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas.map, roughnessMap: atlas.orm, metalnessMap: atlas.orm, roughness: 1, metalness: 1, vertexColors: true });
  const U = {
    uRim: { value: new THREE.Color(0.7, 0.7, 0.7) },
    uRimRM: { value: new THREE.Vector2(0.24, 0.75) },
    uCal: { value: new THREE.Color(0.6, 0.05, 0.05) },
  };
  m.userData.u = U;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSel;\nvarying float vSel;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSel = aSel;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSel;\nuniform vec3 uRim, uCal;\nuniform vec2 uRimRM;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (vSel > 0.5) diffuseColor.rgb = vSel < 1.5 ? uRim : uCal;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vSel > 0.5) roughnessFactor = vSel < 1.5 ? uRimRM.x : 0.35;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (vSel > 0.5) metalnessFactor = vSel < 1.5 ? uRimRM.y : 0.25;');
  };
  m.customProgramCacheKey = () => 'carWheels';
  return m;
}

// ---------------------------------------------------------------------------
// Ombre par proxy : l'objet n'est retenu que par le frustum (orthographique) de l'ombre du soleil,
// jamais par celui de la caméra — il ne coûte donc qu'un appel, dans la passe d'ombre.
// ---------------------------------------------------------------------------
function isShadowFrustum(f) {
  return f.planes[0].normal.dot(f.planes[1].normal) < -0.9999;
}
const PROXY_MAT = new THREE.MeshBasicMaterial({ color: 0x000000 });
export function shadowProxy(geo) {
  const m = new THREE.Mesh(geo || new THREE.BufferGeometry(), PROXY_MAT);
  m.castShadow = true;
  m.userData.shadowProxy = true;
  m.intersectsFrustum = function (f) { return isShadowFrustum(f) && f.intersectsObject(this); };
  return m;
}
