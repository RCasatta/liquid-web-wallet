import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for the page to be fully loaded
        await page.waitForLoadState('networkidle');
    });

    test('should load the home page', async ({ page }) => {
        await expect(page).toHaveTitle('Home');
        await expect(page.getByRole('heading', { name: 'Liquid Web Wallet' })).toBeVisible();
    });

    test('should show watch-only section', async ({ page }) => {
        await page.getByRole('button', { name: 'Options' }).click();
        await expect(page.getByRole('heading', { name: 'Watch-only' })).toBeVisible();
    });

    test('should show example descriptor button', async ({ page }) => {
        await page.getByRole('button', { name: 'Options' }).click();
        const exampleButton = page.getByRole('button', { name: 'Try example' });
        await expect(exampleButton).toBeVisible();
    });

    test('should show connect jade button', async ({ page }) => {
        const connectButton = page.getByRole('button', { name: 'Connect to Jade' });
        await expect(connectButton).toBeVisible();
    });

    test('should show descriptor textarea', async ({ page }) => {
        await page.getByRole('button', { name: 'Options' }).click();
        const textarea = page.locator('#descriptor-textarea');
        await expect(textarea).toBeVisible();
    });
}); 