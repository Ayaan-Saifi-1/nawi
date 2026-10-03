import { test, expect } from '@playwright/test';

test('NAWI technician, reviewer, public verification, and manufacturer flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('tech1@nawi.gov.in');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/dashboard/);

  await page.getByTestId('new-session').click();
  await expect(page).toHaveURL(/test-sessions\/new/);
  await page.getByTestId('session-model').selectOption({ index: 1 });
  await page.getByTestId('session-serial').fill(`SMOKE-${Date.now()}`);
  await page.getByTestId('session-next').click();
  await page.getByTestId('session-lab').selectOption({ index: 1 });
  await page.getByTestId('session-date').fill('2026-09-29');
  await page.getByTestId('session-temperature').fill('25');
  await page.getByTestId('session-humidity').fill('50');
  await page.getByTestId('session-inclination').fill('0');
  await page.getByTestId('session-environment-notes').fill('Smoke test conditions');
  await page.getByTestId('session-next').click();
  await page.getByTestId('session-next').click();
  await page.getByRole('button', { name: /select all/i }).click();
  await page.getByTestId('create-session').click();
  await expect(page).toHaveURL(/test-sessions\/[^/]+/);

  const fillObservation = async (annex, readings = 2) => {
    await page.getByTestId('add-observation').click();
    await page.getByTestId('observation-annex').selectOption(annex);
    for (let row = 0; row < readings; row += 1) {
      if (row > 0) await page.getByRole('button', { name: /add reading/i }).click();
      const fields = page.locator(`[data-testid^="observation-field-${row}-"]`);
      for (let fieldIndex = 0; fieldIndex < await fields.count(); fieldIndex += 1) {
        const field = fields.nth(fieldIndex);
        if (await field.evaluate((element) => element.tagName === 'SELECT')) await field.selectOption({ index: 1 });
        else await field.fill(String(100 + row));
      }
    }
    await page.getByRole('button', { name: /save observation/i }).click();
  };

  await fillObservation('A4_accuracy', 2);
  await fillObservation('A4_repeatability', 2);
  await page.getByTestId('add-observation').click();
  await page.getByTestId('observation-annex').selectOption('A1_administrative');
  await page.getByRole('combobox').last().selectOption('true');
  await page.getByRole('textbox').last().fill('Smoke-test checklist evidence');
  await page.getByRole('button', { name: /save observation/i }).click();
  await page.getByTestId('submit-session').click();
  await expect(page.getByText(/overall result|pass|fail|not evaluated/i).first()).toBeVisible();

  await page.getByRole('button', { name: /logout/i }).click();
  await page.getByTestId('login-email').fill('reviewer1@nawi.gov.in');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await page.goto('/test-sessions');
  await page.locator('tr').filter({ hasText: /under review|passed|failed/i }).first().click();
  await page.getByRole('button', { name: /approve evaluation/i }).click();
  await page.getByRole('button', { name: /generate test report/i }).first().click();
  await page.goto('/reports');
  await page.getByRole('button', { name: /publish/i }).first().click();
  const reportNumber = await page.locator('tbody tr').first().locator('td').first().innerText();

  await page.getByRole('button', { name: /logout/i }).click();
  await page.goto(`/verify/${encodeURIComponent(reportNumber.trim())}`);
  await expect(page.getByText(/published report verified/i)).toBeVisible();
  await page.goto('/verify/NOT-A-REPORT');
  await expect(page.getByText(/No published report matches this number or hash/i)).toBeVisible();

  await page.goto('/login');
  await page.getByTestId('login-email').fill('manufacturer@acme-weighing.com');
  await page.getByTestId('login-password').fill('Password123!');
  await page.getByTestId('login-submit').click();
  await page.goto('/test-sessions');
  await expect(page.getByText(/No approved results yet/i)).toBeVisible();
});
