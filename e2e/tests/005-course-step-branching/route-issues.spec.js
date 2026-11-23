import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';
import { createCourse, openCourse, saveCourse } from '../../helpers/course.js';

// Scenario 8, 9, 10, 11, 12 en 20: meldingen over de route en de lijst "n nog te doen".
// Een andere route dan het voorbeeld wordt via de API klaargezet (saveCourse, met key en nextStepKey).
// Een blok toont alleen zijn eerste melding; alle meldingen van een onderdeel staan in het paneel.
// Bron: docs/e2e plans/e2e-plan-spec-005.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

const video = (key, nextStepKey = null, extra = {}) => ({
  key, stepType: 'video', isStart: false, positionX: 0, positionY: 0, videoId: null, nextStepKey, ...extra,
});
const question = (key, answers, extra = {}) => ({
  key, stepType: 'question', isStart: false, positionX: 0, positionY: 0, questionText: 'Wat doe je?', feedback: null,
  answers: answers.map(([answerText, nextStepKey], i) => ({ answerText, isCorrect: i === 0, nextStepKey })),
  ...extra,
});

/** Nieuwe organisatie en cursus; met `steps` wordt de route via de API vervangen. Opent de editor. */
async function openRoute(browser, tag, steps) {
  const org = await t.organisation({ name: uniqueName(`E2E-005-SC${tag}`) });
  const api = await t.login(org.loginCode);
  let course = await createCourse(api, { name: uniqueName(`SC${tag}-005 cursus`) });
  if (steps) course = await saveCourse(api, course, steps);
  const page = await t.pageAs(browser, org.loginCode);
  await openCourse(page, course.id, { view: 'Canvas + paneel' });
  return { course, page, api };
}

test('scenario 8: een pijl aanklikken en met Delete weghalen', async ({ browser }) => {
  // A. Pijl van antwoord A naar zijn video aanklikken, Delete: de pijl is weg; "Antwoord A is nog niet verbonden";
  // de losse video "Niet bereikbaar vanaf de start".
  const { course, page } = await openRoute(browser, '8');
  const q = course.steps.find((s) => s.stepType === 'question');
  const videoA = q.answers[0].nextStepId;
  const edge = page.getByRole('group', { name: `Edge from s${q.id} to s${videoA}` });
  await expect(edge).toHaveCount(1);

  // Op de lijn zelf klikken (een kwart van de lengte, weg van de letter): het midden van het vak rond een geknikte
  // lijn ligt vaak naast de lijn.
  const point = await edge.locator('.vue-flow__edge-interaction').evaluate((path) => {
    const p = path.getPointAtLength(path.getTotalLength() / 4);
    const m = path.getScreenCTM();
    return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f };
  });
  await page.mouse.click(point.x, point.y);
  await page.keyboard.press('Delete');
  await expect(edge).toHaveCount(0);

  const panel = page.getByRole('complementary');
  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await expect(panel).toContainText('Antwoord A is nog niet verbonden');
  await page.locator(`.vue-flow__node[data-id="s${videoA}"] [data-test="block"]`).click();
  await expect(panel).toContainText('Niet bereikbaar vanaf de start');
});

test('scenario 9: twee video\'s die naar elkaar wijzen, één als start', async ({ browser }) => {
  // A. Route via de API: video 1 (start) naar video 2, video 2 naar video 1. Melding "De route heeft geen einde"
  // en bij beide blokken "Vanaf hier eindigt de route nooit".
  const { course, page } = await openRoute(browser, '9', [
    video('v1', 'v2', { isStart: true }),
    video('v2', 'v1', { positionY: 260 }),
  ]);
  expect(course.steps).toHaveLength(2);

  await page.getByRole('button', { name: /nog te doen/ }).click();
  // Bij 5 of meer punten zijn de groepen dicht (scenario 20); de melding staat in de groep "Cursus".
  await page.getByRole('button', { name: /^Cursus/ }).click();
  await expect(page.getByText('De route heeft geen einde')).toBeVisible();
  await page.keyboard.press('Escape');

  const panel = page.getByRole('complementary');
  for (const step of course.steps) {
    await page.locator(`.vue-flow__node[data-id="s${step.id}"] [data-test="block"]`).click();
    await expect(panel).toContainText('Vanaf hier eindigt de route nooit');
  }
});

test('scenario 10: een onderdeel met twee binnenkomende pijlen verwijderen en Ctrl+Z (SC-007)', async ({ browser }) => {
  // A. Route via de API waarin antwoord A en B naar hetzelfde videoblok gaan en antwoord C naar een ander. Dat blok
  // verwijderen: A en B zonder vervolg en gemeld. Ctrl+Z: het blok en beide pijlen zijn terug.
  // Antwoord C houdt de vraag verbonden: een vraag zonder enig verbonden antwoord is een "Einde" (scenario 3),
  // en dan worden de losse antwoorden niet gemeld.
  const { course, page } = await openRoute(browser, '10', [
    question('q', [['Ik grijp in', 'v'], ['Ik wacht af', 'v'], ['Ik bel 112', 'other']], { isStart: true }),
    video('v', null, { positionY: 260 }),
    video('other', null, { positionX: 300, positionY: 260 }),
  ]);
  const q = course.steps.find((s) => s.stepType === 'question');
  const v = course.steps.find((s) => s.id === q.answers[0].nextStepId);
  const edges = page.getByRole('group', { name: `Edge from s${q.id} to s${v.id}` });
  const nodeV = page.locator(`.vue-flow__node[data-id="s${v.id}"]`);
  const panel = page.getByRole('complementary');
  await expect(edges).toHaveCount(2);

  await nodeV.locator('[data-test="block"]').click();
  await panel.locator('[data-test="remove-step"]').click();
  await expect(nodeV).toHaveCount(0);
  await expect(edges).toHaveCount(0);
  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await expect(panel).toContainText('Antwoord A is nog niet verbonden');
  await expect(panel).toContainText('Antwoord B is nog niet verbonden');

  await page.keyboard.press('Control+z');
  await expect(nodeV).toHaveCount(1);
  await expect(edges).toHaveCount(2);
});

