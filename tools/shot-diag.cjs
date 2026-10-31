const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const failed = [];
  const errors = [];
  page.on('response', (r) => {
    if (!r.ok()) failed.push(r.status() + ' ' + r.url());
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(process.argv[2] || 'http://localhost:8124/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log('FAILED REQUESTS:');
  console.log(failed.join('\n'));
  console.log('\nPAGE ERRORS:');
  console.log([...new Set(errors)].slice(0, 15).join('\n'));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
