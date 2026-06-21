import Phaser from 'phaser';
import Juice from './Juice';
import FilmPipeline, { filmParams } from './pipelines/FilmPipeline';
import AsphaltPipeline from './pipelines/AsphaltPipeline';

/**
 * PostFx — punto unico per il post-processing a livello di camera.
 *
 * Registra le pipeline custom (vedi `PIPELINES`, agganciato in game.ts → GameConfig.pipeline)
 * e le attacca alla camera principale di una scena. Tutto è gated da `Settings.screenFx`
 * dai chiamanti e da un guard WebGL: se il renderer è Canvas (fallback di `Phaser.AUTO`),
 * lo shader non è disponibile e si torna all'overlay "finto" di Juice.
 *
 * Le FX sono **WebGL-only** (nessuna controparte Canvas) — il guard evita schermate vuote.
 */

/** Nome registrato della pipeline filmica (deve combaciare con `FilmPipeline` name). */
export const POSTFX_FILM = 'Film';
/** Nome registrato della pipeline di superficie asfalto (object-pipeline sulla strada). */
export const POSTFX_ASPHALT = 'Asphalt';

/**
 * Mappa nome→classe per GameConfig.pipeline. Phaser instrada automaticamente le
 * sottoclassi di PostFXPipeline al registro delle post-pipeline al boot del renderer.
 * Tipizzato lasco perché la firma di PipelineConfig vuole `typeof WebGLPipeline`.
 */
export const PIPELINES: Record<string, unknown> = {
  [POSTFX_FILM]: FilmPipeline,
  [POSTFX_ASPHALT]: AsphaltPipeline,
};

/**
 * Bloom morbido sugli emissivi (FX integrata, multi-pass a mezza risoluzione → economica).
 * Tenue di default: l'art bible vuole bloom "sugli emissivi", non una foschia generale.
 * (color, offsetX, offsetY, blurStrength, strength, steps)
 */
const BLOOM = { color: 0xffffff, offX: 1, offY: 1, blur: 1.1, strength: 0.5, steps: 6 } as const;

/** True se il renderer attivo è WebGL (necessario per qualsiasi shader/post-FX). */
function isWebGL(scene: Phaser.Scene): boolean {
  return scene.game.renderer.type === Phaser.WEBGL;
}

/**
 * Attacca la catena di post-processing alla camera principale della scena.
 * Ritorna true se attiva (WebGL); false su Canvas (il chiamante usa il fallback Juice).
 *
 * `vignette` regola la forza della vignetta per QUESTA camera (1 = gioco, ~0.45 = menu).
 */
export function attachPostFx(scene: Phaser.Scene, vignette = 1): boolean {
  if (!isWebGL(scene)) return false;

  const cam = scene.cameras.main;

  // Bloom PRIMA della pipeline Film: si aggiunge per primo allo stack post → viene
  // applicato per primo, così il grading di Film tona il frame già "bloomato".
  cam.postFX.addBloom(BLOOM.color, BLOOM.offX, BLOOM.offY, BLOOM.blur, BLOOM.strength, BLOOM.steps);
  cam.setPostPipeline(FilmPipeline);

  // Ogni camera riceve la propria istanza di pipeline → impostiamo la vignetta per-camera.
  const got = cam.getPostPipeline(FilmPipeline);
  const film = (Array.isArray(got) ? got[0] : got) as FilmPipeline | undefined;
  if (film) film.vignette = vignette;

  return true;
}

/**
 * Ingresso schermo unificato: prova ad attaccare la pipeline shader; se non disponibile
 * (Canvas) ripiega sull'overlay procedurale di Juice. Ritorna la grana del fallback
 * (per `Juice.jitterGrain`) oppure null quando lo shader è attivo (la grana la fa lo shader).
 *
 * I chiamanti restano gated da `Settings.screenFx` come prima.
 */
export function enterScreen(scene: Phaser.Scene, vignette = 1): Phaser.GameObjects.TileSprite | null {
  if (attachPostFx(scene, vignette)) return null;
  return Juice.addOverlay(scene, 18, vignette);
}

/**
 * Kick transitorio di aberrazione cromatica su impatti grossi (esplosioni, scatto).
 * Imposta lo "shock" che il FilmPipeline fa decadere da solo ogni frame. No-op visivo
 * se lo shader non è attivo (Canvas / screenFx off). Cinetica readability-safe.
 */
export function pulse(amount = 0.018): void {
  filmParams.shock = Math.max(filmParams.shock, amount);
}

/**
 * Avvicina dolcemente la "velocità" (0..1) verso `target`: guida lo streak radiale ai
 * bordi (scatto/overdrive). Da chiamare ogni frame; lo smoothing evita scatti netti.
 */
export function rampSpeed(target: number, k = 0.18): void {
  filmParams.speed += (Phaser.Math.Clamp(target, 0, 1) - filmParams.speed) * k;
}

/** Azzera gli effetti cinetici (alla chiusura della scena di gioco → menu puliti). */
export function resetKinetics(): void {
  filmParams.speed = 0;
  filmParams.shock = 0;
}
