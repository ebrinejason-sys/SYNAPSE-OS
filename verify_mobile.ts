import { chromium, devices } from 'playwright';

(async () => {
  const iPhone13 = devices['iPhone 13'];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...iPhone13,
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to landing page on mobile...');
    await page.goto('http://localhost:3000/');

    // Check for overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      console.error('❌ Horizontal scroll detected on mobile!');
    } else {
      console.log('✅ No horizontal scroll on mobile');
    }

    await page.screenshot({ path: '/home/jules/verification/landing_mobile.png', fullPage: true });

    console.log('Checking Pricing Section...');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/home/jules/verification/pricing_mobile.png' });

    const priceText = await page.textContent('.text-5xl.font-black');
    console.log('Sample Price Text:', priceText);

    console.log('Checking Pricing Modal on mobile...');
    await page.click('button:has-text("Request Pilot")');
    await page.waitForSelector('text=Tier Selected');
    await page.screenshot({ path: '/home/jules/verification/pricing_modal_mobile.png' });

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await browser.close();
  }
})();
