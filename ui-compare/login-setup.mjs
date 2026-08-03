// One-time setup: opens a real (headed) browser so you can log in to kakeiboWeb by hand.
// Once logged in, the session (cookies/localStorage) is saved to auth.json so that
// screenshot-web.mjs can reuse it headlessly without logging in again each time.
//
// Usage: npm run login
import { chromium } from 'playwright';

const BASE_URL = process.env.KAKEIBO_WEB_URL ?? 'https://kakeibo-test.vercel.app';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(BASE_URL);
console.log('Please log in in the opened browser window...');

// The bottom nav "ホーム" label only appears once you're authenticated.
await page.waitForSelector('text=ホーム', { timeout: 5 * 60 * 1000 });
console.log('Login detected. Saving session to auth.json ...');

await context.storageState({ path: 'auth.json' });
await browser.close();

console.log('Done. You can now run: npm run shots');
