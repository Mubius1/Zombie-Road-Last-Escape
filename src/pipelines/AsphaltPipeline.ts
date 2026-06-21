import Phaser from 'phaser';

/**
 * AsphaltPipeline — dettaglio di superficie procedurale (FBM) per la sola TileSprite
 * dell'asfalto. Aggiunge sporco/weathering a frequenza più alta di quanto un tile da 256px
 * possa contenere e — soprattutto — **scorre col manto** (uniform `uScroll` = tilePositionX),
 * così la ripetizione del tile non si nota. Una chiazza fredda di "umido" rompe il piatto.
 *
 * Object-pipeline (applicata via `tilesprite.setPostPipeline`): `onPreRender()` viene
 * invocata ogni frame dall'evento PRE_RENDER del renderer (senza argomenti, come per le
 * pipeline di camera) e imposta gli uniform sul currentShader. Blast radius limitato alla
 * strada. GLSL ES 1.00 inline, `highp` per non perdere precisione su `uScroll` (cresce a lungo).
 */

/** Parametri vivi (un solo asfalto a schermo → singleton ok). `scroll` = asphalt.tilePositionX. */
export const asphaltParams = { intensity: 1, scroll: 0 };

const frag = `
#define SHADER_NAME ASPHALT_FS
precision highp float;

uniform sampler2D uMainSampler;
uniform float uScroll;
uniform float uIntensity;

varying vec2 outTexCoord;

// Frequenza del rumore sulla superficie (la strada è larga e bassa → x più fitto).
const float NSX = 22.0;
const float NSY = 7.0;
const float SK  = 0.012;  // quanto la grana segue lo scroll del manto
const float GRIME = 0.12; // ampiezza modulazione luminosità (sporco)
const float WET   = 0.06; // intensità del riflesso umido

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s;
}

void main () {
  vec2 uv = outTexCoord;
  vec4 base = texture2D(uMainSampler, uv);
  float k = clamp(uIntensity, 0.0, 1.0);

  vec2 np = vec2(uv.x * NSX + uScroll * SK, uv.y * NSY);
  float n = fbm(np);

  // Sporco: modula la luminosità ±
  float grime = (n - 0.5) * 2.0;
  vec3 col = base.rgb * (1.0 + grime * GRIME * k);

  // Umido: riflesso freddo stretto dove il rumore è alto
  float wet = smoothstep(0.74, 0.93, n);
  col += wet * WET * k * vec3(0.45, 0.55, 0.75);

  gl_FragColor = vec4(col, base.a);
}
`;

export default class AsphaltPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'Asphalt',
      fragShader: frag,
    } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  // onPreRender() è chiamata ogni frame (evento PRE_RENDER, nessun argomento): gli uniform
  // vanno sul currentShader, come per la pipeline di camera.
  onPreRender(): void {
    this.set1f('uScroll', asphaltParams.scroll);
    this.set1f('uIntensity', asphaltParams.intensity);
  }
}
