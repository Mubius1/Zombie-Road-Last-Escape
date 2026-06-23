import Phaser from 'phaser';
import Settings from '../Settings';

/**
 * FilmPipeline — post-processing filmico a livello di camera (GLSL inline, WebGL1).
 *
 * Deroga consapevole al vincolo "geometria 100% via Graphics API": il post-processing
 * (tone mapping, grading, vignetta, grana, aberrazione) vive in shader. **Nessun asset
 * esterno**: il sorgente GLSL è una stringa inline qui sotto, niente PNG, niente .glsl.
 * Vedi docs/ART_BIBLE_ZOMBIES.md §"Standard di Produzione AAA" e docs/ARCHITETTURA.md.
 *
 * Catena (una sola passata): aberrazione cromatica radiale → tone mapping ACES (filmico) →
 * contrasto → saturazione → temperatura → vignetta → grana animata → scanline CRT.
 * Il bloom morbido sugli emissivi è la FX integrata di Phaser, aggiunta PRIMA di questa
 * pipeline in PostFx.attachPostFx (così il grading tona il frame già "bloomato").
 *
 * Tutto è gated da un master `uIntensity` e regolabile a runtime via `filmParams` senza
 * ricompilare. I default sono CONSERVATIVI e HUD-safe: il post-processing a livello camera
 * tocca anche l'HUD (depth >20), e l'art bible mette la leggibilità prima di tutto.
 *
 * API verificata sui type definitions di Phaser 3.90 (PostFXPipeline, WebGL1, GLSL ES 1.00:
 * `texture2D`/`gl_FragColor`, `varying vec2 outTexCoord`, `uniform sampler2D uMainSampler`).
 */

/**
 * Parametri "vivi" condivisi, regolabili a runtime senza ricompilare lo shader.
 * Singleton per-game (la `vignette` è invece per-camera, vedi FilmPipeline.vignette).
 *
 * Allineati alla direzione filmica dell'art bible: strada notturna desaturata, grana tenue
 * (≤ ~0.05), accenti emissivi come unica luce viva. Per spegnere tutto: `intensity = 0`.
 */
export interface FilmParams {
  /** Master 0..1 dell'intero stack filmico (0 = passthrough pulito). */
  intensity: number;
  /** Contrasto attorno a 0.5 (1 = neutro; ~1.08 = leggermente più inciso). */
  contrast: number;
  /** Saturazione (1 = neutro; <1 desatura verso il look "malato/notturno"). */
  saturation: number;
  /** Temperatura: >0 vira caldo (rosso su / blu giù), <0 freddo. Default neutro. */
  warmth: number;
  /** Quantità di tone mapping ACES miscelato (0 = off, 1 = pieno filmico). */
  tone: number;
  /** Esposizione pre-tonemap (compensa l'ACES che scurisce i mezzitoni). */
  exposure: number;
  /** Aberrazione cromatica radiale (0 = off; cresce verso i bordi). Tenue di default. */
  aberration: number;
  /** Grana di pellicola (ampiezza del rumore per-pixel; ≤ ~0.05 da art bible). */
  grain: number;
  /** Scanline CRT (oscuramento righe alterne; molto tenue). */
  scanline: number;
  /** Velocità 0..1: streak radiale SOLO ai bordi (centro nitido → leggibilità salva). */
  speed: number;
  /** Shock transitorio di aberrazione su impatti grossi; decade da solo ogni frame. */
  shock: number;
}

export const filmParams: FilmParams = {
  intensity: 1,
  // Penombra (pivot horror): grading più cupo e desaturato → notte malata, meno "arcade".
  contrast: 1.12,
  saturation: 0.84,
  warmth: 0.0,
  tone: 0.5,
  exposure: 0.9,
  aberration: 0.006,
  grain: 0.045,
  scanline: 0.035,
  speed: 0,
  shock: 0,
};

