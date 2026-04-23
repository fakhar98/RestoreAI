const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const fixturePath = path.resolve(__dirname, '..', 'node_modules', '@upscalerjs', 'maxim-deblurring', 'assets', 'fixture.png');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Wait for the hidden file input and upload the fixture image
  const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
  await fileInput.setInputFiles(fixturePath);

  // Click Run AI Restore to ensure AI path is executed
  try {
    const runBtn = await page.waitForSelector('button:has-text("Run AI Restore")', { timeout: 20000 });
    await runBtn.click();
  } catch (e) {
    // ignore if not found
  }

  // Wait for processed "After" image to appear
  const afterSelector = 'img[alt="After processing"]';
  await page.waitForSelector(afterSelector, { timeout: 120000 });

  const afterSrc = await page.getAttribute(afterSelector, 'src');
  if (!afterSrc) {
    console.error('No processed image src found');
    fs.writeFileSync(path.join(artifactsDir, 'console.log'), consoleMessages.join('\n'));
    await browser.close();
    process.exit(2);
  }

  if (afterSrc.startsWith('data:')) {
    const base64 = afterSrc.split(',')[1];
    const outPath = path.join(artifactsDir, 'ai-restored.jpg');
    fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
    console.log('Saved restored image to', outPath);
  } else {
    // If it's a remote URL, fetch and save
    const res = await page.request.get(afterSrc);
    const outPath = path.join(artifactsDir, 'ai-restored.jpg');
    const buffer = await res.body();
    fs.writeFileSync(outPath, buffer);
    console.log('Downloaded restored image to', outPath);
  }

  fs.writeFileSync(path.join(artifactsDir, 'console.log'), consoleMessages.join('\n'));

  await browser.close();
  console.log('Done.');
})();
