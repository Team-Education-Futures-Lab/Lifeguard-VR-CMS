# Quest-app (Unity)

De VR-app voor de Meta Quest staat in een eigen repository,
[Yonder-Futureslab-VR-Lifeguard](https://github.com/Team-Education-Futures-Lab/Yonder-Futureslab-VR-Lifeguard).
Hij praat alleen via de Quest-API met het CMS (`/api/quest/v1`, zie
[specs/007-quest-api/contracts/quest-api.md](../specs/007-quest-api/contracts/quest-api.md)); dat
contract is de afspraak tussen beide kanten. Hoe de app is opgebouwd (mappen, onderdelen, scènes en
hoe een cursus uit het contract in beeld komt) staat met diagrammen in
[docs/architectuur.md](https://github.com/Team-Education-Futures-Lab/Yonder-Futureslab-VR-Lifeguard/blob/main/docs/architectuur.md)
van die repository (tot de merge naar `main` staat het op de branch `Development`).

De uitgestelde wensen van de Quest-app staan in [backlog-quest-app.md](backlog-quest-app.md), een
kopie van `docs/backlog.md` in de Quest-repository die gelijk wordt gehouden.

## Een Quest testen tegen het lokale CMS (via de USB-kabel)

Een Quest bereikt `localhost` van de laptop niet, en de wifi is niet altijd aan te passen. Met de
Quest via USB aan de laptop stuurt `adb` het verkeer naar `localhost` op de Quest door naar de
laptop; wifi is dan niet nodig voor het CMS.

1. Quest via USB aan de laptop (ontwikkelaarsmodus aan, USB-foutopsporing toegestaan). Verkeer naar
   poort 8443 op de Quest doorsturen naar het lokale CMS (poort 443):

   ```powershell
   adb reverse tcp:8443 tcp:443
   ```

   Op de Quest bewust 8443 en niet 443: een poort onder 1024 mag daar niet zomaar geopend worden.
   Voor de usability-omgeving (luistert al op 8443) is het `adb reverse tcp:8443 tcp:8443`. De
   e2e-omgeving op 9443 is hier niet voor bedoeld: die verdwijnt na elke testrun.
2. De vingerafdruk van het dev-certificaat (in deze repo):

   ```powershell
   openssl x509 -in nginx/certs/server.crt -noout -fingerprint -sha256
   ```

3. In Unity (Quest-repo): menu *LifeGuard → Create local server settings* met het adres
   `https://localhost:8443` en bij `Pinned Certificate Sha256` de vingerafdruk uit stap 2. Dat
   bestand (`ServerSettings.Local`) staat niet in git. Daarna een Development Build via USB
   (Build And Run); alleen Development Builds vertrouwen het vastgepinde dev-certificaat.
4. Koppelen met de koppelcode van de organisatie (in het CMS onder "Quest koppelen"). Opnieuw
   beginnen of een andere organisatie koppelen: eerst de app-gegevens wissen (ook alle gedownloade
   cursussen):

   ```powershell
   adb shell pm clear com.Futureslab.LifeGuardVR
   ```

5. De app op de Quest starten vanaf de laptop (staat hij er al op, dan is een nieuwe build niet
   nodig):

   ```powershell
   adb shell monkey -p com.Futureslab.LifeGuardVR -c android.intent.category.LAUNCHER 1
   ```

6. Na afloop de doorverwijzing weghalen (of de kabel eruit):

   ```powershell
   adb reverse --remove-all
   ```

Kan de Quest wel op dezelfde wifi als de laptop, dan werkt ook het netwerk-IP van de laptop als
adres (`https://<netwerk-IP>`), met dezelfde vingerafdruk.
