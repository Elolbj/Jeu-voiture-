// Post-traitement final : adaptation d'exposition douce (luminance moyenne mesurée sur le GPU, sans relecture),
// tone mapping filmique (ACES), vignettage discret, effet de vitesse sur les bords, gouttes à l'écran,
// passage en sRGB et tramage anti-bandes. Fournit aussi le filtre passe-haut plafonné du bloom.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Facteur d'adaptation (≈ 1 pour une image « normale ») tiré de la luminance logarithmique moyenne adaptée
const ADAPT_GLSL = `
uniform sampler2D tAdapt;
uniform float uAdaptOn, uKey, uAdaptMin, uAdaptMax;
float adaptFactor() {
  float L = exp2(texture2D(tAdapt, vec2(0.5)).r);
  float f = pow(uKey / max(L, 1e-4), 0.5);
  return mix(1.0, clamp(f, uAdaptMin, uAdaptMax), uAdaptOn);
}`;

// 1) Luminance logarithmique sous-échantillonnée (64×36)
const LUM_FS = `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float s = 0.0;
  for (int y = -1; y <= 2; y++) for (int x = -1; x <= 2; x++) {
    vec3 c = texture2D(tDiffuse, vUv + (vec2(x, y) - 0.5) * uTexel).rgb;
    s += log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
  }
  gl_FragColor = vec4(s / 16.0, 0.0, 0.0, 1.0);
}`;

// 2) Moyenne (pondérée vers le centre de l'image) + adaptation temporelle → texture 1×1
const ADAPT_FS = `
uniform sampler2D tLum, tPrev;
uniform float uRate, uReset;
varying vec2 vUv;
void main() {
  float s = 0.0, w = 0.0;
  for (int y = 0; y < 18; y++) for (int x = 0; x < 32; x++) {
    vec2 uv = (vec2(x, y) + 0.5) / vec2(32.0, 18.0);
    vec2 d = uv - vec2(0.5, 0.55);
    float k = 1.0 - 0.7 * clamp(dot(d, d) * 3.0, 0.0, 1.0);
    s += texture2D(tLum, uv).r * k;
    w += k;
  }
  float target = s / w;
  float prev = texture2D(tPrev, vec2(0.5)).r;
  gl_FragColor = vec4(mix(prev, target, uReset > 0.5 ? 1.0 : uRate), 0.0, 0.0, 1.0);
}`;

