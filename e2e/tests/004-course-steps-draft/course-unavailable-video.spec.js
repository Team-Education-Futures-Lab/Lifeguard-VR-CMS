import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { openLibraryAs, uploadVideos } from '../../helpers/video-upload.js';
import { createCourse, openCourse, openStep } from '../../helpers/course.js';

// Scenario 14, 14a t/m 14e en 23: een video die onbeschikbaar wordt terwijl een cursus hem gebruikt.
// 14a t/m 14e zijn scenario 18, 19, 20, 21 en 21a uit de quickstart. Elke test zet de situatie van 14 zelf
// klaar (setupUnavailableVideo), zodat hij los kan draaien.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e plans/e2e-plan-spec-004.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

/**
 * De situatie van scenario 14: B maakt een video "Selectief" voor A, A kiest hem in een videoblok en slaat op,
 * B zet hem op "Alleen eigen organisatie". Geeft de pagina van A terug, met de cursus open.
 */
async function setupUnavailableVideo(browser) {
  // Nog in te vullen.
}

test.fixme('scenario 14: A ziet een video die onbeschikbaar is geworden nog in de cursus', async ({ browser }) => {
  // A. Na setupUnavailableVideo: het blok toont nog naam en duur; opslaan lukt. In /videos en in de kiezer
  // ([data-test="video-option"]) staat de video niet meer.
});

test.fixme('scenario 14a: het onderdeel verwijderen geeft een waarschuwing', async ({ browser }) => {
  // A. [data-test="remove-step"]: alertdialog "Video niet meer beschikbaar"; "Annuleren": het onderdeel blijft.
});

test.fixme('scenario 14b: "Wijzig" en "Video weghalen" geven een waarschuwing', async ({ browser }) => {
  // A. "Wijzig" en apart [data-test="remove-video"]: beide eerst dezelfde waarschuwing. "Annuleren" laat de video
  // staan; "Doorgaan" voert het uit.
});

test.fixme('scenario 14c: na verwijderen met Doorgaan zet Ctrl+Z het onderdeel met video terug', async ({ browser }) => {
  // A. Verwijderen met "Doorgaan", Ctrl+Z: onderdeel en video zijn terug; opslaan lukt.
});

test.fixme('scenario 14d: na opslaan komt het onderdeel terug zonder video', async ({ browser }) => {
  // A. Verwijderen met "Doorgaan", opslaan, Ctrl+Z: het blok is terug zonder video, met [data-test="lost-video"]
  // "Deze video is niet meer beschikbaar en kan niet worden teruggezet." Opslaan lukt; na herladen is het een
  // video-onderdeel zonder video.
});

test.fixme('scenario 14e: na een andere video kiezen, opslaan, Ctrl+Z en Ctrl+Y', async ({ browser }) => {
  // A. "Wijzig", "Doorgaan", een andere (eigen) video kiezen, opslaan. Ctrl+Z: het blok staat op dezelfde plek
  // zonder video, met [data-test="lost-video"]. Ctrl+Y: de gekozen video staat er weer.
});

test.fixme('scenario 23: B verwijdert een algemene video die A gebruikt', async ({ browser }) => {
  // A. Zoals 14, maar B uploadt de video "Algemeen" en verwijdert hem (zacht) nadat A hem heeft gekozen en opgeslagen.
  // A ziet in de cursus nog naam en duur; in /videos en in de kiezer staat hij niet meer.
});
