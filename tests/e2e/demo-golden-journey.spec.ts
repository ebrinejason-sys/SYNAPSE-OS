/**
 * Demo Golden Journey E2E Test
 * 
 * Tests the complete connected-care workflow:
 * Reception → Triage → Doctor → Lab → Pharmacy → Billing
 * 
 * Requirements:
 * - No 404 errors
 * - No 500 errors
 * - No production Supabase health data mutations
 * - Same patient (Amina Demo) moves through all facilities
 * - State persists across page reloads
 * - All workflows complete successfully
 */

import { test, expect } from '@playwright/test';

test.describe('Demo Golden Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Reset demo playground before each test
    await page.goto('/demo');
    await page.evaluate(() => {
      return indexedDB.deleteDatabase('synapse-demo-playground');
    });
    await page.reload();
  });

  test('complete golden journey: reception → triage → doctor → lab → pharmacy → billing', async ({ page }) => {
    // Step 1: Login as Reception
    await page.goto('/demo/login');
    await expect(page.locator('h1')).toContainText('Explore SYNAPSE Test Drive');
    
    await page.locator('button:has-text("Enter as Reception")').click();
    await page.waitForURL('/demo/workspace');
    
    // Step 2: Reception - Register Patient
    await page.goto('/demo/reception');
    await expect(page.locator('h1')).toContainText('Reception');
    
    // Search for Amina Demo
    await page.locator('input[placeholder*="Search"]').fill('Amina');
    await page.locator('button:has-text("Search")').click();
    
    // Select Amina Demo
    await page.locator('text=Amina Demo').first().click();
    
    // Fill visit form
    await page.locator('button:has-text("consultation")').click();
    await page.locator('button:has-text("OPD")').click();
    await page.locator('button:has-text("cash")').click();
    await page.locator('textarea[placeholder*="complaint"]').fill('Fever and headache for 3 days');
    
    // Start visit
    await page.locator('button:has-text("Start Visit")').click();
    await expect(page.locator('text=Visit Started Successfully')).toBeVisible();
    
    const encounterId = await page.locator('text=/Encounter ID/').textContent();
    console.log('Created encounter:', encounterId);
    
    // Step 3: Switch to Nurse
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("Nurse Demo")').click();
    
    await page.goto('/demo/nurse');
    await expect(page.locator('h1')).toContainText('Nurse');
    
    // Record vitals
    await page.locator('input[placeholder="37.0"]').fill('38.2');
    await page.locator('input[placeholder="80"]').fill('96');
    await page.locator('input[placeholder="120"]').first().fill('110');
    await page.locator('input[placeholder="80"]').last().fill('70');
    await page.locator('input[placeholder="98"]').fill('98');
    
    // Select triage category
    await page.locator('button:has-text("GREEN")').click();
    
    // Save and send to doctor
    await page.locator('button:has-text("Save Triage")').click();
    await expect(page.locator('text=Triage Completed')).toBeVisible();
    
    // Step 4: Switch to Doctor
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("Doctor Demo")').click();
    
    await page.goto('/demo/doctor');
    await expect(page.locator('h1')).toContainText('Doctor');
    
    // Fill HPI
    await page.locator('button:has-text("History")').click();
    await page.locator('textarea[placeholder*="history"]').fill('Patient reports 3 days of fever and headache. No other symptoms.');
    
    // Order lab test
    await page.locator('button:has-text("Investigations")').click();
    await page.locator('label:has-text("Full Blood Count")').click();
    await page.locator('button:has-text("Order")').click();
    
    // Write prescription
    await page.locator('button:has-text("Prescriptions")').click();
    await page.locator('button:has-text("Add Medication")').click();
    
    // Sign note
    await page.locator('button:has-text("Disposition")').click();
    await page.locator('button:has-text("Sign Note")').click();
    await expect(page.locator('text=Clinical Note Signed')).toBeVisible();
    
    // Step 5: Switch to Lab Technician
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("SYNAPSE Demo Laboratory")').click();
    await page.locator('button:has-text("Lab Technician Demo")').click();
    
    await page.goto('/demo/lab');
    await expect(page.locator('h1')).toContainText('Lab');
    
    // Accept order
    await page.locator('button:has-text("Accept Order")').click();
    
    // Collect specimen
    await page.locator('button:has-text("Collect Specimen")').click();
    
    // Enter result
    await page.locator('input[placeholder="e.g. 12.5"]').fill('12.5');
    await page.locator('input[placeholder="e.g. g/dL"]').fill('g/dL');
    await page.locator('button:has-text("Enter Result")').click();
    
    // Step 6: Switch to Lab Scientist (verify and release)
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("Lab Scientist Demo")').click();
    
    await page.reload();
    await page.locator('button:has-text("Verify Results")').click();
    await page.locator('button:has-text("Release Results")').click();
    await expect(page.locator('text=Results Released')).toBeVisible();
    
    // Step 7: Switch to Pharmacist
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("SYNAPSE Demo Pharmacy")').click();
    await page.locator('button:has-text("Pharmacist Demo")').click();
    
    await page.goto('/demo/pharmacist');
    await expect(page.locator('h1')).toContainText('Pharmacy');
    
    // Dispense medication
    const firstBatch = page.locator('button:has-text("FEFO First")').first();
    if (await firstBatch.isVisible()) {
      await firstBatch.click();
    }
    
    await page.locator('button:has-text("Dispense Medication")').click();
    await expect(page.locator('text=Prescription Dispensed')).toBeVisible();
    
    // Step 8: Switch to Cashier for Billing
    await page.locator('button:has-text("Show Controls")').click();
    await page.locator('button:has-text("SYNAPSE Demo Hospital")').click();
    await page.locator('button:has-text("Cashier Demo")').click();
    
    await page.goto('/demo/billing');
    await expect(page.locator('h1')).toContainText('Billing');
    
    // Generate invoice
    await page.locator('button:has-text("Generate Invoice")').click();
    
    // Collect payment
    await page.locator('button:has-text("cash")').click();
    await page.locator('button:has-text("Receive Payment")').click();
    await expect(page.locator('text=Payment Received')).toBeVisible();
    
    // Step 9: Verify Timeline
    await page.goto('/demo/timeline');
    await expect(page.locator('h1')).toContainText('Timeline');
    
    // Check for key events
    await expect(page.locator('text=Visit started')).toBeVisible();
    await expect(page.locator('text=Triage completed')).toBeVisible();
    await expect(page.locator('text=Clinical note signed')).toBeVisible();
    await expect(page.locator('text=Lab tests ordered')).toBeVisible();
    await expect(page.locator('text=Results released')).toBeVisible();
    await expect(page.locator('text=Prescription dispensed')).toBeVisible();
    await expect(page.locator('text=Payment received')).toBeVisible();
    
    // Step 10: Verify Network View
    await page.goto('/demo/network');
    await expect(page.locator('h1')).toContainText('Network');
    
    // Check for exchange events
    await expect(page.locator('text=lab_order')).toBeVisible();
    await expect(page.locator('text=lab_result')).toBeVisible();
    await expect(page.locator('text=prescription')).toBeVisible();
  });

  test('reload persistence: data survives page refresh', async ({ page }) => {
    // Start a visit
    await page.goto('/demo/login');
    await page.locator('button:has-text("Enter as Reception")').click();
    await page.goto('/demo/reception');
    
    // Create encounter
    await page.locator('input[placeholder*="Search"]').fill('Amina');
    await page.locator('button:has-text("Search")').click();
    await page.locator('text=Amina Demo').first().click();
    await page.locator('button:has-text("consultation")').click();
    await page.locator('textarea[placeholder*="complaint"]').fill('Test reload persistence');
    await page.locator('button:has-text("Start Visit")').click();
    
    // Reload page
    await page.reload();
    
    // Verify data persists
    await page.goto('/demo/timeline');
    await expect(page.locator('text=Visit started')).toBeVisible();
    await expect(page.locator('text=Test reload persistence')).toBeVisible();
  });

  test('export and import playground state', async ({ page }) => {
    // Create some data
    await page.goto('/demo/login');
    await page.locator('button:has-text("Enter as Reception")').click();
    await page.goto('/demo/reception');
    
    await page.locator('input[placeholder*="Search"]').fill('Amina');
    await page.locator('button:has-text("Search")').click();
    await page.locator('text=Amina Demo').first().click();
    await page.locator('button:has-text("consultation")').click();
    await page.locator('textarea[placeholder*="complaint"]').fill('Test export/import');
    await page.locator('button:has-text("Start Visit")').click();
    
    // Export data
    await page.locator('button:has-text("Show Controls")').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Export")').click()
    ]);
    
    // Reset playground
    await page.locator('button:has-text("Reset")').click();
    await page.locator('button:has-text("OK")').click(); // Confirm dialog
    
    // Verify reset
    await page.goto('/demo/timeline');
    await expect(page.locator('text=Test export/import')).not.toBeVisible();
    
    // Import data back
    // Note: Actual file upload testing requires additional setup
    // This is a placeholder for the import test
  });

  test('no 404 errors on core routes', async ({ page }) => {
    const routes = [
      '/demo',
      '/demo/login',
      '/demo/workspace',
      '/demo/reception',
      '/demo/nurse',
      '/demo/doctor',
      '/demo/lab',
      '/demo/pharmacist',
      '/demo/billing',
      '/demo/timeline',
      '/demo/network',
      '/demo/guide'
    ];

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      
      // Verify no error messages
      await expect(page.locator('text=404')).not.toBeVisible();
      await expect(page.locator('text=500')).not.toBeVisible();
      await expect(page.locator('text=Error')).not.toBeVisible();
    }
  });

  test('RBAC: unauthorized actions are prevented', async ({ page }) => {
    // Login as Nurse
    await page.goto('/demo/login');
    await page.locator('button:has-text("Enter as Nurse")').click();
    
    // Try to access doctor page (should show warning)
    await page.goto('/demo/doctor');
    await expect(page.locator('text=Role Mismatch')).toBeVisible();
    
    // Verify nurse can't sign notes (would require repository-level test)
    // This is a UI-level check only
  });
});
