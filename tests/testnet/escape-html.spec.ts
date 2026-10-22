import { test, expect } from '@playwright/test';

// Error messages can contain text controlled by a server (e.g. an HTTP error
// body from the esplora/waterfalls backend). They must be shown as text, never
// parsed as HTML.
test.describe('Untrusted text is not rendered as HTML', () => {
    test('server error body in a reissuance warning stays text', async ({ page }) => {
        const payload = '"><img src=x onerror="window.__xss=1">';
        // An asset published on the testnet asset registry
        const assetId = '38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5';

        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: 'Options' }).click();
        await page.getByRole('button', { name: 'Random mnemonic' }).click();
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible({ timeout: 20000 });

        await page.getByRole('link', { name: 'Create' }).click();
        await expect(page.getByRole('heading', { name: 'Create' })).toBeVisible();

        // From now on the backend answers fetching the issuance tx with an error
        // whose body is an HTML payload.
        let mocked = 0;
        await page.route('**/tx/*/raw', async (route) => {
            mocked++;
            await route.fulfill({ status: 500, contentType: 'text/plain', body: payload });
        });

        await page.getByText('Reissuance', { exact: true }).click();
        await page.locator('input[name="reissuance_asset_id"]').fill(assetId);
        await page.locator('input[name="reissuance_satoshi"]').fill('1');
        await page.getByRole('button', { name: 'Reissue assets' }).click();

        const message = page.locator('.messageReissuance');
        const input = message.locator('input');
        await expect(input).toHaveValue(/returned HTTP 500/);
        expect(mocked).toBeGreaterThan(0);
        await expect(input).toHaveValue(new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        await expect(input).toHaveAttribute('aria-invalid', 'true');
        await expect(message.locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});
