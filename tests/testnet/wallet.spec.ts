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

    test('should login with Amp0 wallet', async ({ page }) => {
        // Open options section
        await page.getByRole('button', { name: 'Options' }).click();

        // Check that Amp0 section is visible (only in testnet)
        await expect(page.locator('#amp0-div')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Amp0' })).toBeVisible();

        // Fill in username and password
        await page.locator('#amp0-user').fill('userleo34567');
        await page.locator('#amp0-password').fill('userleo34567');

        // Click login button with increased timeout (15 seconds)
        const loginButton = page.locator('#amp0-login-button');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toBeEnabled();

        await loginButton.click();

        // Wait for the balance page to be shown
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible({ timeout: 15000 });

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();

        // Navigate to the receive page
        await page.getByRole('link', { name: 'Receive' }).click();

        // Wait for the receive page to be shown
        await expect(page.getByRole('heading', { name: 'Receive' })).toBeVisible();

        // Click the "Show address" button
        const showAddressButton = page.getByRole('button', { name: 'Show address' });
        await expect(showAddressButton).toBeVisible();
        await showAddressButton.click();

        // Wait for the address to be displayed and verify it matches the expected Amp0 address
        await expect(page.locator('.address-text code')).toBeVisible();
        await expect(page.locator('.address-text code')).toHaveText('vjTvpDMQx3EQ2bS3pmmy7RivU3QTjGyyJFJy1Y5basdKmwpW3R4YRdsxFNT7B3bPNmJkgKCRCS63AtjR');
    });
});