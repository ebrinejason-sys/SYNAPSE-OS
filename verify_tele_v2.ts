import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to landing page...');
    await page.goto('http://localhost:3000/');

    console.log('Verifying Telemedicine link...');
    // Use a more specific selector to avoid strict mode violation
    await page.click('a[href="/tele"]:visible >> nth=0');
    await page.waitForURL('**/tele');
    console.log('✅ Telemedicine link works');

    console.log('Starting consultation...');
    await page.click('button:has-text("START")');

    // Step 1: Symptom
    await page.waitForSelector('button:has-text("Fever")');
    await page.click('button:has-text("Fever")');

    // Step 2: Duration
    await page.waitForSelector('button:has-text("1–3 days")');
    await page.click('button:has-text("1–3 days")');

    // Step 3: Severity
    await page.waitForSelector('button:has-text("7")');
    await page.click('button:has-text("7")');

    // Step 4: Extra Symptoms
    await page.waitForSelector('button:has-text("Nausea")');
    await page.click('button:has-text("Nausea")');
    await page.click('button:has-text("Continue")');

    // Step 5: Medications
    await page.waitForSelector('input');
    await page.fill('input', 'None');
    await page.click('button:has-text("Continue")');

    // Step 6: Allergies
    await page.waitForSelector('input');
    await page.fill('input', 'None');
    await page.click('button:has-text("Continue")');

    // Step 7: Conditions
    await page.waitForSelector('button:has-text("None")');
    await page.click('button:has-text("None")');
    await page.click('button:has-text("Continue")');

    // Step 8: Age
    await page.waitForSelector('input');
    await page.fill('input', '30');
    await page.click('button:has-text("Continue")');

    // Step 9: Sex
    await page.waitForSelector('button:has-text("Male")');
    await page.click('button:has-text("Male")');

    // Step 10: District
    await page.waitForSelector('button:has-text("Kampala")');
    await page.click('button:has-text("Kampala")');

    // Step 11: Urgency
    await page.waitForSelector('button:has-text("Today")');
    await page.click('button:has-text("Today")');

    // Step 12: Insurance
    await page.waitForSelector('button:has-text("pay cash")');
    await page.click('button:has-text("pay cash")');

    console.log('Verifying triage result...');
    await page.waitForSelector('text=urgent');
    console.log('✅ Triage result visible');
    await page.screenshot({ path: '/home/jules/verification/tele_flow_success.png' });

  } catch (err) {
    console.error('Verification failed:', err);
    await page.screenshot({ path: '/home/jules/verification/tele_flow_error.png' });
  } finally {
    await browser.close();
  }
})();
