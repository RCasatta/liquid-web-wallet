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

    async function signAndBroadcastPset(page) {
        // Click on the "Sign with software signer" section
        await page.getByText('Sign with software signer').click();

        // Verify that the mnemonic textarea contains the expected mnemonic
        const mnemonicTextarea = page.locator('details:has-text("Sign with software signer") textarea[placeholder="Mnemonic"]');
        await expect(mnemonicTextarea).toBeVisible();
        const mnemonicValue = await mnemonicTextarea.inputValue();
        expect(mnemonicValue).toMatch(/^[a-z ]+$/); // Should contain lowercase words separated by spaces
        const wordCount = mnemonicValue.split(' ').length;
        expect(wordCount === 12 || wordCount === 24).toBe(true); // Should be a 12 or 24-word mnemonic

        // Press the Sign button
        await page.getByRole('button', { name: 'Sign', exact: true }).click();

        // Verify that the Signatures section displays "Has" text
        await expect(page.locator('h3:has-text("Signatures")').locator('~div table td:has-text("Has")')).toBeVisible();

        // Press the Broadcast button
        await page.getByRole('button', { name: 'Broadcast', exact: true }).click();

        // Verify broadcast success message appears
        await expect(page.getByText('Tx broadcasted')).toBeVisible();

        // Get the txid from the broadcast success message
        const txElement = page.getByText('Tx broadcasted').locator('..');
        const txid = await txElement.getByRole('textbox').inputValue();
        return txid;
    }

    test('should navigate to lightning page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to lightning page
        await page.getByRole('link', { name: 'Lightning' }).click();

        // Verify we're on the lightning page by checking for the heading
        await expect(page.getByRole('heading', { name: 'Lightning' })).toBeVisible();
    });

    test('should generate invoice and pay it', async ({ page }) => {
        await loadWallet(page);

        // Navigate to lightning page
        await page.getByRole('link', { name: 'Lightning' }).click();

        // Verify we're on the lightning page
        await expect(page.getByRole('heading', { name: 'Lightning' })).toBeVisible();

        // Fill the invoice amount field with 1000
        await page.locator('#lightning_amount').fill('1000');

        // Press the invoice button
        await page.locator('#lightning-receive-form button[type="submit"]').click();

        // Wait for the invoice to be generated and expect the invoice string
        const invoiceCode = page.locator('.invoice-text code');
        await expect(invoiceCode).toBeVisible({ timeout: 30000 });
        const invoiceString = await invoiceCode.textContent();
        expect(invoiceString).not.toBeNull();
        expect(invoiceString).toMatch(/^lnbc/i); // Lightning invoice starts with lnbc

        // Paste the invoice string in the send form
        await page.locator('#lightning_invoice').fill(invoiceString!);

        // Press the Pay button
        await page.locator('#lightning-send-form button[type="submit"]').click();

        // The page should become the sign page
        await expect(page.getByRole('heading', { name: 'Sign', exact: true })).toBeVisible({ timeout: 30000 });

        // Sign and broadcast the pset
        const txid = await signAndBroadcastPset(page);

        // Check successful broadcast
        expect(txid).toBeTruthy();
        expect(txid).toMatch(/^[a-f0-9]{64}$/); // txid should be a 64-character hex string
    });
});

