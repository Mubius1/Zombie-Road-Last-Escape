/**
 * Impostazioni persistenti del giocatore.
 * Salvate in localStorage così sopravvivono al reload della pagina; in memoria
 * sono una cache statica letta da MenuScene / SettingsScene / GameScene.
 * Qui vivono SOLO preferenze (volume, effetti schermo) — nessun asset, nessuno stato di partita.
 */
const STORAGE_KEY = 'zombieRoad.settings.v1';
const DEFAULTS = { volume: 1, screenFx: true };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { ...DEFAULTS };
        const p = JSON.parse(raw);
        return {
            volume: typeof p.volume === 'number' ? clamp01(p.volume) : DEFAULTS.volume,
            screenFx: typeof p.screenFx === 'boolean' ? p.screenFx : DEFAULTS.screenFx,
        };
    }
    catch {
        return { ...DEFAULTS };
    }
}
class Settings {
    static get volume() { return this.data.volume; }
    static set volume(v) { this.data.volume = clamp01(v); this.save(); }
    static get screenFx() { return this.data.screenFx; }
    static set screenFx(v) { this.data.screenFx = v; this.save(); }
    static save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
        catch { /* storage non disponibile */ }
    }
}
Settings.data = loadSettings();
export default Settings;
//# sourceMappingURL=Settings.js.map