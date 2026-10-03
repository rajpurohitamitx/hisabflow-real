import { test, expect } from '@playwright/test';
test('landing page loads', async ({page})=>{await page.goto('/');await expect(page).toHaveTitle(/Hisab Flow/i);});
test('login page loads', async ({page})=>{await page.goto('/login');await expect(page.getByText(/sign in|login/i).first()).toBeVisible();});
