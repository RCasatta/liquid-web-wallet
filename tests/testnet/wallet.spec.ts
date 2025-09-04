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
        await page.locator('#amp0-user').fill('userleo345678');
        await page.locator('#amp0-password').fill('userleo345678');

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
        await expect(page.locator('.address-text code')).toHaveText('vjU8ft8T5MX2X6DorpqwELknV2H27dhsLUwDAWHbhTpQT4FHtedrEUauYgjFa4w8nbK9eybQWB4EqRZh');

        // Navigate to the create transaction page
        await page.getByRole('link', { name: 'Create' }).click();
        await expect(page.getByRole('heading', { name: 'Create transaction' })).toBeVisible();

        // Wait for the page to load completely
        await expect(page.locator('create-transaction div[hidden]')).not.toBeVisible();

        // Add recipient address
        await page.locator('input[name="address"]').fill('vjU8ft8T5MX2X6DorpqwELknV2H27dhsLUwDAWHbhTpQT4FHtedrEUauYgjFa4w8nbK9eybQWB4EqRZh');

        // Add amount (select the first amount input, not the burn assets one)
        await page.locator('#add-recipient-div input[name="amount"]').first().fill('0.00001');

        // Select tLBTC as asset (select the first asset select, not the burn assets one)
        await page.locator('#add-recipient-div select[name="asset"]').first().selectOption({ label: 'tLBTC' });

        // Click '+' to add the recipient (select the first one, not the burn assets one)
        await page.locator('#add-recipient-div input[type="submit"][value="+"]').first().click();

        // Click create to create the transaction
        await page.getByRole('button', { name: 'Create' }).click();

        // Should navigate to the sign page
        await expect(page.locator('h2:has-text("Sign")')).toBeVisible();

        // Expand the software signer details section first
        const softwareSignerDetails = page.locator('details:has-text("Sign with software signer")');
        await softwareSignerDetails.locator('summary').click();

        // Set mnemonic in the software signer section
        const mnemonicTextarea = page.locator('details:has-text("Sign with software signer") textarea[placeholder="Mnemonic"]');
        await mnemonicTextarea.fill('student lady today genius gentle zero satoshi book just link gauge tooth');

        // Click Save to save the mnemonic
        await page.getByRole('button', { name: 'Save' }).click();

        // Click Sign button (the first one, not the hidden one or the summary)
        await page.locator('button.sign').first().click();

        // Wait for success message "Transaction signed!"
        await expect(page.locator('div.message input[aria-invalid="false"]')).toBeVisible();
        await expect(page.locator('div.message input[aria-invalid="false"]')).toHaveValue('Transaction signed!');

        // Click Cosign Amp0 button
        const cosignAmp0Button = page.locator('button.cosign-amp0');
        await expect(cosignAmp0Button).toBeVisible();
        await cosignAmp0Button.click();

        // Should show error message "Amp0 sign failed: error sending request"
        await expect(page.locator('div.message input[aria-invalid="false"]')).toBeVisible();
        await expect(page.locator('div.message input[aria-invalid="false"]')).toHaveValue('Transaction signed with Amp0!');
    });
});