test('scenario 11: het startvakje uitzetten', async ({ browser }) => {
  // A. Bij de startvraag [data-test="start"] uitzetten: "Kies een startonderdeel"; geen meldingen over
  // bereikbaarheid ("Niet bereikbaar vanaf de start").
  const { course, page } = await openRoute(browser, '11');
  const q = course.steps.find((s) => s.stepType === 'question');

  await page.locator(`.vue-flow__node[data-id="s${q.id}"] [data-test="block"]`).click();
  await page.getByRole('complementary').locator('[data-test="start"]').uncheck();

  await page.getByRole('button', { name: /nog te doen/ }).click();
  await expect(page.getByText('Kies een startonderdeel')).toBeVisible();
  await expect(page.getByText('Niet bereikbaar vanaf de start')).toHaveCount(0);
});

test('scenario 12: een melding in "nog te doen" aanklikken', async ({ browser }) => {
  // A+H. "2 nog te doen" openen, een regel "Kies een video" aanklikken: het paneel van dat videoblok opent.
  // Handmatig: dat het blok in beeld schuift.
  const { page } = await openRoute(browser, '12');
  const panel = page.getByRole('complementary');
  await expect(panel).toHaveCount(0);

  await page.getByRole('button', { name: '2 nog te doen' }).click();
  await page.getByRole('button', { name: /^Kies een video/ }).first().click();

  await expect(panel.getByRole('heading', { name: 'Video-onderdeel' })).toBeVisible();
});

test('scenario 20: de groepen in "n nog te doen"', async ({ browser }) => {
  // A. Route via de API zonder start, met twee video's zonder video en een open antwoord (4 punten): groep "Cursus"
  // bovenaan, daaronder "Antwoorden zonder vervolg" (1) en "Video-onderdelen zonder video" (2), alle open. Klik op een
  // kop klapt hem in en uit; klik op een regel opent het blok. Een tweede cursus met 6 punten: de groepen zijn dicht.
  const { page, api } = await openRoute(browser, '20', [
    question('q', [['Ik grijp in', 'v1'], ['Ik wacht af', null]]),
    video('v1', null, { positionY: 260 }),
    video('v2', null, { positionX: 300, positionY: 260 }),
  ]);
  const header = (name) => page.getByRole('button', { name: new RegExp(`^${name}`) });
  const videoRows = page.getByRole('button', { name: /^Kies een video/ });

  await page.getByRole('button', { name: '4 nog te doen' }).click();
  await expect(header('Cursus')).toBeVisible();
  await expect(header('Antwoorden zonder vervolg')).toContainText('1');
  await expect(header('Video-onderdelen zonder video')).toContainText('2');
  const y = async (name) => (await header(name).boundingBox()).y;
  expect(await y('Cursus')).toBeLessThan(await y('Antwoorden zonder vervolg'));
  expect(await y('Cursus')).toBeLessThan(await y('Video-onderdelen zonder video'));
  for (const name of ['Cursus', 'Antwoorden zonder vervolg', 'Video-onderdelen zonder video']) {
    await expect(header(name)).toHaveAttribute('aria-expanded', 'true');
  }

  // Een kop klapt in en weer uit.
  await expect(videoRows).toHaveCount(2);
  await header('Video-onderdelen zonder video').click();
  await expect(header('Video-onderdelen zonder video')).toHaveAttribute('aria-expanded', 'false');
  await expect(videoRows).toHaveCount(0);
  await header('Video-onderdelen zonder video').click();
  await expect(videoRows).toHaveCount(2);

  // Een regel opent het blok.
  await videoRows.first().click();
  await expect(page.getByRole('complementary').getByRole('heading', { name: 'Video-onderdeel' })).toBeVisible();

  // 6 punten (geen start, twee open antwoorden, drie video's zonder video): de groepen zijn dicht.
  let other = await createCourse(api, { name: uniqueName('SC20-005 cursus 2') });
  other = await saveCourse(api, other, [
    question('q', [['Ik grijp in', 'v1'], ['Ik wacht af', null], ['Ik bel 112', null]]),
    video('v1', null, { positionY: 260 }),
    video('v2', null, { positionX: 300, positionY: 260 }),
    video('v3', null, { positionX: 600, positionY: 260 }),
  ]);
  await openCourse(page, other.id, { view: 'Canvas + paneel' });
  await page.getByRole('button', { name: '6 nog te doen' }).click();
  for (const name of ['Cursus', 'Antwoorden zonder vervolg', 'Video-onderdelen zonder video']) {
    await expect(header(name)).toHaveAttribute('aria-expanded', 'false');
  }
});