// GLSL ES 1.00 (WebGL1). uMainSampler + uResolution sono forniti da Phaser; gli altri li
// impostiamo in onPreRender. Standard Phaser: `texture2D` + `gl_FragColor`.
const frag = `
#define SHADER_NAME FILM_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uIntensity;
uniform float uVignette;
uniform float uContrast;
uniform float uSaturation;
uniform float uWarmth;
uniform float uTone;
uniform float uExposure;
uniform float uAberration;
uniform float uGrain;
uniform float uScanline;
uniform float uSpeed;

varying vec2 outTexCoord;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

// ACES filmico (approssimazione di Narkowicz): rolloff morbido sulle alte luci.
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Hash pseudo-random per la grana.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main () {
  vec2 uv = outTexCoord;
  float k = clamp(uIntensity, 0.0, 1.0);

  // ── Aberrazione cromatica: scostamento radiale crescente verso i bordi ──
  vec2 ctr = uv - 0.5;
  vec2 off = ctr * (uAberration * dot(ctr, ctr) * k);
  vec3 src = vec3(
    texture2D(uMainSampler, uv + off).r,
    texture2D(uMainSampler, uv).g,
    texture2D(uMainSampler, uv - off).b
  );

  // ── Streak radiale di velocità: SOLO ai bordi (centro nitido → leggibilità) ──
  if (uSpeed > 0.001) {
    float edge = smoothstep(0.22, 0.55, length(ctr));
    float amt = uSpeed * edge * 0.018;
    vec3 streak = texture2D(uMainSampler, uv - ctr * amt).rgb
                + texture2D(uMainSampler, uv - ctr * amt * 2.0).rgb
                + texture2D(uMainSampler, uv - ctr * amt * 3.0).rgb
                + texture2D(uMainSampler, uv - ctr * amt * 4.0).rgb;
    src = mix(src, streak * 0.25, uSpeed * edge);
  }

  // ── Grading ──
  vec3 c = src;
  c = mix(c, aces(c * uExposure), uTone);          // tone mapping filmico
  c = (c - 0.5) * uContrast + 0.5;                  // contrasto attorno a 0.5
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, uSaturation);                // saturazione
  c.r += uWarmth; c.b -= uWarmth;                  // temperatura
  c = mix(src, c, k);                              // master blend del grading

  // ── Vignetta radiale ──
  float vig = smoothstep(0.90, 0.28, length(ctr) * 1.30);
  c *= mix(1.0, vig, clamp(uVignette, 0.0, 1.0) * k * 0.6);

  // ── Grana animata (per-pixel, varia ogni frame) ──
  float n = hash(gl_FragCoord.xy + fract(uTime) * 100.0);
  c += (n - 0.5) * uGrain * k;

  // ── Scanline CRT (righe alterne, molto tenue) ──
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159);
  c *= 1.0 - uScanline * sl * k;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export default class FilmPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  /** Forza vignetta di QUESTA camera (impostata da attachPostFx dopo setPostPipeline). */
  vignette = 1;

  private elapsed = 0;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'Film',
      fragShader: frag,
    });
  }

  // Chiamata una volta per frame, prima del draw: posto qui gli uniform animati/per-camera.
  override onPreRender(): void {
    this.elapsed += this.game.loop.delta / 1000;
    const p = filmParams;
    p.shock *= 0.88; // lo shock di impatto decade da solo
    this.set1f('uTime', this.elapsed);
    this.set1f('uIntensity', p.intensity);
    this.set1f('uVignette', Settings.vignetteFx ? this.vignette : 0); // toggle singolo (Impostazioni → Grafica)
    const grade = Settings.gradingFx; // toggle grading (tone-map / contrasto / saturazione / temperatura)
    this.set1f('uContrast', grade ? p.contrast : 1);
    this.set1f('uSaturation', grade ? p.saturation : 1);
    this.set1f('uWarmth', grade ? p.warmth : 0);
    this.set1f('uTone', grade ? p.tone : 0);
    this.set1f('uExposure', p.exposure); // ininfluente quando uTone=0
    this.set1f('uAberration', Settings.aberrationFx ? p.aberration + p.shock : 0); // toggle aberrazione (+ kick)
    this.set1f('uGrain', Settings.grainFx ? p.grain : 0);          // toggle singolo
    this.set1f('uScanline', Settings.scanlineFx ? p.scanline : 0); // toggle singolo
    this.set1f('uSpeed', p.speed);
  }
}
