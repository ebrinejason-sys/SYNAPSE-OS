import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login');

    console.log('Testing Doctor Demo fill...');
    await page.click('button:has-text("Doctor View")');
    const email = await page.inputValue('input[type="email"]');
    const password = await page.inputValue('input[type="password"]');

    if (email === 'demodoc@synapseos.tech' && password === 'Demo4321') {
      console.log('✅ Doctor demo fill works');
    } else {
      console.error('❌ Doctor demo fill failed:', { email, password });
    }

    console.log('Testing login redirection...');
    await page.click('button:has-text("Sign In to Workspace")');
    await page.waitForURL('**/doctor/queue');
    console.log('✅ Doctor login redirection works:', page.url());

    await page.screenshot({ path: '/home/jules/verification/doctor_dashboard.png' });

    console.log('Navigating back to login for patient test...');
    await page.goto('http://localhost:3000/login');
    await page.click('button:has-text("Patient View")');
    await page.click('button:has-text("Sign In to Workspace")');
    await page.waitForURL('**/app/dashboard');
    console.log('✅ Patient login redirection works:', page.url());
    await page.screenshot({ path: '/home/jules/verification/patient_dashboard.png' });

    console.log('Checking Theme Toggle...');
    await page.goto('http://localhost:3000/');
    const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('light') ? 'light' : 'dark');
    console.log('Initial theme:', initialTheme);

    // Header theme toggle
    await page.click('button[title*="Switch to"]');
    const toggledTheme = await page.evaluate(() => document.documentElement.classList.contains('light') ? 'light' : 'dark');
    console.log('Toggled theme:', toggledTheme);

    if (initialTheme !== toggledTheme) {
      console.log('✅ Theme toggle works');
    } else {
      console.error('❌ Theme toggle failed');
    }
    await page.screenshot({ path: '/home/jules/verification/landing_page_light.png' });

    console.log('Testing Pilot Application form...');
    await page.goto('http://localhost:3000/apply?plan=professional');
    await page.fill('input[placeholder*="Mengo"]', 'Test Hospital');
    await page.fill('input[placeholder*="Kampala"]', 'Test City');
    await page.fill('input[placeholder*="50-100"]', '10');
    await page.fill('input[placeholder="Your Name"]', 'Test Admin');
    await page.fill('input[placeholder="name@facility.com"]', 'test@example.com');
    await page.fill('textarea', 'Testing the integration');

    await page.click('button:has-text("SUBMIT APPLICATION")');
    await page.waitForSelector('text=Application Received');
    console.log('✅ Pilot application submission works');
    await page.screenshot({ path: '/home/jules/verification/apply_success.png' });

  } catch (err) {
    console.error('Verification failed:', err);
    await page.screenshot({ path: '/home/jules/verification/error.png' });
  } finally {
    await browser.close();
  }
})();
