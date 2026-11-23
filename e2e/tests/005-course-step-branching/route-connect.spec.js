import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 3, 4, 6, 15 en 16: onderdelen verbinden via het menu bij een verbindingspunt.
// Verbinden gaat via het menu ("+" of de letter aanklikken), niet door te slepen.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 3: "+" onder video A, "Nieuwe vraag"', async ({ browser }) => {
  // A. Het venster van de nieuwe vraag is open; een pijl van video A naar de vraag; video A heeft geen "Einde"
  // meer, de nieuwe vraag wel (geen antwoord verbonden).
});

test.fixme('scenario 4: antwoord A van de nieuwe vraag naar een nieuw video-onderdeel', async ({ browser }) => {
  // A+H. Zoals 3, dan op "A" van de nieuwe vraag, "Nieuw video-onderdeel": melding "Antwoord B is nog niet verbonden".
  // Handmatig: de oranje kleur.
});

test.fixme('scenario 6: antwoord B terug naar video A (lus)', async ({ browser }) => {
  // A. Zoals 4, dan op "B", "Bestaand onderdeel", video A: pijl met "B ↺"; de melding is weg; met de muis op
  // video A de tooltip "Wordt bereikt vanuit 2 verbindingen"; geen "← 2" op het blok.
});

test.fixme('scenario 15: een video-onderdeel kan zichzelf niet als vervolg kiezen', async ({ browser }) => {
  // A. Bij het "+" van een videoblok, "Bestaand onderdeel": het eigen blok staat er niet in.
  // In het venster van dat blok biedt "Daarna" het eigen blok niet aan (FR-003).
});

test.fixme('scenario 16: "Nieuwe vraag" op een "+" dat al verbonden is', async ({ browser }) => {
  // A. Video A naar video B verbinden; daarna op het "+" van video A, "Nieuwe vraag": de vraag staat ertussen,
  // antwoord A gaat naar video B (het oude vervolg) en "Antwoord B is nog niet verbonden".
});
