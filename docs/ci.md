# CI: wat er bij elke push gebeurt

De workflow staat in `.github/workflows/ci.yml`. Hij draait bij **elke push op elke branch**; er is
geen aparte trigger voor pull requests, zodat niets dubbel draait. Een nieuwe push op dezelfde
branch annuleert de run die nog loopt, behalve op `main`: daar kan een run een release aan het
maken zijn, dus wacht de volgende run. De workflow mag standaard alleen de code lezen
(`contents: read`); alleen de job **Release** mag tags en images schrijven. CodeQL hoort er niet
in: dat staat apart aan via de standaardinstelling van GitHub.

## De jobs

De jobs draaien na elkaar. Een job start alleen als de vorige is geslaagd; faalt er een, dan
worden de volgende overgeslagen.

| # | Job | Wat hij doet | Faalt als |
| --- | --- | --- | --- |
| 1 | **Lint (ESLint)** | `npm ci` en `npm run lint` in `backend/` en in `frontend/`, met Node 22 (zelfde versie als de Docker-images). npm-pakketten worden tussen runs gecachet. | ESLint een fout vindt |
| 2 | **Build (Docker images)** | Bouwt de images met `docker compose build api web`. `web` bouwt daarbij ook de frontend (`npm run build`) en zet hem in nginx. | een image niet bouwt, bijvoorbeeld een buildfout in de frontend |
| 3 | **Tests** | Precies de commando's die je lokaal gebruikt: `docker compose --profile test run --rm --build api-test` (backendtests tegen een tijdelijke MariaDB) en `docker compose run --rm web-build npm test` (frontendtests met Vitest). De frontendtests draaien ook als de backendtests falen, zodat je alle fouten in één run ziet. Daarna worden de testcontainers opgeruimd. | een test faalt |
| 4 | **End-to-end tests (Playwright)** | Start de hele app (db, api, web met een zelfondertekend certificaat), wacht tot `/api/health` antwoordt, voert de migraties uit, maakt een testbeheerder aan en draait `npx playwright test` in `e2e/` met Chromium (twee tests tegelijk; de browser staat per Playwright-versie in de cache van GitHub, alleen de systeembibliotheken worden elke run geïnstalleerd). Het Playwright-rapport wordt 7 dagen bewaard als artefact van de run. | een e2e-test faalt of de app niet opstart |
| 5 | **Audit** | `npm audit --omit=dev --audit-level=high` in `backend/` en `frontend/`. Leest alleen de `package-lock.json` en kijkt alleen naar de productiepakketten (wat in de images komt), niet naar testtools zoals vitest, vite en eslint. | er een kwetsbaarheid met ernst hoog of kritiek in de productiepakketten zit |
| 6 | **Release** | **Alleen op `main`.** Bepaalt het volgende versienummer, bouwt beide images zoals ze op de VPS draaien, zet ze op GHCR en zet de git-tag. Zie "Releases". | inloggen of pushen naar GHCR niet mag, of de tag niet gepusht kan worden |

### Omgevingsvariabelen en bestanden

- `docker-compose.yml` leest `.env` (via `env_file` van de API-services). `.env` staat niet in git,
  dus de workflow maakt hem op de runner aan:
  - in **Build** als kopie van `.env.example` (lege waarden; er wordt nergens verbonden);
  - in **Tests** en **End-to-end tests** met vaste testwaarden voor een tijdelijke database. Dat
    zijn geen geheimen: de database bestaat alleen tijdens die job, op de runner.
- Er staan **geen echte geheimen** in de workflow en er zijn geen GitHub-secrets nodig. De job
  **Release** gebruikt het token dat GitHub Actions zelf bij elke run aanmaakt (`GITHUB_TOKEN`).
- `nginx/certs` (niet in git) is niet nodig: de e2e-job maakt zelf een certificaat met
  `nginx/dev-cert.sh`; de andere jobs mounten geen certificaten.

## Releases

Elke push naar `main` waarbij jobs 1 t/m 5 slagen (in de praktijk: elke gemergde pull request)
wordt een nieuwe versie `vA.B.C`:

- **A (major):** grote of brekende wijziging;
- **B (minor):** nieuwe functie;
- **C (patch):** bugfix of kleine wijziging.

### Hoe het nummer wordt bepaald

De job zoekt de laatste tag van de vorm `vA.B.C` en kijkt alleen naar de **titels van de pull
requests** die sindsdien naar `main` zijn gemerged. Commits op Development, commitberichten en de
beschrijving van een PR tellen niet mee; zo maakt uitleg waarin `#major` voorkomt geen
major-versie. (Bij een squash-merge of een directe push naar `main` telt de eerste regel van die
commit, want daar staat de titel.)

| Staat er in de titel van een PR sinds de vorige versie… | Dan | Voorbeeld |
| --- | --- | --- |
| `#major` | A + 1, B en C naar 0 | `v1.4.2` → `v2.0.0` |
| `#minor` (en geen `#major`) | B + 1, C naar 0 | `v1.4.2` → `v1.5.0` |
| geen van beide | C + 1 | `v1.4.2` → `v1.4.3` |

