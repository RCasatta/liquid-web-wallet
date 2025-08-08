import { test, expect } from '@playwright/test';

test.describe('Wallet Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    async function loadWallet(page) {
        // Open options section
        await page.getByRole('button', { name: 'Options' }).click();

        // Click the example wallet button
        const abandonWalletButton = page.getByRole('button', { name: 'Random wallet' });
        await expect(abandonWalletButton).toBeVisible();
        await abandonWalletButton.click();

        // Wait for the balance page to be shown
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible({ timeout: 20000 });
        await page.waitForTimeout(500); // Add a small delay to ensure balance has fully synced
        // TODO without waiting for the balance to be ready, other pages may break
    }

    test('should show wallet navigation options', async ({ page }) => {
        await loadWallet(page);

        // Check navigation links
        await expect(page.getByRole('link', { name: 'Balance' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sign' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Receive' })).toBeVisible();
    });

    test('should register AMP2 wallet', async ({ page }) => {
        await loadWallet(page);

        await page.getByRole('link', { name: 'Wallet' }).click();

        await expect(page.locator('wallet-amp2 h3')).toHaveText('Amp2');

        // Click the register wallet button
        const registerWalletButton = page.getByRole('button', { name: 'Register wallet' });
        await expect(registerWalletButton).toBeVisible();
        await registerWalletButton.click();

        // Wait for registration to complete and uuid to be shown
        const uuidTextarea = page.getByLabel('uuid');
        await expect(uuidTextarea).toBeVisible();
        await expect(uuidTextarea).not.toHaveValue('');
        await expect(registerWalletButton).toBeHidden();
    });
});