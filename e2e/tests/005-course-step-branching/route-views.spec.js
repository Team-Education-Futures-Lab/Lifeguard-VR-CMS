import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, saveCourse } from '../../helpers/course.js';

// Scenario 13, 14, 19 en 21: de weergave "Lijst", "Canvas ordenen" en de tooltip op een blok.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 13: de weergave "Lijst"', async ({ browser }) => {
  // A. Route via de API met een vertakking, een lus en een los onderdeel. Weergave "Lijst": de route vanaf de start
  // met A/B-vertakkingen, "Einde", "Verder bij “…”" bij de lus, het losse onderdeel onder "Niet bereikbaar".
});

test.fixme('scenario 14: "Canvas ordenen" zonder bevestigingsvraag', async ({ browser }) => {
  // A+H. Knop "Canvas ordenen": geen alertdialog; melding "Canvas geordend" met "Ongedaan maken".
  // Handmatig: de nieuwe indeling (volgens de route, vertakkingen naast elkaar).
});

test.fixme('scenario 19: de tooltip bij geen of één binnenkomende pijl', async ({ browser }) => {
  // A. Met de muis op de startvraag (geen binnenkomende pijl): geen tooltip. Op een videoblok (één pijl):
  // "Wordt bereikt vanuit 1 verbinding". Nergens een vaste "← n" op een blok.
});

test.fixme('scenario 21: "Canvas ordenen", "Ongedaan maken" en Ctrl+Y', async ({ browser }) => {
  // A. Posities op het canvas (de transform van het Vue Flow-blok, zoals in spec 004 scenario 14e) voor het ordenen.
  // "Canvas ordenen", "Ongedaan maken" in de melding: posities gelijk aan ervoor. Ctrl+Y: weer de geordende posities.
});
