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

    await page.screenshot({ path: '/home/jules/verification/final_v2_320px.png', fullPage: true });

    console.log('Testing Mobile Navigation...');
    await page.click('button[aria-label="Open menu"]');
    await page.waitForSelector('text=Telemedicine');
    console.log('✅ Mobile Nav works');
    await page.screenshot({ path: '/home/jules/verification/mobile_nav_v2.png' });
    await page.click('button:has(svg.w-6.h-6)'); // Close button X

    console.log('Checking Pricing Section visibility...');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/home/jules/verification/pricing_v2_320px.png' });

    console.log('Opening Pricing Modal...');
    // Use the first "Start Trial" or similar button
    await page.click('button:has-text("Get Started")');
    await page.waitForSelector('text=Plan Detail');
    await page.screenshot({ path: '/home/jules/verification/modal_v2_320px.png' });

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await browser.close();
  }
})();
