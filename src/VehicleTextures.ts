import Phaser from 'phaser';
import { VEHICLES } from './GameData';
import { OVERSAMPLE } from './Config';

/**
 * Authoring procedurale della texture del VEICOLO (estratto da GameScene per coesione).
 * Colore "cotto" nella texture (niente tint), vista dall'alto, sovracampionata a OVERSAMPLE×.
 */
// Interpola un colore verso un target (0xffffff per schiarire, 0x000000 per scurire)
function mixColor(color: number, target: number, t: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const tr = (target >> 16) & 0xff, tg = (target >> 8) & 0xff, tb = target & 0xff;
  const nr = Math.round(r + (tr - r) * t);
  const ng = Math.round(g + (tg - g) * t);
  const nb = Math.round(b + (tb - b) * t);
  return (nr << 16) | (ng << 8) | nb;
}

// Veicolo in vista dall'alto (top-down), colore "cotto" nella texture (niente tint)
export function buildVehicleTexture(scene: Phaser.Scene, vehicleKey: string) {
  const key = `vehicle_${vehicleKey}`;
  if (scene.textures.exists(key)) return;

  const base    = VEHICLES[vehicleKey].color;
  const light   = mixColor(base, 0xffffff, 0.30);
  const lighter = mixColor(base, 0xffffff, 0.52);
  const dark    = mixColor(base, 0x000000, 0.34);
  const darker  = mixColor(base, 0x000000, 0.58);

  const metal = 0x4a4a52, metalL = 0x70707a, metalD = 0x26262c;
  const g = scene.make.graphics({ add: false } as any) as Phaser.GameObjects.Graphics & { generateTexture(k:string,w:number,h:number):void };
  // Sovracampionamento: il veicolo è l'elemento più osservato → texture a OVERSAMPLE× (nitida
  // sotto lo zoom della camera). Il disegno resta in coordinate design; lo sprite torna a scala
  // design con setScale(1/OVERSAMPLE) in buildVehicle.
  g.setScale(OVERSAMPLE);
  { const orig = g.generateTexture.bind(g); (g as any).generateTexture = (k: string, w: number, h: number) => orig(k, w * OVERSAMPLE, h * OVERSAMPLE); }

  g.fillStyle(0x000000, 0.22); g.fillEllipse(50, 25, 96, 40);

  if (vehicleKey === 'civilian_car') {
    // ── BERLINA CIVILE ──────────────────────────────────────────────────────
    const wh: [number,number][] = [[16,2],[62,2],[16,31],[62,31]];
    g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,22,11,4));
    g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,10,15].forEach(o => g.fillRect(x+o,y+2,2,7)));
    g.fillStyle(darker); g.fillRoundedRect(7,6,86,32,{tl:8,bl:8,tr:16,br:16});
    g.fillStyle(base);   g.fillRoundedRect(8,7,84,30,{tl:7,bl:7,tr:15,br:15});
    g.fillStyle(dark);   g.fillRoundedRect(10,29,80,7,{tl:4,bl:4,tr:8,br:8});
    g.fillStyle(light);  g.fillRoundedRect(12,8,74,9,{tl:5,bl:2,tr:9,br:2});
    g.fillStyle(dark);  g.fillRect(64,15,22,1); g.fillRect(64,28,22,1);
    g.fillStyle(light); g.fillRect(66,21,18,2);
    g.fillStyle(0x0e1d29);
    g.fillPoints([{x:52,y:10},{x:64,y:14},{x:64,y:30},{x:52,y:34}],true);
    g.fillStyle(0x2c5470,0.5);
    g.fillPoints([{x:53,y:12},{x:60,y:14},{x:58,y:19},{x:53,y:17}],true);
    g.fillStyle(light);   g.fillRoundedRect(33,11,20,22,6);
    g.fillStyle(lighter); g.fillRoundedRect(35,13,16,8,4);
    g.fillStyle(dark);    g.fillRect(33,21,20,1);
    g.fillStyle(0x0e1d29);
    g.fillPoints([{x:24,y:12},{x:33,y:11},{x:33,y:33},{x:24,y:32}],true);
    g.fillStyle(0x2c5470,0.4);
    g.fillPoints([{x:25,y:13},{x:31,y:13},{x:30,y:18},{x:25,y:17}],true);
    g.fillStyle(dark); g.fillRect(20,9,1,26); g.fillRect(11,12,8,1); g.fillRect(11,31,8,1);
    g.fillStyle(base);     g.fillRoundedRect(49,3,7,4,2); g.fillRoundedRect(49,37,7,4,2);
    g.fillStyle(0x0e1d29); g.fillRect(50,4,4,2); g.fillRect(50,38,4,2);
    g.fillStyle(0xfff4bc); g.fillRoundedRect(85,9,6,5,2); g.fillRoundedRect(85,30,6,5,2);
    g.fillStyle(0xffffff); g.fillRect(86,10,3,3); g.fillRect(86,31,3,3);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(90,10,4,3); g.fillRect(90,31,4,3);
    g.fillStyle(0xcc1111); g.fillRoundedRect(8,10,4,5,1); g.fillRoundedRect(8,29,4,5,1);
    g.fillStyle(0xff4444); g.fillRect(9,11,2,3); g.fillRect(9,30,2,3);
    g.fillStyle(lighter); g.fillRoundedRect(89,16,4,12,2);
    g.fillStyle(metalD); g.fillCircle(58,22,9); g.fillStyle(metal); g.fillCircle(58,22,7);
    g.fillStyle(metalL); g.fillCircle(56,20,2.5); g.fillStyle(metalD); g.fillCircle(58,22,2);
    g.fillStyle(metalD); g.fillRect(58,18,42,8); g.fillStyle(metal); g.fillRect(58,19,42,6);
    g.fillStyle(metalL); g.fillRect(58,20,38,2);
    g.fillStyle(metalD); g.fillRect(90,17,10,10);
    g.fillStyle(0x000000); g.fillRect(91,19,8,2); g.fillRect(91,23,8,2);
    g.fillStyle(0xffffff,0.10); g.fillRoundedRect(16,7,58,3,2);

  } else if (vehicleKey === 'pickup') {
    // ── PICKUP — cabina (ant.) + pianale aperto con listoni (post.) ─────────
    const wh: [number,number][] = [[10,1],[62,1],[10,32],[62,32]];
    g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,24,12,4));
    g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,11,17].forEach(o => g.fillRect(x+o,y+2,2,8)));
    // pianale posteriore (sinistra) con listoni
    g.fillStyle(darker); g.fillRect(7,6,42,32);
    g.fillStyle(dark);   g.fillRect(8,7,40,30);
    g.fillStyle(darker); g.fillRect(8,7,40,4); g.fillRect(8,33,40,4);
    [14,20,26,32,38].forEach(x => { g.fillStyle(darker); g.fillRect(x,11,2,22); });
    g.fillStyle(base); [15,21,27,33,39].forEach(x => g.fillRect(x,11,1,22));
    // separatore cabina / pianale
    g.fillStyle(darker); g.fillRect(48,4,4,36);
    g.fillStyle(metalD); g.fillRect(49,4,2,36);
    // cabina (destra — anteriore)
    g.fillStyle(darker); g.fillRoundedRect(51,5,43,34,{tl:4,bl:4,tr:14,br:14});
    g.fillStyle(base);   g.fillRoundedRect(52,6,41,32,{tl:3,bl:3,tr:13,br:13});
    g.fillStyle(dark);   g.fillRoundedRect(54,29,37,8,{tl:2,bl:2,tr:8,br:8});
    g.fillStyle(light);  g.fillRoundedRect(54,7,35,9,3);
    // parabrezza cabina
    g.fillStyle(0x0e1d29);
    g.fillPoints([{x:67,y:9},{x:80,y:13},{x:80,y:31},{x:67,y:35}],true);
    g.fillStyle(0x2c5470,0.5);
    g.fillPoints([{x:68,y:11},{x:76,y:14},{x:74,y:19},{x:68,y:16}],true);
    // finestrino laterale cabina
    g.fillStyle(0x0e1d29);
    g.fillPoints([{x:53,y:9},{x:67,y:9},{x:67,y:35},{x:53,y:35}],true);
    g.fillStyle(0x2c5470,0.35); g.fillRect(55,11,10,11); g.fillRect(55,22,10,11);
    // cofano ant.
    g.fillStyle(dark); g.fillRect(80,15,12,1); g.fillRect(80,28,12,1);
    g.fillStyle(light); g.fillRect(82,20,8,4);
    g.fillStyle(0xfff4bc); g.fillRoundedRect(89,8,5,5,2); g.fillRoundedRect(89,31,5,5,2);
    g.fillStyle(0xffffff); g.fillRect(90,9,2,3); g.fillRect(90,32,2,3);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(93,9,4,3); g.fillRect(93,32,4,3);
    g.fillStyle(0xcc1111); g.fillRoundedRect(7,10,4,5,1); g.fillRoundedRect(7,29,4,5,1);
    g.fillStyle(0xff4444); g.fillRect(8,11,2,3); g.fillRect(8,30,2,3);
    g.fillStyle(lighter); g.fillRoundedRect(92,15,4,14,2);
    // mitragliatrice montata sul pianale
    g.fillStyle(metalD); g.fillCircle(28,22,8); g.fillStyle(metal); g.fillCircle(28,22,6);
    g.fillStyle(metalL); g.fillCircle(26,20,2); g.fillStyle(metalD); g.fillCircle(28,22,2);
    g.fillStyle(metalD); g.fillRect(28,19,22,6); g.fillStyle(metal); g.fillRect(28,20,22,4);
    g.fillStyle(metalL); g.fillRect(29,21,18,2);
    g.fillStyle(metalD); g.fillRect(48,18,4,8);
    g.fillStyle(0x000000); g.fillRect(49,20,2,2); g.fillRect(49,24,2,2);
    g.fillStyle(0xffffff,0.10); g.fillRoundedRect(53,6,38,3,2);

  } else if (vehicleKey === 'armored_van') {
    // ── FURGONE BLINDATO — corpo scatolato, piastre, rivetti, feritoie ─────
    const wh: [number,number][] = [[11,1],[62,1],[11,32],[62,32]];
    g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,22,11,3));
    g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [4,9,14].forEach(o => g.fillRect(x+o,y+2,2,7)));
    g.fillStyle(darker); g.fillRect(6,4,88,36);
    g.fillStyle(base);   g.fillRect(7,5,86,34);
    g.fillStyle(light);  g.fillRect(9,5,82,8);
    g.fillStyle(dark);   g.fillRect(9,31,82,8);
    // giunzioni piastre
    g.fillStyle(darker);
    [26,50,70].forEach(x => g.fillRect(x,5,3,34));
    g.fillRect(7,20,86,3);
    // rivetti
    g.fillStyle(metalD);
    [16,35,57,76].forEach(x => [9,17,27,35].forEach(y => g.fillCircle(x,y,2)));
    // feritoie anteriori
    g.fillStyle(0x0e1d29); g.fillRect(73,8,15,7); g.fillRect(73,29,15,7);
    g.fillStyle(0x2c5470,0.5); g.fillRect(75,10,9,3); g.fillRect(75,31,9,3);
    // feritoie laterali
    g.fillStyle(0x0e1d29); g.fillRect(30,7,14,8); g.fillRect(30,29,14,8);
    g.fillStyle(0x2c5470,0.35); g.fillRect(32,9,8,4); g.fillRect(32,31,8,4);
    g.fillStyle(0xfff4bc); g.fillRect(88,8,5,4); g.fillRect(88,32,5,4);
    g.fillStyle(0xffffff); g.fillRect(89,9,2,2); g.fillRect(89,33,2,2);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(92,9,3,2); g.fillRect(92,33,3,2);
    g.fillStyle(0xcc1111); g.fillRect(7,9,4,5); g.fillRect(7,30,4,5);
    g.fillStyle(0xff4444); g.fillRect(8,10,2,3); g.fillRect(8,31,2,3);
    g.fillStyle(metalD); g.fillRect(91,8,5,28); g.fillStyle(metal); g.fillRect(92,9,3,26);
    g.fillStyle(metalD); g.fillRect(6,9,3,26);
    // torretta blindata (con scatola protettiva)
    g.fillStyle(darker); g.fillRect(36,8,28,28);
    g.fillStyle(base);   g.fillRect(37,9,26,26);
    g.fillStyle(metalD); g.fillCircle(50,22,11); g.fillStyle(metal); g.fillCircle(50,22,9);
    g.fillStyle(metalL); g.fillCircle(48,20,3); g.fillStyle(metalD); g.fillCircle(50,22,2);
    g.fillStyle(metalD); g.fillRect(50,17,46,10); g.fillStyle(metal); g.fillRect(50,18,46,8);
    g.fillStyle(metalL); g.fillRect(50,19,42,3);
    g.fillStyle(metalD); g.fillRect(90,16,7,12); g.fillRect(94,15,4,14);
    g.fillStyle(0x000000); g.fillRect(95,18,2,2); g.fillRect(95,23,2,2);
    g.fillStyle(0xffffff,0.10); g.fillRect(9,5,78,3);

  } else if (vehicleKey === 'military_suv') {
    // ── SUV MILITARE — alto, boxy, ruote grandi, bull bar, antenna radio ────
    const wh: [number,number][] = [[9,0],[60,0],[9,33],[60,33]];
    g.fillStyle(0x141414); wh.forEach(([x,y]) => g.fillRoundedRect(x,y,25,13,4));
    g.fillStyle(0x2c2c2c); wh.forEach(([x,y]) => [5,10,17].forEach(o => g.fillRect(x+o,y+2,2,9)));
    g.fillStyle(0x555555); wh.forEach(([x,y]) => g.fillCircle(x+12,y+6,4));
    // corpo alto e boxy
    g.fillStyle(darker); g.fillRoundedRect(6,3,88,38,{tl:6,bl:6,tr:10,br:10});
    g.fillStyle(base);   g.fillRoundedRect(7,4,86,36,{tl:5,bl:5,tr:9,br:9});
    g.fillStyle(dark);   g.fillRoundedRect(9,32,80,7,{tl:3,bl:3,tr:7,br:7});
    g.fillStyle(light);  g.fillRoundedRect(9,5,76,10,{tl:4,bl:2,tr:7,br:2});
    // finestre militari (piccole e quadrate)
    g.fillStyle(0x0e1d29); g.fillRect(55,8,22,12); g.fillRect(55,24,22,12);
    g.fillStyle(0x2c5470,0.45); g.fillRect(57,10,14,6); g.fillRect(57,26,14,6);
    g.fillStyle(0x0e1d29); g.fillRect(31,8,20,12); g.fillRect(31,24,20,12);
    g.fillStyle(0x2c5470,0.35); g.fillRect(33,10,12,6); g.fillRect(33,26,12,6);
    g.fillStyle(base); g.fillRect(51,5,6,34);
    g.fillStyle(dark); g.fillRect(78,15,12,1); g.fillRect(78,28,12,1);
    g.fillStyle(light); g.fillRect(80,20,8,4);
    // bull bar anteriore
    g.fillStyle(metalD); g.fillRoundedRect(88,9,6,26,3);
    g.fillStyle(metal);  g.fillRect(89,12,4,20);
    g.fillStyle(metalD); g.fillRect(89,7,3,5); g.fillRect(89,32,3,5);
    g.fillStyle(0xfff4bc); g.fillRoundedRect(83,7,7,7,2); g.fillRoundedRect(83,30,7,7,2);
    g.fillStyle(0xffffff); g.fillRect(84,8,4,5); g.fillRect(84,31,4,5);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(89,8,5,5); g.fillRect(89,31,5,5);
    g.fillStyle(0xcc1111); g.fillRoundedRect(7,9,5,6,1); g.fillRoundedRect(7,29,5,6,1);
    g.fillStyle(0xff4444); g.fillRect(8,10,2,4); g.fillRect(8,30,2,4);
    g.fillStyle(base); g.fillRoundedRect(52,1,8,5,2); g.fillRoundedRect(52,38,8,5,2);
    g.fillStyle(0x0e1d29); g.fillRect(53,2,5,3); g.fillRect(53,39,5,3);
    // antenna radio
    g.fillStyle(metalD); g.fillRect(18,3,2,5); g.fillStyle(metalL); g.fillRect(19,2,1,3);
    g.fillStyle(metalD); g.fillRect(6,11,3,22);
    // torretta
    g.fillStyle(metalD); g.fillCircle(47,22,11); g.fillStyle(metal); g.fillCircle(47,22,9);
    g.fillStyle(metalL); g.fillCircle(45,20,3); g.fillStyle(metalD); g.fillCircle(47,22,2);
    g.fillStyle(metalD); g.fillRect(47,17,49,10); g.fillStyle(metal); g.fillRect(47,18,49,8);
    g.fillStyle(metalL); g.fillRect(47,19,44,3);
    g.fillStyle(metalD); g.fillRect(89,16,8,12); g.fillRect(93,15,5,14);
    g.fillStyle(0x000000); g.fillRect(94,18,3,2); g.fillRect(94,23,3,2);
    g.fillStyle(0xffffff,0.10); g.fillRoundedRect(15,4,68,3,2);

  } else if (vehicleKey === 'armored_truck') {
    // ── CAMION CORAZZATO — corpo enorme, 6 ruote (doppio assale post.) ──────
    g.fillStyle(0x141414);
    g.fillRoundedRect(62,0,26,13,4); g.fillRoundedRect(62,31,26,13,4);
    g.fillRoundedRect(10,0,24,13,4); g.fillRoundedRect(34,0,24,13,4);
    g.fillRoundedRect(10,31,24,13,4); g.fillRoundedRect(34,31,24,13,4);
    g.fillStyle(0x2c2c2c);
    ([[62,0],[10,0],[34,0],[62,31],[10,31],[34,31]] as [number,number][]).forEach(([x,y]) =>
      [5,11,17].forEach(o => g.fillRect(x+o,y+3,2,7))
    );
    g.fillStyle(darker); g.fillRect(5,2,90,40);
    g.fillStyle(base);   g.fillRect(6,3,88,38);
    g.fillStyle(light);  g.fillRect(8,3,84,10);
    g.fillStyle(dark);   g.fillRect(8,31,84,10);
    g.fillStyle(darker);
    g.fillRect(5,21,90,3);
    [22,44,62].forEach(x => g.fillRect(x,2,3,40));
    g.fillStyle(metalD);
    [14,32,51,70,84].forEach(x => [8,15,29,36].forEach(y => g.fillCircle(x,y,2.5)));
    g.fillStyle(0x0e1d29); g.fillRect(65,7,18,9); g.fillRect(65,28,18,9);
    g.fillStyle(0x2c5470,0.4); g.fillRect(67,9,12,5); g.fillRect(67,30,12,5);
    g.fillStyle(0xfff4bc); g.fillRect(87,7,5,5); g.fillRect(87,32,5,5);
    g.fillStyle(0xffffff); g.fillRect(88,8,2,3); g.fillRect(88,33,2,3);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(91,8,4,3); g.fillRect(91,33,4,3);
    g.fillStyle(0xcc1111); g.fillRect(6,8,5,5); g.fillRect(6,31,5,5);
    g.fillStyle(0xff4444); g.fillRect(7,9,2,3); g.fillRect(7,32,2,3);
    g.fillStyle(metalD); g.fillRect(91,6,6,32); g.fillStyle(metal); g.fillRect(92,7,4,30);
    g.fillStyle(metalD); g.fillRect(5,7,3,30);
    // torretta corazzata con scatola protettiva visibile
    g.fillStyle(darker); g.fillRect(22,7,30,30);
    g.fillStyle(base);   g.fillRect(23,8,28,28);
    g.fillStyle(metalD); g.fillCircle(37,22,11); g.fillStyle(metal); g.fillCircle(37,22,9);
    g.fillStyle(metalL); g.fillCircle(35,20,3); g.fillStyle(metalD); g.fillCircle(37,22,2);
    g.fillStyle(metalD); g.fillRect(37,16,56,12); g.fillStyle(metal); g.fillRect(37,17,56,10);
    g.fillStyle(metalL); g.fillRect(37,18,52,4);
    g.fillStyle(metalD); g.fillRect(87,15,10,14); g.fillRect(92,13,6,18);
    g.fillStyle(0x000000); g.fillRect(93,17,4,2); g.fillRect(93,24,4,2);
    g.fillStyle(0xffffff,0.08); g.fillRect(8,3,80,3);

  } else if (vehicleKey === 'heavy_military') {
    // ── MEZZO PESANTE — 6 ruote enormi, doppio cannone, corazza massima ─────
    g.fillStyle(0x141414);
    g.fillRoundedRect(60,0,28,14,4); g.fillRoundedRect(60,30,28,14,4);
    g.fillRoundedRect(30,0,26,14,4); g.fillRoundedRect(30,30,26,14,4);
    g.fillRoundedRect(4,0,22,14,4);  g.fillRoundedRect(4,30,22,14,4);
    g.fillStyle(0x2c2c2c);
    ([[60,0],[30,0],[4,0],[60,30],[30,30],[4,30]] as [number,number][]).forEach(([x,y]) =>
      [5,11,17,22].forEach(o => g.fillRect(x+o,y+3,2,8))
    );
    g.fillStyle(0x555555);
    ([[74,6],[44,6],[15,6],[74,37],[44,37],[15,37]] as [number,number][]).forEach(([x,y]) => g.fillCircle(x,y,5));
    g.fillStyle(darker); g.fillRect(3,1,94,42);
    g.fillStyle(base);   g.fillRect(4,2,92,40);
    g.fillStyle(light);  g.fillRect(6,2,88,11);
    g.fillStyle(dark);   g.fillRect(6,31,88,11);
    g.fillStyle(darker);
    g.fillRect(3,21,94,3);
    [18,38,56,74].forEach(x => g.fillRect(x,1,3,42));
    g.fillStyle(metalD);
    [11,27,46,63,80,91].forEach(x => [8,15,29,36].forEach(y => g.fillCircle(x,y,2.5)));
    g.fillStyle(0x0e1d29);
    g.fillRect(60,5,16,8); g.fillRect(60,31,16,8);
    g.fillRect(40,5,14,8); g.fillRect(40,31,14,8);
    g.fillStyle(0x2c5470,0.4);
    g.fillRect(62,7,10,4); g.fillRect(62,33,10,4);
    g.fillRect(42,7,8,4);  g.fillRect(42,33,8,4);
    g.fillStyle(0xfff4bc); g.fillRect(86,4,6,6); g.fillRect(86,34,6,6);
    g.fillStyle(0xffffff); g.fillRect(87,5,3,4); g.fillRect(87,35,3,4);
    g.fillStyle(0xfff4bc,0.3); g.fillRect(91,5,5,4); g.fillRect(91,35,5,4);
    g.fillStyle(0xcc1111); g.fillRect(4,7,5,6); g.fillRect(4,31,5,6);
    g.fillStyle(0xff4444); g.fillRect(5,8,2,4); g.fillRect(5,32,2,4);
    g.fillStyle(metalD); g.fillRect(90,5,7,34); g.fillStyle(metal); g.fillRect(91,6,5,32);
    g.fillStyle(metalD); g.fillRect(3,9,3,26); g.fillStyle(metal); g.fillRect(3,17,3,10);
    // DOPPIO CANNONE
    g.fillStyle(darker); g.fillRect(20,10,26,24);
    g.fillStyle(base);   g.fillRect(21,11,24,22);
    g.fillStyle(metalD); g.fillCircle(33,22,11); g.fillStyle(metal); g.fillCircle(33,22,9);
    g.fillStyle(metalL); g.fillCircle(31,20,3.5); g.fillStyle(metalD); g.fillCircle(33,22,2);
    g.fillStyle(metalD); g.fillRect(33,13,60,7); g.fillStyle(metal); g.fillRect(33,14,60,5);
    g.fillStyle(metalL); g.fillRect(33,14,56,2);
    g.fillStyle(metalD); g.fillRect(87,12,10,9);
    g.fillStyle(0x000000); g.fillRect(88,14,7,2);
    g.fillStyle(metalD); g.fillRect(33,24,60,7); g.fillStyle(metal); g.fillRect(33,25,60,5);
    g.fillStyle(metalL); g.fillRect(33,25,56,2);
    g.fillStyle(metalD); g.fillRect(87,23,10,9);
    g.fillStyle(0x000000); g.fillRect(88,25,7,2);
    g.fillStyle(0xffffff,0.07); g.fillRect(6,2,82,3);

  } else {
    // ── VEICOLO SPERIMENTALE — futuristico, angolare, cannone a energia ──────
    g.fillStyle(0x111122);
    g.fillRoundedRect(11,2,20,10,5); g.fillRoundedRect(11,32,20,10,5);
    g.fillRoundedRect(63,2,20,10,5); g.fillRoundedRect(63,32,20,10,5);
    g.fillStyle(0x440088);
    g.fillCircle(21,7,3);  g.fillCircle(21,37,3);
    g.fillCircle(73,7,3);  g.fillCircle(73,37,3);
    g.fillStyle(0x8833ff,0.8);
    g.fillCircle(21,7,2);  g.fillCircle(21,37,2);
    g.fillCircle(73,7,2);  g.fillCircle(73,37,2);
    // corpo angolare a cunei
    const body = [{x:8,y:11},{x:16,y:5},{x:82,y:5},{x:94,y:15},{x:94,y:29},{x:82,y:39},{x:16,y:39},{x:8,y:33}];
    g.fillStyle(darker); g.fillPoints(body.map(p => ({x:p.x+1,y:p.y+1})),true);
    g.fillStyle(base);   g.fillPoints(body,true);
    g.fillStyle(light);
    g.fillPoints([{x:16,y:6},{x:82,y:6},{x:82,y:12},{x:16,y:12}],true);
    g.fillStyle(dark);
    g.fillPoints([{x:16,y:32},{x:82,y:32},{x:82,y:38},{x:16,y:38}],true);
    // trim viola caratteristico
    g.fillStyle(0x8833ff,0.85);
    g.fillRect(8,21,86,2); g.fillRect(8,10,86,1); g.fillRect(8,33,86,1);
    // cabina vetro scuro angolare
    g.fillStyle(0x060012);
    g.fillPoints([{x:43,y:7},{x:74,y:9},{x:74,y:35},{x:43,y:37}],true);
    g.fillStyle(0x3300aa,0.55);
    g.fillPoints([{x:45,y:9},{x:68,y:11},{x:66,y:17},{x:45,y:15}],true);
    // pannello laterale
    g.fillStyle(0x060012);
    g.fillPoints([{x:19,y:8},{x:43,y:7},{x:43,y:37},{x:19,y:36}],true);
    g.fillStyle(0x220044,0.6); g.fillRect(21,10,18,10); g.fillRect(21,24,18,10);
    // griglia anteriore ad energia
    g.fillStyle(0x060012);
    g.fillPoints([{x:74,y:9},{x:88,y:14},{x:88,y:30},{x:74,y:35}],true);
    g.fillStyle(0x8833ff,0.45); g.fillRect(76,13,10,5); g.fillRect(76,26,10,5);
    // fari anteriori energia viola
    g.fillStyle(0xbb44ff); g.fillRoundedRect(86,8,7,6,2); g.fillRoundedRect(86,30,7,6,2);
    g.fillStyle(0xffffff,0.8); g.fillRect(87,9,3,4); g.fillRect(87,31,3,4);
    g.fillStyle(0xbb44ff,0.4); g.fillRect(92,9,5,4); g.fillRect(92,31,5,4);
    // fari posteriori rosa energia
    g.fillStyle(0xff22aa); g.fillRect(9,10,5,6); g.fillRect(9,28,5,6);
    g.fillStyle(0xff88cc,0.5); g.fillRect(13,11,3,4); g.fillRect(13,29,3,4);
    // CANNONE A ENERGIA
    g.fillStyle(0x330066); g.fillCircle(47,22,11);
    g.fillStyle(0x550099); g.fillCircle(47,22,9);
    g.fillStyle(0x9955ee); g.fillCircle(45,20,3.5);
    g.fillStyle(0x8833ff,0.9); g.fillCircle(47,22,5);
    g.fillStyle(0xffffff,0.8); g.fillCircle(47,22,2);
    g.fillStyle(0x330066); g.fillRect(47,18,46,8);
    g.fillStyle(0x550099); g.fillRect(47,19,46,6);
    g.fillStyle(0x8833ff,0.7); g.fillRect(49,20,40,4);
    g.fillStyle(0x330066); g.fillRect(87,17,9,10);
    g.fillStyle(0xffffff,0.9); g.fillRect(90,19,6,6);
    g.fillStyle(0x8833ff,0.3); g.fillRect(49,17,38,10);
    g.fillStyle(0xffffff,0.12); g.fillRoundedRect(17,6,52,3,2);
  }

  g.generateTexture(key, 100, 44);
  g.destroy();
}
