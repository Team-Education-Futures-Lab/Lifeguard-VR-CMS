import { test as teardown, request } from '@playwright/test';
import fs from 'node:fs';
import { BASE_URL } from '../helpers/base-url.js';

const runInfoFile = 'playwright/.auth/run-org.json';
const adminFile = 'playwright/.auth/admin.json';

teardown('testorganisatie opruimen', async () => {
  // Heeft de setup de organisatie nooit aangemaakt, dan is er niets op te ruimen.
  if (!fs.existsSync(runInfoFile)) return;

  const { id } = JSON.parse(fs.readFileSync(runInfoFile, 'utf8'));

  const api = await request.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    storageState: adminFile,
    extraHTTPHeaders: { 'X-Requested-With': 'cms' },
  });
  await api.delete(`/api/admin/organisations/${id}`);
  await api.dispose();

  fs.unlinkSync(runInfoFile); // het bestand hoort bij deze run, dus ook weg
});