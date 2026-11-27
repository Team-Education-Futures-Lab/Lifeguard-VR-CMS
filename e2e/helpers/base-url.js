// Waar de e2e-tests heen gaan. Standaard de aparte e2e-omgeving (docker-compose.e2e.yml), zodat
// een lokale run nooit testdata in de ontwikkeldatabase achterlaat. CI zet E2E_BASE_URL op
// https://localhost (daar is de app zelf een wegwerpomgeving). Altijd https: nginx stuurt http door
// naar https zonder poort, en een POST wordt via zo'n redirect een GET.
export const BASE_URL = process.env.E2E_BASE_URL || 'https://localhost:9443';
