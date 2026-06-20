/**
 * Internazionalizzazione (i18n) — fonte di verità unica per i testi rivolti al giocatore.
 *
 * Tutte le stringhe vivono nei dizionari `src/locales/<lang>.ts`, indicizzate per CHIAVE
 * (es. `menu.continue`). Il codice non contiene più letterali in lingua: chiama `t('chiave')`.
 * La lingua corrente è una preferenza persistente (`Settings.language`).
 *
 * Regole:
 *  · `it` è la locale CANONICA: contiene ogni chiave. Le altre fanno fallback su `it`.
 *  · Interpolazione con segnaposto `{nome}` → `t('shop.money', { n: 120 })`.
 *  · I numeri di gameplay NON si scrivono a mano nelle traduzioni: si iniettano via params
 *    (singola fonte di verità), così non divergono dal codice/BALANCE.md.
 *
 * Dettagli e guida "come aggiungere una lingua/chiave" in docs/I18N.md.
 */
import Settings, { Lang } from './Settings';
import it from './locales/it';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import pt from './locales/pt';

export type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = { it, en, es, fr, de, pt };

/** Lingue offerte nel selettore Impostazioni (codice + etichetta nella lingua stessa). */
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Traduce `key` nella lingua corrente, con fallback su italiano e infine sulla chiave stessa
 * (utile in sviluppo per individuare chiavi mancanti). `params` riempie i segnaposto `{nome}`.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const lang = Settings.language;
  const raw = DICTS[lang]?.[key] ?? DICTS.it[key];
  if (raw === undefined) {
    // Avviso solo in sviluppo (accesso a import.meta.env type-safe senza dipendere da vite/client).
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) console.warn(`[i18n] chiave mancante: "${key}"`);
    return key;
  }
  if (!params) return raw;
  return raw.replace(PLACEHOLDER, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
