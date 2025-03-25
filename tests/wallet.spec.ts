import { test, expect } from '@playwright/test';

test.describe('Wallet Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
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
        // TODO without waiting for the balance to be ready, other pages may break
    }

    async function createTransaction(page) {
        await loadWallet(page);

        // Navigate to create page
        await page.getByRole('link', { name: 'Create' }).click();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('create-transaction article[aria-busy="true"]')).not.toBeVisible();

        // Verify we're on the create page
        await expect(page.getByRole('heading', { name: 'Create' })).toBeVisible();

        // Fill in the recipient details
        await page.locator('#add-recipient-div input[name="address"]').fill('el1qqwmdgx74h58nfufxvvmm2ny8evkc6fv39h682u0jtpurq6969jwlvv6fyn40gm5qd6rtx5m6ztupt9grp4e6wq47g0thyayh7');

        // Fill in the amount field - use the ID selector to be specific
        await page.locator('#add-recipient-div input[name="amount"]').fill('0.000023');

        // Select rL-BTC by label
        await page.locator('#add-recipient-div select[name="asset"]').selectOption({ label: 'rL-BTC' });

        // Click the + button
        await page.getByRole('button', { name: '+' }).click();

        // Click create button
        await page.getByRole('button', { name: 'Create' }).click();

        // Verify the PSET was created successfully and we're on the sign page
        await expect(page.getByRole('heading', { name: 'Sign', exact: true })).toBeVisible();
    }

    async function createIssuancePset(page) {

        // Navigate to create page
        await page.getByRole('link', { name: 'Create' }).click();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('create-transaction article[aria-busy="true"]')).not.toBeVisible();

        // Open the issuance details section
        await page.getByRole('button', { name: 'Issuance', exact: true }).click();

        // Fill in the issuance form
        await page.locator('input[name="asset_amount"]').fill('1000');
        await page.locator('input[name="token_amount"]').fill('1');
        await page.locator('input[name="domain"]').fill('liquidtestnet.com');
        await page.locator('input[name="name"]').fill('Test Asset');
        await page.locator('input[name="ticker"]').fill([...Array(5)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join(''));
        await page.locator('input[name="precision"]').fill('8');

        // Click the Issue assets button
        await page.getByRole('button', { name: 'Issue assets' }).click();

        // Verify we're on the sign page
        await expect(page.getByRole('heading', { name: 'Sign', exact: true })).toBeVisible();

        // Verify PSET textarea is populated
        const psetTextarea = page.locator('sign-transaction textarea').first();
        await expect(psetTextarea).toHaveValue(/^cHNldP8/); // Base64 PSET prefix

        // Verify contract textarea is visible and populated
        const contractSection = page.locator('div.contract-section');
        await expect(contractSection).toBeVisible();
        const contractTextarea = contractSection.locator('textarea');
        await expect(contractTextarea).toHaveValue(/^{/); // JSON contract starts with {

        // Get and parse the contract JSON to extract the asset ID
        const contractJson = await contractTextarea.inputValue();
        const contract = JSON.parse(contractJson);
        const assetId = contract.asset_id;

        return { assetId, contract };
    }

    async function signAndBroadcastPset(page) {
        // Click on the "Sign with software signer" section
        await page.getByText('Sign with software signer').click();

        // Press the Sign button
        await page.getByRole('button', { name: 'Sign', exact: true }).click();

        // Verify that the Signatures section displays "Has" text
        await expect(page.locator('h3:has-text("Signatures")').locator('~div table td:has-text("Has")')).toBeVisible();

        // Press the Sign button
        await page.getByRole('button', { name: 'Broadcast', exact: true }).click();

        // Verify broadcast success message appears
        await expect(page.getByText('Tx broadcasted')).toBeVisible();

        // Get the txid from the broadcast success message
        const txElement = page.getByText('Tx broadcasted').locator('..');
        const txid = await txElement.getByRole('textbox').inputValue();
        return txid;
    }

    async function waitForTransactionToAppear(page, txid) {
        // Navigate to transactions page
        await page.getByRole('link', { name: 'Transactions' }).click();

        // Wait for the transactions page to load
        await expect(page.locator('wallet-transactions article[aria-busy="true"]')).not.toBeVisible();

        // Get the first 8 characters of the txid to search for
        const txidPrefix = txid.substring(0, 8);

        // Try up to 5 times with 1 second delay between attempts
        for (let attempt = 0; attempt < 5; attempt++) {
            // Get the transactions list content
            const transactionsContent = await page.locator('wallet-transactions table').textContent();

            // Check if the txid prefix is in the transactions list
            if (transactionsContent.includes(txidPrefix)) {
                // console.log(`Transaction ${txidPrefix}... found on attempt ${attempt + 1}`);
                return true;
            }

            // console.log(`Transaction ${txidPrefix}... not found on attempt ${attempt + 1}, waiting...`);

            // Wait 1 second before the next attempt (if not the last attempt)
            if (attempt < 4) {
                await page.waitForTimeout(1000);
                // Refresh the transactions list by clicking on Transactions link again
                await page.getByRole('link', { name: 'Transactions' }).click();
                await expect(page.locator('wallet-transactions article[aria-busy="true"]')).not.toBeVisible();
            }
        }

        console.log(`Transaction ${txidPrefix}... not found after 5 attempts`);
        return false;
    }

    async function checkAssetBalance(page, assetId, expectedAmount) {
        // Navigate to balance page to verify total amount
        await page.getByRole('link', { name: 'Balance' }).click();

        // Wait for balance to load
        await expect(page.locator('wallet-balance article[aria-busy="true"]')).not.toBeVisible();

        // Find the specific row containing our asset ID and verify the amount
        const assetRow = page.locator(`wallet-balance table tr:has-text("${assetId}")`);
        await expect(assetRow).toBeVisible();
        const assetAmount = await assetRow.locator('td:last-child').textContent();
        expect(assetAmount?.trim()).toBe(expectedAmount.toString());
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

    test('should navigate to receive page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to receive page
        await page.getByRole('link', { name: 'Receive' }).click();

        // Verify receive page elements
        await expect(page.getByRole('heading', { name: 'Receive' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show address', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Show address', exact: true }).click();

        // Get the address and see it maches the network
        const address = await page.getByRole('code').textContent();
        expect(address).toMatch(/^el1/);
    });

    test('should navigate to balance page', async ({ page }) => {
        await loadWallet(page);


        // Verify we're on the balance page
        await expect(page.getByRole('heading', { name: 'Balance' })).toBeVisible();

        // Wait for balance to load and check content
        const balanceContent = await page.locator('wallet-balance').textContent();
        expect(balanceContent).toContain('rL-BTC');
        expect(balanceContent).not.toContain('0.00000000');
    });

    test('should navigate to transactions page', async ({ page }) => {
        await loadWallet(page);

        // Navigate to transactions page
        await page.getByRole('link', { name: 'Transactions' }).click();

        // Wait for the sync to complete by waiting for the loading indicator to disappear
        await expect(page.locator('wallet-transactions article[aria-busy="true"]')).not.toBeVisible();

        // Verify transactions page elements
        await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

        // Verify there is at least one transaction in the table
        const transactionCount = await page.locator('wallet-transactions table tr').count();
        expect(transactionCount).toBeGreaterThan(0);
    });

    test('should sign a created pset', async ({ page }) => {
        await createTransaction(page);
        const txid = await signAndBroadcastPset(page);
        const txFound = await waitForTransactionToAppear(page, txid);
        expect(txFound).toBe(true);
    });

    test('issuance/reissuance/burn', async ({ page }) => {
        await loadWallet(page);
        const { assetId } = await createIssuancePset(page);
        const txid = await signAndBroadcastPset(page);

        // Look for an input element with this value instead of direct text
        await expect(page.locator('input[value="Asset registered in the asset registry"]')).toBeVisible({ timeout: 15000 })

        // Ensure we are synced
        const txFound = await waitForTransactionToAppear(page, txid);
        expect(txFound).toBe(true);

        // Navigate to create page for reissuance
        await page.getByRole('link', { name: 'Create' }).click();

        // Wait for the sync to complete
        await expect(page.locator('create-transaction article[aria-busy="true"]')).not.toBeVisible();

        // Open the reissuance section
        await page.getByRole('button', { name: 'Reissuance', exact: true }).click();

        // Fill in the reissuance form
        await page.locator('input[name="reissuance_asset_id"]').fill(assetId);
        await page.locator('input[name="reissuance_satoshi"]').fill('500');

        // Click the Reissue assets button
        await page.getByRole('button', { name: 'Reissue assets' }).click();

        // Verify we're on the sign page
        await expect(page.getByRole('heading', { name: 'Sign', exact: true })).toBeVisible();

        // Sign and broadcast the reissuance
        const txidReissuance = await signAndBroadcastPset(page);
        const txFoundReissuance = await waitForTransactionToAppear(page, txidReissuance);
        expect(txFoundReissuance).toBe(true);

        // Check balance after reissuance
        await checkAssetBalance(page, assetId, 1500); // 1000 from issuance + 500 from reissuance

        // Navigate to create page for burn
        await page.getByRole('link', { name: 'Create' }).click();

        // Wait for the sync to complete
        await expect(page.locator('create-transaction article[aria-busy="true"]')).not.toBeVisible();

        // Open the burn section
        await page.getByRole('button', { name: 'Burn assets', exact: true }).click();

        const detailsBurn = page.locator('details.burn-assets');
        // Fill in the burn form
        await detailsBurn.locator('input[name="amount"]').fill('300');

        // Select the asset id
        await detailsBurn.locator('select[name="asset"]').selectOption({ label: assetId });

        // Click the + button
        await detailsBurn.getByRole('button', { name: '+' }).click();

        // Click create button
        await page.getByRole('button', { name: 'Create' }).click();

        // Verify we're on the sign page
        await expect(page.getByRole('heading', { name: 'Sign', exact: true })).toBeVisible();

        // Sign and broadcast the burn
        const txidBurn = await signAndBroadcastPset(page);
        const txFoundBurn = await waitForTransactionToAppear(page, txidBurn);
        expect(txFoundBurn).toBe(true);

        // Check balance after burn
        await checkAssetBalance(page, assetId, 1200); // 1000 from issuance + 500 from reissuance - 300 burn
    });


}); 