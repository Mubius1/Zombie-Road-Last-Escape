/**
 * Campagna "IL CONVOGLIO" — archi personali dei sopravvissuti e radio ("This War of Mine su ruote").
 * Dati NEUTRI (nessun import) sul modello di `Routes.ts`/`Locations.ts`: li leggono `StopScene` (dialoghi)
 * e `GameScene` (epilogo, radio). I TESTI vivono in i18n (`dlg.*` / `campaign.ending.*` / `radio.*`); qui
 * stanno le CHIAVI, gli effetti (morale/cibo/monete) e i flag. Vedi docs/CAMPAGNA_CONVOGLIO.md.
 *
 * Cadenza di un arco: parli col personaggio → finché l'atto < `unlockAct` senti la sua battuta in voce
 * (`talk`, variata per stato emotivo); raggiunto `unlockAct` arriva il BEAT (la scelta che pesa); dopo la
 * scelta, riparlandogli senti la sua eco (`after`); a fine corsa l'epilogo legge il flag e mostra la carta.
 */
export interface ArcOption {
  labelKey: string;  // la tua risposta/scelta
  replyKey: string;  // la replica del personaggio
  flag: string;      // salvato in RunData.choices
  morale: number; food: number; money: number; // effetti
  detour?: string;   // se presente, marca una DIRAMAZIONE giocabile: la prossima tratta è la deviazione (es. 'lena')
}
export interface SurvivorArc {
  unlockAct: number;                          // 0-based: atto in cui il beat diventa disponibile
  beatKey: string;                            // ciò che dice per impostare la scelta
  options: ArcOption[];
  after: { flag: string; key: string }[];     // eco post-scelta, per flag
  endings: { flag: string; key: string }[];   // carte-epilogo per flag-scelta + 'died'
  talk: { calm: string; distressed: string }; // battuta in voce per stato emotivo
  /** Battute SOSTITUTIVE post-esito (diramazione): se un flag è in `choices` hanno la PRIORITÀ sull'eco
   *  generica `after`, e variano per stato emotivo come `talk`. Es. Sara dopo aver ritrovato/perso Lena. */
  talkAfter?: { flag: string; calm: string; distressed: string }[];
}

