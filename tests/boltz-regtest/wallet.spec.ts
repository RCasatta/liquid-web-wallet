import { test, expect } from '@playwright/test';

test.describe('Wallet Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?esploraUrl=http://127.0.0.1:4003/api/&waterfalls=false');
        await page.waitForLoadState('networkidle');
    });

    async function loadWallet(page) {
        // Open options section
        await page.getByRole('button', { name: 'Options' }).click();

        // Click the Abandon wallet button
        const abandonWalletButton = page.getByRole('button', { name: 'Abandon wallet' });
        await expect(abandonWalletButton).toBeVisible();
        await abandonWalletButton.click();

        // Wait for the balance page to be shown
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();
        await page.waitForTimeout(500); // Add a small delay to ensure balance has fully synced
    }

    test('should navigate to lightning page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to lightning page
        await page.getByRole('link', { name: 'Lightning' }).click();

        // Verify we're on the lightning page by checking for the heading
        await expect(page.getByRole('heading', { name: 'Lightning' })).toBeVisible();
    });
});

