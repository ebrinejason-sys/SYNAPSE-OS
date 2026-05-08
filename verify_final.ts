import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 320, height: 600 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to landing page at 320px...');
    await page.goto('http://localhost:3000/');

    // Check for overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      console.error('❌ Horizontal scroll detected at 320px!');
    } else {
      console.log('✅ No horizontal scroll at 320px');
    }

    await page.screenshot({ path: '/home/jules/verification/final_320px.png', fullPage: true });

    console.log('Checking Pricing Section visibility...');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/home/jules/verification/final_pricing_320px.png' });

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await browser.close();
  }
})();