// 3) Image finale
const GRADE_FS = `
uniform sampler2D tDiffuse;
uniform float uExposure, uVignette, uSpeed, uDrops, uTime, uAspect, uSat, uContrast;
uniform vec3 uLift;
varying vec2 vUv;
${ADAPT_GLSL}
vec3 gradeRRT(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 gradeAces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(O * gradeRRT(I * c), 0.0, 1.0);
}
vec3 gradeSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float gradeHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Gouttes sur l'objectif : cellules pseudo-aléatoires, chaque goutte vit puis sèche
vec2 gradeDrops(vec2 uv, float t) {
  vec2 off = vec2(0.0);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 7.0 : 13.0;
    vec2 p = vec2(uv.x * uAspect, uv.y) * sc;
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = gradeHash(id + float(l) * 17.0);
    float life = fract(t * (0.12 + 0.1 * h) + h);
    vec2 c = vec2(gradeHash(id + 3.1) - 0.5, gradeHash(id + 5.7) - 0.5) * 0.6;
    c.y -= life * 0.15;
    vec2 d = f - c;
    float r = (0.18 + 0.12 * h) * (1.0 - life * 0.6);
    float m = smoothstep(r, r * 0.6, length(d)) * step(0.35, h) * (1.0 - life);
    off += d * m * 0.9 / sc;
  }
  return off;
}
void main() {
  vec2 uv = vUv;
  vec2 dc = uv - 0.5;
  float r2 = dot(dc * vec2(uAspect, 1.0), dc * vec2(uAspect, 1.0));
  if (uDrops > 0.01) uv -= gradeDrops(vUv, uTime) * uDrops;
  vec3 col = texture2D(tDiffuse, uv).rgb;
  // effet de vitesse : léger flou radial sur les bords de l'image
  if (uSpeed > 0.01) {
    float k = uSpeed * smoothstep(0.12, 0.6, r2) * 0.035;
    vec3 acc = col;
    for (int i = 1; i <= 4; i++) acc += texture2D(tDiffuse, uv - dc * k * float(i)).rgb;
    col = acc / 5.0;
  }
  col *= uExposure * adaptFactor();
  col = gradeAces(col);
  // étalonnage léger : contraste autour du gris moyen, saturation, teinte des ombres
  col = mix(vec3(0.18), col, uContrast) + uLift * (1.0 - col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSat), 0.0);
  // vignettage discret
  col *= 1.0 - uVignette * smoothstep(0.25, 1.1, r2);
  col = gradeSRGB(clamp(col, 0.0, 1.0));
  col += (gradeHash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

// Filtre passe-haut du bloom : seuil doux, relatif à l'adaptation, et contribution plafonnée (le soleil ne blanchit plus tout)
export const BLOOM_HIGHPASS_FS = `
uniform sampler2D tDiffuse;
uniform float luminosityThreshold, smoothWidth, uCap;
varying vec2 vUv;
${ADAPT_GLSL}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb * adaptFactor();
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, l);
  vec3 b = c * k * min(1.0, uCap / max(l, 1e-4));
  gl_FragColor = vec4(b, 1.0);
}`;

export class GradePass extends Pass {
  constructor() {
    super();
    const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.lumRT = rt(64, 36);
    this.adaptRT = [rt(1, 1), rt(1, 1)];
    this.cur = 0;
    this.reset = true;
    this.adaptUniforms = {
      tAdapt: { value: this.adaptRT[0].texture },
      uAdaptOn: { value: 1 }, uKey: { value: 0.2 }, uAdaptMin: { value: 0.45 }, uAdaptMax: { value: 1.35 },
    };
    this.lumQuad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() } }, vertexShader: VS, fragmentShader: LUM_FS, depthTest: false, depthWrite: false,
    }));
    this.adaptQuad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tLum: { value: this.lumRT.texture }, tPrev: { value: null }, uRate: { value: 0.05 }, uReset: { value: 1 } },
      vertexShader: VS, fragmentShader: ADAPT_FS, depthTest: false, depthWrite: false,
    }));
    this.uniforms = {
      ...this.adaptUniforms,
      tDiffuse: { value: null }, uExposure: { value: 1 }, uVignette: { value: 0.22 }, uSpeed: { value: 0 }, uDrops: { value: 0 },
      uTime: { value: 0 }, uAspect: { value: 16 / 9 }, uSat: { value: 1.06 }, uContrast: { value: 1.04 }, uLift: { value: new THREE.Vector3(0.004, 0.006, 0.012) },
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VS, fragmentShader: GRADE_FS, depthTest: false, depthWrite: false, toneMapped: false }));
    this.adaptive = true;
    this.speed = 0;
    this.drops = 0;
    this.dt = 1 / 60;
    this.time = 0;
  }

  // Bloom : remplace son filtre passe-haut par la version plafonnée et adaptée
  patchBloom(bloom) {
    const m = bloom.materialHighPassFilter;
    m.fragmentShader = BLOOM_HIGHPASS_FS;
    Object.assign(m.uniforms, this.adaptUniforms, { uCap: { value: 3 } });
    m.needsUpdate = true;
    bloom.highPassUniforms = m.uniforms;
  }

  setSize(w, h) {
    this.uniforms.uAspect.value = w / Math.max(1, h);
  }

  render(renderer, writeBuffer, readBuffer) {
    const src = readBuffer.texture;
    this.time += this.dt;
    const U = this.uniforms;
    U.uExposure.value = renderer.toneMappingExposure;
    U.uAdaptOn.value = this.adaptive ? 1 : 0;
    if (this.adaptive) {
      // luminance moyenne : 64×36 puis 1×1 avec adaptation temporelle (≈ 1,5 s)
      this.lumQuad.material.uniforms.tDiffuse.value = src;
      this.lumQuad.material.uniforms.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height).multiplyScalar(readBuffer.width / 64 / 4);
      renderer.setRenderTarget(this.lumRT);
      this.lumQuad.render(renderer);
      const prev = this.adaptRT[this.cur];
      this.cur ^= 1;
      const next = this.adaptRT[this.cur];
      const au = this.adaptQuad.material.uniforms;
      au.tPrev.value = prev.texture;
      au.uRate.value = 1 - Math.exp(-this.dt * 1.6);
      au.uReset.value = this.reset ? 1 : 0;
      this.reset = false;
      renderer.setRenderTarget(next);
      this.adaptQuad.render(renderer);
      this.adaptUniforms.tAdapt.value = next.texture;
    }
    U.tDiffuse.value = src;
    U.uSpeed.value = this.speed;
    U.uDrops.value = this.drops;
    U.uTime.value = this.time;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.lumRT.dispose();
    for (const r of this.adaptRT) r.dispose();
    this.lumQuad.dispose();
    this.adaptQuad.dispose();
    this.quad.dispose();
  }
}
