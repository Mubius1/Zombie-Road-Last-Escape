import Phaser from 'phaser';

/**
 * FilmPipeline — post-processing filmico a livello di camera (GLSL inline, WebGL1).
 *
 * Deroga consapevole al vincolo "geometria 100% via Graphics API": il post-processing
 * (tone mapping, grading, vignetta, grana, aberrazione) vive in shader. **Nessun asset
 * esterno**: il sorgente GLSL è una stringa inline qui sotto, niente PNG, niente .glsl.
 * Vedi docs/ART_BIBLE_ZOMBIES.md §"Standard di Produzione AAA" e docs/ARCHITETTURA.md.
 *
 * M0 (questa versione): impalcatura verificata — passthrough + vignetta morbida +
 * uniform vivi (tempo, risoluzione, intensità). M1 espande lo shader (grading + grana +
 * aberrazione + tone mapping) e affianca il bloom integrato di Phaser.
 *
 * API verificata sui type definitions di Phaser 3.90 (PostFXPipeline, WebGL1, GLSL ES 1.00:
 * `texture2D`/`gl_FragColor`, `varying vec2 outTexCoord`, `uniform sampler2D uMainSampler`).
 */

/**
 * Parametri "vivi" condivisi, regolabili a runtime senza ricompilare lo shader.
 * Singleton per-game: la `intensity` è un master globale (es. per la modalità ridotta-movimento);
 * la `vignette` di default vale per il gioco — i menu la abbassano per-camera (vedi PostFx.ts).
 */
export interface FilmParams {
  /** Master 0..1 dell'intero stack filmico (0 = passthrough pulito). */
  intensity: number;
  /** Forza di default della vignetta (sovrascritta per-camera in attachPostFx). */
  vignette: number;
}

export const filmParams: FilmParams = { intensity: 1, vignette: 1 };

// GLSL ES 1.00 (WebGL1). uMainSampler + uResolution sono forniti da Phaser; gli altri li
// impostiamo noi in onPreRender. Lo standard Phaser usa `texture2D` e `gl_FragColor`.
const frag = `
#define SHADER_NAME FILM_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uVignette;

varying vec2 outTexCoord;

void main () {
  vec2 uv = outTexCoord;
  vec3 col = texture2D(uMainSampler, uv).rgb;

  // Vignetta radiale morbida (centro pieno, bordi in ombra).
  vec2 d = uv - 0.5;
  float vig = smoothstep(0.90, 0.28, length(d) * 1.30);
  col *= mix(1.0, vig, clamp(uVignette, 0.0, 1.0) * uIntensity * 0.6);

  gl_FragColor = vec4(col, 1.0);
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
    } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  // Chiamata una volta per frame, prima del draw: posto qui gli uniform animati/per-camera.
  onPreRender(): void {
    this.elapsed += this.game.loop.delta / 1000;
    this.set1f('uTime', this.elapsed);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set1f('uIntensity', filmParams.intensity);
    this.set1f('uVignette', this.vignette);
  }
}
