import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { loginViaScreen } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 9, 10, 11, 12 en 17: ongedaan maken, niet-opgeslagen wijzigingen, opslaan zonder netwerk, twee tabbladen.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 9: een onderdeel verwijderen en met Ctrl+Z terugzetten', async ({ browser }) => {
  // A. Een blok openen, [data-test="remove-step"]: geen bevestigingsvraag, het blok is weg.
  // Ctrl+Z (focus niet in een tekstveld, of de knop "Ongedaan maken (Ctrl+Z)"): het blok is terug en
  // [data-test="save"] toont "Opgeslagen".
});

test.fixme('scenario 10: weggaan met niet-opgeslagen wijzigingen', async ({ browser }) => {
  // A. Iets wijzigen (bijvoorbeeld knop "Vraag"), de terugknop (title "Terug naar cursussen"):
  // alertdialog "Wijzigingen niet opgeslagen"; "Annuleren": de editor blijft open.
});

test.fixme('scenario 11: herladen met niet-opgeslagen wijzigingen', async ({ browser }) => {
  // A. Iets wijzigen; page.on('dialog') en page.reload(): de dialoog heeft type "beforeunload".
  // Test de waarschuwing van de browser, niet die van de app (scenario 10).
});

test.fixme('scenario 12: opslaan zonder netwerk', async ({ browser }) => {
  // A. Iets toevoegen; context.setOffline(true); opslaan: toast "De cursus is niet opgeslagen. Probeer het opnieuw."
  // en de wijziging staat er nog. context.setOffline(false), opnieuw opslaan, herladen: het onderdeel staat er één keer.
});

test.fixme('scenario 17: twee tabbladen, de laatste opslag wint', async ({ browser }) => {
  // A. Twee pagina's in één context met dezelfde cursus. In tabblad 1 en 2 iets anders wijzigen (bijvoorbeeld een
  // andere naam via de cursustitel), eerst 1 opslaan en dan 2. Herladen: de wijziging van 2 staat er; geen waarschuwing.
});
