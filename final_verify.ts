import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 320, height: 600 }
  });
  const page = await context.newPage();

  try {
    console.log('1. Checking Landing Page...');
    await page.goto('http://localhost:3000/');
    await page.waitForSelector('text=Intelligence');
    console.log('✅ Landing Page Loaded');

    console.log('2. Checking Mobile Nav...');
    await page.click('button[aria-label="Open menu"]');
    await page.waitForSelector('text=Telemedicine');
    console.log('✅ Mobile Nav Operational');
    await page.click('button:has(svg.w-6.h-6)'); // Close

    console.log('3. Checking Pricing Visibility...');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const dollarSign = await page.locator('text=$').first();
    if (await dollarSign.isVisible()) {
      console.log('✅ Dollar sign visible in grid');
    }

    console.log('4. Checking Chatbot Flow...');
    await page.goto('http://localhost:3000/tele');
    await page.click('button:has-text("START")');
    await page.waitForSelector('text=AI Assistant');
    console.log('✅ Chatbot Started');

    console.log('5. Checking Doctor Dashboard...');
    await page.goto('http://localhost:3000/doctor/tele');
    await page.waitForSelector('text=Telemedicine Dashboard');
    console.log('✅ Doctor Dashboard Loaded');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
