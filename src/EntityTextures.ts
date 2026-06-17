import Phaser from 'phaser';
import { OVERSAMPLE } from './Config';

/**
 * Authoring procedurale delle texture di NEMICI, BOSS e OGGETTI (estratto da GameScene per coesione).
 * Funzioni pure su `scene.textures`: generano una sola volta (guardia `textures.exists`) e
 * distruggono i Graphics dopo `generateTexture`. Le dimensioni-firma (AF/generateTexture) sono
 * validate da `npm run validate:art` contro le art bible.
 */
export function buildEntityTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('zombie_common')) return;
  const G = (_w: number, _h: number) => scene.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };
  // Variante SOVRACAMPIONATA per gli sprite che il giocatore osserva da vicino (zombie):
  // scala il Graphics di OVERSAMPLE e genera la texture a OVERSAMPLE× (resta nitida sotto lo
  // zoom della camera). Le dimensioni passate restano quelle di DESIGN — l'override le
  // moltiplica internamente, così le chiamate (e il validatore) non cambiano.
  const OS_G = (_w: number, _h: number) => {
    const g = scene.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };
    g.setScale(OVERSAMPLE);
    const orig = g.generateTexture.bind(g);
    (g as any).generateTexture = (k: string, w: number, h: number) => orig(k, w * OVERSAMPLE, h * OVERSAMPLE);
    return g;
  };
  // Aggiunge N frame numerati (0..n-1) a una texture spritesheet generata.
  // Le texture zombie sono sovracampionate (OS_G) → i frame vanno a coordinate OVERSAMPLE×;
  // i numeri passati restano di design (lo sprite torna a scala design via osSprite).
  const AF = (key: string, fw: number, fh: number, n: number) => {
    const t = scene.textures.get(key);
    const s = OVERSAMPLE;
    for (let i = 0; i < n; i++) t.add(i, 0, i * fw * s, 0, fw * s, fh * s);
  };

  // ── ZOMBIE COMMON · "Il Collo Rotto" (30×44 × 3) ───────────────────────────
  {
    const g = OS_G(90,44);
    const flA=0x6f7d54, flHi=0x8a9668, flSh=0x444c33, livid=0x5a4e63;
    const musc=0x6e2a26, muscHi=0x9a3a2e, bone=0xd9cba6;
    const shA=0x3b4156, shHi=0x4d5570, shSh=0x282c3c, pants=0x34322b, eye=0xff2a10;
    for (let f = 0; f < 3; f++) {
      const ox = f * 30, ph = f - 1; const X = (x: number) => ox + x;
      // ombra + scarpe + gambe (passo alternato)
      g.fillStyle(0x000000,0.28); g.fillEllipse(X(15),42,22,6);
      g.fillStyle(0x191510); g.fillEllipse(X(10-ph),40+ph,9,5); g.fillEllipse(X(20+ph),39-ph,9,5);
      g.fillStyle(pants);
      g.fillRoundedRect(X(8-ph),27+ph*2,6,13-ph,3);
      g.fillRoundedRect(X(16+ph),26-ph*2,6,14+ph,3);
      // chiazze di livor mortis sulle gambe
      g.fillStyle(livid,0.7); g.fillEllipse(X(11-ph),34,4,6); g.fillEllipse(X(19+ph),33,4,5);
      // braccio DESTRO penzolante (lussato, lungo il fianco)
      g.fillStyle(flSh); g.fillRoundedRect(X(22),16,5,16,2);
      g.fillStyle(flA);  g.fillRoundedRect(X(22),16,4,15,2);
      g.fillStyle(flA);  g.fillCircle(X(24),33,3);
      g.fillStyle(flHi); g.fillTriangle(X(22),35,X(24),38,X(26),35);
      // braccio SINISTRO proteso (controfase col passo)
      const laY=16+ph*2;
      g.fillStyle(flSh); g.fillRoundedRect(X(1),laY,8,5,2);
      g.fillStyle(flA);  g.fillRoundedRect(X(1),laY,7,4,2);
      g.fillStyle(flHi); g.fillRect(X(2),laY,5,1);
      g.fillStyle(flA);  g.fillCircle(X(1),laY+2,3);
      g.fillStyle(0x9aae86); g.fillTriangle(X(-1),laY-1,X(-3),laY,X(-1),laY+2);
      // torso: brandelli di maglietta (bordo strappato a triangoli)
      g.fillStyle(shSh); g.fillRoundedRect(X(7),14,16,15,5);
      g.fillStyle(shA);  g.fillRoundedRect(X(8),15,14,12,4);
      g.fillStyle(shSh); [9,12,15,18].forEach(x=>g.fillTriangle(X(x),26,X(x+3),26,X(x+1.5),30));
      g.fillStyle(shHi); g.fillRoundedRect(X(9),16,5,6,2);
      // squarcio: muscolo vivo + costola d'osso
      g.fillStyle(musc);   g.fillEllipse(X(15),25,9,6);
      g.fillStyle(muscHi); g.fillEllipse(X(14),24,4,2);
      g.fillStyle(bone);   [12,15,18].forEach(x=>g.fillRect(X(x),22,1,6));
      g.fillStyle(0x4a0e0e); g.fillEllipse(X(17),26,3,3);
      // collo slanciato → testa che PENDE a destra (collo rotto)
      g.fillStyle(flSh); g.fillRoundedRect(X(14),9,8,7,3);
      g.fillStyle(flA);  g.fillCircle(X(19),8,7); g.fillEllipse(X(20),11,11,8);
      g.fillStyle(flHi); g.fillEllipse(X(16),5,6,5);
      g.fillStyle(flSh); g.fillEllipse(X(23),11,5,6);
      g.fillStyle(livid,0.6); g.fillEllipse(X(22),9,4,5);
      g.fillStyle(0x241c12); g.fillEllipse(X(18),3,12,6); g.fillTriangle(X(12),4,X(14),10,X(15),4);
      // occhiaie + occhi rossi + bocca storta + denti + bava
      g.fillStyle(0x2a2418); g.fillEllipse(X(16),8,5,4); g.fillEllipse(X(23),8,4,4);
      g.fillStyle(eye); g.fillEllipse(X(16),8,2.6,2.2); g.fillEllipse(X(23),8,2.4,2);
      g.fillStyle(0xffc7a0); g.fillCircle(X(15),7,1); g.fillCircle(X(22),7,1);
      g.fillStyle(0x2a0a0a); g.fillEllipse(X(20),13,7,3);
      g.fillStyle(bone); [17,20,23].forEach(x=>g.fillTriangle(X(x),12,X(x+2),12,X(x+1),14));
      g.fillStyle(0x88aa66,0.6); g.fillRect(X(20),14,1,6);
    }
    g.generateTexture('zombie_common',90,44); AF('zombie_common',30,44,3); g.destroy();
  }

  // ── ZOMBIE RUNNER · "Lo Scorticato" (26×42 × 3) ────────────────────────────
  {
    const g = OS_G(78,42);
    const sk=0xb3a48f, skHi=0xcabba6, skSh=0x7d705e;
    const abr=0x7a2e22, abrHi=0xa8412e, rag=0x55303a, bone=0xd9cba6, eye=0xff6410;
    for (let f = 0; f < 3; f++) {
      const ox = f * 26, ph = f - 1; const X = (x: number) => ox + x;
      g.fillStyle(0x000000,0.22); g.fillEllipse(X(13),40,18,5);
      // gamba posteriore (spinta indietro)
      g.fillStyle(skSh); g.fillRoundedRect(X(2+ph*3),24+ph*3,5,14-ph,2);
      g.fillStyle(sk);   g.fillRoundedRect(X(2+ph*3),24+ph*3,4,12-ph,2);
      g.fillStyle(0x191510); g.fillEllipse(X(3+ph*3),38+ph,7,4);
      // gamba anteriore (slancio avanti)
      g.fillStyle(skSh); g.fillRoundedRect(X(15-ph*3),22-ph*3,5,15+ph,2);
      g.fillStyle(sk);   g.fillRoundedRect(X(15-ph*3),22-ph*3,4,13+ph,2);
      g.fillStyle(skHi); g.fillRect(X(16-ph*3),24-ph*3,2,7);
      g.fillStyle(0x191510); g.fillEllipse(X(18-ph*3),37-ph,8,4);
      // abrasione sulla coscia (raschiatura da asfalto)
      g.fillStyle(abr); g.fillEllipse(X(16-ph*2),27,3,5);
      g.fillStyle(abrHi); g.fillEllipse(X(16-ph*2),26,1.5,2);
      // braccio posteriore
      const baY = 18+ph*3;
      g.fillStyle(skSh); g.fillRoundedRect(X(-3),baY,11,4,2);
      g.fillStyle(sk);   g.fillCircle(X(-2),baY+2,3);
      // torso magro + costole + abrasione spalla
      g.fillStyle(rag);   g.fillRoundedRect(X(7),12,12,14,4);
      g.fillStyle(0x44262e); g.fillRoundedRect(X(8),13,5,8,2);
      g.fillStyle(sk);   g.fillEllipse(X(13),22,9,6);
      g.fillStyle(skSh); g.fillRect(X(9),20,8,1); g.fillRect(X(9),22,8,1); g.fillRect(X(10),24,6,1);
      g.fillStyle(abr);  g.fillEllipse(X(11),15,4,3); g.fillStyle(abrHi); g.fillEllipse(X(11),14,2,1.4);
      // braccio anteriore proteso ad artiglio
      const aaY = 13-ph*3;
      g.fillStyle(skSh); g.fillRoundedRect(X(18),aaY,9,4,2);
      g.fillStyle(sk);   g.fillRoundedRect(X(18),aaY,8,3,2);
      g.fillStyle(skHi); g.fillRect(X(19),aaY,6,1);
      g.fillStyle(sk);   g.fillCircle(X(26),aaY+2,3);
      g.fillStyle(0xcabba6);
      g.fillTriangle(X(27),aaY-1,X(29),aaY-1,X(27),aaY+2);
      g.fillTriangle(X(27),aaY+2,X(29),aaY+3,X(27),aaY+5);
      // collo teso + testa protesa, angolosa
      g.fillStyle(skSh); g.fillRoundedRect(X(11),7,7,6,2);
      g.fillStyle(sk);   g.fillEllipse(X(14),6,13,10);
      g.fillStyle(skHi); g.fillEllipse(X(12),4,6,5);
      g.fillStyle(skSh); g.fillEllipse(X(18),8,5,6);
      g.fillStyle(0x2a221a); g.fillEllipse(X(13),2,10,4);
      // occhi arancio brucianti (faro) + bocca spalancata che ringhia
      g.fillStyle(0x1a0e00); g.fillEllipse(X(10),6,5,4); g.fillEllipse(X(18),6,5,4);
      g.fillStyle(eye); g.fillEllipse(X(10),6,3,2.4); g.fillEllipse(X(18),6,3,2.4);
      g.fillStyle(0xffd28a); g.fillCircle(X(9),5,1.1); g.fillCircle(X(17),5,1.1);
      g.fillStyle(0x1a0000); g.fillEllipse(X(14),11,8,5);
      g.fillStyle(bone);
      [9,12,15,18].forEach(x => g.fillTriangle(X(x),9,X(x+2),9,X(x+1),12));
      [10,13,16].forEach(x => g.fillTriangle(X(x),14,X(x+2),14,X(x+1),11));
      g.fillStyle(abr); g.fillRect(X(14),13,2,4);
    }
    g.generateTexture('zombie_runner',78,42); AF('zombie_runner',26,42,3); g.destroy();
  }

  // ── ZOMBIE ARMORED · "Il Tutore" (38×48 × 3) ───────────────────────────────
  {
    const g = OS_G(114,48);
    const st=0x5f6b78, stHi=0x8a97a5, stSh=0x39424c, stDD=0x20262c;
    const rustT=0x8a4a26, rustB=0x3a1d0e, verd=0x3f6b54, bloodOx=0x2a1410;
    const flesh=0x5a4e63, eye=0xffcc22;
    for (let f = 0; f < 3; f++) {
      const ox = f * 38, ph = f - 1; const X = (x: number) => ox + x;
      g.fillStyle(0x000000,0.35); g.fillEllipse(X(19),46,30,6);
      // stivali + gambe (marcia minima, pesante)
      g.fillStyle(0x16181c); g.fillEllipse(X(12-ph),43,12,7); g.fillEllipse(X(26+ph),43,12,7);
      g.fillStyle(stSh); g.fillRoundedRect(X(8-ph),28+ph,11,15,3); g.fillRoundedRect(X(20+ph),28-ph,11,15,3);
      g.fillStyle(st);   g.fillRoundedRect(X(9-ph),29+ph,9,12,3); g.fillRoundedRect(X(21+ph),29-ph,9,12,3);
      g.fillStyle(verd,0.6); g.fillRect(X(9-ph),38,9,2); g.fillRect(X(21+ph),38,9,2);
      // braccio destro + guanto
      g.fillStyle(stSh); g.fillRoundedRect(X(30),20-ph,9,7,3);
      g.fillStyle(st);   g.fillRoundedRect(X(31),20-ph,8,5,2);
      g.fillStyle(stDD); g.fillCircle(X(39),24-ph,4);
      // corazza pettorale + sangue ossidato
      g.fillStyle(stDD); g.fillRoundedRect(X(9),13,22,18,6);
      g.fillStyle(st);   g.fillRoundedRect(X(10),14,20,16,5);
      g.fillStyle(stHi); g.fillRoundedRect(X(12),15,8,6,3);
      g.fillStyle(stSh); g.fillRect(X(11),22,18,1); g.fillRect(X(20),14,1,16);
      g.fillStyle(bloodOx,0.8); g.fillEllipse(X(23),25,6,4);
      // rivetti con colature di RUGGINE che scendono
      const rivets: [number, number][] = [[12,16],[28,16],[12,28],[28,28]];
      rivets.forEach(([x,y]) => { g.fillStyle(rustT,0.7); g.fillRect(X(x),y,2,8); g.fillStyle(rustB,0.7); g.fillRect(X(x),y+5,2,4); });
      g.fillStyle(0xb8c6d4); rivets.forEach(([x,y]) => g.fillCircle(X(x+1),y,1.3));
      // spallaccio destro (cupola)
      g.fillStyle(stSh); g.fillEllipse(X(32),16,11,10);
      g.fillStyle(st);   g.fillEllipse(X(32),15,8,7);
      g.fillStyle(stHi); g.fillEllipse(X(30),13,4,3);
      // collo (carne marcia) + casco (verderame sui bordi)
      g.fillStyle(flesh); g.fillRoundedRect(X(15),9,10,6,2);
      g.fillStyle(stDD); g.fillEllipse(X(20),7,24,15);
      g.fillStyle(st);   g.fillEllipse(X(20),6,21,13);
      g.fillStyle(stHi); g.fillEllipse(X(15),2,8,5);
      g.fillStyle(verd,0.5); g.fillEllipse(X(28),9,5,6);
      // visiera scura + occhi gialli dietro
      g.fillStyle(0x0a1118); g.fillRoundedRect(X(10),7,21,7,3);
      g.fillStyle(0x1c3550,0.7); g.fillRoundedRect(X(11),8,19,3,2);
      g.fillStyle(eye); g.fillEllipse(X(15),10,4,2.4); g.fillEllipse(X(26),10,4,2.4);
      g.fillStyle(0xffffcc); g.fillCircle(X(14),10,1); g.fillCircle(X(25),10,1);
      // griglia bocca
      g.fillStyle(stDD); g.fillRoundedRect(X(14),14,13,5,2);
      g.fillStyle(0x14181e); [15,18,21,24].forEach(x => g.fillRect(X(x),15,2,4));
      // SCUDO antisommossa sul braccio sinistro (gancio silhouette)
      g.fillStyle(stDD); g.fillRoundedRect(X(-2),12,9,28,4);
      g.fillStyle(stSh); g.fillRoundedRect(X(-1),13,7,26,4);
      g.fillStyle(st);   g.fillRoundedRect(X(0),15,4,22,3);
      g.fillStyle(stHi); g.fillRect(X(1),17,2,10);
      g.fillStyle(bloodOx,0.7); g.fillEllipse(X(3),24,3,5);
      g.fillStyle(verd,0.5); g.fillRect(X(0),36,5,2);
    }
    g.generateTexture('zombie_armored',114,48); AF('zombie_armored',38,48,3); g.destroy();
  }

  // ── ZOMBIE JUMPER · "Il Ragno" (32×46 × 3) ─────────────────────────────────
  {
    const g = OS_G(96,46);
    const sk=0x9aa83e, skHi=0xc2d05a, skSh=0x5f6a22, joint=0x20240e;
    const tend=0xd8e08a, eye=0xfff000, claw=0xe8e0c0, blood=0x7a2e22;
    for (let f = 0; f < 3; f++) {
      const ox = f * 32, ph = f - 1; const X = (x: number) => ox + x;
      const bY = ph * 2;
      g.fillStyle(0x000000,0.3); g.fillEllipse(X(16),44,22,5);
      // cosce (compressione a molla nel frame centrale)
      const thH = 9 - Math.abs(ph)*2;
      g.fillStyle(skSh); g.fillRoundedRect(X(5),23+bY,8,thH,4); g.fillRoundedRect(X(19),23+bY,8,thH,4);
      g.fillStyle(sk);   g.fillEllipse(X(8),26+bY,6,thH-2); g.fillEllipse(X(24),26+bY,6,thH-2);
      // ginocchia annerite (lettura "insetto")
      g.fillStyle(joint); g.fillCircle(X(7),30+bY,2.4); g.fillCircle(X(25),30+bY,2.4);
      // stinchi + tendini esposti
      g.fillStyle(skSh); g.fillRoundedRect(X(3),30+bY,7,11,3); g.fillRoundedRect(X(22),30+bY,7,11,3);
      g.fillStyle(sk);   g.fillRoundedRect(X(3),30+bY,5,9,3); g.fillRoundedRect(X(22),30+bY,5,9,3);
      g.fillStyle(tend); g.fillRect(X(4),31+bY,1,7); g.fillRect(X(26),31+bY,1,7);
      // piedi artigliati
      g.fillStyle(skSh); g.fillEllipse(X(5),41,9,4); g.fillEllipse(X(27),41,9,4);
      g.fillStyle(claw);
      [1,4,7].forEach(x => g.fillTriangle(X(x),42,X(x+2),42,X(x+1),45));
      [23,26,29].forEach(x => g.fillTriangle(X(x),42,X(x+2),42,X(x+1),45));
      // torso teso (addominali a tendine)
      g.fillStyle(skSh); g.fillEllipse(X(16),17+bY,15,15);
      g.fillStyle(sk);   g.fillEllipse(X(16),17+bY,13,13);
      g.fillStyle(skHi); g.fillEllipse(X(12),13+bY,6,6);
      g.fillStyle(tend); g.fillRect(X(11),18+bY,10,1); g.fillRect(X(12),21+bY,8,1);
      g.fillStyle(blood); g.fillEllipse(X(19),20+bY,4,3);
      // braccia alzate (gomiti scuri) + artigli
      const aY = 9+bY+ph*2;
      g.fillStyle(skSh); g.fillRoundedRect(X(-4),aY,12,5,2); g.fillRoundedRect(X(24),aY,12,5,2);
      g.fillStyle(joint); g.fillCircle(X(2),aY+2,2.2); g.fillCircle(X(30),aY+2,2.2);
      g.fillStyle(sk);   g.fillRoundedRect(X(-5),aY-4,6,8,3); g.fillRoundedRect(X(31),aY-4,6,8,3);
      g.fillStyle(skHi); g.fillRect(X(-4),aY-3,2,5); g.fillRect(X(32),aY-3,2,5);
      g.fillStyle(claw);
      [-6,-3,0].forEach(x => g.fillTriangle(X(x),aY-6,X(x+2),aY-6,X(x+1),aY-10));
      [32,35,38].forEach(x => g.fillTriangle(X(x),aY-6,X(x+2),aY-6,X(x+1),aY-10));
      // collo + testa
      g.fillStyle(skSh); g.fillRoundedRect(X(13),5+bY,6,6,2);
      g.fillStyle(sk);   g.fillEllipse(X(16),5+bY,14,11);
      g.fillStyle(skHi); g.fillEllipse(X(13),3+bY,7,6);
      g.fillStyle(skSh); g.fillEllipse(X(20),7+bY,6,6);
      // occhi giallo elettrico + ghigno con zanne
      g.fillStyle(0x222a00); g.fillEllipse(X(11),5+bY,5,4); g.fillEllipse(X(20),5+bY,5,4);
      g.fillStyle(eye); g.fillEllipse(X(11),5+bY,3,2.6); g.fillEllipse(X(20),5+bY,3,2.6);
      g.fillStyle(0xffffd0); g.fillCircle(X(10),4+bY,1); g.fillCircle(X(19),4+bY,1);
      g.fillStyle(0x1a1400); g.fillEllipse(X(16),10+bY,9,4);
      g.fillStyle(claw);
      [12,15,18].forEach(x => g.fillTriangle(X(x),8+bY,X(x+2),8+bY,X(x+1),11+bY));
      [13,16].forEach(x => g.fillTriangle(X(x),13+bY,X(x+2),13+bY,X(x+1),10+bY));
    }
    g.generateTexture('zombie_jumper',96,46); AF('zombie_jumper',32,46,3); g.destroy();
  }

  // ── ZOMBIE TOXIC · "Il Gonfio" (30×48 × 3) ─────────────────────────────────
  {
    const g = OS_G(90,48);
    const sk=0x3f7a33, skHi=0x5fa84a, skSh=0x265020, vein=0x7dff4a;
    const ooze=0x6cff3a, oozeD=0x2cbb2a, sac=0x8fd86a, eye=0x9dff5a;
    for (let f = 0; f < 3; f++) {
      const ox = f * 30, ph = f - 1; const X = (x: number) => ox + x; const sw = ph;
      g.fillStyle(0x33ff33,0.08); g.fillCircle(X(15)+sw,24,21);
      g.fillStyle(0x004400,0.4);  g.fillEllipse(X(15)+sw,46,26,7);
      // piedi + gambe gonfie con vene
      g.fillStyle(skSh); g.fillEllipse(X(8-ph),44,9,5); g.fillEllipse(X(22+ph),44,9,5);
      g.fillStyle(skSh); g.fillEllipse(X(9-ph),36+ph,9,16); g.fillEllipse(X(21+ph),36-ph,9,16);
      g.fillStyle(sk);   g.fillEllipse(X(9-ph),35+ph,7,13); g.fillEllipse(X(21+ph),35-ph,7,13);
      g.fillStyle(vein,0.8); g.fillRect(X(8-ph),30,1,12); g.fillRect(X(22+ph),32,1,9);
      // torso gonfio
      g.fillStyle(skSh); g.fillEllipse(X(15)+sw,22,27,24);
      g.fillStyle(sk);   g.fillEllipse(X(15)+sw,22,24,21);
      g.fillStyle(skHi); g.fillEllipse(X(10)+sw,15,9,8);
      // vene emissive sul torso
      g.fillStyle(vein,0.7);
      g.fillRect(X(13)+sw,14,1,16); g.fillRect(X(13)+sw,22,8,1); g.fillRect(X(9)+sw,26,8,1);
      // pustole con nucleo luminoso
      const pus: [number, number, number][] = [[8,20,4],[21,28,3],[13,30,3]];
      pus.forEach(([x,y,r]) => {
        g.fillStyle(oozeD); g.fillCircle(X(x)+sw,y,r);
        g.fillStyle(ooze);  g.fillCircle(X(x)+sw,y,r*0.5);
        g.fillStyle(0xeaffd6); g.fillCircle(X(x-1)+sw,y-1,1);
      });
      // braccia colanti (oscillano inversamente)
      const laY=22+ph, raY=22-ph;
      g.fillStyle(skSh); g.fillEllipse(X(-2),laY,12,7); g.fillEllipse(X(32),raY,12,7);
      g.fillStyle(sk);   g.fillEllipse(X(-1),laY-1,9,5); g.fillEllipse(X(31),raY-1,9,5);
      g.fillStyle(skSh); g.fillCircle(X(-3),laY+2,4); g.fillCircle(X(33),raY+2,4);
      // SACCA tossica enorme sulla spalla destra (gancio silhouette)
      g.fillStyle(skSh); g.fillEllipse(X(24)+sw,11,16,15);
      g.fillStyle(sac);  g.fillEllipse(X(24)+sw,11,13,12);
      g.fillStyle(ooze,0.5); g.fillEllipse(X(24)+sw,12,8,7);
      g.fillStyle(0xeaffd6); g.fillEllipse(X(21)+sw,8,3,3);
      g.fillStyle(vein,0.7); g.fillRect(X(20)+sw,8,8,1); g.fillRect(X(24)+sw,5,1,12);
      // testa gonfia (inclinata verso la sacca)
      g.fillStyle(skSh); g.fillEllipse(X(13)+sw,7,20,15);
      g.fillStyle(sk);   g.fillEllipse(X(13)+sw,7,17,12);
      g.fillStyle(skHi); g.fillEllipse(X(9)+sw,3,7,6);
      g.fillStyle(skSh); g.fillRect(X(12)+sw,0,2,5);
      // occhi luminosi + bocca che cola
      g.fillStyle(0x062006); g.fillEllipse(X(9)+sw,7,6,5); g.fillEllipse(X(18)+sw,7,5,4);
      g.fillStyle(eye);   g.fillEllipse(X(9)+sw,7,3.5,3); g.fillEllipse(X(18)+sw,7,3,2.6);
      g.fillStyle(0xeaffd6); g.fillCircle(X(8)+sw,6,1.2); g.fillCircle(X(17)+sw,6,1);
      g.fillStyle(0x051a05); g.fillEllipse(X(13)+sw,13,10,5);
      g.fillStyle(ooze,0.85); g.fillEllipse(X(13)+sw,13,8,3);
      g.fillStyle(ooze,0.7); g.fillEllipse(X(11)+sw,17,2,4); g.fillEllipse(X(15)+sw,16,2,4);
    }
    g.generateTexture('zombie_toxic',90,48); AF('zombie_toxic',30,48,3); g.destroy();
  }

  // ── ZOMBIE GIANT · "L'Innesto" (48×66 × 3) — riusato dai boss ──────────────
  {
    const g = OS_G(144,66);
    const sk=0x5a3a2e, skHi=0x7d5240, skSh=0x38241c, livid=0x4a3a52;
    const graft=0x5a5a3a, graftHi=0x7d7d50, graftSh=0x2a2a18;
    const sut=0x1e140e, stitch=0x8a7a60, bone=0xd9c8a0, blood=0x6e2a26, eye=0xff2a10;
    for (let f = 0; f < 3; f++) {
      const ox = f * 48, ph = f - 1; const X = (x: number) => ox + x;
      g.fillStyle(0x000000,0.4); g.fillEllipse(X(24),64,44,8);
      // piedi + gambe massicce (passo pesante)
      g.fillStyle(0x120c06); g.fillEllipse(X(13-ph*2),60,16,8); g.fillEllipse(X(35+ph*2),60,16,8);
      g.fillStyle(skSh); g.fillRoundedRect(X(6-ph*2),38+ph*2,16,22,7); g.fillRoundedRect(X(26+ph*2),38-ph*2,16,22,7);
      g.fillStyle(sk);   g.fillRoundedRect(X(7-ph*2),38+ph*2,13,20,6); g.fillRoundedRect(X(28+ph*2),38-ph*2,13,20,6);
      g.fillStyle(skHi); g.fillEllipse(X(12-ph*2),44+ph,5,11); g.fillEllipse(X(33+ph*2),44-ph,5,11);
      g.fillStyle(livid,0.6); g.fillEllipse(X(10),52,5,8);
      g.fillStyle(blood); g.fillEllipse(X(35),50,5,7);
      // braccio SINISTRO (carne normale)
      const laY=22+ph*2;
      g.fillStyle(skSh); g.fillEllipse(X(5),laY,18,14);
      g.fillStyle(sk);   g.fillEllipse(X(5),laY-1,14,11);
      g.fillStyle(skHi); g.fillEllipse(X(3),laY-4,6,5);
      g.fillStyle(skSh); g.fillEllipse(X(4),laY+8,13,12);
      g.fillStyle(sk);   g.fillEllipse(X(4),laY+8,10,10);
      // braccio DESTRO INNESTATO (più grosso, colore diverso, suture alla spalla)
      const raY=22-ph*2;
      g.fillStyle(graftSh); g.fillEllipse(X(43),raY,21,16);
      g.fillStyle(graft);   g.fillEllipse(X(43),raY-1,17,13);
      g.fillStyle(graftHi); g.fillEllipse(X(44),raY-4,7,5);
      g.fillStyle(graftSh); g.fillEllipse(X(44),raY+9,15,14);
      g.fillStyle(graft);   g.fillEllipse(X(44),raY+9,12,11);
      g.fillStyle(sut); g.fillRect(X(35),raY-6,1,15);
      g.fillStyle(stitch); [raY-5,raY-1,raY+3,raY+7].forEach(y => g.fillRect(X(33),y,5,1));
      // nocche
      g.fillStyle(skSh);   [1,4,7].forEach(x => g.fillCircle(X(x),laY+18,1.6));
      g.fillStyle(graftSh); [41,44,47].forEach(x => g.fillCircle(X(x),raY+18,1.6));
      // torso colossale + GOBBA (spalla destra rialzata)
      g.fillStyle(skSh); g.fillRoundedRect(X(3),15,42,26,10);
      g.fillStyle(sk);   g.fillRoundedRect(X(5),16,38,23,9);
      g.fillStyle(skSh); g.fillEllipse(X(38),13,16,12);
      g.fillStyle(sk);   g.fillEllipse(X(38),13,12,9);
      g.fillStyle(skHi); g.fillEllipse(X(15),21,12,8); g.fillEllipse(X(33),20,10,7);
      g.fillStyle(skSh); g.fillRect(X(24),18,1,20);
      // chiazze livide + suture sul torso
      g.fillStyle(livid,0.55); g.fillEllipse(X(13),30,8,6); g.fillEllipse(X(34),31,7,5);
      g.fillStyle(sut); g.fillRect(X(18),18,1,18);
      g.fillStyle(stitch); [20,24,28,32].forEach(y => g.fillRect(X(16),y,5,1));
      // pancia squarciata (costole + sangue)
      g.fillStyle(0x2e1a14); g.fillEllipse(X(24),33,18,9);
      g.fillStyle(bone); [16,20,24,28,32].forEach(x => g.fillRect(X(x),29,2,8));
      g.fillStyle(blood); g.fillEllipse(X(24),35,12,4);
      // collo + testa piccola e infossata
      g.fillStyle(skSh); g.fillRoundedRect(X(16),9,16,10,4);
      g.fillStyle(skSh); g.fillEllipse(X(23),6,26,14);
      g.fillStyle(sk);   g.fillEllipse(X(23),6,22,11);
      g.fillStyle(skHi); g.fillEllipse(X(17),2,9,6);
      // cresta ossea
      g.fillStyle(skSh); g.fillEllipse(X(23),1,20,6);
      [14,18,22,26,30].forEach(x => g.fillTriangle(X(x),1,X(x+3),1,X(x+1.5),4));
      // occhi rossi infossati
      g.fillStyle(0x100000); g.fillEllipse(X(16),6,8,6); g.fillEllipse(X(30),6,8,6);
      g.fillStyle(eye); g.fillEllipse(X(16),6,4.5,3.5); g.fillEllipse(X(30),6,4.5,3.5);
      g.fillStyle(0xff9977); g.fillCircle(X(15),5,1.4); g.fillCircle(X(29),5,1.4);
      // mascella + zanne + sangue
      g.fillStyle(0x180000); g.fillEllipse(X(23),12,20,6);
      g.fillStyle(bone);
      [14,18,23,28,32].forEach(x => g.fillTriangle(X(x),9,X(x+3),9,X(x+1.5),14));
      [16,21,26,30].forEach(x => g.fillTriangle(X(x),16,X(x+3),16,X(x+1.5),11));
      g.fillStyle(blood); g.fillRect(X(19),14,3,7); g.fillRect(X(27),14,2,6);
    }
    g.generateTexture('zombie_giant',144,66); AF('zombie_giant',48,66,3); g.destroy();
  }

  // ════════════════════════════════════════════════════════════════════════
  // BOSS — texture dedicate (silhouette propria per ciascuno). Vedi §6.7 della
  // Art Bible zombi. Gameplay/hitbox restano in BOSS_CONFIG (bodyW/bodyH).
  // ════════════════════════════════════════════════════════════════════════

  // ── BOSS · MEGA MUTANTE "La Madre" (56×70 × 3) — alveare che partorisce ─────
  {
    const g = OS_G(168,70);
    const mem=0x3f6b3a, memHi=0x5fa84a, memSh=0x21401e, livid=0x4a3a52;
    // accento emissivo BLOOD-RED (firma distinta dalla Bestia verde; lega ai comuni dagli occhi rossi che genera)
    const sac=0x8fd86a, glow=0xff5a3a, vein=0xff3020, nucleus=0xffe6d0;
    const emb=0x6e4a3a, embHi=0x9a6a4a, bone=0xd9cba6, maw=0x140604, eye=0xff3a1e;
    for (let f = 0; f < 3; f++) {
      const ox = f * 56, ph = f - 1; const X = (x: number) => ox + x; const p2 = ph * 2;
      g.fillStyle(0x000000,0.34); g.fillEllipse(X(28),67,50,9);
      // piedi tozzi affondati
      g.fillStyle(0x120c08); g.fillEllipse(X(18-ph),64,12,7); g.fillEllipse(X(38+ph),64,12,7);
      g.fillStyle(memSh); g.fillRoundedRect(X(13-ph),52,12,12,5); g.fillRoundedRect(X(31+ph),52,12,12,5);
      g.fillStyle(mem);   g.fillRoundedRect(X(14-ph),52,9,10,4); g.fillRoundedRect(X(32+ph),52,9,10,4);
      // VENTRE-UTERO bulboso e ASIMMETRICO (gancio: sacca che partorisce)
      const bw = 46 + Math.abs(ph) * 2;
      g.fillStyle(memSh); g.fillEllipse(X(27),46,bw+3,40);
      g.fillStyle(memSh); g.fillEllipse(X(17),53,24,22);          // lobo basso-sx → profilo a goccia, non simmetrico
      g.fillStyle(mem);   g.fillEllipse(X(27),45,bw,37);
      g.fillStyle(mem);   g.fillEllipse(X(17),52,21,19);
      g.fillStyle(memHi); g.fillEllipse(X(19),38,18,14);
      g.fillStyle(livid,0.55); g.fillEllipse(X(38),56,16,12);     // livor mortis nella metà bassa (§3.1)
      // membrana traslucida + pod-embrioni luminosi
      g.fillStyle(sac,0.45); g.fillEllipse(X(26),47,bw-8,30);
      const pods: [number,number,number][] = [[16,46,5],[33,42,4],[24,54,5],[39,50,3],[12,54,3]];
      pods.forEach(([x,y,r]) => {
        g.fillStyle(memSh); g.fillCircle(X(x),y,r+1);
        g.fillStyle(glow,0.85); g.fillCircle(X(x),y,r);
        g.fillStyle(nucleus,0.9); g.fillCircle(X(x-1),y-1,r*0.45);
      });
      // vene emissive che si diramano
      g.fillStyle(vein,0.6); g.fillRect(X(27),30,1,24); g.fillRect(X(18),40,12,1); g.fillRect(X(27),48,14,1);
      // BOCCA-UTERO che PARTORISCE: la testa rompe il PROFILO inferiore (gancio in silhouette)
      g.fillStyle(memSh); g.fillEllipse(X(28),63,24,16);          // labbra del parto che sporgono dal ventre
      g.fillStyle(maw);   g.fillEllipse(X(28),64,17,11);
      g.fillStyle(emb);   g.fillCircle(X(28),66,6);               // testa emergente SOTTO la linea del ventre
      g.fillStyle(embHi); g.fillCircle(X(26),64,2.4);
      g.fillStyle(eye);   g.fillCircle(X(26),66,1.3); g.fillCircle(X(30),66,1.3);
      g.fillStyle(bone);  [22,26,30,34].forEach(x => g.fillTriangle(X(x),60,X(x+2),60,X(x+1),63));
      g.fillStyle(emb);   g.fillEllipse(X(16),67,7,4);            // bracciolo dell'embrione che spunta
      g.fillStyle(embHi); g.fillCircle(X(13),67,2);
      // braccia ASIMMETRICHE: sx grande protesa in basso, dx ridotta a moncone (rompe il read "umanoide a 2 braccia")
      const laY = 33 + p2, raY = 24 - p2;
      g.fillStyle(memSh); g.fillEllipse(X(5),laY,15,10); g.fillStyle(mem); g.fillEllipse(X(6),laY-1,11,7);
      g.fillStyle(memSh); g.fillCircle(X(3),laY+6,4); g.fillStyle(mem); g.fillCircle(X(3),laY+6,2.4);
      g.fillStyle(memSh); g.fillEllipse(X(50),raY,10,7); g.fillStyle(mem); g.fillEllipse(X(50),raY-1,7,4);
      // torso superiore + TUMORE-spalla (asimmetria)
      g.fillStyle(memSh); g.fillRoundedRect(X(12),16,32,20,9);
      g.fillStyle(mem);   g.fillRoundedRect(X(14),17,28,17,8);
      g.fillStyle(memHi); g.fillEllipse(X(22),22,12,7);
      g.fillStyle(memSh); g.fillEllipse(X(45),16,20,17);
      g.fillStyle(mem);   g.fillEllipse(X(45),15,16,13);
      g.fillStyle(memSh); g.fillEllipse(X(49),20,8,7);            // ombra (no livor in alto, §3.1)
      g.fillStyle(glow,0.4); g.fillCircle(X(45),14,2.2);          // pustola sottotono: il faro sono gli occhi
      g.fillStyle(nucleus,0.6); g.fillCircle(X(44),13,1);
      // suture sul torso
      g.fillStyle(0x152a12); g.fillRect(X(28),18,1,16);
      g.fillStyle(0x2a5a24); [20,24,28,32].forEach(y => g.fillRect(X(25),y,7,1));
      // testa piccola inclinata (bassa, a sx)
      g.fillStyle(memSh); g.fillEllipse(X(19),12,18,14);
      g.fillStyle(mem);   g.fillEllipse(X(19),11,15,11);
      g.fillStyle(memHi); g.fillEllipse(X(14),7,7,5);
      g.fillStyle(memSh); g.fillEllipse(X(23),16,6,4);            // ombra del mento (lato basso-dx, §3.2)
      // occhi luminosi + bocca
      g.fillStyle(0x081404); g.fillEllipse(X(15),11,5,4); g.fillEllipse(X(23),11,5,4);
      g.fillStyle(eye); g.fillEllipse(X(15),11,2.6,2.2); g.fillEllipse(X(23),11,2.4,2);
      g.fillStyle(nucleus); g.fillCircle(X(14),10,1); g.fillCircle(X(22),10,1);
      g.fillStyle(0x0a1a06); g.fillEllipse(X(19),16,7,3);
      g.fillStyle(bone); [16,19,22].forEach(x => g.fillTriangle(X(x),15,X(x+2),15,X(x+1),17));
    }
    g.generateTexture('boss_mega_mutant',168,70); AF('boss_mega_mutant',56,70,3); g.destroy();
  }

  // ── BOSS · VERME GIGANTE "Il Divoratore" (96×44 × 3) — segmentato con fauci ──
  {
    const g = OS_G(288,44);
    const wf=0x9a5a2e, wfHi=0xc87a3a, wfSh=0x5a2e14, ring=0x3a1d0e, livid=0x5a4e63;
    const maw=0x1a0a06, glow=0xff7722, hot=0xffd06a, bone=0xd9c8a0, eye=0xff8a3a, slime=0xc89a5a;
    const seg: [number,number][] = [[34,17],[48,16],[60,14],[71,12],[80,10],[88,7]];
    for (let f = 0; f < 3; f++) {
      const ox = f * 96, ph = f - 1; const X = (x: number) => ox + x;
      const wy = (i: number) => 23 + Math.sin(i * 0.8 + ph * 1.2) * 4; // ondulazione viaggiante
      g.fillStyle(0x000000,0.28); g.fillEllipse(X(54),40,84,7);
      // dal fondo (coda) verso la testa: la testa copre i segmenti dietro
      for (let i = seg.length - 1; i >= 0; i--) {
        const [sx,r] = seg[i]; const sy = wy(i+1);
        g.fillStyle(wfSh); g.fillEllipse(X(sx),sy+1,r*2+2,r*2);
        g.fillStyle(wf);   g.fillEllipse(X(sx),sy,r*2,r*2-2);
        g.fillStyle(ring); g.fillEllipse(X(sx+r-2),sy+1,3,r*2-3); // solco sul lato trailing/basso (§3.2)
        g.fillStyle(wfHi); g.fillEllipse(X(sx-2),sy-r*0.5,r*0.8,r*0.5);
        g.fillStyle(livid,0.4); g.fillEllipse(X(sx),sy+r*0.6,r*0.7,r*0.4);
      }
      g.fillStyle(slime,0.3); g.fillEllipse(X(44),wy(2)-6,6,3); g.fillEllipse(X(64),wy(3)-5,5,2);
      // TESTA + FAUCI radiali (gancio)
      const hy = wy(0);
      g.fillStyle(wfSh); g.fillEllipse(X(16),hy+1,36,36);
      g.fillStyle(wf);   g.fillEllipse(X(16),hy,32,32);
      g.fillStyle(wfHi); g.fillEllipse(X(9),hy-8,11,8);
      g.fillStyle(wfSh); g.fillEllipse(X(20),hy+9,16,11);
      // gola spalancata
      g.fillStyle(maw); g.fillCircle(X(13),hy,13);
      g.fillStyle(0x3a1206); g.fillCircle(X(13),hy,9);
      g.fillStyle(glow,0.8); g.fillCircle(X(13),hy,5);
      g.fillStyle(hot,0.9); g.fillCircle(X(12),hy-1,2.4);
      // denti radiali (anello di zanne verso il centro)
      const teeth = 10;
      g.fillStyle(bone);
      for (let k = 0; k < teeth; k++) {
        const a = (k / teeth) * Math.PI * 2;
        const cx = 13 + Math.cos(a) * 12, cy = hy + Math.sin(a) * 12;
        const ixp = 13 + Math.cos(a) * 6, iyp = hy + Math.sin(a) * 6;
        const px = Math.cos(a + 0.25) * 2, py = Math.sin(a + 0.25) * 2;
        g.fillTriangle(X(cx-px),cy-py,X(cx+px),cy+py,X(ixp),iyp);
      }
      // occhietti semplici sui lati della testa
      g.fillStyle(0x180800); g.fillCircle(X(24),hy-9,3.4); g.fillCircle(X(26),hy+8,3);
      g.fillStyle(eye); g.fillCircle(X(24),hy-9,1.8); g.fillCircle(X(26),hy+8,1.6);
      g.fillStyle(hot); g.fillCircle(X(23),hy-10,0.8);
      // bava che cola
      g.fillStyle(slime,0.6); g.fillEllipse(X(11),hy+13,2,4);
    }
    g.generateTexture('boss_giant_worm',288,44); AF('boss_giant_worm',96,44,3); g.destroy();
  }

  // ── BOSS · COLOSSO CORAZZATO "Il Bastione" (60×74 × 3) — scudo + cannone ─────
  {
    const g = OS_G(180,74);
    const st=0x5f6b78, stHi=0x8a97a5, stSh=0x39424c, cav=0x20262c;
    const rust=0x8a4a26, rustD=0x3a1d0e, verd=0x3f6b54, bx=0x2a1410, fl=0x5a4e63;
    const eye=0xffcc22, hot=0xffe9a0;
    for (let f = 0; f < 3; f++) {
      const ox = f * 60, ph = f - 1; const X = (x: number) => ox + x;
      g.fillStyle(0x000000,0.36); g.fillEllipse(X(30),71,52,9);
      // gambe corazzate (tonfo: alternanza verticale)
      g.fillStyle(cav); g.fillEllipse(X(22-ph),69,15,7); g.fillEllipse(X(40+ph),69,15,7);
      g.fillStyle(stSh); g.fillRoundedRect(X(16),52+ph*2,14,16,4); g.fillRoundedRect(X(32),52-ph*2,14,16,4);
      g.fillStyle(st);   g.fillRoundedRect(X(17),52+ph*2,11,14,3); g.fillRoundedRect(X(33),52-ph*2,11,14,3);
      g.fillStyle(stHi); g.fillRect(X(18),54+ph*2,3,9); g.fillRect(X(34),54-ph*2,3,9);
      g.fillStyle(rust,0.7); g.fillRect(X(24),58,1,8); g.fillRect(X(40),58,1,8);
      g.fillStyle(fl,0.6); g.fillEllipse(X(23),52,4,3); g.fillEllipse(X(39),52,4,3);
      // TORSO corazzato (blocco top-heavy)
      g.fillStyle(stSh); g.fillRoundedRect(X(10),24,40,30,8);
      g.fillStyle(st);   g.fillRoundedRect(X(12),25,36,27,7);
      g.fillStyle(stHi); g.fillRoundedRect(X(14),27,14,10,4);
      g.fillStyle(stSh); g.fillRect(X(30),26,1,26);
      g.fillStyle(cav); [[15,30],[45,30],[15,48],[45,48]].forEach(([x,y]) => g.fillCircle(X(x),y,1.6));         // 4 rivetti "eroe" (no griglia fitta, §9)
      g.fillStyle(stHi,0.6); [[15,30],[45,30],[15,48],[45,48]].forEach(([x,y]) => g.fillCircle(X(x-0.6),y-0.6,0.8));
      g.fillStyle(rust,0.8); g.fillRect(X(20),34,2,16); g.fillRect(X(38),30,2,20);
      g.fillStyle(rustD,0.7); g.fillRect(X(20),44,2,6); g.fillRect(X(38),44,2,6);
      g.fillStyle(verd,0.5); g.fillRect(X(12),48,36,2); g.fillRect(X(13),25,34,1.5);
      g.fillStyle(bx,0.6); g.fillEllipse(X(34),40,7,5);
      // spallaccio a cupola sx (sopra lo scudo)
      g.fillStyle(stSh); g.fillEllipse(X(13),24,18,14);
      g.fillStyle(st);   g.fillEllipse(X(13),23,14,11);
      g.fillStyle(stHi); g.fillEllipse(X(9),19,6,4);
      g.fillStyle(rust,0.6); g.fillRect(X(10),24,1,6);
      // spallaccio dx
      g.fillStyle(stSh); g.fillEllipse(X(46),22,16,13);
      g.fillStyle(st);   g.fillEllipse(X(46),21,12,10);
      g.fillStyle(stHi); g.fillEllipse(X(43),18,5,4);
      // CANNONE su spalla destra (gancio 2) — disegnato SOPRA lo spallaccio così la canna emerge
      g.lineStyle(9, stSh); g.lineBetween(X(42),21,X(53),9);
      g.lineStyle(6, st);   g.lineBetween(X(42),21,X(52),10);
      g.lineStyle(2, stHi); g.lineBetween(X(43),19,X(50),11);
      g.fillStyle(cav);     g.fillCircle(X(53),9,4);
      g.fillStyle(eye,0.4); g.fillCircle(X(53),9,2);             // brace sottotono: il faro è la visiera
      g.fillStyle(hot,0.7); g.fillCircle(X(52.5),8.5,0.8);
      // ELMO a cupola + visiera luminosa
      g.fillStyle(stSh); g.fillRoundedRect(X(20),8,20,18,7);
      g.fillStyle(st);   g.fillRoundedRect(X(21),9,18,15,6);
      g.fillStyle(stHi); g.fillEllipse(X(26),13,7,5);
      g.fillStyle(cav);  g.fillRoundedRect(X(22),16,16,5,2);
      g.fillStyle(eye,0.25); g.fillEllipse(X(30),18,20,7);       // alone della visiera = faro emissivo dominante
      g.fillStyle(eye);  g.fillRect(X(24),17,12,2.6);
      g.fillStyle(hot);  g.fillRect(X(25),17,5,2);
      g.fillStyle(stSh); g.fillRect(X(30),16,1,5);
      g.fillStyle(cav); g.fillEllipse(X(30),24,6,3);
      g.fillStyle(verd,0.5); g.fillRect(X(22),9,16,1);
      // SCUDO antisommossa enorme (gancio 1) sul braccio sx
      g.fillStyle(stSh); g.fillRoundedRect(X(8),34,8,16,3);
      g.fillStyle(stSh); g.fillTriangle(X(5),11,X(21),14,X(1),57); g.fillTriangle(X(21),14,X(21),55,X(1),57);
      g.fillStyle(st);   g.fillTriangle(X(7),14,X(19),16,X(4),54); g.fillTriangle(X(19),16,X(19),53,X(4),54);
      g.fillStyle(stHi); g.fillTriangle(X(8),16,X(12),17,X(6),40);
      g.fillStyle(cav);  g.fillRect(X(9),22,8,3);
      g.fillStyle(rust,0.7); g.fillRect(X(6),30,2,18); g.fillRect(X(14),20,1,28);
      g.fillStyle(stHi,0.5); g.fillRect(X(10),34,7,1);
      g.fillStyle(bx,0.5); g.fillEllipse(X(12),46,5,7);
      g.fillStyle(stSh); g.fillCircle(X(11),34,4); g.fillStyle(st); g.fillCircle(X(11),34,3); g.fillStyle(stHi); g.fillCircle(X(10),33,1.2);
    }
    g.generateTexture('boss_armored_colossus',180,74); AF('boss_armored_colossus',60,74,3); g.destroy();
  }

  // ── BOSS · BESTIA RADIOATTIVA "Il Reattore" (72×56 × 3) — bruto bioluminescente ──
  {
    const g = OS_G(216,56);
    const hd=0x3f7a33, hdHi=0x5fa84a, hdSh=0x1e3a18, bl=0x9aa83e, livid=0x3a4a2a;
    const core=0x7dff4a, nucleus=0xeaffd6, mid=0xb6ff6a, bone=0xd9c8a0, ooze=0x6cff3a, eye=0xb6ff6a;
    for (let f = 0; f < 3; f++) {
      const ox = f * 72, ph = f - 1; const X = (x: number) => ox + x;
      const fl = ph * 3;
      g.fillStyle(0x000000,0.30); g.fillEllipse(X(38),52,64,8);
      // zampe posteriori (dx): DUE punti d'appoggio distinti → lettura quadrupede netta
      g.fillStyle(hdSh); g.fillRoundedRect(X(49+ph),36,8,16,4); g.fillStyle(hd); g.fillRoundedRect(X(50+ph),36,5,14,3);
      g.fillStyle(0x101808); g.fillEllipse(X(52+ph),52,8,3);
      g.fillStyle(hdSh); g.fillRoundedRect(X(60-ph),35,9,17,4); g.fillStyle(hd); g.fillRoundedRect(X(61-ph),35,6,15,3);
      g.fillStyle(0x101808); g.fillEllipse(X(63-ph),52,8,3);
      g.fillStyle(bone); [60,63,66].forEach(x => g.fillTriangle(X(x-ph),50,X(x+1.5-ph),50,X(x+0.7-ph),53));
      // zampe anteriori (sx, lunghe e protese) controfase
      g.fillStyle(hdSh); g.fillRoundedRect(X(14-fl),30,8,20,3); g.fillStyle(hd); g.fillRoundedRect(X(15-fl),30,5,18,3);
      g.fillStyle(hdHi); g.fillRect(X(16-fl),32,2,10);
      g.fillStyle(0x101808); g.fillEllipse(X(16-fl),50,9,4);
      g.fillStyle(bone); [12,15,18].forEach(x => g.fillTriangle(X(x-fl),49,X(x+1.5-fl),49,X(x+0.7-fl),54));
      // seconda zampa anteriore (più dietro, in ombra)
      g.fillStyle(hdSh); g.fillRoundedRect(X(24+fl),32,7,18,3);
      g.fillStyle(0x0c1406); g.fillEllipse(X(26+fl),50,8,3);
      // TORSO arcuato (massa bassa)
      g.fillStyle(hdSh); g.fillEllipse(X(38),31,52,30);
      g.fillStyle(hd);   g.fillEllipse(X(38),30,48,27);
      g.fillStyle(hdHi); g.fillEllipse(X(28),22,16,9);
      g.fillStyle(livid,0.5); g.fillEllipse(X(48),38,14,9);
      g.fillStyle(bl,0.6); g.fillEllipse(X(44),24,8,5); g.fillEllipse(X(30),34,6,4);
      // SPINA-REATTORE esposta (gancio: nucleo luminoso)
      g.fillStyle(0x0a1606); g.fillEllipse(X(36),18,40,10);
      g.fillStyle(core,0.25); g.fillEllipse(X(36),18,44,16);
      g.fillStyle(bone); [20,27,34,41,48].forEach(x => g.fillTriangle(X(x),20,X(x+4),20,X(x+2),12));
      const pulse = 2 + Math.abs(ph);
      [23,30,37,44].forEach((x,i) => {
        g.fillStyle(core,0.9); g.fillCircle(X(x),17,3.4 + (i === 1 ? pulse * 0.4 : 0));
        g.fillStyle(mid); g.fillCircle(X(x),17,2);
        g.fillStyle(nucleus); g.fillCircle(X(x-0.6),16,0.9);
      });
      g.fillStyle(core,0.5); g.fillRect(X(30),20,1,14); g.fillRect(X(44),20,1,12);
      // TESTA bassa protesa (sx)
      const hy = 34;
      g.fillStyle(hdSh); g.fillEllipse(X(12),hy,20,16);
      g.fillStyle(hd);   g.fillEllipse(X(12),hy-1,17,13);
      g.fillStyle(hdHi); g.fillEllipse(X(8),hy-5,7,5);
      g.fillStyle(hdSh); g.fillTriangle(X(2),hy-2,X(2),hy+5,X(10),hy+2);
      g.fillStyle(hd);   g.fillTriangle(X(3),hy-1,X(3),hy+4,X(10),hy+1);
      // fauci + zanne
      g.fillStyle(0x0a1404); g.fillEllipse(X(8),hy+4,12,5);
      g.fillStyle(bone); [4,7,10,13].forEach(x => g.fillTriangle(X(x),hy+2,X(x+2),hy+2,X(x+1),hy+6));
      g.fillStyle(ooze,0.6); g.fillEllipse(X(7),hy+8,2,4);
      // occhi luminosi
      g.fillStyle(0x0c1a04); g.fillEllipse(X(10),hy-3,5,4); g.fillEllipse(X(16),hy-2,4,3);
      g.fillStyle(eye); g.fillEllipse(X(10),hy-3,2.4,2); g.fillEllipse(X(16),hy-2,2,1.7);
      g.fillStyle(nucleus); g.fillCircle(X(9),hy-4,0.9); g.fillCircle(X(15),hy-3,0.8);
      // corna/spine corte sopra la testa
      g.fillStyle(hdSh); g.fillTriangle(X(14),hy-9,X(18),hy-9,X(15),hy-16);
      g.fillStyle(bone); g.fillTriangle(X(15),hy-10,X(17),hy-10,X(15.6),hy-15);
      // coda corta (dx)
      g.fillStyle(hdSh); g.fillTriangle(X(60),28,X(70+ph),24,X(62),34);
      g.fillStyle(hd);   g.fillTriangle(X(61),28,X(68+ph),26,X(62),32);
      g.fillStyle(core,0.4); g.fillCircle(X(68+ph),25,2);
    }
    g.generateTexture('boss_radioactive_beast',216,56); AF('boss_radioactive_beast',72,56,3); g.destroy();
  }

  // ── BULLET (18×5) — tracer AAA · sovracampionato (OS_G) · tinta a runtime ──
  // Scia di velocità a sinistra, nucleo bianco caldo (prende la tinta dell'arma),
  // punta luminosa a destra = direzione inequivocabile (§4.4). Luce dall'alto.
  {
    const g = OS_G(18,5);
    // 1) scia di velocità (alone caldo che si assottiglia a sinistra)
    g.fillStyle(0xffdd00,0.16); g.fillTriangle(0,2.5, 10,1.1, 10,3.9);
    g.fillStyle(0xffcc33,0.30); g.fillTriangle(3,2.5, 11,1.6, 11,3.4);
    // 2) alone morbido attorno al corpo
    g.fillStyle(0xffdd00,0.38); g.fillRoundedRect(7,0.4,10.5,4.2,2);
    // 3) culatta in ottone (rear del proietto)
    g.fillStyle(0x886600); g.fillRoundedRect(8,1.2,3.4,2.6,1);
    g.fillStyle(0xaa8800); g.fillRoundedRect(8,1.0,3.4,2.2,1);
    g.fillStyle(0xd4aa44); g.fillRect(8.4,1.0,2.6,0.7);
    // 4) nucleo bianco caldo (qui si legge la tinta dell'arma)
    g.fillStyle(0xffffff); g.fillRoundedRect(10.5,1.0,5.2,3.0,1.4);
    g.fillStyle(0xfff2c0); g.fillRect(11,3.1,4.4,0.9);   // fondo più caldo (luce dall'alto)
    // 5) punta + nucleo della punta (accento emissivo + direzione)
    g.fillStyle(0xffee44); g.fillTriangle(15.2,0.5, 15.2,4.5, 18,2.5);
    g.fillStyle(0xffffff); g.fillTriangle(15.6,1.3, 15.6,3.7, 17.7,2.5);
    g.generateTexture('bullet', 18, 5);
    g.destroy();
  }

  // ── FUEL CAN (22×26) — jerry-can AAA · sovracampionata (OS_G) ──────────────
  // Pickup = "il timer della corsa": deve gridare "benzina, prendimi" nel caos.
  // Luce da alto-sinistra, costole pressate, kit metallo condiviso (§3.2) su
  // maniglia/beccuccio, etichetta di pericolo gialla come gancio di lettura.
  {
    const g = OS_G(22,26);
    // Ombra di contatto a terra (la stacca dall'asfalto, come il veicolo)
    g.fillStyle(0x000000,0.22); g.fillEllipse(11,25,18,4);
    // Corpo: ombra profonda → base rossa → mezzo-tono e luce da alto-sinistra
    g.fillStyle(0x5e1000); g.fillRoundedRect(2,5,18,19,{tl:4,tr:4,bl:2,br:2});
    g.fillStyle(0xcc3300); g.fillRoundedRect(2,5,17,18,{tl:4,tr:4,bl:2,br:1});
    g.fillStyle(0xe23d12); g.fillRoundedRect(2,5,9,18,{tl:4,tr:0,bl:2,br:0});
    g.fillStyle(0xff5530); g.fillRect(3,7,4,15); g.fillRect(4,6,12,2);
    g.fillStyle(0xff8a5c,0.7);  g.fillRect(3,6,1,15);
    g.fillStyle(0xff8a5c,0.55); g.fillRect(4,6,11,1);
    // Ombra sul lato destro / fondo (basso-destra)
    g.fillStyle(0x8a1c00); g.fillRect(17,7,2,15);
    g.fillStyle(0x6e1400); g.fillRect(4,21,13,2);
    // Costole laterali pressate (convesse: luce a sinistra, ombra a destra)
    g.fillStyle(0xff7a52); g.fillRect(4,9,1,11); g.fillStyle(0x7a1600); g.fillRect(5,9,1,11);
    g.fillStyle(0xff6a44); g.fillRect(15,9,1,11); g.fillStyle(0x701400); g.fillRect(16,9,1,11);
    // Piede inferiore
    g.fillStyle(0x4a0c00); g.fillRoundedRect(2,22,17,3,{tl:0,tr:0,bl:2,br:1});
    g.fillStyle(0x8a1c00); g.fillRect(4,22,12,1);
    // Collare / tappo
    g.fillStyle(0x7a1800); g.fillRoundedRect(3,3,15,4,1);
    g.fillStyle(0xa8300a); g.fillRoundedRect(3,3,14,3,1);
    g.fillStyle(0xcc4a1e); g.fillRect(4,4,12,1);
    // Maniglia — kit metallo condiviso (§3.2) + specular
    g.fillStyle(0x26262c); g.fillRoundedRect(3,1,9,3,1);
    g.fillStyle(0x4a4a52); g.fillRoundedRect(3,1,9,2,1);
    g.fillStyle(0x70707a); g.fillRect(4,1,7,1);
    g.fillStyle(0xa6a6b0,0.8); g.fillRect(4,1,3,1);
    // Beccuccio — kit metallo, con imbocco chiaro + riflesso speculare
    g.fillStyle(0x26262c); g.fillRect(13,1,7,4);
    g.fillStyle(0x4a4a52); g.fillRect(13,1,6,3);
    g.fillStyle(0x70707a); g.fillRect(14,2,4,1);
    g.fillStyle(0x9a9aa4); g.fillRect(17,0,3,2);
    g.fillStyle(0xa6a6b0,0.9); g.fillCircle(18,1,1);
    // Etichetta di pericolo gialla (il gancio di lettura a distanza)
    g.fillStyle(0xb89000); g.fillRoundedRect(6,10,8,8,1);
    g.fillStyle(0xffdd00); g.fillRoundedRect(6,10,8,7,1);
    g.fillStyle(0xffee66); g.fillRect(7,10,6,1);
    // Simbolo fiamma (rosso → arancio → nucleo caldo)
    g.fillStyle(0xcc1800); g.fillTriangle(10,11, 7.5,16.2, 12.5,16.2);
    g.fillStyle(0xff3300); g.fillTriangle(10,12, 8.3,16, 11.7,16);
    g.fillStyle(0xffcc00); g.fillTriangle(10,13.6, 9,15.8, 11,15.8);
    g.fillStyle(0xcc1800); g.fillRect(8,16,4,1);
    g.generateTexture('fuel_can', 22, 26);
    g.destroy();
  }

  // ── PARTICLE (12×12) — mote caldo AAA · VFX condiviso · tinta a runtime ─────
  // Falloff radiale morbido (alone → nucleo bianco) + glint a croce per la lettura
  // "scintilla" (§4.6). Base bianco-calda: tinge pulito su qualsiasi colore (debris
  // metallici grigi, schegge verdi, scintille arancio…).
  {
    const g = G(12,12);
    // alone radiale (dal bordo morbido al nucleo incandescente)
    g.fillStyle(0xff6600,0.22); g.fillCircle(6,6,6);
    g.fillStyle(0xff8800,0.35); g.fillCircle(6,6,5);
    g.fillStyle(0xffaa00,0.55); g.fillCircle(6,6,3.8);
    g.fillStyle(0xffcc33,0.85); g.fillCircle(6,6,2.6);
    g.fillStyle(0xffee88);      g.fillCircle(6,6,1.7);
    g.fillStyle(0xffffff);      g.fillCircle(6,6,1.0);
    // glint a croce (assottigliato verso le punte) — la "scintilla"
    g.fillStyle(0xfff4cc,0.30); g.fillRect(1,5.7,10,0.6); g.fillRect(5.7,1,0.6,10);
    g.fillStyle(0xffffff,0.55); g.fillRect(3,5.85,6,0.3); g.fillRect(5.85,3,0.3,6);
    g.generateTexture('particle', 12, 12);
    g.destroy();
  }

  // ── ROCKET (28×12) — missile AAA · sovracampionato (OS_G) ───────────────────
  // Vola a destra, fiamma in coda a sinistra (CONTENUTA nella texture). Corpo
  // acciaio top-lit con rivetti/giunti, testata rossa con gradiente, ogiva a punta,
  // ugello in kit metallo (§3.2) con bagliore caldo, alette (§4.5).
  {
    const g = OS_G(28,12);
    // ── Fiamma di scarico (coda, a sinistra) — strati che si appuntano a sx
    g.fillStyle(0xff5500,0.85); g.fillTriangle(0,6, 7,2.5, 7,9.5);
    g.fillStyle(0xff8800,0.90); g.fillTriangle(1,6, 7,3.6, 7,8.4);
    g.fillStyle(0xffcc33,1.0);  g.fillTriangle(2.5,6, 7,4.4, 7,7.6);
    g.fillStyle(0xffffff,1.0);  g.fillTriangle(4.5,6, 7,5.0, 7,7.0);
    g.fillStyle(0xff8800,0.6);  g.fillTriangle(0.5,4.4, 4,3.2, 4,5.2); // lingue di fiamma
    g.fillStyle(0xff8800,0.6);  g.fillTriangle(0.5,7.6, 4,6.8, 4,8.8);
    // ── Ugello (kit metallo §3.2) + bagliore interno caldo
    g.fillStyle(0x26262c); g.fillRect(6,3.5,3.5,5);
    g.fillStyle(0x444444); g.fillRect(6.5,4.0,3.0,4.0);
    g.fillStyle(0x70707a); g.fillRect(8.4,4.0,1.1,4.0);            // rim destro
    g.fillStyle(0xffcc66,0.8); g.fillRect(6.3,5.1,1.2,1.8);        // glow interno
    // ── Corpo (cilindro d'acciaio top-lit)
    g.fillStyle(0x8e8e98); g.fillRoundedRect(9,3.0,13,6.0,1);      // ombra base
    g.fillStyle(0xcfcfd6); g.fillRoundedRect(9,3.0,13,5.0,1);      // mezzo-tono
    g.fillStyle(0xeeeef2); g.fillRect(9.5,3.2,12,1.6);            // banda di luce in cima
    g.fillStyle(0xf8f8fc); g.fillRect(9.5,3.2,7,0.8);            // picco di luce (fronte)
    g.fillStyle(0x70707a); g.fillRect(9.5,7.8,12,0.9);            // ombra inferiore
    // giunti, rivetti, banda di colore (materia/storia)
    g.fillStyle(0x70707a); g.fillRect(13,3.4,0.6,5.0); g.fillRect(17,3.4,0.6,5.0);
    g.fillStyle(0x55555c); g.fillCircle(11,7.0,0.5); g.fillCircle(15,7.0,0.5); g.fillCircle(19,7.0,0.5);
    g.fillStyle(0xf8f8fc); g.fillCircle(11,4.2,0.4); g.fillCircle(15,4.2,0.4); g.fillCircle(19,4.2,0.4);
    g.fillStyle(0xcc2200); g.fillRect(12.5,3.0,1.4,5.6);          // banda rossa
    // ── Testata (rossa, gradiente top-lit)
    g.fillStyle(0xaa1800); g.fillRoundedRect(21,2.5,6,7.0,{tl:1,tr:2,bl:1,br:2});
    g.fillStyle(0xcc2200); g.fillRoundedRect(21,2.5,6,6.0,{tl:1,tr:2,bl:0,br:1});
    g.fillStyle(0xff4422); g.fillRect(21.5,3.0,5.0,2.4);
    g.fillStyle(0xff7755); g.fillRect(21.5,3.0,4.0,1.0);          // luce in cima
    g.fillStyle(0x8a1000); g.fillRect(21,8.0,5.5,1.2);           // ombra in basso
    g.fillStyle(0x6a0c00); g.fillRect(20.6,2.8,0.7,6.4);         // giunto corpo/testata
    // ── Ogiva a punta (direzione + pericolo)
    g.fillStyle(0xbb1100); g.fillTriangle(26.5,2.2, 26.5,9.8, 28,6);
    g.fillStyle(0xff5533); g.fillTriangle(26.5,3.0, 26.5,5.5, 27.8,6); // spigolo illuminato
    // ── Alette (acciaio, sopra/sotto al retro del corpo)
    g.fillStyle(0x55555c); g.fillTriangle(9,3.0, 9,0.6, 13.5,3.0);
    g.fillStyle(0x8e8e98); g.fillTriangle(9.4,3.0, 9.4,1.3, 12.8,3.0);
    g.fillStyle(0x44444a); g.fillTriangle(9,9.0, 9,11.4, 13.5,9.0);
    g.fillStyle(0x70707a); g.fillTriangle(9.4,9.0, 9.4,10.7, 12.8,9.0);
    g.generateTexture('rocket', 28, 12);
    g.destroy();
  }

  // ── TOXIC CLOUD (50×50) — minaccia residua AAA ──────────────────────────────
  // Sacca di gas verde-tossico: silhouette IRREGOLARE (blob sovrapposti, non un
  // disco), bolle di ebollizione, nucleo malato denso (§4.7). Tutto a bassa alpha →
  // resta gas traslucido, tinge e sfuma bene (riuso anche nella morte del Reattore).
  {
    const g = G(50,50);
    // corpo morbido — blob irregolari sovrapposti (lettura "gas", non cerchio)
    g.fillStyle(0x003300,0.14); g.fillCircle(25,25,24);
    g.fillStyle(0x004d11,0.16); g.fillCircle(22,27,22); g.fillCircle(29,22,20);
    g.fillStyle(0x006600,0.20); g.fillCircle(25,25,18);
    g.fillStyle(0x008822,0.22); g.fillCircle(20,21,13); g.fillCircle(31,24,12); g.fillCircle(24,31,12);
    g.fillStyle(0x00aa33,0.26); g.fillCircle(25,24,12);
    g.fillStyle(0x00cc44,0.28); g.fillCircle(23,23,8); g.fillCircle(28,27,7);
    // bolle di ebollizione (boil tossico) — mote più brillanti
    g.fillStyle(0x33dd55,0.5);  g.fillCircle(21,22,2.4); g.fillCircle(30,26,2.0); g.fillCircle(26,30,1.8); g.fillCircle(27,20,1.6);
    // nucleo malato denso + nucleo incandescente
    g.fillStyle(0x00ff55,0.22); g.fillCircle(25,25,7);
    g.fillStyle(0x44ff88,0.30); g.fillCircle(25,25,4);
    g.fillStyle(0x88ffaa,0.50); g.fillCircle(24,24,1.8);
    g.generateTexture('toxic_cloud', 50, 50);
    g.destroy();
  }

  // ── Animazioni di camminata (ciclo 0=passo sx · 1=neutro · 2=passo dx) ──────
  const walk = (type: string, rate: number) => {
    const key = `walk_${type}`;
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: [
        { key: `zombie_${type}`, frame: 0 },
        { key: `zombie_${type}`, frame: 1 },
        { key: `zombie_${type}`, frame: 2 },
        { key: `zombie_${type}`, frame: 1 },
      ],
      frameRate: rate, repeat: -1,
    });
  };
  walk('common', 5);
  walk('runner', 12);
  walk('armored', 4);
  walk('jumper', 9);
  walk('toxic', 4);
  walk('giant', 3.5);

  // Animazioni boss: stesso ciclo a 3 frame ma su texture dedicate (boss_<tipo>).
  const bwalk = (texKey: string, rate: number) => {
    const key = `walk_${texKey}`;
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: [0, 1, 2, 1].map(fr => ({ key: texKey, frame: fr })),
      frameRate: rate, repeat: -1,
    });
  };
  bwalk('boss_mega_mutant', 2.6);      // alveare che respira lento
  bwalk('boss_giant_worm', 4.5);       // ondulazione serpeggiante
  bwalk('boss_armored_colossus', 2.2); // tonfo pesante implacabile
  bwalk('boss_radioactive_beast', 5);  // andatura predatoria nervosa
}