export const SURVIVOR_ARCS: Record<string, SurvivorArc> = {
  // Sara Conti (medico): la figlia Lena. Disponibile da subito (unlockAct 0).
  medic: {
    unlockAct: 0,
    beatKey: 'dlg.medic.beat',
    options: [
      { labelKey: 'dlg.medic.search',  replyKey: 'dlg.medic.replySearch',  flag: 'sara_search', morale: 8,  food: -15, money: 0, detour: 'lena' },
      { labelKey: 'dlg.medic.decline', replyKey: 'dlg.medic.replyDecline', flag: 'sara_skip',   morale: -10, food: 0,   money: 0 },
    ],
    after:   [{ flag: 'sara_search', key: 'dlg.medic.afterSearch' }, { flag: 'sara_skip', key: 'dlg.medic.afterSkip' }],
    // Esiti della DIRAMAZIONE «Cerca Lena» (lena_found/late/trap) hanno la priorità sull'esito base nell'epilogo.
    endings: [{ flag: 'sara_search', key: 'campaign.ending.sara.search' }, { flag: 'sara_skip', key: 'campaign.ending.sara.skip' }, { flag: 'lena_found', key: 'campaign.ending.sara.lena_found' }, { flag: 'lena_late', key: 'campaign.ending.sara.lena_late' }, { flag: 'lena_trap', key: 'campaign.ending.sara.lena_trap' }, { flag: 'died', key: 'campaign.ending.sara.died' }],
    talk:    { calm: 'dlg.medic.talk.calm', distressed: 'dlg.medic.talk.distressed' },
    // S1: dopo l'esito della diramazione «Cerca Lena» Sara è una persona diversa — battute dedicate per
    // ritrovata (calm/distressed), persa, o esca. Priorità sull'eco generica `afterSearch`.
    talkAfter: [
      { flag: 'lena_found', calm: 'dlg.medic.reunited.calm', distressed: 'dlg.medic.reunited.distressed' },
      { flag: 'lena_late',  calm: 'dlg.medic.lostLena',      distressed: 'dlg.medic.lostLena' },
      { flag: 'lena_trap',  calm: 'dlg.medic.trapLena',      distressed: 'dlg.medic.trapLena' },
    ],
  },
  // ── I 6 archi autorati (workflow narrativa) — Bruno · Marcus · Nadia · Vince · Eva · Karim ──
  mechanic: {
    unlockAct: 0,
    beatKey: 'dlg.mechanic.beat',
    options: [
      { labelKey: 'dlg.mechanic.opt0', replyKey: 'dlg.mechanic.reply0', flag: 'mechanic_rest', morale: -6, food: 0, money: 0 },
      { labelKey: 'dlg.mechanic.opt1', replyKey: 'dlg.mechanic.reply1', flag: 'mechanic_work', morale: 8, food: 0, money: 40, detour: 'hands' }, // DIRAMAZIONE-COMPITO: la riparazione che solo lui sa fare
    ],
    after:   [{ flag: 'mechanic_rest', key: 'dlg.mechanic.after0' }, { flag: 'mechanic_work', key: 'dlg.mechanic.after1' }],
    endings: [{ flag: 'mechanic_rest', key: 'campaign.ending.mechanic.rest' }, { flag: 'mechanic_work', key: 'campaign.ending.mechanic.work' }, { flag: 'hands_steady', key: 'campaign.ending.mechanic.hands_steady' }, { flag: 'hands_shaky', key: 'campaign.ending.mechanic.hands_shaky' }, { flag: 'hands_yield', key: 'campaign.ending.mechanic.hands_yield' }, { flag: 'died', key: 'campaign.ending.mechanic.died' }],
    talk:    { calm: 'dlg.mechanic.talk.calm', distressed: 'dlg.mechanic.talk.distressed' },
    talkAfter: [
      { flag: 'hands_steady', calm: 'dlg.mechanic.hands.steady', distressed: 'dlg.mechanic.hands.steady' },
      { flag: 'hands_shaky',  calm: 'dlg.mechanic.hands.shaky',  distressed: 'dlg.mechanic.hands.shaky' },
      { flag: 'hands_yield',  calm: 'dlg.mechanic.hands.yield',  distressed: 'dlg.mechanic.hands.yield' },
    ],
  },
  soldier: {
    unlockAct: 2,
    beatKey: 'dlg.soldier.beat',
    options: [
      { labelKey: 'dlg.soldier.opt0', replyKey: 'dlg.soldier.reply0', flag: 'soldier_save_all', morale: 12, food: -20, money: -40 },
      { labelKey: 'dlg.soldier.opt1', replyKey: 'dlg.soldier.reply1', flag: 'soldier_sacrifice_few', morale: -14, food: 15, money: 60 },
      { labelKey: 'dlg.soldier.opt2', replyKey: 'dlg.soldier.reply2', flag: 'soldier_seek_unit', morale: 0, food: 0, money: 0, detour: 'unit' }, // DIRAMAZIONE: la vecchia unità
    ],
    after:   [{ flag: 'soldier_save_all', key: 'dlg.soldier.after0' }, { flag: 'soldier_sacrifice_few', key: 'dlg.soldier.after1' }],
    endings: [{ flag: 'soldier_save_all', key: 'campaign.ending.soldier.save_all' }, { flag: 'soldier_sacrifice_few', key: 'campaign.ending.soldier.sacrifice_few' }, { flag: 'unit_reunited', key: 'campaign.ending.soldier.unit_reunited' }, { flag: 'unit_graves', key: 'campaign.ending.soldier.unit_graves' }, { flag: 'unit_deserters', key: 'campaign.ending.soldier.unit_deserters' }, { flag: 'died', key: 'campaign.ending.soldier.died' }],
    talk:    { calm: 'dlg.soldier.talk.calm', distressed: 'dlg.soldier.talk.distressed' },
    talkAfter: [
      { flag: 'unit_reunited',  calm: 'dlg.soldier.unit.reunited',  distressed: 'dlg.soldier.unit.reunited' },
      { flag: 'unit_graves',    calm: 'dlg.soldier.unit.graves',    distressed: 'dlg.soldier.unit.graves' },
      { flag: 'unit_deserters', calm: 'dlg.soldier.unit.deserters', distressed: 'dlg.soldier.unit.deserters' },
    ],
  },
  explorer: {
    unlockAct: 1,
    beatKey: 'dlg.explorer.beat',
    options: [
      { labelKey: 'dlg.explorer.opt0', replyKey: 'dlg.explorer.reply0', flag: 'explorer_take_pass', morale: -6, food: -5, money: 0, detour: 'valico' },
      { labelKey: 'dlg.explorer.opt1', replyKey: 'dlg.explorer.reply1', flag: 'explorer_long_road', morale: 4, food: -12, money: -20 },
      { labelKey: 'dlg.explorer.opt2', replyKey: 'dlg.explorer.reply2', flag: 'explorer_speak_them', morale: 10, food: -6, money: 0 },
    ],
    after:   [{ flag: 'explorer_take_pass', key: 'dlg.explorer.after0' }, { flag: 'explorer_long_road', key: 'dlg.explorer.after1' }, { flag: 'explorer_speak_them', key: 'dlg.explorer.after2' }],
    // Esiti della DIRAMAZIONE «Il valico» (valico_through/blocked/echoes) hanno priorità sull'esito base nell'epilogo.
    endings: [{ flag: 'explorer_take_pass', key: 'campaign.ending.explorer.take_pass' }, { flag: 'explorer_long_road', key: 'campaign.ending.explorer.long_road' }, { flag: 'explorer_speak_them', key: 'campaign.ending.explorer.speak_them' }, { flag: 'valico_through', key: 'campaign.ending.explorer.valico_through' }, { flag: 'valico_blocked', key: 'campaign.ending.explorer.valico_blocked' }, { flag: 'valico_echoes', key: 'campaign.ending.explorer.valico_echoes' }, { flag: 'died', key: 'campaign.ending.explorer.died' }],
    talk:    { calm: 'dlg.explorer.talk.calm', distressed: 'dlg.explorer.talk.distressed' },
    // S1: dopo l'esito della diramazione «Il valico» Nadia ha chiuso (o riaperto) i conti con la montagna —
    // battute dedicate per passate pulite (calm/distressed), la frana, o le tracce dei suoi. Priorità sull'eco.
    talkAfter: [
      { flag: 'valico_through', calm: 'dlg.explorer.valico.through.calm', distressed: 'dlg.explorer.valico.through.distressed' },
      { flag: 'valico_blocked', calm: 'dlg.explorer.valico.blocked', distressed: 'dlg.explorer.valico.blocked' },
      { flag: 'valico_echoes',  calm: 'dlg.explorer.valico.echoes',  distressed: 'dlg.explorer.valico.echoes' },
    ],
  },
  looter: {
    unlockAct: 1,
    beatKey: 'dlg.looter.beat',
    options: [
      { labelKey: 'dlg.looter.opt0', replyKey: 'dlg.looter.reply0', flag: 'looter_share', morale: 12, food: 15, money: -60 },
      { labelKey: 'dlg.looter.opt1', replyKey: 'dlg.looter.reply1', flag: 'looter_trade', morale: -2, food: -10, money: 110 },
      { labelKey: 'dlg.looter.opt2', replyKey: 'dlg.looter.reply2', flag: 'looter_keep', morale: -14, food: 0, money: 0 },
      { labelKey: 'dlg.looter.opt3', replyKey: 'dlg.looter.reply3', flag: 'looter_stash', morale: 0, food: -5, money: 0, detour: 'stash' }, // DIRAMAZIONE: la scorta nascosta
    ],
    after:   [{ flag: 'looter_share', key: 'dlg.looter.after0' }, { flag: 'looter_trade', key: 'dlg.looter.after1' }, { flag: 'looter_keep', key: 'dlg.looter.after2' }],
    endings: [{ flag: 'looter_share', key: 'campaign.ending.looter.share' }, { flag: 'looter_trade', key: 'campaign.ending.looter.trade' }, { flag: 'looter_keep', key: 'campaign.ending.looter.keep' }, { flag: 'stash_intact', key: 'campaign.ending.looter.stash_intact' }, { flag: 'stash_looted', key: 'campaign.ending.looter.stash_looted' }, { flag: 'stash_ambush', key: 'campaign.ending.looter.stash_ambush' }, { flag: 'died', key: 'campaign.ending.looter.died' }],
    talk:    { calm: 'dlg.looter.talk.calm', distressed: 'dlg.looter.talk.distressed' },
    talkAfter: [
      { flag: 'stash_intact', calm: 'dlg.looter.stash.intact', distressed: 'dlg.looter.stash.intact' },
      { flag: 'stash_looted', calm: 'dlg.looter.stash.looted', distressed: 'dlg.looter.stash.looted' },
      { flag: 'stash_ambush', calm: 'dlg.looter.stash.ambush', distressed: 'dlg.looter.stash.ambush' },
    ],
  },
  sniper: {
    unlockAct: 2,
    beatKey: 'dlg.sniper.beat',
    options: [
      { labelKey: 'dlg.sniper.opt0', replyKey: 'dlg.sniper.reply0', flag: 'sniper_cover_us', morale: 12, food: 0, money: -30 },
      { labelKey: 'dlg.sniper.opt1', replyKey: 'dlg.sniper.reply1', flag: 'sniper_perfect_shots', morale: -6, food: 0, money: 0 },
      { labelKey: 'dlg.sniper.opt2', replyKey: 'dlg.sniper.reply2', flag: 'sniper_carry_it', morale: 4, food: 0, money: 0 },
      { labelKey: 'dlg.sniper.opt3', replyKey: 'dlg.sniper.reply3', flag: 'sniper_seek_shot', morale: 0, food: 0, money: 0, detour: 'shot' }, // DIRAMAZIONE: il colpo mancato
    ],
    after:   [{ flag: 'sniper_cover_us', key: 'dlg.sniper.after0' }, { flag: 'sniper_perfect_shots', key: 'dlg.sniper.after1' }, { flag: 'sniper_carry_it', key: 'dlg.sniper.after2' }],
    endings: [{ flag: 'sniper_cover_us', key: 'campaign.ending.sniper.cover_us' }, { flag: 'sniper_perfect_shots', key: 'campaign.ending.sniper.perfect_shots' }, { flag: 'sniper_carry_it', key: 'campaign.ending.sniper.carry_it' }, { flag: 'shot_redeemed', key: 'campaign.ending.sniper.shot_redeemed' }, { flag: 'shot_empty', key: 'campaign.ending.sniper.shot_empty' }, { flag: 'shot_mirror', key: 'campaign.ending.sniper.shot_mirror' }, { flag: 'died', key: 'campaign.ending.sniper.died' }],
    talk:    { calm: 'dlg.sniper.talk.calm', distressed: 'dlg.sniper.talk.distressed' },
    talkAfter: [
      { flag: 'shot_redeemed', calm: 'dlg.sniper.shot.redeemed', distressed: 'dlg.sniper.shot.redeemed' },
      { flag: 'shot_empty',    calm: 'dlg.sniper.shot.empty',    distressed: 'dlg.sniper.shot.empty' },
      { flag: 'shot_mirror',   calm: 'dlg.sniper.shot.mirror',   distressed: 'dlg.sniper.shot.mirror' },
    ],
  },
  demolitionist: {
    unlockAct: 3,
    beatKey: 'dlg.demolitionist.beat',
    options: [
      { labelKey: 'dlg.demolitionist.opt0', replyKey: 'dlg.demolitionist.reply0', flag: 'demolitionist_open_gate', morale: 12, food: 0, money: -40, detour: 'gates' }, // DIRAMAZIONE: i cancelli murati
      { labelKey: 'dlg.demolitionist.opt1', replyKey: 'dlg.demolitionist.reply1', flag: 'demolitionist_keep_sealed', morale: -14, food: 0, money: 0 },
    ],
    after:   [{ flag: 'demolitionist_open_gate', key: 'dlg.demolitionist.after0' }, { flag: 'demolitionist_keep_sealed', key: 'dlg.demolitionist.after1' }],
    endings: [{ flag: 'demolitionist_open_gate', key: 'campaign.ending.demolitionist.open_gate' }, { flag: 'demolitionist_keep_sealed', key: 'campaign.ending.demolitionist.keep_sealed' }, { flag: 'gates_open', key: 'campaign.ending.demolitionist.gates_open' }, { flag: 'gates_sealed', key: 'campaign.ending.demolitionist.gates_sealed' }, { flag: 'gates_held', key: 'campaign.ending.demolitionist.gates_held' }, { flag: 'died', key: 'campaign.ending.demolitionist.died' }],
    talk:    { calm: 'dlg.demolitionist.talk.calm', distressed: 'dlg.demolitionist.talk.distressed' },
    talkAfter: [
      { flag: 'gates_open',   calm: 'dlg.demolitionist.gates.open',   distressed: 'dlg.demolitionist.gates.open' },
      { flag: 'gates_sealed', calm: 'dlg.demolitionist.gates.sealed', distressed: 'dlg.demolitionist.gates.sealed' },
      { flag: 'gates_held',   calm: 'dlg.demolitionist.gates.held',   distressed: 'dlg.demolitionist.gates.held' },
    ],
  },
};

/** Radio (This War of Mine): bollettini per ATTO (0..5, il segnale degrada) + frasi di transito. Chiavi i18n. */
export const RADIO_ACTS = ['radio.act0', 'radio.act1', 'radio.act2', 'radio.act3', 'radio.act4', 'radio.act5'];
export const RADIO_TRANSIT = ['radio.transit0', 'radio.transit1', 'radio.transit2', 'radio.transit3'];
