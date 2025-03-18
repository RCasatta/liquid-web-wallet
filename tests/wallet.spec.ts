import { test, expect } from '@playwright/test';

test.describe('Wallet Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
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
    }

    test('should load wallet with descriptor', async ({ page }) => {
        await loadWallet(page);
    });

    test('should show wallet navigation options', async ({ page }) => {
        await loadWallet(page);

        // Check navigation links
        await expect(page.getByRole('link', { name: 'Balance' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sign' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Receive' })).toBeVisible();
    });

    test('should navigate to receive page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to receive page
        await page.getByRole('link', { name: 'Receive' }).click();

        // Verify receive page elements
        await expect(page.getByRole('heading', { name: 'Receive' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show' })).toBeVisible();
    });

    test('should navigate to balance page', async ({ page }) => {
        await loadWallet(page);

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();

        // Verify we're on the balance page
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();

        // Wait for balance to load and check content
        const balanceContent = await page.locator('wallet-balance').textContent();
        expect(balanceContent).toContain('rL-BTC');
        expect(balanceContent).not.toContain('0.00000000');
    });

    test('should navigate to transactions page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to transactions page
        await page.getByRole('link', { name: 'Transactions' }).click();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-transactions article[aria-busy="true"]')).not.toBeVisible();

        // Verify transactions page elements
        await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

        // Verify there is at least one transaction in the table
        const transactionCount = await page.locator('wallet-transactions table tr').count();
        expect(transactionCount).toBeGreaterThan(0);
    });

}); 