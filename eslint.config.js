// @ts-check
// ESLint 9 (flat config) + typescript-eslint, type-checked.
// Obiettivo: pescare ciò che `tsc` non vede (variabili inutilizzate residue, **floating/misused promises**,
// ecc.) SENZA annegare nel rumore dei tipi "laschi" di Phaser (le regole `no-unsafe-*` sono spente apposta).
// Lo strict type-check resta in tsconfig.json (noUnusedLocals/Parameters, noUncheckedIndexedAccess, ...).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Fuori dal lint: build, deps, gli script Node (.mjs) e i guard .js ombra in src/.
  { ignores: ['dist/**', 'node_modules/**', 'src/**/*.js'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // typescript-eslint v8: type-checking senza elencare a mano i tsconfig.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Phaser espone molte API tipizzate `any`: le `no-unsafe-*` sarebbero solo rumore.
      // Restano attive le regole ad alto valore sulle Promise (floating/misused) — quelle che volevamo.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // `any` deliberato nei punti d'interop con Phaser (cast per `generateTexture`, config pipeline, ecc.):
      // il vincolo "niente asset/tipi laschi" non si applica all'API di Phaser. Spento di proposito.
      '@typescript-eslint/no-explicit-any': 'off',
      // Falsi positivi col pattern Phaser `{ callback: this.metodo, callbackScope: this }` (il `this` è
      // legato a parte): la regola non lo vede. Spenta per non costringere a wrapper inutili.
      '@typescript-eslint/unbound-method': 'off',
      // Inutilizzati: `_`-prefix = intenzionale (coerente con la convenzione del codice).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
