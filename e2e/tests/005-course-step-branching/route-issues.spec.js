import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, openStep, saveCourse } from '../../helpers/course.js';

// Scenario 8, 9, 10, 11, 12 en 20: meldingen over de route en de lijst "n nog te doen".
// Een andere route dan het voorbeeld wordt via de API klaargezet (saveCourse, met key en nextStepKey).
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 8: een pijl aanklikken en met Delete weghalen', async ({ browser }) => {
  // A. Pijl van antwoord A naar zijn video aanklikken, Delete: de pijl is weg; "Antwoord A is nog niet verbonden";
  // de losse video "Niet bereikbaar vanaf de start".
});

test.fixme('scenario 9: twee video\'s die naar elkaar wijzen, één als start', async ({ browser }) => {
  // A. Route via de API: video 1 (start) naar video 2, video 2 naar video 1. Meldingen "De route heeft geen einde"
  // en bij beide blokken "Vanaf hier eindigt de route nooit".
});

test.fixme('scenario 10: een onderdeel met twee binnenkomende pijlen verwijderen en Ctrl+Z (SC-007)', async ({ browser }) => {
  // A. Route via de API waarin antwoord A en B naar hetzelfde videoblok gaan. Dat blok verwijderen: beide
  // antwoorden zonder vervolg en gemeld. Ctrl+Z: het blok en beide pijlen zijn terug.
});

test.fixme('scenario 11: het startvakje uitzetten', async ({ browser }) => {
  // A. Bij de startvraag [data-test="start"] uitzetten: alleen "Kies een startonderdeel"; geen meldingen over
  // bereikbaarheid ("Niet bereikbaar vanaf de start").
});

test.fixme('scenario 12: een melding in "nog te doen" aanklikken', async ({ browser }) => {
  // A+H. "2 nog te doen" openen, een regel "Kies een video" aanklikken: het venster van dat videoblok opent.
  // Handmatig: dat het blok in beeld schuift.
});

test.fixme('scenario 20: de groepen in "n nog te doen"', async ({ browser }) => {
  // A. Route via de API met een start-probleem, twee video's zonder video en een open antwoord. De lijst: groep
  // "Cursus" bovenaan, daaronder "Antwoorden zonder vervolg" (1) en "Video-onderdelen zonder video" (2).
  // Bij minder dan 5 punten open, bij 5 of meer dicht; klik op een kop klapt hem in of uit; klik op een regel
  // opent het blok.
});
