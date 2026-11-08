import { test, expect } from '@playwright/test';

test('esploraUrl query parameter does not change the backend', async ({ page }) => {
    const override = 'http://127.0.0.1:9/override/';
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));
    await page.route('http://127.0.0.1:9/**', (route) => route.abort());
    await page.route('http://localhost:3000/**', (route) => route.abort());

    await page.goto('/?esploraUrl=' + encodeURIComponent(override));
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByRole('button', { name: 'Abandon wallet' }).click();

    await expect.poll(() => requested.some((url) => url.startsWith('http://localhost:3000/')), { timeout: 15000 }).toBe(true);
    expect(requested.filter((url) => url.startsWith('http://127.0.0.1:9/'))).toEqual([]);
});
