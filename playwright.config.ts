import { defineConfig, devices } from '@playwright/test';

// Use system chromium on NixOS. Drop LD_LIBRARY_PATH from its environment:
// the Nix chromium wrapper sets up its own libraries, and an inherited path to
// libraries built against a different glibc prevents it from starting.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { LD_LIBRARY_PATH, ...chromiumEnv } = process.env;
const launchOptions = {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    env: chromiumEnv,
};

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: process.env.CI ? 1 : 1, // otherwise UTXOs can be selected concurrently
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:8383',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'regtest',
            testDir: './tests/regtest',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions,
            },
        },
        {
            name: 'testnet',
            testDir: './tests/testnet',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions,
            },
        },
        {
            name: 'boltz-regtest',
            testDir: './tests/boltz-regtest',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:8383',
                launchOptions,
            },
        },
    ],

    webServer: {
        command: 'npm run start',
        url: 'http://localhost:8383',
        reuseExistingServer: !process.env.CI,
    },
}); 