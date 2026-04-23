const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext();
    const page = await context.newPage();

    const logs = [];
    const requests = [];

    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
      console.log('PAGE LOG:', msg.type(), msg.text());
    });

    page.on('request', req => {
      requests.push({ url: req.url(), method: req.method() });
      console.log('REQ', req.method(), req.url());
    });

    page.on('response', res => {
      console.log('RES', res.status(), res.url());
    });

    const url = 'http://localhost:5173/';
    console.log('Opening', url);
    await page.goto(url, { timeout: 120000 });

    await page.waitForSelector('input[type=file]', { timeout: 60000 });

    const filePath = path.resolve(__dirname, '..', 'tmp', 'blurred.jpg');
    if (!fs.existsSync(filePath)) {
      console.error('Sample image missing:', filePath);
      await browser.close();
      process.exit(1);
    }

    const input = await page.$('input[type=file]');
    await input.setInputFiles(filePath);
    console.log('File uploaded');

    // Click Run AI Restore if the button is present (this is optional)
    try {
      const aiBtn = await page.$('text="Run AI Restore"');
      if (aiBtn) {
        await aiBtn.click();
        console.log('Clicked Run AI Restore button');
      }
    } catch (e) {
      // ignore
    }

    console.log('Waiting for processed image...');
    await page.waitForSelector('img[alt="After processing"]', { timeout: 180000 });

    const src = await page.getAttribute('img[alt="After processing"]', 'src');
    console.log('Processed src length:', src ? src.length : 'none');

    if (src && src.startsWith('data:')) {
      const match = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
      if (match) {
        const mime = match[1];
        const ext = mime.split('/')[1];
        const b64 = match[2];
        const out = path.resolve(__dirname, '..', 'tmp', `processed.${ext}`);
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.log('Saved processed image:', out);
      } else {
        const out = path.resolve(__dirname, '..', 'tmp', 'processed.bin');
        const commaIndex = src.indexOf(',');
        const raw = src.slice(commaIndex + 1);
        fs.writeFileSync(out, Buffer.from(raw, 'base64'));
        console.log('Saved processed image to', out);
      }
    } else if (src) {
      // external URL
      try {
        const res = await page.request.get(src);
        const out = path.resolve(__dirname, '..', 'tmp', 'processed.jpg');
        const buffer = Buffer.from(await res.body());
        fs.writeFileSync(out, buffer);
        console.log('Saved processed image:', out);
      } catch (err) {
        console.error('Failed to fetch processed src:', err.message || err);
      }
    } else {
      console.error('No processed src found');
    }

    fs.writeFileSync(path.resolve(__dirname, '..', 'tmp', 'page-logs.json'), JSON.stringify({ logs, requests }, null, 2));
    console.log('Wrote logs to tmp/page-logs.json');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
