import { test, expect, Page, WebSocketRoute } from '@playwright/test';

// Requires the regtest environment with the Jade emulator and its websocat
// WebSocket bridge on ws://localhost:3331 (see tests/regtest/README.md).
//
// The app talks to the emulator over that WebSocket with raw CBOR frames.
// Playwright's routeWebSocket proxies the connection, and in the mismatch test
// the get_receive_address reply is rewritten to a different valid address of
// the same length. Same-length replacement keeps the CBOR text-string header
// valid, so no CBOR library is needed.

const JADE_WS_URL = 'ws://localhost:3331';

// Valid regtest confidential P2WPKH addresses of the "abandon ... about"
// wallet (indexes 0 and 1), never derived by the Jade emulator (e3ebcc79).
const FAKE_ADDRESSES = [
    'el1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z0z676mna6kdq',
    'el1qqv8pmjjq942l6cjq69ygtt6gvmdmhesqmzazmwfsq7zwvan4kewdqmaqzegq50r2wdltkfsw9hw20zafydz4sqljz0eqe0vhc',
];

const ADDRESS_REGEX = /el1[02-9ac-hj-np-z]{90,}/;

type JadeProxyStats = {
    receiveAddressRequests: number;
    rewrites: { original: string; fake: string }[];
    errors: string[];
};

function toBuffer(message: string | Buffer): Buffer {
    return typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
}

async function proxyJade(page: Page, rewriteReceiveAddress: boolean): Promise<JadeProxyStats> {
    const stats: JadeProxyStats = { receiveAddressRequests: 0, rewrites: [], errors: [] };
    let pendingReceiveAddress = false;

    await page.routeWebSocket(JADE_WS_URL, (ws: WebSocketRoute) => {
        const server = ws.connectToServer();

        ws.onMessage((message) => {
            if (toBuffer(message).includes('get_receive_address')) {
                stats.receiveAddressRequests++;
                pendingReceiveAddress = true;
            }
            server.send(message);
        });

        server.onMessage((message) => {
            if (!rewriteReceiveAddress || !pendingReceiveAddress) {
                ws.send(message);
                return;
            }
            const frame = toBuffer(message);
            const match = frame.toString('latin1').match(ADDRESS_REGEX);
            if (!match) {
                // Reply split across frames or not an address: forward unchanged,
                // the test fails later because no rewrite was recorded.
                ws.send(message);
                return;
            }
            pendingReceiveAddress = false;
            const original = match[0];
            const fake = FAKE_ADDRESSES.find((a) => a !== original)!;
            if (fake.length !== original.length) {
                stats.errors.push(`cannot rewrite ${original}: length ${original.length} != ${fake.length}`);
                ws.send(message);
                return;
            }
            const rewritten = Buffer.from(frame);
            rewritten.write(fake, match.index!, 'latin1');
            stats.rewrites.push({ original, fake });
            ws.send(rewritten);
        });
    });

    return stats;
}

async function connectJadeAndOpenReceive(page: Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('#connect-jade-websocket-button').click();
    await expect(page.getByRole('heading', { name: 'Wallets' })).toBeVisible();
    await expect(page.locator('my-footer')).toContainText('e3ebcc79');

    await page.locator('wallet-selector select').selectOption('Wpkh');
    await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();
    await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();

    await page.getByRole('link', { name: 'Receive' }).click();
    await expect(page.getByRole('heading', { name: 'Receive' })).toBeVisible();
}

function addressErrorNotification(page: Page) {
    return page.locator('wallet-notifications .wallet-notification-error').filter({ hasText: 'Receive address error' });
}

test.describe('Jade receive address verification', () => {
    test('shows the address when Jade returns the same address', async ({ page }) => {
        const stats = await proxyJade(page, false);
        await connectJadeAndOpenReceive(page);

        await page.getByRole('button', { name: 'Show address', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Show address', exact: true })).toBeEnabled();

        expect(stats.receiveAddressRequests).toBe(1);
        const view = page.locator('address-view');
        await expect(view.locator('.address-text code')).toHaveText(/^el1/);
        await expect(view.locator('.address-qr')).toBeVisible();
        await expect(view.locator('.address-qr img')).toHaveAttribute('src', /^data:image/);
        await expect(addressErrorNotification(page)).toHaveCount(0);
    });

    test('hides the address and shows an error when Jade returns a different address', async ({ page }) => {
        const stats = await proxyJade(page, true);
        await connectJadeAndOpenReceive(page);

        await page.getByRole('button', { name: 'Show address', exact: true }).click();

        // Make sure the reply was actually tampered with before checking the UI
        await expect.poll(() => stats.rewrites.length + stats.errors.length).toBeGreaterThan(0);
        expect(stats.errors).toEqual([]);
        expect(stats.rewrites).toHaveLength(1);

        const notification = addressErrorNotification(page);
        await expect(notification).toBeVisible();
        const { original, fake } = stats.rewrites[0];
        await expect(notification).toContainText('Address mismatch');
        await expect(notification).toContainText(original);
        await expect(notification).toContainText(fake);

        const view = page.locator('address-view');
        await expect(view.locator('.address-text')).toBeHidden();
        await expect(view.locator('.address-text code')).toHaveText('');
        await expect(view.locator('.address-qr')).toBeHidden();
        await expect(view.locator('.address-qr img')).not.toHaveAttribute('src');
        await expect(view.locator('.address-qr a')).not.toHaveAttribute('href');
    });
});
