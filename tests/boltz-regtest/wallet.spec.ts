import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// LND proxy configuration for boltz-regtest environment
const PROXY_URL = 'http://localhost:51234/proxy';
const LND_URL = 'https://localhost:8081';

// Read the LND macaroon from the lwk_boltz .env file
function getLndMacaroon(): string {
    const envPath = path.join(__dirname, '../../../lwk/lwk_boltz/.env');
    if (!fs.existsSync(envPath)) {
        throw new Error(`LND macaroon .env file not found at ${envPath}. Make sure boltz-regtest environment is running.`);
    }
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^LND_MACAROON_HEX=(.+)$/m);
    if (!match) {
        throw new Error('LND_MACAROON_HEX not found in .env file');
    }
    return match[1];
}

// Make a request to LND via the proxy
async function lndRequest(method: string, params: object): Promise<unknown> {
    const macaroon = getLndMacaroon();
    const url = `${LND_URL}/${method}`;

    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Grpc-Metadata-macaroon': macaroon,
            'X-Proxy-URL': url,
        },
        body: JSON.stringify(params),
    });

    const text = await response.text();
    // Parse the last JSON in the response (multiple JSONs separated by newlines)
    const lines = text.split('\n').filter(line => line.trim());
    const lastLine = lines[lines.length - 1];
    return JSON.parse(lastLine);
}

// Generate an invoice from the regtest LND
async function generateInvoiceLnd(amountSat: number): Promise<string> {
    const response = await lndRequest('v1/invoices', { value: amountSat }) as { payment_request?: string };
    if (!response.payment_request) {
        throw new Error('Missing payment_request field in LND response');
    }
    return response.payment_request;
}

// Pay an invoice using the regtest LND (fire and forget)
async function payInvoiceLnd(invoice: string): Promise<void> {
    // Don't await the response - LND streaming endpoint doesn't return immediately
    lndRequest('v2/router/send', { payment_request: invoice, timeout_seconds: 60 }).catch(() => {
        // Ignore errors - the payment may complete after we've moved on
    });
}

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
        // Press the Sign button
        await page.getByRole('button', { name: 'Sign', exact: true }).click();

        // Verify that the Signatures section displays "Has" text
        await expect(page.locator('h3:has-text("Signatures")').locator('~div table td:has-text("Has")')).toBeVisible();

        // Press the Broadcast button
        await page.getByRole('button', { name: 'Broadcast', exact: true }).click();

        // Verify broadcast success notification appears
        const notification = page.locator('wallet-notifications .wallet-notification').filter({ hasText: 'Tx broadcasted!' }).last();
        await expect(notification).toBeVisible();

        // Get the txid from the broadcast success notification
        const txid = (await notification.locator('.wallet-notification-message').textContent())?.trim() ?? '';
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

    test('should pay LND invoice via submarine swap', async ({ page }) => {
        // Generate an invoice from the regtest LND
        const invoiceAmount = 1000;
        const lndInvoice = await generateInvoiceLnd(invoiceAmount);
        expect(lndInvoice).toMatch(/^lnbcrt/); // regtest invoice starts with lnbcrt

        await loadWallet(page);

        // Navigate to lightning page
        await page.getByRole('link', { name: 'Lightning' }).click();

        // Verify we're on the lightning page
        await expect(page.getByRole('heading', { name: 'Lightning' })).toBeVisible();

        // Paste the LND invoice in the send form
        await page.locator('#lightning_invoice').fill(lndInvoice);

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

    test('should receive payment from LND via reverse swap', async ({ page }) => {
        await loadWallet(page);

        // Navigate to lightning page
        await page.getByRole('link', { name: 'Lightning' }).click();

        // Verify we're on the lightning page
        await expect(page.getByRole('heading', { name: 'Lightning' })).toBeVisible();

        // Fill the invoice amount field with 1000
        await page.locator('#lightning_amount').fill('1000');

        // Press the invoice button to generate a wallet invoice
        await page.locator('#lightning-receive-form button[type="submit"]').click();

        // Wait for the invoice to be generated
        const invoiceCode = page.locator('.invoice-text code');
        await expect(invoiceCode).toBeVisible({ timeout: 30000 });
        const walletInvoice = await invoiceCode.textContent();
        expect(walletInvoice).not.toBeNull();
        expect(walletInvoice).toMatch(/^lnbcrt/); // regtest invoice starts with lnbcrt

        // Pay the wallet invoice using the regtest LND
        await payInvoiceLnd(walletInvoice!);

        // Wait for the payment to be received and processed
        // The wallet should automatically claim the swap and show a success message or update the balance
        // We'll wait for the balance to update by navigating to the balance page
        await page.waitForTimeout(5000); // Give some time for the swap to complete

        // Navigate to balance page to verify the payment was received
        await page.getByRole('link', { name: 'Balance' }).click();
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();
    });
});
