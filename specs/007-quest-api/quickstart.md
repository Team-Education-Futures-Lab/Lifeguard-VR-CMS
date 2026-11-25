# Quickstart: Quest-API controleren

Dit is een validatiegids, geen implementatie. Zie [contracts/quest-api.md](contracts/quest-api.md)
en [contracts/organisation-api.md](contracts/organisation-api.md) voor de precieze vorm.

## Voorbereiding

1. Er zijn geen nieuwe `.env`-instellingen nodig.
2. Start de stack met nginx (`docker compose up`) en draai de migraties. Er komen geen nieuwe
   migraties bij.
3. Maak in het CMS als organisatie A een cursus met twee video's en een vraag, en publiceer hem
   (feature 006). Maak ook een tweede cursus die alleen een concept heeft.

## Automatische tests

```powershell
cd backend; npm test
```

Verwacht: alle unit- en integratietests uit research R10 slagen. De e2e-tests schrijft het team
zelf; de handmatige rondgang hieronder kan daarvoor de basis zijn.

## Handmatige controle (PowerShell, via nginx op http://localhost)

1. **Koppelcode opzoeken**: log in als A en open "Quest koppelen" in het menu. De code staat er,
   met de uitleg.
2. **Koppelen**:
   ```powershell
   $r = Invoke-RestMethod -Method Post -Uri http://localhost/api/quest/v1/link -ContentType 'application/json' -Body '{"linkCode":" <code in kleine letters> "}'
   ```
   Verwacht: `linkCode` (in hoofdletters, zonder spaties) en de naam van A. Met de loginCode van A → 401 `invalid_link_code`.
3. **Lijst**:
   ```powershell
   $h = @{ Authorization = "Bearer $($r.linkCode)" }; Invoke-RestMethod -Uri http://localhost/api/quest/v1/courses -Headers $h
   ```
   Verwacht: alleen de gepubliceerde cursus, met versie 1, de datum en `downloadSizeBytes`.
4. **Download**: `GET /courses/<id>` geeft de onderdelen, antwoorden, `startStepId` en `videos`.
   Controleer dat Σ `fileSizeBytes` + het aantal bytes van het antwoord = `downloadSizeBytes`.
5. **Video en hervatten**:
   ```powershell
   curl.exe -s -o NUL -w "%{http_code} %{size_download}`n" -H "Authorization: Bearer $($r.linkCode)" -H "Range: bytes=1000-" http://localhost/api/quest/v1/videos/<videoId>
   ```
   Verwacht: `206` en een grootte van `fileSizeBytes - 1000`. Zonder header: `401`.
6. **Video die niet in de live versie zit** (alleen in het concept of de bibliotheek): `404`.
7. **Verwijderde video blijft werken**: verwijder als eigenaar een video uit de live versie. Stap 5
   geeft nog steeds `206`.
8. **Wijzigen en opnieuw publiceren**: de lijst toont `versionNumber` 2. Onpubliceer de cursus: hij
   staat niet meer in de lijst en de download en de video's geven `404`.
9. **Vernieuwen**: klik op "Nieuwe koppelcode maken" en annuleer: de code blijft gelijk. Klik
   opnieuw en bevestig: er staat een nieuwe code. De oude code als
   sleutel → `401 relink_required`, de oude code bij `/link` → `401 invalid_link_code`, de nieuwe
   code werkt.
10. **Scheiding**: een `GET /api/quest/v1/courses` met alleen de CMS-cookie → `401
    relink_required`. Een `GET /api/organisation` met alleen de koppelcode in de header → `401`.
11. **Ontbrekend bestand**: hernoem een videobestand op schijf. De lijst en de download werken nog,
    alleen die video geeft een fout. Zet het bestand daarna terug.
