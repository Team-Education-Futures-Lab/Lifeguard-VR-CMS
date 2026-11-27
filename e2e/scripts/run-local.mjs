// Runs the Playwright tests locally in their own environment, never against the development
// database:
//   npm run test:local [-- <playwright arguments>]     e.g. npm run test:local -- tests/011-course-reference-copy
//   npm run test:local -- --keep                         leave the environment running afterwards
// Each run starts with an empty database (like CI): the Compose project "e2e"
// (docker-compose.yml + docker-compose.e2e.yml) is removed with its volumes, built and started,
// migrated, the test administrator from e2e/.env (E2E_ADMIN_LOGIN, E2E_ADMIN_PASSWORD) is
// created, and afterwards everything is removed again. The app runs on https://localhost:9443.
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(e2eDir, '..');
dotenv.config({ path: path.join(e2eDir, '.env'), quiet: true });

const port = process.env.E2E_HTTPS_PORT || '9443';
const baseUrl = `https://localhost:${port}`;
const compose = ['compose', '-p', 'e2e', '-f', 'docker-compose.yml', '-f', 'docker-compose.e2e.yml'];
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const playwrightArgs = args.filter((arg) => arg !== '--keep');

function run(command, commandArgs, { cwd = root, input, env } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    input,
    env: { ...process.env, ...env, E2E_HTTPS_PORT: port },
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

function step(label, command, commandArgs, options) {
  console.log(`\n== ${label}`);
  const status = run(command, commandArgs, options);
  if (status !== 0) throw new Error(`${label} failed (exit ${status})`);
}

/** Waits until GET /api/health answers 200 (the certificate is self-signed). */
async function waitForHealth() {
  console.log(`\n== Wachten op ${baseUrl}/api/health`);
  for (let attempt = 0; attempt < 60; attempt++) {
    const ok = await new Promise((resolve) => {
      https
        .get(`${baseUrl}/api/health`, { rejectUnauthorized: false }, (res) => {
          res.resume();
          resolve(res.statusCode === 200);
        })
        .on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('De API antwoordt niet');
}

const { E2E_ADMIN_LOGIN: adminLogin, E2E_ADMIN_PASSWORD: adminPassword } = process.env;
if (!adminLogin || !adminPassword) {
  console.error('Zet E2E_ADMIN_LOGIN en E2E_ADMIN_PASSWORD in e2e/.env');
  process.exit(1);
}

let exitCode = 1;
try {
  step('Oude e2e-omgeving weghalen', 'docker', [...compose, 'down', '--volumes', '--remove-orphans']);
  step('E2e-omgeving bouwen en starten', 'docker', [...compose, 'up', '-d', '--build', 'db', 'api', 'web']);
  await waitForHealth();
  step('Migraties', 'docker', [...compose, 'exec', '-T', 'api', 'npx', 'knex', 'migrate:latest']);
  step('Testbeheerder aanmaken', 'docker', [...compose, 'exec', '-T', 'api', 'node', 'scripts/create-admin.js', adminLogin], {
    input: `${adminPassword}\n${adminPassword}\n`,
  });
  console.log(`\n== Playwright tegen ${baseUrl}`);
  exitCode = run('npx', ['playwright', 'test', ...playwrightArgs], { cwd: e2eDir, env: { E2E_BASE_URL: baseUrl } });
} catch (error) {
  console.error(`\n${error.message}`);
} finally {
  if (keep) console.log(`\nDe e2e-omgeving draait nog op ${baseUrl} (weghalen: docker ${compose.join(' ')} down --volumes)`);
  else run('docker', [...compose, 'down', '--volumes', '--remove-orphans']);
}
process.exit(exitCode);
