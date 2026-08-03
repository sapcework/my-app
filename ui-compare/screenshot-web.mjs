// Captures a screenshot of each main kakeiboWeb screen using the saved login session
// (auth.json, produced by login-setup.mjs). Saves to screenshots/web/<name>.png so they
// can be compared side by side with screenshots/app/<name>.png (from the Flutter app).
//
// Usage: npm run shots
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.KAKEIBO_WEB_URL ?? 'https://kakeibo-test.vercel.app';

if (!existsSync('auth.json')) {
  console.error('auth.json not found. Run "npm run login" first to save a logged-in session.');
  process.exit(1);
}

// route path -> output file name (kept in sync with the Flutter side's screen names)
const PAGES = {
  '/': 'home',
  '/expenses': 'expenses',
  '/table': 'table',
  '/stats': 'stats',
  '/settings': 'settings',
  '/categories': 'categories',
  '/budget': 'budget',
  '/recurring': 'recurring',
};

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: 'auth.json',
  viewport: { width: 430, height: 900 }, // mobile-first layout, matches the app's phone-sized design
});
const page = await context.newPage();

for (const [path, name] of Object.entries(PAGES)) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300); // let animations/charts settle
  await page.screenshot({ path: `screenshots/web/${name}.png` });
  console.log(`saved screenshots/web/${name}.png`);
}

await browser.close();
