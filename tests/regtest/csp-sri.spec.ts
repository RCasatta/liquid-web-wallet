import { test, expect, Page } from '@playwright/test';

// Checks the Content-Security-Policy and the SRI pins on third party scripts.
// No regtest environment is needed: backend requests are aborted.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const PLAUSIBLE_URL = 'https://plausible.casatta.it/js/script.js';

async function mockBackends(page: Page) {
    await page.route('http://localhost:3000/**', (route) => route.abort());
    await page.route('https://plausible.casatta.it/api/event', (route) => route.fulfill({ status: 202, body: 'ok' }));
}

async function tamper(page: Page, url: string) {
    await page.route(url, async (route) => {
        const response = await route.fetch();
        const body = 'window.__tampered = true;\n' + await response.text();
        await route.fulfill({ response, body });
    });
}

test.describe('Content-Security-Policy and SRI', () => {
    test('pinned scripts load and the app starts without CSP violations', async ({ page }) => {
        const violations: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error' && /Content Security Policy|integrity/i.test(msg.text())) violations.push(msg.text());
        });
        await mockBackends(page);
        await page.goto('/');

        const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).not.toContain("'unsafe-eval'");
        await expect(page.locator(`script[src="${PLAUSIBLE_URL}"]`)).toHaveAttribute('integrity', /^sha384-/);
        await expect(page.locator(`script[src="${JSQR_URL}"]`)).toHaveAttribute('integrity', /^sha384-/);

        await expect.poll(() => page.evaluate(() => typeof (window as any).jsQR)).toBe('function');
        await expect.poll(() => page.evaluate(() => typeof (window as any).plausible)).toBe('function');

        await page.getByRole('button', { name: 'Options' }).click();
        await expect(page.getByRole('button', { name: 'Abandon wallet' })).toBeVisible();
        expect(violations).toEqual([]);
    });

    test('a modified jsQR script is not executed', async ({ page }) => {
        await mockBackends(page);
        await tamper(page, JSQR_URL);
        const integrityError = page.waitForEvent('console', (msg) => /integrity/i.test(msg.text()));
        await page.goto('/');
        await integrityError;
        expect(await page.evaluate(() => (window as any).__tampered)).toBeUndefined();
        expect(await page.evaluate(() => typeof (window as any).jsQR)).toBe('undefined');
    });

    test('a modified Plausible script is not executed', async ({ page }) => {
        await mockBackends(page);
        await tamper(page, PLAUSIBLE_URL);
        const integrityError = page.waitForEvent('console', (msg) => /integrity/i.test(msg.text()));
        await page.goto('/');
        await integrityError;
        expect(await page.evaluate(() => (window as any).__tampered)).toBeUndefined();
        expect(await page.evaluate(() => typeof (window as any).plausible)).toBe('undefined');
    });

    test('scripts and connections outside the policy are blocked', async ({ page }) => {
        await mockBackends(page);
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const blocked: string[] = [];
            document.addEventListener('securitypolicyviolation', (e) => blocked.push(e.effectiveDirective));
            const inline = document.createElement('script');
            inline.textContent = 'window.__inline = true';
            document.head.appendChild(inline);
            const remote = document.createElement('script');
            remote.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.3.0/dist/jsQR.js';
            document.head.appendChild(remote);
            let fetchFailed = false;
            try { await fetch('https://example.com/'); } catch { fetchFailed = true; }
            await new Promise((r) => setTimeout(r, 1000));
            return { inline: (window as any).__inline, fetchFailed, blocked };
        });
        expect(result.inline).toBeUndefined();
        expect(result.fetchFailed).toBe(true);
        expect(result.blocked).toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
    });

    test('a blocked custom Jade pinserver is explained to the user', async ({ page }) => {
        await mockBackends(page);
        await page.goto('/');
        await expect(page.locator('#connect-jade-button')).toBeEnabled();

        // Not a pinserver request: blocked without the pinserver message
        await page.evaluate(() => fetch('https://example.com/').catch(() => { }));
        await page.waitForTimeout(500);
        await expect(page.locator('wallet-notifications')).not.toContainText('Custom Jade pinserver');
        // What lwk does when a Jade configured with a custom pinserver unlocks
        await page.evaluate(() => fetch('https://pin.example.com/start_handshake', { method: 'POST' }).catch(() => { }));

        const notice = page.locator('wallet-notifications');
        await expect(notice).toContainText('Custom Jade pinserver not allowed');
        await expect(notice).toContainText('EXTRA_CONNECT_SRC="https://pin.example.com"');
    });
});
