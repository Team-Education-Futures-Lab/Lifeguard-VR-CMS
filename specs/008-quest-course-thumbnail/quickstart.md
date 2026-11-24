# Quickstart: cursusafbeelding in de Quest-API controleren

Dit is een validatiegids, geen implementatie. Zie
[contracts/quest-api-thumbnail.md](contracts/quest-api-thumbnail.md) voor de precieze vorm en
[research.md](research.md) R1 voor de regel die de video kiest.

## Voorbereiding

1. Geen nieuwe `.env`-instellingen en geen nieuwe migraties.
2. Start de stack met nginx (`docker compose up`).
3. Maak in het CMS als organisatie A:
   - cursus **Video eerst**: start met video X, daarna een vraag; publiceer;
   - cursus **Vraag eerst**: start met een vraag; antwoord A gaat naar een vraag die naar video Y
     gaat, antwoord B gaat direct naar video Z; publiceer;
   - cursus **Zonder video**: één vraag zonder verbonden antwoorden; publiceer.
4. Zoek de koppelcode op ("Quest koppelen") en zet hem in PowerShell:
   ```powershell
   $h = @{ Authorization = "Bearer <koppelcode>" }
   ```

## Automatische tests

```powershell
cd backend; npm test
```

Verwacht: alle tests slagen, ook de bestaande tests van feature 007 (aangepast voor het nieuwe veld)
en de nieuwe tests uit research R7.

## Handmatige controle (via nginx op http://localhost)

1. **Lijst**:
   ```powershell
   (Invoke-RestMethod -Uri http://localhost/api/quest/v1/courses -Headers $h).courses | Select-Object name, versionNumber, thumbnailUrl
   ```
   Verwacht: **Video eerst** en **Vraag eerst** hebben `/api/quest/v1/courses/<id>/thumbnail?v=1`;
   **Zonder video** heeft `null`. Alle andere velden zijn zoals in feature 007.
2. **Inhoud**: `GET /courses/<id>` heeft hetzelfde `thumbnailUrl`. Σ `videos[].fileSizeBytes` +
   het aantal bytes van het antwoord = `downloadSizeBytes` uit de lijst.
3. **Afbeelding**:
   ```powershell
   curl.exe -s -D - -o thumb.jpg -H "Authorization: Bearer <koppelcode>" "http://localhost/api/quest/v1/courses/<id>/thumbnail?v=1"
   ```
   Verwacht: `200`, `Content-Type: image/jpeg`, `Cache-Control: private, max-age=0, must-revalidate`.
   Open `thumb.jpg`: voor **Video eerst** is het de thumbnail van X, voor **Vraag eerst** die van Z
   (antwoord B is korter dan de weg via antwoord A).
4. **Zonder video / zonder koppeling**: de afbeelding van **Zonder video** → `404 not_found`. Zonder
   header → `401 relink_required`.
5. **Concept telt niet**: zet in het concept van **Video eerst** een andere video aan het begin en
   publiceer niet. De afbeelding blijft die van X.
6. **Opnieuw publiceren**: publiceer die wijziging. `thumbnailUrl` eindigt nu op `?v=2` en de
   afbeelding is die van de nieuwe video. Het oude adres met `?v=1` geeft ook de nieuwe afbeelding.
7. **Verwijderde video**: verwijder als eigenaar de video die de afbeelding levert. De afbeelding is
   nog steeds op te halen.
8. **Onpubliceren**: onpubliceer de cursus. De afbeelding geeft `404`.
9. **Vernieuwde koppelcode**: maak een nieuwe koppelcode. De afbeelding met de oude code → `401
   relink_required`.
10. **Direct naar nginx**: `GET http://localhost/internal/videos/thumbnails/...` → `404` (alleen
    bereikbaar via de API).
11. **Ontbrekend bestand**: hernoem het thumbnailbestand van een live cursus op schijf. De lijst en
    de inhoud geven nog `200` met hetzelfde `thumbnailUrl`; alleen het ophalen van de afbeelding
    mislukt (nginx: `404` en een regel `open() … failed` in zijn foutlog). Zet het bestand daarna
    terug.