Dus: bij een gewone merge hoef je niets te doen. Gaat het om een nieuwe functie, zet dan
`#minor` in de titel van de pull request, bijvoorbeeld "Zoeken in de video-kiezer #minor". Is er
niets nieuws sinds de laatste tag (bijvoorbeeld bij een herhaalde run), dan wordt er niets
uitgebracht.

### Wat er wordt gepubliceerd

- `ghcr.io/team-education-futures-lab/lifeguard-cms-api:<versie>` en `:latest`
- `ghcr.io/team-education-futures-lab/lifeguard-cms-web:<versie>` en `:latest` (gebouwd met
  `nginx/default.prod.conf`, de config voor de VPS)
- de git-tag `v<versie>`, pas nadat beide images op GHCR staan

Het nieuwe nummer staat in de samenvatting van de run op GitHub (tabblad **Actions**). Op de VPS
gebeurt nog niets vanzelf: zet daar `CMS_VERSION` op het nieuwe nummer en voer `pull` en `up -d`
uit (zie `docs/deployment-vps.md`, "Een nieuwe versie uitrollen").

### Eenmalig instellen op GitHub

De job pusht met `GITHUB_TOKEN`, niet met een persoonlijk token. Daarvoor moet het volgende goed
staan:

1. **Packages:** de packages `lifeguard-cms-api` en `lifeguard-cms-web` bestaan al (v1.0.0 is
   met de hand gepusht). Open per package op GitHub (organisatie → **Packages** → package →
   **Package settings**) het onderdeel **Manage Actions access** en voeg de repository
   `Lifeguard-VR-CMS` toe met de rol **Write**.
2. **Rechten van workflows:** in de instellingen van de organisatie of de repository
   (**Settings → Actions → General → Workflow permissions**) mag het token niet beperkt zijn tot
   alleen lezen op een manier die de rechten in de workflow tegenhoudt. De workflow vraagt zelf
   alleen voor de job **Release** `contents: write` en `packages: write`.
3. **Tags:** staat er een regel die het pushen van tags `v*` beschermt, dan moet GitHub Actions
   die mogen pushen.

Faalt de job op `docker push` met `denied` of `permission_denied`, dan ontbreekt stap 1. Faalt hij
op `git push` van de tag, dan ontbreekt stap 2 of 3.

## Een mislukte run bekijken

1. Open de repository op GitHub en ga naar het tabblad **Actions**.
2. Klik op de run (de commitboodschap van je push). Je ziet de jobs met een groen vinkje, een rood
   kruis of "skipped" (overgeslagen omdat een eerdere job faalde, of **Release** op een andere
   branch dan `main`).
3. Klik op de rode job en open de rode stap. De laatste regels laten meestal de oorzaak zien:
   - **Lint**: bestand, regel en ESLint-regel.
   - **Build**: de Docker-buildstap die faalde, met de foutmelding van `npm run build` of `npm ci`.
   - **Tests**: Vitest toont per falende test de verwachting en de werkelijke waarde. Bij een
     mislukte testjob draait daarna automatisch de stap **"Show container status and logs"**:
     `docker compose ps -a` en `docker compose logs` van de testcontainers (bijvoorbeeld als de
     testdatabase niet opkwam).
   - **End-to-end tests**: download het artefact **playwright-report** onderaan de run en open
     `index.html`; daar staan per test de stappen, screenshots en de fout. Bij een mislukte job
     staan de logs van de containers in de stap **"Show container logs"**.
   - **Audit**: de tabel van `npm audit` met pakket, ernst en of er een oplossing is.
   - **Release**: zie "Eenmalig instellen op GitHub" hierboven.
4. Lokaal hetzelfde draaien:

   ```bash
   docker compose --profile test run --rm --build api-test
   ```

   ```bash
   docker compose run --rm web-build npm test
   ```

   ```bash
   npm audit --omit=dev --audit-level=high
   ```

   (de laatste in `backend/` en in `frontend/`). Zonder `--omit=dev` zie je ook de testtools;
   die tellen in CI niet mee, maar kijk er af en toe naar.

   De e2e-tests draaien lokaal in een **eigen omgeving**, nooit tegen de ontwikkeldatabase (in
   `e2e/`):

   ```bash
   npm run test:local
   ```

   Dat start het Compose-project `e2e` (`docker-compose.yml` + `docker-compose.e2e.yml`) met een
   lege database op https://localhost:9443, voert de migraties uit, maakt de testbeheerder uit
   `e2e/.env` aan (`E2E_ADMIN_LOGIN`, `E2E_ADMIN_PASSWORD`), draait Playwright en haalt de omgeving
   met al haar data daarna weer weg. Alleen een deel draaien:
   `npm run test:local -- tests/011-course-reference-copy`; de omgeving laten staan om te kijken:
   `npm run test:local -- --keep`. Een kaal `npx playwright test` gaat ook naar poort 9443
   (`e2e/helpers/base-url.js`); CI zet `E2E_BASE_URL=https://localhost`.

5. Een run opnieuw starten (bijvoorbeeld bij een tijdelijke netwerkfout): knop **Re-run jobs**
   rechtsboven in de run. Voor **Release** is dat veilig: is de tag er al, dan brengt de job niets
   opnieuw uit.
