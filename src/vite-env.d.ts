/// <reference types="vite/client" />
// Tipi ambient di Vite: rende `import.meta.env.DEV`/`PROD`/`MODE` type-safe.
// Usato per gatare le opzioni di DEBUG fuori dal build di produzione: i blocchi
// `if (import.meta.env.DEV) { … }` vengono sostituiti con `if (false)` e rimossi
// (dead-code elimination) nella build `vite build` → debug NON presente nel finale.
