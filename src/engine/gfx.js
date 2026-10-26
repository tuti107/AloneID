// Renderer: draws the 3D scene into a low-resolution target, then upscales it
// with a retro post-process (tone mapping, ordered dithering, palette
// quantisation, vignette, grain and a handful of full-screen effects).
import * as THREE from 'three';

const POST_VERT = /* glsl */`
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uFade;
uniform float uFlash;
uniform float uHurt;
uniform float uWarp;
uniform float uLevels;
uniform float uDither;
uniform float uExposure;
uniform float uGamma;
uniform float uGrain;
uniform float uVignette;
uniform float uSat;
uniform vec3 uTint;
uniform vec3 uFlashColor;
in vec2 vUv;
out vec4 outColor;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = vUv;
  if (uWarp > 0.0) {
    uv.x += sin(uv.y * 23.0 + uTime * 3.1) * 0.006 * uWarp;
    uv.y += cos(uv.x * 19.0 + uTime * 2.3) * 0.005 * uWarp;
  }
  // Snap to the low-res pixel grid so upscaling stays crisp.
  vec2 px = floor(uv * uRes);
  vec2 suv = (px + 0.5) / uRes;
  vec3 col = texture(tScene, suv).rgb;
  if (uWarp > 0.0) {
    float s = 0.004 * uWarp;
    col.r = mix(col.r, texture(tScene, suv + vec2(s, 0.0)).r, 0.6);
    col.b = mix(col.b, texture(tScene, suv - vec2(s, 0.0)).b, 0.6);
  }
  col *= uExposure * uTint;
  col = aces(col);
  col = toSRGB(col);
  // Brightness setting: a gamma on the display values lifts the shadows
  // while black stays black.
  col = pow(col, vec3(uGamma));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);

  vec2 d = suv - 0.5;
  float vig = 1.0 - dot(d, d) * uVignette;
  col *= clamp(vig, 0.0, 1.0);

  // Pain: red rim.
  float rim = smoothstep(0.15, 0.55, length(d));
  col = mix(col, vec3(0.55, 0.0, 0.0), uHurt * rim * 0.8);

  col += uFlashColor * uFlash;
  col += (hash(px + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  col *= 1.0 - uFade;

  // Ordered dither + quantise to a VGA-ish palette. Quantising in a
  // square-root space keeps more steps in the shadows.
  float t = bayer4(px);
  vec3 s = sqrt(clamp(col, 0.0, 1.0));
  vec3 q = floor(s * uLevels + mix(0.5, t, uDither)) / uLevels;
  outColor = vec4(q * q, 1.0);
}`;

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = true;

    this.width = 320;
    this.height = 240;
    this.rt = null;
    this.post = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        uRes: { value: new THREE.Vector2(320, 240) },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uFlash: { value: 0 },
        uHurt: { value: 0 },
        uWarp: { value: 0 },
        uLevels: { value: 9 },
        uDither: { value: 1 },
        uExposure: { value: 1.35 },
        uGamma: { value: 1 },
        uGrain: { value: 0.02 },
        uVignette: { value: 1.25 },
        uSat: { value: 0.92 },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uFlashColor: { value: new THREE.Vector3(0.75, 0.82, 1.0) },
      },
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    quad.frustumCulled = false;
    this.postScene.add(quad);
    this.u = this.post.uniforms;
    this.setResolution(320, 240);
  }

  setResolution(w, h) {
    this.width = w;
    this.height = h;
    if (this.rt) this.rt.dispose();
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.u.uRes.value.set(w, h);
    this.u.tScene.value = this.rt.texture;
  }

  setShadows(quality) {
    // quality: 0 off, 1 low, 2 high
    this.renderer.shadowMap.enabled = quality > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.shadowQuality = quality;
  }

  // Build the shaders a scene needs before it is first drawn (behind a fade),
  // so stepping into a new room doesn't freeze the picture. Never waits long.
  precompile(scene, camera, maxMs = 1500) {
    let p;
    try { p = this.renderer.compileAsync(scene, camera); } catch (e) { return Promise.resolve(); }
    return Promise.race([p, new Promise((res) => setTimeout(res, maxMs))]);
  }

  // Resize the backing canvas to the given CSS box (device pixels, capped).
  resizeCanvas(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
    }
  }

  render(scene, camera, time) {
    const r = this.renderer;
    this.u.uTime.value = time;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }
}
