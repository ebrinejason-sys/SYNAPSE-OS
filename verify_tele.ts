import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to /tele...');
    await page.goto('http://localhost:3000/tele');

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

    // Step 10: District (Step 10 Pregnant is skipped for Male)
    await page.waitForSelector('button:has-text("Kampala")');
    await page.click('button:has-text("Kampala")');

    // Step 11: Urgency
    await page.waitForSelector('button:has-text("Today")');
    await page.click('button:has-text("Today")');

    // Step 12: Insurance
    await page.waitForSelector('button:has-text("pay cash")');
    await page.click('button:has-text("pay cash")');

    console.log('Verifying triage result...');
    await page.waitForSelector('text=urgent', { timeout: 10000 });
    console.log('✅ Triage result visible');
    await page.screenshot({ path: '/home/jules/verification/tele_triage.png' });

    console.log('Booking appointment...');
    await page.click('button:has-text("Okello")');
    await page.waitForURL('**/tele/booking**');

    await page.fill('input[placeholder="John Doe"]', 'John Test');
    await page.fill('input[placeholder="+256..."]', '+256700000000');
    await page.click('button:has-text("CONFIRM")');

    console.log('Verifying confirmation...');
    await page.waitForURL('**/tele/booked/**');
    console.log('✅ Appointment confirmed');
    await page.screenshot({ path: '/home/jules/verification/tele_confirmed.png' });

    console.log('Joining room...');
    await page.click('button:has-text("JOIN")');
    await page.waitForURL('**/tele/room/**');
    console.log('✅ Consultation room loaded');
    await page.screenshot({ path: '/home/jules/verification/tele_room.png' });

    console.log('Ending call...');
    // The End Call button is the last button in footer
    await page.click('footer button:last-child');
    await page.waitForSelector('text=Ended');
    console.log('✅ Post-call summary visible');
    await page.screenshot({ path: '/home/jules/verification/tele_ended.png' });

  } catch (err) {
    console.error('Verification failed:', err);
    await page.screenshot({ path: '/home/jules/verification/tele_error.png' });
  } finally {
    await browser.close();
  }
})();
