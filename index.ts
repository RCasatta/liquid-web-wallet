import * as lwk from "lwk_wasm"
import {
    getCurrentPage, setCurrentPage,
    getJade, setJade, getStandardDerivations,
    getLedger, setLedger,
    getXpub, getMultiWallets,
    getWollet, setWollet, getWolletSelected, setWolletSelected,
    getScanState, setScanRunning, getScanLoop, setScanLoop,
    getSwSigner, setSwSigner, getPset, setPset, getContract, setContract,
    getRegistry, setRegistry,
    getDevMode, setDevMode,
    getUtxoOnly, setUtxoOnly,
    getRegistryFetched, setRegistryFetched,
    getAmp0, setAmp0,
    getAmp0Pset, setAmp0Pset,
    getBoltzSession, setBoltzSession,
    getLocalStorageFull, setLocalStorageFull,
    subscribe, publish,
    getWalletNotifications,
    notifyWallet,
    dismissWalletNotification,
    WalletNotification,
    saveSwap,
    getAllSwaps,
    removeSwap
} from './state'

// Type declaration for jsQR global function
declare global {
    function jsQR(imageData: Uint8ClampedArray, width: number, height: number, options?: any): any;
}

// Import the jsQR library for QR code scanning
const jsQRScript = document.createElement('script');
jsQRScript.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
document.head.appendChild(jsQRScript);

// Network setup (remains global as it's a configuration not state)
const network: lwk.Network = lwk.Network.regtestDefault()

// Reference to the main application container
const app: HTMLElement | null = document.getElementById('app')

const RANDOM_MNEMONIC_KEY: string = "random_mnemonic"
const AMP2_DATA_KEY_PREFIX: string = "amp2_data_v2_"

/// Re-enables initially disabled buttons, and add listener to buttons on the first page
/// First page doesn't use components because we want to be loaded before the wasm is loaded, which takes time
async function init(): Promise<void> {

    let connectJade: HTMLButtonElement | null = document.getElementById("connect-jade-button") as HTMLButtonElement | null
    let descriptorTextarea: HTMLTextAreaElement | null = document.getElementById("descriptor-textarea") as HTMLTextAreaElement | null
    let descriptorMessage: HTMLElement | null = document.getElementById("descriptor-message") as HTMLElement | null
    let exampleDescriptor: HTMLAnchorElement | null = document.getElementById("example-descriptor-link") as HTMLAnchorElement | null
    let loadingBar: HTMLElement | null = document.getElementById("loading-wasm") as HTMLElement | null;
    let devMode: HTMLInputElement | null = document.getElementById("dev-mode") as HTMLInputElement | null
    let utxoOnly: HTMLInputElement | null = document.getElementById("utxo-only") as HTMLInputElement | null
    let amp0Div: HTMLElement | null = document.getElementById("amp0-div") as HTMLElement | null
    let amp0LoginButton: HTMLButtonElement | null = document.getElementById("amp0-login-button") as HTMLButtonElement | null

    // Diagnostic logging for dev mode state
    if (getDevMode()) {
        console.log("Dev mode is enabled");
    }

    // Diagnostic logging for UTXO only state
    if (getUtxoOnly()) {
        console.log("UTXO only mode is enabled");
    }

    const registry = lwk.Registry.defaultHardcodedForNetwork(network)
    setRegistry(registry)

    if (devMode) devMode.checked = getDevMode()
    if (utxoOnly) utxoOnly.checked = getUtxoOnly()

    // Define handleDevMode function to update state when checkbox changes
    const handleDevMode = function (e: Event) {
        const target = e.target as HTMLInputElement;
        const isDevMode = target.checked;
        console.log("Dev mode checkbox changed to:", isDevMode);
        setDevMode(isDevMode);
    }

    // Define handleUtxoOnly function to update state when checkbox changes
    const handleUtxoOnly = function (e: Event) {
        const target = e.target as HTMLInputElement;
        const isUtxoOnly = target.checked;
        console.log("UTXO only checkbox changed to:", isUtxoOnly);
        setUtxoOnly(isUtxoOnly);
    }

    if (devMode) devMode.onchange = handleDevMode
    if (utxoOnly) utxoOnly.onchange = handleUtxoOnly

    if (connectJade) {
        connectJade.addEventListener("click", async (_e: Event) => {
            let connectJadeMessage: HTMLElement | null = document.getElementById("connect-jade-message") as HTMLElement | null;
            try {
                if (connectJade) setBusyDisabled(connectJade, true);
                let filter = !getDevMode()
                console.log("filter out do it yourself " + filter)

                const jade = await lwk.Jade.fromSerial(network, filter)
                loadingBar.setAttribute("style", "visibility: visible;")
                connectJadeMessage.innerHTML = warning("Insert the PIN on the Jade if locked")

                // Initialize jade and collect all related data
                const xpub = await jade.getMasterXpub() // asking something that requires unlock
                const multiWallets = await jade.getRegisteredMultisigs()
                const jadeDerivations = await jadeStandardDerivations(jade)

                // Set all jade-related state at once
                setJade(jade, xpub, multiWallets, jadeDerivations)

                loadingBar.setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts
            } catch (e) {
                if (connectJadeMessage) connectJadeMessage.innerHTML = warning(e);
                if (connectJade) setBusyDisabled(connectJade, false);
            }
        });
    }

    if (network.isRegtest()) {
        // Add WebSocket Jade connection functionality
        let connectJadeWebSocket = document.getElementById("connect-jade-websocket-button") as HTMLButtonElement
        connectJadeWebSocket.hidden = false
        connectJadeWebSocket.disabled = false

        connectJadeWebSocket.addEventListener("click", async (_e) => {
            let connectJadeWebSocketMessage = document.getElementById("connect-jade-websocket-message")
            try {
                setBusyDisabled(connectJadeWebSocket, true)

                // Connect to Jade via WebSocket on port 3331
                const jadeWs = await lwk.JadeWebSocket.fromWebSocket(network, "ws://localhost:3331")
                loadingBar.setAttribute("style", "visibility: visible;")
                connectJadeWebSocketMessage.innerHTML = warning("Connecting to Jade via WebSocket...")

                // Call getVersion() and print result in console
                const version = await jadeWs.getVersion()
                console.log("Jade WebSocket version:", version)

                // Initialize jade and collect all related data
                const xpub = await jadeWs.getMasterXpub() // asking something that requires unlock
                const multiWallets = await jadeWs.getRegisteredMultisigs()

                // Create standard derivations for WebSocket Jade (similar to regular Jade)
                const jadeDerivations = await jadeStandardDerivations(jadeWs)

                // Set all jade-related state at once (reusing the same state as regular Jade)
                setJade(jadeWs, xpub, multiWallets, jadeDerivations)

                connectJadeWebSocketMessage.innerHTML = success("Connected to Jade via WebSocket successfully!")
                loadingBar.setAttribute("style", "visibility: hidden;")
            } catch (e) {
                console.error("Error connecting to Jade via WebSocket:", e)
                connectJadeWebSocketMessage.innerHTML = warning("Error connecting to Jade via WebSocket: " + e.message)
                setBusyDisabled(connectJadeWebSocket, false)
            }
        })
    }

    exampleDescriptor.addEventListener("click", (_e) => {
        if (descriptorTextarea.value == "") {
            const exampleTestnet = "ct(slip77(ac53739ddde9fdf6bba3dbc51e989b09aa8c9cdce7b7d7eddd49cec86ddf71f7),elwpkh([93970d14/84'/1'/0']tpubDC3BrFCCjXq4jAceV8k6UACxDDJCFb1eb7R7BiKYUGZdNagEhNfJoYtUrRdci9JFs1meiGGModvmNm8PrqkrEjJ6mpt6gA1DRNU8vu7GqXH/<0;1>/*))#u0y4axgs"
            // const exampleTestnet = "ct(elip151,elwpkh([93970d14/84'/1'/0']tpubDC3BrFCCjXq4jAceV8k6UACxDDJCFb1eb7R7BiKYUGZdNagEhNfJoYtUrRdci9JFs1meiGGModvmNm8PrqkrEjJ6mpt6gA1DRNU8vu7GqXH/<0;1>/*))"
            const exampleMainnet = "ct(slip77(2411e278affa5c47010eab6d313c1ec66628ec0dd03b6fc98d1a05a0618719e6),elwpkh([a8874235/84'/1776'/0']xpub6DLHCiTPg67KE9ksCjNVpVHTRDHzhCSmoBTKzp2K4FxLQwQvvdNzuqxhK2f9gFVCN6Dori7j2JMLeDoB4VqswG7Et9tjqauAvbDmzF8NEPH/<0;1>/*))#upsg7h8m"
            // const exampleMainnet = "ct(elip151,elwpkh([a8874235/84h/1776h/0h]xpub6DLHCiTPg67KE9ksCjNVpVHTRDHzhCSmoBTKzp2K4FxLQwQvvdNzuqxhK2f9gFVCN6Dori7j2JMLeDoB4VqswG7Et9tjqauAvbDmzF8NEPH/<0;1>/*))#e5ttknaj"
            const example = network.isMainnet() ? exampleMainnet : exampleTestnet
            descriptorTextarea.value = example
            handleWatchOnlyClick()
        } else {
            descriptorMessage.innerHTML = warning("Clear the descriptor text area to try an example descriptor")
        }
    })

    let watchOnlyButton = document.getElementById("watch-only-button") as HTMLButtonElement
    watchOnlyButton.addEventListener("click", handleWatchOnlyClick)

    connectJade.disabled = false
    watchOnlyButton.disabled = false as any
    (exampleDescriptor as any).disabled = false

    loadingBar.setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts

    let randomWalletButton = document.getElementById("random-wallet-button") as HTMLButtonElement;
    let softwareMnemonicTextarea = document.getElementById("software-mnemonic-textarea") as HTMLTextAreaElement;
    let useMnemonicButton = document.getElementById("use-mnemonic-button") as HTMLButtonElement;

    let ledgerDescriptorDiv = document.getElementById("ledger-descriptor-div")
    let ledgerDescriptorButton = document.getElementById("ledger-connect-button") as HTMLButtonElement
    ledgerDescriptorButton.addEventListener("click", async (_e) => {
        let connectLedgerMessage = document.getElementById("connect-ledger-message")

        var ledger
        try {
            let device = await lwk.searchLedgerDevice()
            ledger = new lwk.LedgerWeb(device, network)
        } catch (e) {
            console.error("Error connecting to Ledger:", e)
            connectLedgerMessage.innerHTML = warning("Error. Is the Ledger connected and unlocked?")
        }
        try {
            loadingBar.setAttribute("style", "visibility: visible;")

            let desc = await ledger.wpkhSlip77Descriptor()

            let wollet = new lwk.Wollet(network, desc)
            console.log("wollet", wollet)
            setLedger(ledger)
            setWollet(wollet)
            setBoltzSession(await createBoltzSession(wollet))
            setWolletSelected("Ledger")
            setScanRunning(false)
            loadPersisted(wollet)
            await fullScanAndApply(wollet, getScanState())

        } catch (e) {
            console.error("Error getting descriptor:", e)
            connectLedgerMessage.innerHTML = warning("Error. Is the Ledger unlocked and app is " + network + "?")
        } finally {
            loadingBar.setAttribute("style", "visibility: hidden;")
        }
    })

    // Function to update ledger UI elements based on devMode and network
    const updateLedgerVisibility = (isDevMode) => {
        // Only show if dev mode is enabled
        if (isDevMode) {
            // Show the container div
            ledgerDescriptorDiv.hidden = false;

            // Show and style the button
            ledgerDescriptorButton.hidden = false;
            ledgerDescriptorButton.disabled = false;
            ledgerDescriptorButton.textContent = "Connect to Ledger";
        } else {
            // Hide completely when not in dev mode
            ledgerDescriptorDiv.hidden = true;
            ledgerDescriptorButton.hidden = true;
            ledgerDescriptorButton.disabled = true;
        }
    }

    // Initialize ledger visibility based on current dev mode
    updateLedgerVisibility(getDevMode())

    // Subscribe to dev mode changes to update ledger visibility
    subscribe('dev-mode-changed', updateLedgerVisibility)

    // Show Amp0 section only in testnet and mainnet
    if (network.isTestnet() || network.isMainnet()) {
        amp0Div.hidden = false
        amp0LoginButton.disabled = false
        amp0LoginButton.addEventListener("click", handleAmp0Login)
    }

    if (!network.isMainnet()) {
        document.getElementById("random-wallet-div").hidden = false
        randomWalletButton.disabled = false
        useMnemonicButton.disabled = false

        // Function to handle wallet creation with a specific mnemonic
        const createWalletWithMnemonic = (mnemonicStr: string) => {
            const mnemonicToUse = new lwk.Mnemonic(mnemonicStr)
            const swSigner = new lwk.Signer(mnemonicToUse, network)
            setSwSigner(swSigner)
            let desc = swSigner.wpkhSlip77Descriptor()
            descriptorTextarea.value = desc.toString()
            handleWatchOnlyClick()
        }

        const getSavedMnemonic = (): string | null => {
            const mnemonicFromStorage = localStorage.getItem(RANDOM_MNEMONIC_KEY)
            if (mnemonicFromStorage != null) {
                try {
                    new lwk.Mnemonic(mnemonicFromStorage)
                    return mnemonicFromStorage
                } catch (_e) {
                    return null
                }
            }

            return null
        }

        const saveAndUseMnemonic = (mnemonicStr: string) => {
            const mnemonic = new lwk.Mnemonic(mnemonicStr)
            const normalizedMnemonic = mnemonic.toString()
            localStorage.setItem(RANDOM_MNEMONIC_KEY, normalizedMnemonic)
            softwareMnemonicTextarea.value = normalizedMnemonic
            createWalletWithMnemonic(normalizedMnemonic)
        }

        const savedMnemonic = getSavedMnemonic()
        if (savedMnemonic != null) {
            softwareMnemonicTextarea.value = savedMnemonic
        }

        // Show test-specific buttons only in regtest mode
        if (network.isRegtest()) {
            const testButtonsDiv = document.getElementById("test-buttons-div")
            testButtonsDiv.hidden = false

            // Add event listener for "Abandon wallet" button
            const abandonWalletButton = document.getElementById("abandon-wallet-button")
            abandonWalletButton.addEventListener("click", () => {
                createWalletWithMnemonic("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about")
            })

            // Add event listener for "Ledger test wallet" button
            const ledgerTestWalletButton = document.getElementById("ledger-test-wallet-button")
            ledgerTestWalletButton.addEventListener("click", () => {
                createWalletWithMnemonic("glory promote mansion idle axis finger extra february uncover one trip resource lawn turtle enact monster seven myth punch hobby comfort wild raise skin")
            })
        }

        randomWalletButton.addEventListener("click", (_e) => {
            if (softwareMnemonicTextarea.value.trim() !== "" && !window.confirm("Replace the mnemonic with a new random mnemonic? Make sure you have backed it up.")) {
                return
            }

            const mnemonicToUse = lwk.Mnemonic.fromRandom(12)
            saveAndUseMnemonic(mnemonicToUse.toString())
        });

        useMnemonicButton.addEventListener("click", (_e) => {
            saveAndUseMnemonic(softwareMnemonicTextarea.value.trim())
        });
    }

    const hashDescriptor = decodeURIComponent(window.location.hash.slice(1))
    if (hashDescriptor) {
        descriptorTextarea.value = hashDescriptor
        document.querySelector("details").open = true
        window.location.hash = ''

        // Using setTimeout to ensure this runs after component initialization.
        // This allows the custom elements to be registered and ready before
        // we try to navigate to the wallet view.
        setTimeout(async () => {
            await handleWatchOnlyClick()
        }, 0)
    }
}

async function handleWatchOnlyClick(_e?: Event): Promise<void> {
    let descriptorMessage = document.getElementById("descriptor-message")
    try {
        let descriptorTextarea = document.getElementById("descriptor-textarea") as HTMLTextAreaElement
        const descriptorText = descriptorTextarea.value.trim()
        if (descriptorText == "") {
            throw new Error("Empty confidential descriptor")
        }
        const descriptor = new lwk.WolletDescriptor(descriptorText)
        if (descriptor.isMainnet() != network.isMainnet()) {
            throw new Error("The descriptor has wrong network")
        }

        const wollet = new lwk.Wollet(network, descriptor)
        setWollet(wollet)
        setBoltzSession(await createBoltzSession(wollet))
        setWolletSelected("Descriptor")
        setScanRunning(false)
        loadPersisted(wollet)

        await fullScanAndApply(wollet, getScanState())
    } catch (e) {
        descriptorMessage.innerHTML = warning(e)
    }
}

async function handleAmp0Login(_e: Event) {
    let amp0Message = document.getElementById("amp0-message")
    let amp0User = document.getElementById("amp0-user") as HTMLInputElement
    let amp0Password = document.getElementById("amp0-password") as HTMLInputElement
    let amp0LoginButton = document.getElementById("amp0-login-button")

    try {
        // Clear previous messages
        amp0Message.innerHTML = ""

        // Get input values
        const username = amp0User.value.trim()
        const password = amp0Password.value.trim()

        // Basic validation
        if (username === "") {
            throw new Error("Username cannot be empty")
        }
        if (password === "") {
            throw new Error("Password cannot be empty")
        }

        // Set button to busy state
        setBusyDisabled(amp0LoginButton, true)

        var amp0
        if (network.isMainnet()) {
            amp0 = await lwk.Amp0.newMainnet(username, password, "");
        } else {
            amp0 = await lwk.Amp0.newTestnet(username, password, "");
        }

        // Store amp0 instance in state
        setAmp0(amp0);

        // Show success message
        amp0Message.innerHTML = success("Login successful!")
        const wollet = amp0.wollet()

        setWollet(wollet)
        setBoltzSession(await createBoltzSession(wollet))
        setWolletSelected("Amp0")
        setScanRunning(false)
        loadPersisted(wollet)

        await fullScanAndApply(wollet, getScanState())

    } catch (e) {
        amp0Message.innerHTML = warning("Login failed: " + e.toString())
    } finally {
        // Always reset button state when operation is complete
        setBusyDisabled(amp0LoginButton, false)
    }
}

await init()

class WalletNotifications extends HTMLElement {
    subscriptions!: (() => void)[];
    dismissTimers!: Map<string, ReturnType<typeof setTimeout>>;

    constructor() {
        super()

        this.subscriptions = [
            subscribe('wallet-notifications-changed', this.render)
        ];
        this.dismissTimers = new Map();

        this.setAttribute("aria-live", "polite");
        this.addEventListener("click", this.handleClick);

        this.render();
    }

    disconnectedCallback() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.dismissTimers.forEach(timer => clearTimeout(timer));
        this.dismissTimers.clear();
        this.removeEventListener("click", this.handleClick);
    }

    handleClick = (event: Event) => {
        const target = event.target as Element | null;
        const closeButton = target?.closest("button[data-notification-id]") as HTMLButtonElement | null;
        const notificationId = closeButton?.getAttribute("data-notification-id");

        if (notificationId) {
            dismissWalletNotification(notificationId);
        }
    }

    syncDismissTimers(notifications: WalletNotification[]) {
        const currentIds = new Set(notifications.map(notification => notification.id));

        this.dismissTimers.forEach((timer, id) => {
            if (!currentIds.has(id)) {
                clearTimeout(timer);
                this.dismissTimers.delete(id);
            }
        });

        notifications.forEach(notification => {
            if (notification.timeoutMs === null || this.dismissTimers.has(notification.id)) {
                return;
            }

            const timer = setTimeout(() => {
                dismissWalletNotification(notification.id);
            }, notification.timeoutMs);
            this.dismissTimers.set(notification.id, timer);
        });
    }

    render = () => {
        const notifications = getWalletNotifications();
        this.syncDismissTimers(notifications);

        this.replaceChildren();
        this.hidden = notifications.length === 0;

        notifications.forEach(notification => {
            const article = document.createElement("article");
            article.className = `wallet-notification wallet-notification-${notification.level}`;
            article.setAttribute("role", notification.level === "error" || notification.level === "warning" ? "alert" : "status");

            const content = document.createElement("div");
            content.className = "wallet-notification-content";

            if (notification.title !== "") {
                const title = document.createElement("strong");
                title.className = "wallet-notification-title";
                title.textContent = notification.title;
                content.appendChild(title);
            }

            const message = document.createElement("p");
            message.className = "wallet-notification-message";
            message.textContent = notification.message;
            content.appendChild(message);
            article.appendChild(content);

            if (notification.closable) {
                const closeButton = document.createElement("button");
                closeButton.type = "button";
                closeButton.className = "wallet-notification-close secondary outline";
                closeButton.setAttribute("aria-label", "Close notification");
                closeButton.setAttribute("data-notification-id", notification.id);
                closeButton.textContent = "x";
                article.appendChild(closeButton);
            }

            this.appendChild(article);
        });
    }
}

class MyFooter extends HTMLElement {
    footer!: HTMLElement;
    subscriptions!: (() => void)[];

    constructor() {
        super()
        this.footer = this.querySelector('footer')

        // Store subscriptions so we can unsubscribe later if needed
        this.subscriptions = [];

        // Replace document event listeners with state subscriptions
        this.subscriptions.push(
            subscribe('jade-changed', this.render),
            subscribe('wallet-selected', this.render)
        );

        this.render()
    }

    // Clean up subscriptions when the element is removed from the DOM
    disconnectedCallback() {
        // Unsubscribe from all state subscriptions
        this.subscriptions.forEach(unsubscribe => unsubscribe());
    }

    handleClick = (_event) => {
        this.dispatchEvent(new CustomEvent('wallet-clicked', {
            bubbles: true,
        }))
    }



    handleAboutClick = (_event) => {
        this.dispatchEvent(new CustomEvent('about-clicked', {
            bubbles: true,
        }))
    }

    render = () => {
        var footer = ''
        if (network.isMainnet()) {
            footer += `<a href="/">Home</a>`
        } else {
            footer += `<a href="/testnet">Home</a>`
        }

        footer += `<span> | </span><a href="https://github.com/RCasatta/liquid-web-wallet">Source</a>`
        footer += `<span> | </span><a href="#" id="about">About</a>`

        footer += `<span> | </span><span>${network}</span>`
        if (getJade() != null) {
            const jadeIdentifier = (getXpub() as any).fingerprint()
            footer += `<span> | </span><span><code>${jadeIdentifier}</code></span>`
        }
        if (getWolletSelected() != null) {
            footer += `<span> | </span><a href="#" id="wallet">Wallet</a>`
        }
        if (network.isMainnet()) {
            footer += `<span> | </span><a href="/testnet">Switch to Testnet</a>`
        } else {
            footer += `<span> | </span><a href="/">Switch to Mainnet</a>`
        }
        this.footer.innerHTML = footer
        let id = this.querySelector("#wallet")
        if (id) {
            id.addEventListener("click", this.handleClick)
        }

        let idAbout = this.querySelector("#about")
        if (idAbout) {
            idAbout.addEventListener("click", this.handleAboutClick)
        }
    }
}

class MyNav extends HTMLElement {
    subscriptions!: (() => void)[];

    constructor() {
        super()

        // Store subscriptions so we can unsubscribe later if needed
        this.subscriptions = [];

        // Initialize the component
        this.render()

        // Keep direct DOM event listeners
        this.addEventListener("click", this.handleClick)

        this.subscriptions.push(
            // State change subscriptions
            subscribe('jade-changed', () => {
                this.render()
                this.renderPage("wallets-page")
            }),

            // Handle wallet selection
            subscribe('wallet-selected', () => {
                scanLoop()
                this.render()
                this.renderPage("balance-page")
            }),

            // Handle PSET changes
            subscribe('pset-changed', (pset) => {
                if (pset !== null) {
                    this.renderPage("sign-page")
                }
            })
        );

        // We still need some DOM events for component interactions
        // These could eventually be replaced with a more robust component communication system
        document.addEventListener('wallet-clicked', () => {
            this.renderPage("wallet-page")
        })

        document.addEventListener('register-clicked', () => {
            this.renderPage("register-multisig-page")
        })



        document.addEventListener('about-clicked', () => {
            this.renderPage("about-page")
        })

        // For reload-page, we could eventually create a dedicated state action
        document.addEventListener('reload-page', () => {
            const currentPage = getCurrentPage()
            if (currentPage != null) {
                if (currentPage == "balance-page" || currentPage == "transactions-page") {
                    this.renderPage(currentPage)
                }
            }
        })
    }

    // Clean up subscriptions when the element is removed from the DOM
    disconnectedCallback() {
        // Unsubscribe from all state subscriptions
        this.subscriptions.forEach(unsubscribe => unsubscribe());
    }

    handleClick = async (event) => {
        let id = event.target.id
        if (id === "") {
            return
        }
        if (id == "disconnect") {
            stopScanLoop()
            location.reload()
            return
        }

        this.renderPage(id)
    }

    renderPage(id) {
        setCurrentPage(id)
        const template = (document.getElementById(id + "-template") as HTMLTemplateElement).content.cloneNode(true)

        cleanChilds(app)
        app.appendChild(template)
    }

    render = async (_e?: Event) => {
        if (getWolletSelected() != null) {
            const lightningLink = network.isTestnet()
                ? ''
                : `<a href="#" id="lightning-page">Lightning</a> |`;
            this.innerHTML = `
                    <a href="#" id="balance-page">Balance</a> |
                    <a href="#" id="transactions-page">Transactions</a> |
                    <a href="#" id="create-page">Create</a> |
                    <a href="#" id="sign-page">Sign</a> |
                    <a href="#" id="receive-page">Receive</a> |
                    ${lightningLink}
                    <a href="#" id="disconnect">Disconnect</a>

                    <br><br>
                `
        }
    }
}


class WalletSelector extends HTMLElement {
    walletSelector!: HTMLSelectElement;
    walletProgress!: HTMLProgressElement;
    registerMultisigLink!: HTMLAnchorElement;

    constructor() {
        super()
        this.walletSelector = this.querySelector("select")
        this.walletProgress = this.querySelector("progress")
        this.walletSelector.onchange = this.handleSelect  // not sure why I can't addEventListener
        this.registerMultisigLink = this.querySelector("a")
        this.registerMultisigLink.addEventListener("click", this.handleClick)

        this.addMulti()
    }

    handleClick = async (_event) => {
        this.dispatchEvent(new CustomEvent("register-clicked", {
            bubbles: true,
        }))
    }

    addMulti = () => {
        getMultiWallets().forEach((w) => {
            let option = document.createElement("option")
            option.innerText = w + " (multisig)"
            option.setAttribute("value", w)
            this.walletSelector.appendChild(option)
        })
    }

    handleSelect = async () => {
        this.walletProgress.hidden = false

        setWolletSelected(this.walletSelector.value)
        var descriptor
        const jade = getJade();
        if (getWolletSelected() == "Wpkh") {
            descriptor = await jade.wpkh()
        } else if (getWolletSelected() == "ShWpkh") {
            descriptor = await jade.shWpkh()
        } else {
            descriptor = await jade.multi(getWolletSelected())
        }
        console.log(descriptor.toString())
        const wollet = new lwk.Wollet(network, descriptor)
        setWollet(wollet)
        setBoltzSession(await createBoltzSession(wollet))
        setScanRunning(false)
        loadPersisted(wollet)

        await fullScanAndApply(wollet, getScanState())
    }
}


class AddressView extends HTMLElement {
    showButton!: HTMLButtonElement;
    messageDiv!: HTMLElement;
    addressDisplay!: HTMLElement;
    addressText!: HTMLElement;
    addressCode!: HTMLElement;
    addressQR!: HTMLElement;
    addressLink!: HTMLAnchorElement;
    addressImage!: HTMLImageElement;

    constructor() {
        super()

        this.showButton = this.querySelector("button.show-address")
        this.messageDiv = this.querySelector("div.message")
        this.addressDisplay = this.querySelector("div.address-display")
        this.addressText = this.querySelector(".address-text")
        this.addressCode = this.querySelector(".address-text code")
        this.addressQR = this.querySelector(".address-qr")
        this.addressLink = this.querySelector(".address-qr a")
        this.addressImage = this.querySelector(".address-qr img")

        this.showButton.addEventListener("click", this.handleShow)
    }

    displayAddress(address: lwk.AddressResult) {
        const addr = address.address()
        const addrString = addr.toString()

        // Update the address code element
        this.addressCode.textContent = addrString
        this.addressText.hidden = false

        // Update the QR code link and image
        this.addressLink.href = `liquidnetwork:${addrString}`
        this.addressImage.src = addr.QRCodeUri(null)
        this.addressQR.hidden = false
    }

    handleShow = async (_e) => {
        try {
            // Set button to busy state at the beginning
            setBusyDisabled(this.showButton, true)

            if (getAmp0() != null) {
                await this.handleShowOnAmp0()
            } else if (getJade() != null) {
                await this.handleShowOnJade()
            } else if (getLedger() != null) {
                await this.handleShowOnLedger()
            } else {
                this.displayAddress(getWollet().address(null))
            }
        } catch (error) {
            this.messageDiv.innerHTML = warning(error.toString())
        } finally {
            // Always reset button state when operation is complete
            setBusyDisabled(this.showButton, false)
        }
    }

    handleShowOnLedger = async (_e?: Event) => {
        const address = getWollet().address(null)
        const index = address.index()
        console.log(address.address().toString())

        // Display the address so that it can be compared
        this.displayAddress(address)

        this.messageDiv.innerHTML = warning("Check the address on the Ledger!")

        let ledger = getLedger()
        let addressLedger = await ledger.getReceiveAddressSingle(index)

        console.assert(addressLedger == address.address().toString(), "local and ledger address are different!")

        this.messageDiv.innerHTML = ""

    }

    handleShowOnAmp0 = async (_e?: Event) => {
        const address = await getAmp0().address(1)
        this.displayAddress(address)
        this.messageDiv.innerHTML = warning("Fixed Amp0 address with index 1")
    }

    handleShowOnJade = async (_e?: Event) => {
        // We don't need to set busy state here since it's now handled in handleShow
        const address = getWollet().address(null)
        const index = address.index()
        console.log(address.address().toString())

        // Display the address so that it can be compared
        this.displayAddress(address)

        if (getJade() == null) {
            this.messageDiv.innerHTML = warning("Address generated without double checking without the hardware wallet are risky!")
            return
        }
        this.messageDiv.innerHTML = warning("Check the address on the Jade!")
        var jadeAddress
        if (getWolletSelected() === "Wpkh" || getWolletSelected() === "ShWpkh") {
            // FIXME it breakes if someone call his registered wallet "Wpkh" or "ShWpkh"
            let fullPath = getWollet().addressFullPath(index)
            let variant = lwk.Singlesig.from(getWolletSelected())
            jadeAddress = await getJade().getReceiveAddressSingle(variant, fullPath)
        } else {
            // 0 means external chain
            jadeAddress = await getJade().getReceiveAddressMulti(getWolletSelected(), new Uint32Array([0, index]))
        }

        console.assert(jadeAddress == address.address().toString(), "local and jade address are different!")
        this.messageDiv.hidden = true
    }
}

class WalletBalance extends HTMLElement {
    subtitle!: HTMLElement;
    div!: HTMLElement;
    faucetRequest!: HTMLButtonElement;
    subscriptions!: (() => void)[];
    messageDiv!: HTMLElement;

    constructor() {
        super()
        this.subtitle = this.querySelector("p")
        this.div = this.querySelector("div")
        this.faucetRequest = this.querySelector("button")

        // Store subscriptions so we can unsubscribe later if needed
        this.subscriptions = [];

        // Subscribe to scan state changes instead of using document events
        this.subscriptions.push(
            subscribe('scan-update', this.render),
            subscribe('registry-fetched', this.render),
            subscribe('persist-loaded', this.render),
        );

        this.faucetRequest.addEventListener('click', this.handleFaucetRequest)
        this.messageDiv = this.querySelector("div.message")

        this.render()
    }

    // Clean up subscriptions when the element is removed from the DOM
    disconnectedCallback() {
        // Unsubscribe from all state subscriptions
        this.subscriptions.forEach(unsubscribe => unsubscribe());
    }

    handleFaucetRequest = async () => {
        this.faucetRequest.hidden = true
        var address
        if (getAmp0() == null) {
            address = getWollet().address(null).address().toString()
        } else {
            address = (await getAmp0().address(null)).address().toString()
        }
        const url = `https://liquidtestnet.com/api/faucet?address=${address}&action=lbtc`
        console.log(url)
        this.messageDiv.innerHTML = success("Sending request to the faucet...")
        await fetch(url, { mode: "no-cors" })
        this.messageDiv.innerHTML = success("Request sent to the faucet, wait a bit to see funds")
    }

    render = () => {
        const wollet = getWollet();
        if (!wollet || wollet.neverScanned()) {
            return
        }
        const balance = wollet.balance().entries()

        const lbtc = balance.get(network.policyAsset().toString())
        if (lbtc == 0 && !network.isMainnet()) {
            this.faucetRequest.hidden = false
        }

        updatedAt(wollet, this.subtitle)

        cleanChilds(this.div)
        this.div.appendChild(mapToTable(mapBalance(balance), true))
    }
}


class WalletTransactions extends HTMLElement {
    static readonly PAGE_SIZE = 10;
    txsTitle!: HTMLElement;
    subtitle!: HTMLElement;
    div!: HTMLElement;
    subscriptions!: (() => void)[];
    currentPage: number;

    constructor() {
        super()
        this.txsTitle = this.querySelector("h2")
        this.subtitle = this.querySelector("p")
        this.div = this.querySelector("div")
        this.currentPage = 0;

        // Store subscriptions so we can unsubscribe later if needed
        this.subscriptions = [];

        // Subscribe to scan state changes instead of using document events
        this.subscriptions.push(
            subscribe('scan-state-changed', this.render)
        );

        this.render()
    }

    // Clean up subscriptions when the element is removed from the DOM
    disconnectedCallback() {
        // Unsubscribe from all state subscriptions
        this.subscriptions.forEach(unsubscribe => unsubscribe());
    }

    render = () => {
        const wollet = getWollet();
        if (!wollet || wollet.neverScanned()) {
            return
        }

        const totalTransactions = wollet.numTxs()
        const totalPages = Math.max(1, Math.ceil(totalTransactions / WalletTransactions.PAGE_SIZE))
        this.currentPage = Math.min(this.currentPage, totalPages - 1)

        const offset = this.currentPage * WalletTransactions.PAGE_SIZE
        const txsOpt = lwk.TxsOpt.withPagination(offset, WalletTransactions.PAGE_SIZE)
        const transactions = wollet.txs(txsOpt)

        if (totalTransactions === 1) {
            this.txsTitle.innerText = "1 Transaction"
        } else if (totalTransactions > 1) {
            this.txsTitle.innerText = totalTransactions + " Transactions"
        } else {
            this.txsTitle.innerText = "Transactions"
        }
        let div = document.createElement("div")
        div.setAttribute("class", "overflow-auto")

        // Add UTXO only mode explanation if enabled
        if (getUtxoOnly()) {
            let utxoInfo = document.createElement("p")
            utxoInfo.setAttribute("class", "secondary")
            utxoInfo.innerHTML = "<em>The following is not the full transaction history, in UTXO only mode only transactions contributing to the balance are shown.</em>"
            div.appendChild(utxoInfo)
        }

        let table = document.createElement("table")
        table.setAttribute("class", "striped")
        div.appendChild(table)
        transactions.forEach((val) => {

            let newRow = document.createElement("tr")
            table.appendChild(newRow)
            let txid_string = val.txid().toString()
            let txid_truncated = txid_string.slice(0, 8) + "..." + txid_string.slice(-8)

            let txid = document.createElement("td")
            txid.innerHTML = `
                    <code><a href="${val.unblindedUrl(network.defaultExplorerUrl())}" target="_blank">${txid_truncated}</a></code>
                `
            let txType = document.createElement("td")
            txType.innerHTML = `
                    <span>${val.txType()}</span>
                `
            let heightCell = document.createElement("td")

            var timeAgo = (typeof val.timestamp() === 'undefined') ? "unconfirmed" : elapsedFrom(val.timestamp())
            heightCell.innerHTML = `
                <em data-placement="left" data-tooltip="Block ${val.height()}">${timeAgo}</em>
            `
            heightCell.setAttribute("style", "text-align:right")

            newRow.appendChild(txid)
            newRow.appendChild(txType)
            newRow.appendChild(heightCell)
        })

        if (totalTransactions > 0) {
            const pagination = document.createElement("nav")
            pagination.setAttribute("aria-label", "Transactions pagination")

            const previousButton = document.createElement("button")
            previousButton.innerText = "Previous"
            previousButton.disabled = this.currentPage === 0
            previousButton.onclick = () => {
                this.currentPage -= 1
                this.render()
            }

            const nextButton = document.createElement("button")
            nextButton.innerText = "Next"
            nextButton.disabled = this.currentPage >= totalPages - 1
            nextButton.onclick = () => {
                this.currentPage += 1
                this.render()
            }

            const rangeStart = offset + 1
            const rangeEnd = offset + transactions.length
            const pageSummary = document.createElement("ul")
            pageSummary.innerHTML = `<li>Showing ${rangeStart}-${rangeEnd} of ${totalTransactions}</li>`

            pagination.appendChild(pageSummary)
            pagination.appendChild(previousButton)
            pagination.appendChild(nextButton)
            div.appendChild(pagination)
        }

        updatedAt(wollet, this.subtitle)
        cleanChilds(this.div)
        this.div.appendChild(div)
    }
}


class CreateTransaction extends HTMLElement {
    createButton!: HTMLButtonElement;
    busy!: HTMLElement;
    selectAssetInRecipient!: HTMLSelectElement;
    div!: HTMLElement;
    addressInput!: HTMLInputElement;
    satoshisInput!: HTMLInputElement;
    addRecipient!: HTMLInputElement;
    message!: HTMLElement;
    messageCreate!: HTMLElement;
    template!: HTMLTemplateElement;
    listRecipients!: HTMLElement;
    assetWanted!: HTMLInputElement;
    amountWanted!: HTMLInputElement;
    messageLiquidex!: HTMLElement;
    proposalTextarea!: HTMLTextAreaElement;
    qrScannerModal!: HTMLDialogElement;
    videoStream!: MediaStream | null;
    qrVideo!: HTMLVideoElement;
    scanInterval!: ReturnType<typeof setInterval> | null;
    currentScanTarget!: string | null;
    qrScanButton!: HTMLButtonElement;
    qrScanButtonAsset!: HTMLButtonElement;
    qrScanButtonToken!: HTMLButtonElement;
    qrCloseButton!: HTMLButtonElement;
    messageIssuance!: HTMLElement;
    messageReissuance!: HTMLElement;
    reissuanceAssetId!: HTMLInputElement;
    reissuanceSatoshi!: HTMLInputElement;
    reissuanceAddress!: HTMLInputElement;
    ticker!: HTMLInputElement;
    assetAddress!: HTMLInputElement;
    tokenAddress!: HTMLInputElement;
    tokenAmount!: HTMLInputElement;
    domain!: HTMLInputElement;
    pubkey!: HTMLInputElement;
    name!: HTMLInputElement;
    precision!: HTMLInputElement;
    assetAmount!: HTMLInputElement;
    selectAssetInBurn!: HTMLSelectElement;
    amountBurn!: HTMLInputElement;
    messageBurn!: HTMLElement;
    utxoSelect!: HTMLSelectElement;
    makerForm!: HTMLFormElement;
    takerForm!: HTMLFormElement;
    createProposalButton!: HTMLButtonElement;
    lbtcButton!: HTMLButtonElement;
    acceptProposalButton!: HTMLButtonElement;
    addBurn!: HTMLInputElement;
    qrScanButtonReissuance!: HTMLButtonElement;
    issueForm!: HTMLFormElement;
    reissueForm!: HTMLFormElement;

    constructor() {
        super();
        const selects = this.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
        this.selectAssetInRecipient = selects[0];
        this.div = this.querySelector("div") as HTMLElement;
        this.createButton = this.querySelector("button.create") as HTMLButtonElement;
        if (this.createButton) this.createButton.addEventListener("click", this.handleCreate.bind(this));
        this.busy = this.querySelector("article")
        const inputs = this.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
        this.addressInput = inputs[0];
        this.satoshisInput = inputs[1];
        this.addRecipient = inputs[2];
        if (this.addRecipient) this.addRecipient.addEventListener("click", this.handleAdd.bind(this));
        this.message = this.querySelector("div.message") as HTMLElement;
        this.messageCreate = this.querySelector("div.messageCreate") as HTMLElement;
        this.template = this.querySelector("template") as HTMLTemplateElement;
        this.listRecipients = this.querySelector("div.recipients") as HTMLElement;

        // Setup QR Code scanner
        this.qrScanButton = this.querySelector("button.qr-scan-button")
        this.qrScanButton.addEventListener("click", () => this.handleQrScan())
        this.qrScannerModal = document.getElementById("qr-scanner-modal") as HTMLDialogElement
        this.qrVideo = document.getElementById("qr-video") as HTMLVideoElement
        this.qrCloseButton = document.getElementById("qr-scanner-close") as HTMLButtonElement
        this.qrCloseButton.addEventListener("click", this.closeQrScanner)

        // Additional QR scan buttons
        this.qrScanButtonAsset = this.querySelector("button.qr-scan-button-asset")
        if (this.qrScanButtonAsset) {
            this.qrScanButtonAsset.addEventListener("click", () => this.handleQrScan("asset"))
        }

        this.qrScanButtonToken = this.querySelector("button.qr-scan-button-token")
        if (this.qrScanButtonToken) {
            this.qrScanButtonToken.addEventListener("click", () => this.handleQrScan("token"))
        }

        this.qrScanButtonReissuance = this.querySelector("button.qr-scan-button-reissuance")
        if (this.qrScanButtonReissuance) {
            this.qrScanButtonReissuance.addEventListener("click", () => this.handleQrScan("reissuance"))
        }

        // Set up QR code scanning
        this.videoStream = null
        this.scanInterval = null
        this.currentScanTarget = null

        this.message = this.querySelector("div.message")
        this.messageCreate = this.querySelector("div.messageCreate")

        this.template = this.querySelector("template")
        this.listRecipients = this.querySelector("div.recipients")

        const details = this.querySelectorAll("details")
        let issuanceSection = details[0]

        // Get the form instead of the button
        this.issueForm = issuanceSection.querySelector("form")
        this.issueForm.addEventListener("submit", this.handleIssue)
        const issuanceInputs = issuanceSection.querySelectorAll("input")
        this.assetAmount = issuanceInputs[0]
        this.assetAddress = issuanceInputs[1]
        this.tokenAmount = issuanceInputs[2]
        this.tokenAddress = issuanceInputs[3]
        this.domain = issuanceInputs[4]
        this.name = issuanceInputs[5]
        this.ticker = issuanceInputs[6]
        this.precision = issuanceInputs[7]
        this.pubkey = issuanceInputs[8]
        this.messageIssuance = issuanceSection.querySelector("div.messageIssuance")


        // Add reissuance section components
        let reissuanceSection = details[1]

        // Get the form instead of the button
        this.reissueForm = reissuanceSection.querySelector("form")
        this.reissueForm.addEventListener("submit", this.handleReissue)
        const reissuanceInputs = reissuanceSection.querySelectorAll("input")
        this.reissuanceAssetId = reissuanceInputs[0]
        this.reissuanceSatoshi = reissuanceInputs[1]
        this.reissuanceAddress = reissuanceInputs[2]
        this.messageReissuance = reissuanceSection.querySelector("div.messageReissuance")

        let burnSection = details[2]

        this.selectAssetInBurn = burnSection.querySelector("select")
        const inputsBurn = burnSection.querySelectorAll("input")
        this.amountBurn = inputsBurn[0]
        this.addBurn = inputsBurn[1]
        this.addBurn.addEventListener("click", this.handleBurn)
        this.messageBurn = burnSection.querySelector("div.messageBurn")

        // Add liquidex section components
        let liquidexMakerSection = details[3]
        let liquidexTakerSection = details[4]

        // Show liquidex sections only in dev mode
        if (getDevMode()) {
            liquidexMakerSection.hidden = false
            liquidexTakerSection.hidden = false
        }

        // Map forms
        const liquidexForms = this.querySelectorAll("form")
        this.makerForm = liquidexMakerSection.querySelector("form")
        this.takerForm = liquidexTakerSection.querySelector("form")

        // Map Maker inputs
        this.utxoSelect = this.makerForm.querySelector("select#utxo")
        const makerInputs = this.makerForm.querySelectorAll("input")
        this.assetWanted = makerInputs[0]
        this.amountWanted = makerInputs[1]

        // Map Maker button
        this.createProposalButton = this.makerForm.querySelector("button[type='submit']")

        // Map LBTC button in the Asset ID field
        this.lbtcButton = this.makerForm.querySelector("button.lbtc-button")
        if (this.lbtcButton) {
            this.lbtcButton.addEventListener("click", this.handleLbtcButtonClick)
        }

        // Map Taker textarea and button
        this.proposalTextarea = this.takerForm.querySelector("textarea")
        this.acceptProposalButton = this.takerForm.querySelector("button[type='submit']")

        // Map message div (which is now outside both details elements)
        this.messageLiquidex = this.querySelector("div.messageLiquidex")

        // Add event listeners
        this.makerForm.addEventListener("submit", this.handleCreateProposal)
        this.takerForm.addEventListener("submit", this.handleAcceptProposal)

        this.render()
    }

    // Handler for LBTC button click
    handleLbtcButtonClick = () => {
        // Set the asset_wanted field to the network's policy asset (LBTC)
        this.assetWanted.value = network.policyAsset().toString()
    }

    handleQrScan = async (targetField = "main") => {
        try {
            // Store which field we're scanning for
            this.currentScanTarget = targetField;

            // Make sure jsQR is loaded
            if (typeof jsQR !== 'function') {
                this.message.innerHTML = warning("QR code scanner is not ready yet. Please try again in a moment.");
                return;
            }

            // Reset message
            this.message.innerHTML = "";

            // Open the modal
            this.qrScannerModal.showModal();

            // Access the camera
            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.qrVideo.srcObject = this.videoStream;

            // Set up canvas for processing video frames
            const canvas = document.createElement('canvas');
            const canvasContext = canvas.getContext('2d');

            // Start scanning
            this.scanInterval = setInterval(() => {
                if (this.qrVideo.readyState === this.qrVideo.HAVE_ENOUGH_DATA) {
                    canvas.height = this.qrVideo.videoHeight;
                    canvas.width = this.qrVideo.videoWidth;
                    canvasContext.drawImage(this.qrVideo, 0, 0, canvas.width, canvas.height);

                    const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });

                    if (code) {
                        // QR code detected
                        this.processQrResult(code.data);
                    }
                }
            }, 200); // Check every 200ms

        } catch (error) {
            this.closeQrScanner();

            let errorMessage = "Could not access camera: " + error.message;

            // More user-friendly error messages for common cases
            if (error.name === 'NotAllowedError') {
                errorMessage = "Camera access was denied. Please allow camera access to scan QR codes.";
            } else if (error.name === 'NotFoundError') {
                errorMessage = "No camera detected on your device.";
            } else if (error.name === 'NotReadableError') {
                errorMessage = "Camera is already in use by another application.";
            }

            // Display the error message in the appropriate location based on the current target
            switch (this.currentScanTarget) {
                case "asset":
                case "token":
                    this.messageIssuance.innerHTML = warning(errorMessage);
                    break;
                case "reissuance":
                    this.messageReissuance.innerHTML = warning(errorMessage);
                    break;
                default:
                    this.message.innerHTML = warning(errorMessage);
                    break;
            }

            // Reset the current scan target
            this.currentScanTarget = null;
        }
    }

    closeQrScanner = () => {
        // Stop video stream and scanning
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        // Close modal
        this.qrScannerModal.close();
    }

    processQrResult = (result) => {
        // Clean up the scan result if needed
        let address = result;

        // If it's a URI scheme like liquidnetwork:address, extract just the address
        if (result.startsWith('liquidnetwork:')) {
            address = result.substring('liquidnetwork:'.length);
        }

        // Close the scanner
        this.closeQrScanner();

        // Set the address in the target input field based on currentScanTarget
        switch (this.currentScanTarget) {
            case "asset":
                this.assetAddress.value = address;
                this.messageIssuance.innerHTML = success("Asset address QR code scanned successfully!");
                break;
            case "token":
                this.tokenAddress.value = address;
                this.messageIssuance.innerHTML = success("Token address QR code scanned successfully!");
                break;
            case "reissuance":
                this.reissuanceAddress.value = address;
                this.messageReissuance.innerHTML = success("Reissuance address QR code scanned successfully!");
                break;
            case "main":
            default:
                this.addressInput.value = address;
                this.message.innerHTML = success("QR code scanned successfully!");
                break;
        }

        // Reset the current scan target
        this.currentScanTarget = null;
    }

    handleReissue = async (e) => {
        e.preventDefault()
        // Get form and validate using built-in HTML5 validation
        const form = e.target

        if (!form.checkValidity()) {
            form.reportValidity()
            return
        }

        try {
            const esplora = esploraClient()
            const assetId = new lwk.AssetId(this.reissuanceAssetId.value)
            const registry = getRegistry();
            const assetInfo = await registry.fetchWithTx(assetId, esplora)
            console.log(`assetId: ${assetId.toString()}`)
            console.log(`contract: ${assetInfo.contract().toString()}`)
            console.log(`issuance tx: ${assetInfo.tx().txid().toString()}`)

            var builder = new lwk.TxBuilder(network)


            // Get the amount to reissue
            const satoshis = parseInt(this.reissuanceSatoshi.value)
            if (isNaN(satoshis) || satoshis <= 0) {
                throw new Error("Invalid reissuance amount")
            }

            // Get the address or use the wallet's address if empty
            let address
            if (this.reissuanceAddress.value.trim() === "") {
                address = getWollet().address(null).address()
            } else {
                address = lwk.Address.parse(this.reissuanceAddress.value, network)
            }

            // Build the reissuance transaction
            builder = builder.reissueAsset(assetId,
                BigInt(this.reissuanceSatoshi.value),
                address,
                assetInfo.tx()
            )
            const reissuePset = builder.finish(getWollet())
            const reissuePsetWithContracts = getRegistry().addContracts(reissuePset);
            setPset(reissuePsetWithContracts)

        } catch (e) {
            this.messageReissuance.innerHTML = warning(e)
            return
        }
    }

    handleIssue = async (e) => {
        e.preventDefault()
        // Get form and validate using built-in HTML5 validation
        const form = e.target

        // initIssuanceForm() // TODO: mockup data, remove this

        if (!form.checkValidity()) {
            form.reportValidity()
            return
        }

        try {
            console.log("handleIssue")

            // Check if ticker is already in use
            const tickerValue = this.ticker.value
            if (!network.isRegtest()) {
                const isTickerAvailable = await checkTickerAvailability(tickerValue);
                if (!isTickerAvailable) {
                    throw new Error(`Ticker '${tickerValue}' is already in use. Please choose a different ticker.`);
                }
            }

            var builder = new lwk.TxBuilder(network)

            const assetAddr = this.assetAddress.value != '' ? new lwk.Address(this.assetAddress.value) : null
            const tokenAddr = parseFloat(this.tokenAmount.value) > 0 && this.tokenAddress.value != '' ? new lwk.Address(this.tokenAddress.value) : null
            const contract = new lwk.Contract(
                this.domain.value,
                this.pubkey.value,
                this.name.value,
                parseInt(this.precision.value),
                tickerValue,
                0,
            )

            // Convert string values to bigint explicitly
            const assetAmount = BigInt(this.assetAmount.value);
            const tokenAmount = BigInt(this.tokenAmount.value);

            builder = builder.issueAsset(
                assetAmount,
                assetAddr,
                tokenAmount,
                tokenAddr,
                contract.clone()
            )
            const pset = builder.finish(getWollet())

            const assetId = pset.inputs()[0].issuanceAsset()
            const postedContract = new lwk.RegistryPost(contract, assetId)
            setContract(postedContract)
            setPset(pset)
        } catch (e) {
            this.messageIssuance.innerHTML = warning(e)
            return
        }
    }

    render = () => {
        const wollet = getWollet();
        if (!wollet || wollet.neverScanned()) {
            return
        }
        let balance = wollet.balance().entries()

        cleanChilds(this.selectAssetInRecipient)
        let option = document.createElement("option")
        option.innerText = "Select Asset"
        this.selectAssetInRecipient.appendChild(option)

        cleanChilds(this.selectAssetInBurn)
        let optionBurn = document.createElement("option")
        optionBurn.innerText = "Select Asset"
        this.selectAssetInBurn.appendChild(optionBurn)

        balance.forEach((_val, key) => {

            let option = document.createElement("option")
            option.innerText = mapAssetTicker(key)
            option.setAttribute("value", key)
            this.selectAssetInRecipient.appendChild(option)

            if (key != network.policyAsset().toString()) {
                // only show non-LBTC assets in the burn section

                let optionBurn = document.createElement("option")
                optionBurn.innerText = mapAssetTicker(key)
                optionBurn.setAttribute("value", key)
                this.selectAssetInBurn.appendChild(optionBurn)
            }
        })

        // Initialize UTXO select dropdown for Liquidex
        if (this.utxoSelect) {
            cleanChilds(this.utxoSelect)

            // Add default empty option
            let defaultOption = document.createElement("option")
            defaultOption.innerText = "Select UTXO"
            defaultOption.setAttribute("value", "")
            this.utxoSelect.appendChild(defaultOption)

            // Add each UTXO from the wallet
            const utxos = wollet.utxos()
            if (utxos && utxos.length > 0) {
                utxos.forEach((utxo, _index) => {
                    try {
                        // Get unblinded information to access asset and value
                        const unblinded = utxo.unblinded()
                        const asset = unblinded.asset().toString()
                        const value = mapAssetPrecision(asset, unblinded.value())
                        const txid = utxo.outpoint().txid().toString()
                        const truncatedTxid = truncateIdentifier(txid)
                        const vout = utxo.outpoint().vout()

                        let option = document.createElement("option")
                        const assetTicker = mapAssetTicker(asset)

                        // Format differently based on whether it's a known asset or not
                        if (assetTicker !== asset) {
                            // Known asset with ticker
                            option.innerText = `${value} ${assetTicker} - ${truncatedTxid}:${vout}`
                        } else {
                            // Unknown asset, show truncated asset ID
                            const truncatedAsset = truncateIdentifier(asset)
                            option.innerText = `${value} [${truncatedAsset}] - ${truncatedTxid}:${vout}`
                        }

                        // Store the full data as a value attribute in JSON format
                        const utxoData = {
                            txid: txid,
                            vout: vout,
                            asset: asset,
                            value: unblinded.value().toString()
                        }
                        option.setAttribute("value", JSON.stringify(utxoData))

                        this.utxoSelect.appendChild(option)
                    } catch (e) {
                        console.error('Error processing UTXO:', e)
                        // Skip this UTXO if there's any issue accessing unblinded data
                    }
                })
            }
        }

        this.busy.hidden = true
        this.div.hidden = false
    }

    handleCreate = (_e) => {
        this.messageCreate.innerHTML = ""
        // verify at least 1 row

        console.log("handleCreate")
        setBusyDisabled(this.createButton, true)

        try {
            const inputsEmpty = this.checkEmptynessRecipient(false)
            if (inputsEmpty.length == 0) {
                this.messageCreate.innerHTML = warning("Click '+' to add the output")
                return
            }

            const recipients = Array.from(this.querySelectorAll("fieldset.recipients"))
            if (recipients.length == 0) {
                this.messageCreate.innerHTML = warning("Cannot create a transaction with no recipients")
                return
            }

            var builder = new lwk.TxBuilder(network)

            for (const recipient of recipients) {
                const recipientAsset = new lwk.AssetId((recipient.querySelector("input.assetid") as HTMLInputElement).value)
                const satoshis = parsePrecision(recipientAsset.toString(), (recipient.querySelector("input.amount") as HTMLInputElement).value)

                if ((recipient.querySelector("input.address") as HTMLInputElement).value == "BURN") {
                    builder = builder.addBurn(satoshis, recipientAsset)
                } else {
                    // address already validated during add phase
                    const recipientAddress = new lwk.Address((recipient.querySelector("input.address") as HTMLInputElement).value)
                    builder = builder.addRecipient(recipientAddress, satoshis, recipientAsset)
                }
            }
            var pset;
            if (getAmp0() == null) {
                pset = builder.finish(getWollet())
            } else {
                const amp0pset = builder.finishForAmp0(getWollet())
                pset = amp0pset.pset()
                setAmp0Pset(amp0pset)
            }
            const psetWithContracts = getRegistry().addContracts(pset);
            setPset(psetWithContracts)

        } catch (e) {
            this.messageCreate.innerHTML = warning(e)
            return
        } finally {
            setBusyDisabled(this.createButton, false)
        }
    }

    checkEmptynessRecipient = (setAria) => {
        return this.checkEmptyness(setAria, [this.addressInput, this.satoshisInput, this.selectAssetInRecipient])
    }
    checkEmptynessBurn = (setAria) => {
        return this.checkEmptyness(setAria, [this.amountBurn, this.selectAssetInBurn])
    }
    checkEmptyness = (setAria, elements) => {
        var inputsEmpty = []
        for (const element of elements) {
            console.log(`element ${element.name} ${element.value}`)
            if (element.value === "" || (element.name == "asset" && element.value === "Select Asset")) {
                if (setAria) {
                    element.setAttribute("aria-invalid", "true")
                }
                inputsEmpty.push(element.name)
            }
        }
        return inputsEmpty
    }

    handleBurn = (_e) => {
        this.messageBurn.innerHTML = ""

        var inputsValid = ""

        const inputsEmpty = this.checkEmptynessBurn(true)
        if (inputsEmpty.length > 0) {
            this.messageBurn.innerHTML = warning(inputsEmpty.join(", ") + " cannot be empty")
            return
        }

        this.selectAssetInBurn.setAttribute("aria-invalid", "false")
        var assetInBurn
        try {
            assetInBurn = new lwk.AssetId(this.selectAssetInBurn.value)
        } catch (e) {
            this.selectAssetInBurn.setAttribute("aria-invalid", "true")
            inputsValid += "Invalid asset. " + e.toString()
        }

        this.amountBurn.setAttribute("aria-invalid", "false")
        const satoshis = parsePrecision(assetInBurn.toString(), this.amountBurn.value)
        if (!satoshis || satoshis <= 0) {
            this.amountBurn.setAttribute("aria-invalid", "true")
            inputsValid += "Invalid value. "
        }

        if (inputsValid != "") {
            this.messageBurn.innerHTML = warning(inputsValid)
            return
        }

        this.listRecipients.hidden = false

        // Add recipient row
        const content = this.template.content.cloneNode(true) as DocumentFragment

        const el = content.querySelector("fieldset") as HTMLElement
        const inputs = content.querySelectorAll("input") as NodeListOf<HTMLInputElement>
        inputs[0].value = "BURN"
        inputs[1].value = this.amountBurn.value
        inputs[2].value = mapAssetTicker(this.selectAssetInBurn.value) // value seen
        inputs[3].value = this.selectAssetInBurn.value                 // value used
        inputs[4].addEventListener("click", (_e) => {
            this.listRecipients.removeChild(el)
        })
        this.listRecipients.appendChild(content)
        // end add recipient row

        // Reset fields
        this.amountBurn.value = ""
        this.selectAssetInBurn.value = "Select Asset"
        this.amountBurn.removeAttribute("aria-invalid")
        this.selectAssetInBurn.removeAttribute("aria-invalid")
        // end reset fields
    }

    handleAdd = (_e) => {
        this.listRecipients.hidden = false
        this.message.innerHTML = ""
        this.messageCreate.innerHTML = ""

        var inputsValid = ""

        const inputsEmpty = this.checkEmptynessRecipient(true)
        if (inputsEmpty.length > 0) {
            this.message.innerHTML = warning(inputsEmpty.join(", ") + " cannot be empty")
            return
        }

        /// Other validations such as valid address
        this.addressInput.setAttribute("aria-invalid", "false")
        try {
            lwk.Address.parse(this.addressInput.value, network)
        } catch (e) {
            this.addressInput.setAttribute("aria-invalid", "true")
            inputsValid += e.toString() + ". "
        }

        this.selectAssetInRecipient.setAttribute("aria-invalid", "false")
        var recipientAsset
        try {
            recipientAsset = new lwk.AssetId(this.selectAssetInRecipient.value)
        } catch (_e) {
            this.selectAssetInRecipient.setAttribute("aria-invalid", "true")
            inputsValid += "Invalid asset. "
        }

        this.satoshisInput.setAttribute("aria-invalid", "false")
        const satoshis = parsePrecision(recipientAsset.toString(), this.satoshisInput.value)
        if (!satoshis || satoshis <= 0) {
            this.satoshisInput.setAttribute("aria-invalid", "true")
            inputsValid += "Invalid value. "
        }

        if (inputsValid != "") {
            this.message.innerHTML = warning(inputsValid)
            return
        }
        // end other validations

        // Add recipient row
        const content = this.template.content.cloneNode(true) as DocumentFragment

        const el = content.querySelector("fieldset") as HTMLElement
        const inputs = content.querySelectorAll("input") as NodeListOf<HTMLInputElement>
        inputs[0].value = this.addressInput.value
        inputs[1].value = this.satoshisInput.value
        inputs[2].value = mapAssetTicker(this.selectAssetInRecipient.value) // value seen
        inputs[3].value = this.selectAssetInRecipient.value                 // value used
        inputs[4].addEventListener("click", (_e) => {
            this.listRecipients.removeChild(el)
        })
        this.listRecipients.appendChild(content)
        // end add recipient row

        // Reset fields
        this.addressInput.value = ""
        this.satoshisInput.value = ""
        this.selectAssetInRecipient.value = "Select Asset"
        this.addressInput.removeAttribute("aria-invalid")
        this.satoshisInput.removeAttribute("aria-invalid")
        this.selectAssetInRecipient.removeAttribute("aria-invalid")
        // end reset fields
    }

    handleCreateProposal = async (e) => {
        e.preventDefault()
        this.messageLiquidex.innerHTML = ""

        try {
            // Check if a UTXO is selected
            if (!this.utxoSelect.value) {
                throw new Error("Please select a UTXO to offer")
            }

            // Parse the UTXO data from the select option
            const utxoData = JSON.parse(this.utxoSelect.value)

            // Create an OutPoint from the UTXO data
            const outpoint = new lwk.OutPoint(`${utxoData.txid}:${utxoData.vout}`)

            // Validate asset wanted
            if (!this.assetWanted.value.trim()) {
                throw new Error("Asset wanted cannot be empty")
            }
            const assetWanted = new lwk.AssetId(this.assetWanted.value.trim())

            // Validate amount wanted
            const amountWantedValue = parseFloat(this.amountWanted.value)
            if (isNaN(amountWantedValue) || amountWantedValue <= 0) {
                throw new Error("Amount wanted must be a positive number")
            }

            // Convert to satoshis using appropriate precision
            const satoshisWanted = parsePrecision(assetWanted.toString(), this.amountWanted.value)

            // Get the receiving address for the swap (using current wallet's address)
            const address = getWollet().address(null).address()

            // Create a new transaction builder
            const builder = new lwk.TxBuilder(network)

            // Use the liquidexMake method to create the proposal
            const psetBuilder = builder.liquidexMake(outpoint, address, BigInt(satoshisWanted), assetWanted)

            // Finish building the transaction
            const pset = psetBuilder.finish(getWollet())

            // Pass the PSET to the sign page
            setPset(pset)

            // Show success message
            this.messageLiquidex.innerHTML = success("Proposal created successfully! Go to Sign page to continue.")

        } catch (e) {
            this.messageLiquidex.innerHTML = warning(e.toString())
        }
    }

    handleAcceptProposal = async (e) => {
        e.preventDefault()
        this.messageLiquidex.innerHTML = ""

        try {
            // Get the proposal text from the textarea
            const proposalText = this.proposalTextarea.value.trim()

            if (!proposalText) {
                throw new Error("Proposal text cannot be empty")
            }
            // Create a UnvalidatedLiquidexProposal from the text
            const unvalidatedProposal = lwk.UnvalidatedLiquidexProposal.new(proposalText)

            // Validate the proposal
            // TODO: make full validation
            const validatedProposal = unvalidatedProposal.insecureValidate()
            console.log(validatedProposal)

            // Create a transaction builder to accept the proposal
            var builder = new lwk.TxBuilder(network)
            builder = builder.liquidexTake([validatedProposal])

            const wallet = getWollet()
            const pset = builder.finish(wallet)

            console.log(pset.outputs().length)
            console.log(pset.inputs().length)

            // Pass the PSET to the sign page
            setPset(pset)

        } catch (error) {
            this.messageLiquidex.innerHTML = warning(error.toString())
        }
    }
}



class SignTransaction extends HTMLElement {
    pset!: HTMLTextAreaElement;
    contract!: HTMLTextAreaElement;
    combineTextarea!: HTMLTextAreaElement;
    contractSection!: HTMLElement;
    analyzeButton!: HTMLButtonElement;
    signButton!: HTMLButtonElement;
    cosignButton!: HTMLButtonElement;
    cosignAmp0Button!: HTMLButtonElement;
    broadcastButton!: HTMLButtonElement;
    downloadPsetButton!: HTMLAnchorElement;
    uploadPsetFile!: HTMLInputElement;
    proposalButton!: HTMLButtonElement;
    combineButton!: HTMLButtonElement;
    messageDiv!: HTMLElement;
    contractDiv!: HTMLElement;
    signDivAnalyze!: HTMLElement;
    recipientsDiv!: HTMLElement;
    proposalContainer!: HTMLElement;
    proposalText!: HTMLTextAreaElement;

    constructor() {
        super()

        const textareas = this.querySelectorAll("textarea")
        this.pset = textareas[0]           // PSET textarea
        this.contract = textareas[1]       // Contract textarea
        this.combineTextarea = textareas[3] // Combine PSET textarea
        this.contractSection = this.querySelector("div.contract-section")
        this.analyzeButton = this.querySelector("button.analyze")
        this.signButton = this.querySelector("button.sign")
        this.cosignButton = this.querySelector("button.cosign")
        this.cosignAmp0Button = this.querySelector("button.cosign-amp0")
        this.broadcastButton = this.querySelector("button.broadcast")
        this.downloadPsetButton = this.querySelector("a.download-pset-icon")
        this.uploadPsetFile = this.querySelector("#upload-pset-input")
        this.proposalButton = this.querySelector("button.proposal")
        this.combineButton = this.querySelector("button.combine")

        this.messageDiv = this.querySelector("div.message")
        this.contractDiv = this.querySelector("div.contract")
        this.signDivAnalyze = this.querySelector("div.analyze")
        this.recipientsDiv = this.querySelector("div.recipients")
        this.proposalContainer = this.querySelector("div.proposal-container")
        this.proposalText = this.querySelector("textarea.proposal-text")

        this.analyzeButton.addEventListener("click", (_e) => {
            this.renderAnalyze()
        })
        this.signButton.addEventListener("click", this.handleSignClick)
        this.cosignButton.addEventListener("click", this.handleCosignClick)
        this.cosignAmp0Button.addEventListener("click", this.handleCosignAmp0Click)
        this.proposalButton.addEventListener("click", this.handleProposal)
        this.broadcastButton.addEventListener("click", this.handleBroadcastClick)
        this.downloadPsetButton.addEventListener("click", this.handleDownloadPset)
        this.uploadPsetFile.addEventListener("change", this.handleUploadPset)
        this.combineButton.addEventListener("click", this.handleCombineClick)

        if (getPset() != null) {
            this.pset.value = getPset().toString()
            setPset(null)
        }

        if (getContract() != null) {
            this.contract.value = getContract().toString()
            this.contractSection.hidden = false
        }

        this.renderAnalyze()
    }

    handleBroadcastClick = async (_e) => {
        try {
            setBusyDisabled(this.broadcastButton, true)
            dismissWalletNotification("broadcast-success")
            dismissWalletNotification("signing-page-error")

            if (getAmp0() == null) {
                let psetString = this.pset.value
                let pset = new lwk.Pset(psetString)
                let psetFinalized = getWollet().finalize(pset)
                let tx = psetFinalized.extractTx().toString()
                console.log("broadcasting:")
                console.log(tx)
                let client = esploraClient()
                let txid = await client.broadcast(psetFinalized)
                this.notifyBroadcastSuccess(txid)

                this.broadcastContractIfAny()
            } else {
                const tx = new lwk.Transaction(this.pset.value)
                let client = esploraClient()
                let txid = await client.broadcastTx(tx)
                this.notifyBroadcastSuccess(txid)
            }

        } catch (e) {
            this.notifySigningPageError("Cannot broadcast tx, is it signed?", "Broadcast failed")
            console.error(e)
        }
        setBusyDisabled(this.broadcastButton, false)
    }

    notifyBroadcastSuccess = (txid: lwk.Txid) => {
        this.messageDiv.innerHTML = ""
        dismissWalletNotification("signing-page-error")
        notifyWallet({
            id: "broadcast-success",
            level: "success",
            title: "Tx broadcasted!",
            message: txid.toString(),
            closable: true,
        })
    }

    notifyTransactionSignSuccess = (message = "Transaction signed!") => {
        this.messageDiv.innerHTML = ""
        dismissWalletNotification("signing-page-error")
        dismissWalletNotification("signing-page-prompt")
        dismissWalletNotification("transaction-sign-success")
        notifyWallet({
            id: "transaction-sign-success",
            level: "success",
            title: message,
            message: "The PSET has been updated."
        })
    }

    notifySigningPageSuccess = (message: string) => {
        this.messageDiv.innerHTML = ""
        dismissWalletNotification("signing-page-error")
        dismissWalletNotification("signing-page-prompt")
        dismissWalletNotification("signing-page-success")
        notifyWallet({
            id: "signing-page-success",
            level: "success",
            title: message,
            message: "The signing page has been updated."
        })
    }

    notifySigningPageError = (message: string, title = "Signing error") => {
        this.messageDiv.innerHTML = ""
        dismissWalletNotification("signing-page-error")
        dismissWalletNotification("signing-page-prompt")
        notifyWallet({
            id: "signing-page-error",
            level: "error",
            title,
            message,
            closable: true
        })
    }

    notifySigningPagePrompt = (message: string) => {
        this.messageDiv.innerHTML = ""
        dismissWalletNotification("signing-page-prompt")
        notifyWallet({
            id: "signing-page-prompt",
            level: "warning",
            title: message,
            message: "Confirm the transaction details on the hardware wallet.",
            closable: true
        })
    }

    notifyAssetRegistrySuccess = () => {
        this.contractDiv.innerHTML = ""
        dismissWalletNotification("asset-registry-success")
        notifyWallet({
            id: "asset-registry-success",
            level: "success",
            title: "Asset registered",
            message: "Asset registered in the asset registry",
            closable: true
        })
    }

    broadcastContractIfAny = async () => {
        if (getContract() != null) {
            const broadcastEvery = network.isRegtest() ? 1 : 10
            console.log(`Will start broadcasting contract in ${broadcastEvery} seconds...`)
            console.log("Contract:", getContract().toString())

            // Initial delay before first attempt
            setTimeout(() => {
                const attemptBroadcast = async () => {
                    console.log("Attempting to broadcast contract...")
                    const successBroadcast = await broadcastContract(getContract())

                    if (successBroadcast) {
                        console.log("Contract broadcast succeeded!")
                        setContract(null)
                        this.notifyAssetRegistrySuccess()
                    } else {
                        console.log(`Contract broadcast failed, retrying in ${broadcastEvery} seconds...`)
                        // Schedule another attempt in 30 seconds
                        setTimeout(attemptBroadcast, broadcastEvery * 1000)
                    }
                }

                // Start the first attempt
                attemptBroadcast()
            }, broadcastEvery * 1000)
        }
    }

    handleSignClick = async (_e: Event) => {
        try {
            // Get the PSET string and parse it
            let psetString = this.pset.value
            if (!psetString.trim()) {
                throw new Error("PSET cannot be empty")
            }
            let pset = new lwk.Pset(psetString)

            // Set button to busy state at the beginning
            setBusyDisabled(this.signButton, true)

            let signedPset;

            // Try to sign with Jade first if available
            if (getJade() != null) {
                this.notifySigningPagePrompt("Check the transaction on the Jade")
                signedPset = await getJade().sign(pset)
            }
            // Try to sign with Ledger if available
            else if (getLedger() != null) {
                this.notifySigningPagePrompt("Check the transaction on the Ledger")
                let ledger = getLedger()
                signedPset = await ledger.sign(pset)
                signedPset = signedPset.toString() // Ensure consistent return type
            }
            // Try software signer as last resort
            else if (getSwSigner() != null) {
                const signer = getSwSigner()
                signedPset = signer.sign(pset)

                if (getAmp0() != null) {
                    const amp0Pset = getAmp0Pset();
                    const psetCopy = new lwk.Pset(signedPset.toString()) // not ideal...
                    const userSignedAmp0Pset = new lwk.Amp0Pset(psetCopy, amp0Pset.blindingNonces())
                    setAmp0Pset(userSignedAmp0Pset)
                }
            }
            // No signing method available
            else {
                throw new Error("No wallet available for signing")
            }

            // Update the UI with the signed PSET
            this.pset.value = signedPset.toString()
            this.renderAnalyze()
            this.notifyTransactionSignSuccess()

        } catch (error) {
            this.notifySigningPageError(error.toString())
        } finally {
            // Always reset button state when operation is complete
            setBusyDisabled(this.signButton, false)
        }
    }


    handleCosignClick = async (_e: Event) => {
        let psetString = this.pset.value
        let pset = new lwk.Pset(psetString)
        setBusyDisabled(this.cosignButton, true)

        let amp2 = lwk.Amp2.newTestnet()

        try {
            let signedPset = await amp2.cosign(pset)
            this.notifyTransactionSignSuccess("Transaction cosigned!")
            this.pset.value = signedPset.toString()
            this.renderAnalyze()
        } catch (e) {
            this.notifySigningPageError(e.toString())
        } finally {
            setBusyDisabled(this.cosignButton, false)
        }

    }

    handleCosignAmp0Click = async (_e: Event) => {
        setBusyDisabled(this.cosignAmp0Button, true)

        try {
            const amp0 = getAmp0()
            const amp0Pset = getAmp0Pset()

            if (!amp0) {
                throw new Error("Amp0 instance not available")
            }
            if (!amp0Pset) {
                throw new Error("Amp0 PSET not available")
            }

            let tx = await amp0.sign(amp0Pset)
            this.notifyTransactionSignSuccess("Transaction signed with Amp0!")
            this.pset.value = tx.toString()

        } catch (e) {
            this.notifySigningPageError("Amp0 sign failed: " + e.toString())
        } finally {
            setBusyDisabled(this.cosignAmp0Button, false)
        }
    }


    handleCombineClick = async (_e: Event) => {
        const pset1Str = this.pset.value
        const pset2Str = this.combineTextarea.value
        try {
            if (pset1Str === "" || pset2Str === "") {
                throw new Error("Both PSET must be non-empty")
            }
            const pset1 = new lwk.Pset(pset1Str)
            const pset2 = new lwk.Pset(pset2Str)
            pset1.combine(pset2)
            this.pset.value = pset1.toString()
            this.combineTextarea.value = ""
            this.renderAnalyze()

            this.notifySigningPageSuccess("PSET combined!")
        } catch (e) {
            this.notifySigningPageError(e.toString())
        }
    }

    renderAnalyze() {
        this.messageDiv.innerHTML = ""
        let psetString = this.pset.value
        if (!psetString) {
            return
        }
        let pset = new lwk.Pset(psetString)
        let details = getWollet().psetDetails(pset)

        // Check if PSET has exactly 1 input and 1 output and show proposal button if true
        if (pset.inputs().length === 1 && pset.outputs().length === 1 && details.fingerprintsHas().length > 0) {
            this.proposalButton.hidden = false
        } else {
            this.proposalButton.hidden = true
        }

        // Show cosign Amp0 button only if Amp0 is available
        if (getAmp0() != null) {
            this.cosignAmp0Button.hidden = false
        } else {
            this.cosignAmp0Button.hidden = true
        }

        cleanChilds(this.signDivAnalyze)
        let hgroup = document.createElement("hgroup")
        hgroup.innerHTML = `
                <h3>Net balance</h3><p>From the perspective of the current wallet</p>
            `
        this.signDivAnalyze.appendChild(hgroup)

        var psetBalance = details.balance().balances().entries()
        psetBalance.set("fee", details.balance().feesIn(network.policyAsset()))
        this.signDivAnalyze.appendChild(mapToTable(mapBalance(psetBalance), true))

        let h3 = document.createElement("h3")
        h3.innerText = "Signatures"
        this.signDivAnalyze.appendChild(h3)
        const sigMap = new Map()

        let has = details.fingerprintsHas()
        let missing = details.fingerprintsMissing()

        if (has.length > 0) {
            sigMap.set("Has", has)
        }
        if (missing.length > 0) {
            sigMap.set("Missing", missing)
            if (missing.includes("3d970d04") && !network.isMainnet()) {
                this.cosignButton.hidden = false
            }
        }

        this.signDivAnalyze.appendChild(mapToTable(sigMap))


        // Recipients
        const psetRecipients = details.balance().recipients()
        const recipientsMap = new Map()
        for (const recipient of psetRecipients) {
            let address = recipient.address() != null ? recipient.address().toString() : "BURN"
            let assetHex = recipient.asset().toString()
            recipientsMap.set(address + " " + mapAssetTicker(assetHex), mapAssetPrecision(assetHex, recipient.value()))
        }
        this.recipientsDiv.innerHTML = "<h3>Recipients</h3>"
        this.recipientsDiv.appendChild(mapToTable(recipientsMap))


        // TODO issuances
    }

    handleProposal = async (_e: Event) => {
        try {
            const psetString = this.pset.value
            if (!psetString.trim()) {
                throw new Error("PSET cannot be empty")
            }

            setBusyDisabled(this.proposalButton, true)

            // Create a Pset object from the string
            const pset = new lwk.Pset(psetString)

            // Convert to UnvalidatedLiquidexProposal
            const proposal = lwk.UnvalidatedLiquidexProposal.fromPset(pset)

            // Populate the proposal textarea and show it
            this.proposalText.value = proposal.toString()
            this.proposalContainer.hidden = false

            this.notifySigningPageSuccess("Proposal generated!")
        } catch (error) {
            this.notifySigningPageError(error.toString())
        } finally {
            setBusyDisabled(this.proposalButton, false)
        }
    }

    handleDownloadPset = (e: Event) => {
        e.preventDefault()
        const psetText = this.pset.value
        if (!psetText) {
            this.notifySigningPageError("PSET is empty, nothing to download.", "Download failed")
            return
        }
        const blob = new Blob([psetText], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "pset.txt"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    handleUploadPset = (e) => {
        const file = e.target.files[0]
        if (!file) {
            return
        }
        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target.result
            this.pset.value = typeof content === 'string' ? content : new TextDecoder().decode(content)
            this.renderAnalyze()
            this.notifySigningPageSuccess("PSET loaded successfully.")
        }
        reader.onerror = (error) => {
            this.notifySigningPageError(`Error reading file: ${error}`, "Upload failed")
        }
        reader.readAsText(file)
        e.target.value = "" // Reset file input
    }
}

function scanLoop() {
    const scanEvery = network.isRegtest() ? 1000 : 10000
    if (getScanLoop() == null) {
        const intervalId = setInterval(
            async function () {
                await fullScanAndApply(getWollet(), getScanState())
                // TODO dispatch only on effective change
                window.dispatchEvent(new CustomEvent("reload-page"))
            },
            scanEvery
        );
        setScanLoop(intervalId);
    }
}

function stopScanLoop() {
    if (getScanLoop() != null) {
        clearInterval(getScanLoop())
        setScanLoop(null)
    }
}

class WalletDescriptor extends HTMLElement {
    textarea!: HTMLTextAreaElement;
    quickLink!: HTMLAnchorElement;
    sectionTitle!: HTMLHeadingElement;
    dwidInput!: HTMLInputElement;

    constructor() {
        super()

        this.textarea = this.querySelector("textarea")
        this.quickLink = this.querySelector("a")
        this.sectionTitle = this.querySelector("h3")
        this.dwidInput = this.querySelector("input.dwid")

        if (getAmp0() == null) {
            let descriptor = getWollet().descriptor().toString()
            this.textarea.innerText = descriptor
            this.quickLink.href = "#" + encodeRFC3986URIComponent(descriptor)
            this.dwidInput.value = getWollet().dwid()
        }
        else {
            this.sectionTitle.textContent = "Amp0 id";
            this.textarea.innerText = getAmp0().ampId();
            this.quickLink.hidden = true;
            this.dwidInput.parentElement.hidden = true;
        }
    }
}


class WalletPos extends HTMLElement {
    currencySelect!: HTMLSelectElement;
    posLink!: HTMLAnchorElement;

    constructor() {
        super()

        if (!network.isMainnet() || getAmp0() != null) {
            this.remove()
            return
        }

        this.currencySelect = this.querySelector("select.currency-select")
        this.posLink = this.querySelector("a")

        this.currencySelect.addEventListener("change", () => this.updateLink())
        this.updateLink()
    }

    updateLink() {
        const descriptor = getWollet().descriptor()
        const currencyCode = new lwk.CurrencyCode(this.currencySelect.value)
        const posConfig = new lwk.PosConfig(descriptor, currencyCode)
        const configString = posConfig.encode()
        this.posLink.href = `https://btcpos.cash#${configString}`
    }
}


class WalletAmp2 extends HTMLElement {
    uuid!: HTMLTextAreaElement;
    descriptor!: HTMLTextAreaElement;
    quickLink!: HTMLAnchorElement;
    button!: HTMLButtonElement;

    constructor() {
        super()

        if (network.isMainnet() || jadeOrSwSigner() == null) {
            this.remove()
        } else {
            let textareas = this.querySelectorAll("textarea")

            this.uuid = textareas[0]
            this.descriptor = textareas[1]
            this.quickLink = this.querySelector("a")

            this.button = this.querySelector("button")
            this.button.addEventListener("click", this.handleRegister)
            this.render()
        }
    }

    render = () => {
        let keyoriginXpub = keyoriginXpubUnified(lwk.Bip.bip87());
        let uuid_descriptor = localStorage.getItem(AMP2_DATA_KEY_PREFIX + keyoriginXpub)
        if (uuid_descriptor == null) {
            this.uuid.parentElement.hidden = true
            this.descriptor.parentElement.hidden = true
            this.button.hidden = false
            this.quickLink.hidden = true
        } else {
            let [uuid, descriptor] = uuid_descriptor.split("|")
            this.uuid.parentElement.hidden = false
            this.descriptor.parentElement.hidden = false
            this.uuid.value = uuid
            this.descriptor.value = descriptor
            this.quickLink.hidden = false
            this.quickLink.href = "#" + encodeRFC3986URIComponent(descriptor)
            this.button.hidden = true
        }
    }

    handleRegister = async (_) => {
        try {
            setBusyDisabled(this.button, true)
            let amp2 = lwk.Amp2.newTestnet()
            let keyoriginXpub = await keyoriginXpubUnified(lwk.Bip.bip87());
            let defaultBlinding = "slip77(0684e43749a3a3eb0362dcef8c66994bd51d33f8ce6b055126a800a626fc0d67)";
            let amp2_desc = amp2.descriptorFromStr(keyoriginXpub, defaultBlinding)
            let uuid = await amp2.register(amp2_desc);
            let uuid_descriptor = uuid + "|" + amp2_desc.descriptor(); // TODO: remove `descriptor()` once Amp2Descriptor support toString()
            localStorage.setItem(AMP2_DATA_KEY_PREFIX + keyoriginXpub, uuid_descriptor)
            this.render()
        } catch (_e) {
            setBusyDisabled(this.button, false)

        }
    }
}


class WalletXpubs extends HTMLElement {
    textareas!: NodeListOf<HTMLTextAreaElement>;
    labels!: NodeListOf<HTMLLabelElement>;
    bips!: lwk.Bip[];

    constructor() {
        super()

        this.textareas = this.querySelectorAll("textarea")
        this.labels = this.querySelectorAll("label")
        this.bips = [lwk.Bip.bip49(), lwk.Bip.bip84(), lwk.Bip.bip87()];

        if (jadeOrSwSigner() == null) {
            this.remove()
        } else {
            // TODO should remove also the "Xpubs" subtitle
            for (let i = 0; i < 3; i++) {
                this.labels[i].childNodes[0].nodeValue = this.bips[i].toString()
                this.textareas[i].value = keyoriginXpubUnified(this.bips[i])
            }
        }
    }
}

async function jadeStandardDerivations(jade: lwk.Jade) {
    // these are cached also on the Jade, but caching here allow to get rid of the async in keyoriginXpubUnified
    const derivations = {}
    const bips = [lwk.Bip.bip49(), lwk.Bip.bip84(), lwk.Bip.bip87()];
    for (let i = 0; i < 3; i++) {
        const xpub = await jade.keyoriginXpub(bips[i]).catch(err => console.error("Error jade.keyoriginXpub:", err))
        derivations[bips[i].toString()] = xpub
    }
    return derivations
}


class RegisterWallet extends HTMLElement {
    threshold!: HTMLInputElement;
    keyoriginXpub!: HTMLInputElement;
    addParticipant!: HTMLInputElement;
    jadeName!: HTMLInputElement;
    create!: HTMLButtonElement;
    addJade!: HTMLButtonElement;
    register!: HTMLButtonElement;
    listDiv!: HTMLElement;
    templatePart!: HTMLTemplateElement;
    descriptor!: HTMLTextAreaElement;
    messageDivCreate!: HTMLElement;
    messageDivRegister!: HTMLElement;

    constructor() {
        super()
        const inputs = this.querySelectorAll("input")
        this.threshold = inputs[0]
        this.keyoriginXpub = inputs[1]  // html node in template doesn't count
        this.addParticipant = inputs[2]
        this.jadeName = inputs[3]
        const buttons = this.querySelectorAll("button")
        this.create = buttons[0]
        this.addJade = buttons[1]
        this.register = buttons[2]
        this.listDiv = this.querySelector("div")
        this.templatePart = this.querySelector("template")
        this.descriptor = this.querySelector("textarea")
        const messagDivs = this.querySelectorAll("div.message")
        this.messageDivCreate = messagDivs[0] as HTMLElement
        this.messageDivRegister = messagDivs[1] as HTMLElement

        this.addParticipant.addEventListener("click", this.handleAdd)
        this.addJade.addEventListener("click", this.handleAddJade)
        this.create.addEventListener("click", this.handleCreate)
        this.register.addEventListener("click", this.handleRegister)
    }

    handleRegister = async (_) => {
        var inputsValid = true
        const jadeName = this.jadeName.value
        if (jadeName && jadeName.length > 0 && jadeName.length < 16) {
            this.jadeName.removeAttribute("aria-invalid")
        } else {
            this.jadeName.setAttribute("aria-invalid", "true")
            inputsValid = false
        }
        var descriptor
        try {
            descriptor = new lwk.WolletDescriptor(this.descriptor.value)
            this.descriptor.removeAttribute("aria-invalid")
        } catch (e) {
            console.log(e)
            this.descriptor.setAttribute("aria-invalid", "true")
            inputsValid = false
        }
        if (!inputsValid) {
            return
        }

        try {
            setBusyDisabled(this.register, true)
            this.messageDivRegister.innerHTML = warning("Check confirmation on Jade")
            let result = await getJade().registerDescriptor(jadeName, descriptor)
            if (result) {
                this.messageDivRegister.innerHTML = success("Wallet registered on the Jade!")
            } else {
                this.messageDivRegister.innerHTML = warning("Failed to register the wallet on the Jade")
            }
        } catch (e) {
            this.messageDivRegister.innerHTML = warning(e)
        } finally {
            setBusyDisabled(this.register, false)
        }
    }

    handleCreate = (_) => {
        this.messageDivCreate.innerHTML = ""
        var inputsValid = true
        const thresholdVal = this.threshold.value
        if (thresholdVal && parseInt(thresholdVal) > 0) {
            this.threshold.removeAttribute("aria-invalid")
        } else {
            this.threshold.setAttribute("aria-invalid", "true")
            inputsValid = false
        }

        const participants = Array.from(this.querySelectorAll("input.participant") as NodeListOf<HTMLInputElement>).map((s) => s.value)
        if (participants.length > 0) {
            this.keyoriginXpub.removeAttribute("aria-invalid")
        } else {
            this.keyoriginXpub.setAttribute("aria-invalid", "true")
            inputsValid = false
        }
        if (inputsValid && parseInt(thresholdVal) > participants.length) {
            this.messageDivCreate.innerHTML = warning("Threshold cannot be higher than participant")
            inputsValid = false
        }
        if (!inputsValid) {
            return
        }

        const desc = lwk.WolletDescriptor.newMultiWshSlip77(parseInt(thresholdVal), participants)

        this.descriptor.value = desc.toString()
    }

    handleAdd = (_) => {
        const keyoriginXpub = this.keyoriginXpub.value
        if (lwk.Xpub.isValidWithKeyOrigin(keyoriginXpub)) {
            this.addValidParticipant(keyoriginXpub)
        } else {
            this.keyoriginXpub.setAttribute("aria-invalid", "true")
        }
    }

    handleAddJade = async (_) => {
        this.addJade.setAttribute("aria-busy", "true")
        const jadePart = keyoriginXpubUnified(lwk.Bip.bip87())
        this.addValidParticipant(jadePart)
        this.addJade.removeAttribute("aria-busy")
    }

    addValidParticipant = (keyoriginXpub) => {
        const content = this.templatePart.content.cloneNode(true) as DocumentFragment
        const el = content.querySelector("fieldset") as HTMLElement
        const inputs = content.querySelectorAll("input") as NodeListOf<HTMLInputElement>
        inputs[0].value = keyoriginXpub
        inputs[1].addEventListener("click", (_e) => {
            this.listDiv.removeChild(el)
        })
        this.listDiv.appendChild(content)
        this.keyoriginXpub.value = ""
        this.keyoriginXpub.removeAttribute("aria-invalid")
    }
}

class LightningPage extends HTMLElement {
    receiveForm!: HTMLFormElement;
    sendForm!: HTMLFormElement;
    amountInput!: HTMLInputElement;
    descriptionInput!: HTMLInputElement;
    invoiceInput!: HTMLInputElement;
    messageReceive!: HTMLElement;
    messageSend!: HTMLElement;
    invoiceText!: HTMLElement;
    invoiceQR!: HTMLElement;
    invoiceCode!: HTMLElement;
    invoiceLink!: HTMLAnchorElement;
    invoiceImage!: HTMLImageElement;
    invoiceButton!: HTMLButtonElement;
    sendButton!: HTMLButtonElement;
    downloadRescueButton!: HTMLButtonElement;

    constructor() {
        super();

        // Get the receive form and its elements
        this.receiveForm = this.querySelector("#lightning-receive-form") as HTMLFormElement;
        this.amountInput = this.querySelector("#lightning_amount") as HTMLInputElement;
        this.descriptionInput = this.querySelector("#lightning_description") as HTMLInputElement;
        this.messageReceive = this.querySelector(".messageReceive") as HTMLElement;
        this.invoiceButton = this.receiveForm.querySelector("button[type='submit']") as HTMLButtonElement;

        // Get the invoice display elements
        this.invoiceText = this.querySelector(".invoice-text") as HTMLElement;
        this.invoiceQR = this.querySelector(".invoice-qr") as HTMLElement;
        this.invoiceCode = this.querySelector(".invoice-text code") as HTMLElement;
        this.invoiceLink = this.querySelector(".invoice-qr a") as HTMLAnchorElement;
        this.invoiceImage = this.querySelector(".invoice-qr img") as HTMLImageElement;

        // Get the send form and its elements
        this.sendForm = this.querySelector("#lightning-send-form") as HTMLFormElement;
        this.invoiceInput = this.querySelector("#lightning_invoice") as HTMLInputElement;
        this.messageSend = this.querySelector(".messageSend") as HTMLElement;
        this.sendButton = this.sendForm.querySelector("button[type='submit']") as HTMLButtonElement;

        // Get the download rescue file button
        this.downloadRescueButton = this.querySelector("#download-rescue-file") as HTMLButtonElement;

        // Wire up form submit handlers
        this.receiveForm.addEventListener("submit", this.handleReceiveInvoice.bind(this));
        this.sendForm.addEventListener("submit", this.handleSendPayment.bind(this));
        this.downloadRescueButton.addEventListener("click", this.handleDownloadRescue.bind(this));
    }

    handleReceiveInvoice = async (e: Event) => {
        e.preventDefault();
        try {
            // Set button to loading state
            setBusyDisabled(this.invoiceButton, true);

            const amount = BigInt(this.amountInput.value);
            const description = this.descriptionInput.value;
            const claimAddress = getWollet().address(null).address();
            console.log("asking invoice");
            const invoice = await getBoltzSession().invoice(amount, description, claimAddress);

            saveSwap(invoice);

            // Create a LightningPayment object from the invoice
            const bolt11 = invoice.bolt11Invoice();
            const payment = new lwk.LightningPayment(bolt11);

            // Display the invoice text
            this.invoiceCode.textContent = bolt11;
            this.invoiceText.hidden = false;

            // Display the QR code
            this.invoiceLink.href = `lightning:${bolt11}`;
            this.invoiceImage.src = payment.toUriQr();
            this.invoiceQR.hidden = false;

            // Clear any previous message
            this.messageReceive.innerHTML = "";

            // Spawn background task to complete the payment
            spawnCompletePay(invoice);
        } catch (e) {
            console.error("Error generating lightning invoice:", e);
            this.messageReceive.innerHTML = warning("Error generating lightning invoice: " + e);
            // Hide invoice display on error
            this.invoiceText.hidden = true;
            this.invoiceQR.hidden = true;
        } finally {
            // Always reset button state when operation is complete
            setBusyDisabled(this.invoiceButton, false);
        }
    }

    handleSendPayment = async (e: Event) => {
        e.preventDefault();
        try {
            // Set button to loading state
            setBusyDisabled(this.sendButton, true);

            const payment = new lwk.LightningPayment(this.invoiceInput.value);
            const refundAddress = getWollet().address(null).address();

            let pset: lwk.Pset;

            try {
                const swap = await getBoltzSession().preparePay(payment, refundAddress);

                saveSwap(swap);

                const address = swap.uriAddress();
                const amount = swap.uriAmount();

                let builder = new lwk.TxBuilder(network);
                builder = builder.addLbtcRecipient(address, amount);
                pset = builder.finish(getWollet());

                // Spawn background task to complete the payment
                spawnCompletePay(swap);

                this.messageSend.innerHTML = success("Lightning payment via Boltz swap");
            } catch (prepareError: any) {
                // Check for magic routing hint - direct Liquid payment possible
                if (prepareError?.code === "Boltz::MagicRoutingHint" && prepareError?.details) {
                    const hint = prepareError.details as lwk.MagicRoutingHint;
                    const address = lwk.Address.parse(hint.address(), network);
                    const amount = hint.amount();

                    let builder = new lwk.TxBuilder(network);
                    builder = builder.addLbtcRecipient(address, amount);
                    pset = builder.finish(getWollet());

                    this.messageSend.innerHTML = success("Direct Liquid payment (no swap needed)");
                } else {
                    throw prepareError;
                }
            }

            setPset(pset);
        } catch (e) {
            console.error("Error creating lightning payment:", e);
            this.messageSend.innerHTML = warning("Error creating lightning payment: " + e);
        } finally {
            // Always reset button state when operation is complete
            setBusyDisabled(this.sendButton, false);
        }
    }

    handleDownloadRescue = (e: Event) => {
        e.preventDefault();
        try {
            const rescueFile = getBoltzSession().rescueFile();
            const blob = new Blob([rescueFile], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "boltz-rescue-file.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Error downloading rescue file:", e);
            this.messageSend.innerHTML = warning("Error downloading rescue file: " + e);
        }
    }
}

customElements.define("my-nav", MyNav)
customElements.define("my-footer", MyFooter)
customElements.define("wallet-notifications", WalletNotifications)

customElements.define("wallet-selector", WalletSelector)
customElements.define("address-view", AddressView)
customElements.define("wallet-descriptor", WalletDescriptor)
customElements.define("wallet-pos", WalletPos)
customElements.define("wallet-xpubs", WalletXpubs)
customElements.define("wallet-amp2", WalletAmp2)

customElements.define("wallet-balance", WalletBalance)
customElements.define("wallet-transactions", WalletTransactions)
customElements.define("create-transaction", CreateTransaction)
customElements.define("sign-transaction", SignTransaction)
customElements.define("lightning-page", LightningPage)
customElements.define("register-wallet", RegisterWallet)


function mapBalance(map) {
    map.forEach((value, key) => {
        map.set(key, mapAssetPrecision(key, value))
    })
    return map
}

// We want number or hexes to be monospace
function useCodeIfNecessary(value) {
    if (!isNaN(Number(value))) {
        return `<code>${value}</code>`
    } else {
        try {
            new lwk.AssetId(value)
            // Asset hex is 64 characters - wrap in div with word-break for line wrapping
            // while keeping it selectable as one unit
            return `<div style="word-break: break-word"><code>${value}</code></div>`
        } catch (_e) {
            return value
        }
    }
}


const DEFAULT_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiNlNWU3ZWIiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTRBNiA2IDAgMSAwIDggMkE2IDYgMCAwIDAgOCAxNFpNOCA0QTQgNCAwIDEgMSA4IDEyQTQgNCAwIDAgMSA4IDRaIiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik04IDZBMiAyIDAgMSAwIDggMTBBMiAyIDAgMCAwIDggNloiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+Cjwvc3ZnPgo=';
var notfound = new Set()
function createAssetIconCell(assetId) {
    let iconCell = document.createElement("td")
    iconCell.setAttribute("width", "84")
    let icon = document.createElement("img")
    icon.width = 64
    icon.height = 64

    if (notfound.has(assetId)) {
        icon.src = DEFAULT_IMG
    } else {
        icon.src = iconUrl(assetId)
        // Add error handler for fallback image
        icon.onerror = function () {
            // Set a default image when the original fails to load
            this.src = DEFAULT_IMG
            // Remove the onerror handler to prevent infinite loop if default image also fails
            this.onerror = null
            // Add the assetId to the notfound set so that we don't keep trying to load it
            notfound.add(assetId)
        }
    }

    iconCell.appendChild(icon)
    return iconCell
}

function mapToTable(map, add_icon = false) {
    let div = document.createElement("div")
    div.setAttribute("class", "overflow-auto")
    let table = document.createElement("table")
    table.setAttribute("class", "striped")
    div.appendChild(table)
    if (map.size === 0) {
        let newRow = document.createElement("tr")
        table.appendChild(newRow)
        let asset = document.createElement("td")
        asset.innerHTML = "Empty"
        newRow.appendChild(asset)
    } else {
        map.forEach((val, key) => {
            let newRow = document.createElement("tr")
            table.appendChild(newRow)

            if (add_icon) {
                let iconCell = createAssetIconCell(key)
                newRow.appendChild(iconCell)
            }

            let asset = document.createElement("td")
            asset.innerHTML = useCodeIfNecessary(mapAssetTicker(key))
            newRow.appendChild(asset)

            let secondCell = document.createElement("td")
            secondCell.setAttribute("style", "text-align:right")
            secondCell.innerHTML = useCodeIfNecessary(val)

            newRow.appendChild(secondCell)
        })
    }
    return div
}

async function createBoltzSession(wolletLocal: lwk.Wollet): Promise<lwk.BoltzSession> {
    const dwid = wolletLocal.dwid();
    const mnemonicKey = `mnemonic-${dwid}`;

    // Check if mnemonic exists in localStorage
    let mnemonic: lwk.Mnemonic;
    const storedMnemonic = localStorage.getItem(mnemonicKey);

    if (storedMnemonic) {
        // Load existing mnemonic
        mnemonic = new lwk.Mnemonic(storedMnemonic);
        console.log("found mnemonic in localStorage at key " + mnemonicKey);
    } else {
        // Create new random mnemonic and save it
        console.log("no mnemonic found in localStorage at key " + mnemonicKey + ", creating new random mnemonic");
        mnemonic = lwk.Mnemonic.fromRandom(12);
        localStorage.setItem(mnemonicKey, mnemonic.toString());
    }

    const client = esploraClient();
    var boltzSessionBuilder = new lwk.BoltzSessionBuilder(network, client);
    boltzSessionBuilder = boltzSessionBuilder.mnemonic(mnemonic);
    boltzSessionBuilder = boltzSessionBuilder.referralId("liquidwebwallet.org");
    let session: lwk.BoltzSession;
    try {
        session = await boltzSessionBuilder.build();
    } catch (e) {
        console.error("Error building Boltz session:", e);
        return null;
    }

    for (const swapData of Object.values(getAllSwaps())) {
        const swap = JSON.parse(swapData);
        console.log("restoring swap ", swap.swap_type);
        if (swap.swap_type === "reverse") {
            const restored = await session.restoreInvoice(swapData);
            spawnCompletePay(restored);
        } else if (swap.swap_type === "submarine") {
            const restored = await session.restorePreparePay(swapData);
            spawnCompletePay(restored);
        }
    }

    return session;
}

function loadPersisted(wolletLocal: lwk.Wollet) {
    const descriptor = wolletLocal.descriptor()
    var loaded = false
    var precStatus
    while (true) {
        const walletStatus = wolletLocal.status().toString()
        const retrievedUpdate = localStorage.getItem(walletStatus)
        if (retrievedUpdate) {
            if (precStatus === walletStatus) {
                // FIXME this prevents infinite loop in case the applied update doesn't change anything
                return loaded
            }
            console.log("Found persisted update, applying " + walletStatus)
            const update = lwk.Update.deserializeDecryptedBase64(retrievedUpdate, descriptor)
            wolletLocal.applyUpdate(update)
            loaded = true
            precStatus = walletStatus
            publish('persist-loaded', null)
        } else {
            return loaded
        }
    }
}

function warning(message, helper = "") {
    return createMessage(message, true, helper)
}

function success(message, helper = "") {
    return createMessage(message, false, helper)
}

/**
 * Interface for swap objects that can complete payment (PreparePayResponse or InvoiceResponse)
 */
interface Completable {
    completePay(): Promise<boolean>;
    swapId(): string;
}

/**
 * Spawn a background task to complete a swap payment
 * @param swap - A swap object with completePay() method
 */
function spawnCompletePay(swap: Completable): void {
    setTimeout(async () => {
        try {
            console.log("Starting completePay in background...");
            const swapId = swap.swapId();
            const completed = await swap.completePay();
            console.log("completePay finished with result:", completed);

            if (completed) {
                alert("Lightning payment completed successfully!");
            } else {
                alert("Lightning payment completion failed or timed out");
            }
            removeSwap(swapId);
        } catch (error) {
            console.error("Error in completePay:", error);
            alert("Error completing payment: " + error);
        }
    }, 0);
}

function createMessage(message, invalid, helper) {
    if (helper) {
        const id = Math.random().toString()
        return `<input type="text" value="${message}" aria-invalid="${invalid}" aria-describedby="${id}" readonly><small id="${id}">${helper}</small>`
    } else {
        return `<input type="text" value="${message}" aria-invalid="${invalid}" readonly>`

    }
}

function updatedAt(wolletLocal, node) {
    if (node) {
        const unix_ts = wolletLocal.tip().timestamp()
        node.innerText = "updated at " + new Date(unix_ts * 1000).toLocaleString()
    }
}

function esploraClient(): lwk.EsploraClient {
    const urlParams = new URLSearchParams(window.location.search);
    const overrideUrl = urlParams.get('esploraUrl');
    const waterfallsParam = urlParams.get('waterfalls');

    const mainnetUrl = "https://waterfalls.liquidwebwallet.org/liquid/api"
    const testnetUrl = "https://waterfalls.liquidwebwallet.org/liquidtestnet/api"
    const regtestUrl = "http://localhost:3000/"
    const url = overrideUrl ?? (network.isMainnet() ? mainnetUrl : network.isTestnet() ? testnetUrl : regtestUrl)
    const waterfalls = waterfallsParam !== null ? waterfallsParam === 'true' : true
    const utxoOnly = getUtxoOnly()
    const client = new lwk.EsploraClient(network, url, waterfalls, 4, utxoOnly)
    if (waterfalls && (network.isMainnet() || network.isTestnet())) {
        client.setWaterfallsServerRecipient("age1xxzrgrfjm3yrwh3u6a7exgrldked0pdauvr3mx870wl6xzrwm5ps8s2h0p");
    }
    return client
}

function keyoriginXpubUnified(bip) {
    const jade = getJade();
    const swSigner = getSwSigner();
    const jadeDerivations = getStandardDerivations();

    if (jade != null && jadeDerivations != null) {
        return jadeDerivations[bip.toString()];
    } else if (swSigner != null) {
        return swSigner.keyoriginXpub(bip);
    } else {
        return null;
    }
}

async function fullScanAndApply(wolletLocal: lwk.Wollet, scanState: { running: boolean }) {
    var updated = false

    if (!scanState.running) {
        setScanRunning(true)

        // Publish a scan-start event instead of dispatching a DOM event
        publish('scan-start', null)

        let client = esploraClient()

        try {
            const update = await client.fullScan(wolletLocal)

            if (update instanceof lwk.Update) {
                publish('scan-update', update)
                updated = true
                const walletStatus = wolletLocal.status().toString()
                wolletLocal.applyUpdate(update)
                if (update.onlyTip()) {
                    // this is a shortcut, the restored from persisted state UI won't see "updated at <most recent scan>" but "updated at <most recent scan with tx>".
                    // The latter is possible by deleting the previous update if both this and the previous are `onlyTip()` but the
                    // more complex logic is avoided for now
                    console.log("avoid persisting only tip update")
                } else {
                    // Skip localStorage saving if we already know it was full
                    if (!getLocalStorageFull()) {
                        console.log("Saving persisted update " + walletStatus)
                        update.prune(wolletLocal)
                        const base64 = update.serializeEncryptedBase64(wolletLocal.descriptor())

                        try {
                            localStorage.setItem(walletStatus, base64)
                        } catch (_e) {
                            console.log("Saving persisted update " + walletStatus + " failed, too big")
                            alert("Attempt to store too much data in the local storage, skipping")
                            setLocalStorageFull(true)
                        }
                    } else {
                        console.log("Skipping localStorage save - already alerted user about storage being full")
                    }
                }

            }
            if (!getRegistryFetched()) {
                setRegistryFetched(true)
                fetchRegistry()
            }

            // Publish a scan-end event instead of dispatching a DOM event
            publish('scan-end', { updated })
        } catch (e) {
            console.log("Error in fullScanAndApply: " + e)
            publish('scan-error', e)
        } finally {
            setScanRunning(false)
        }
    }
    return updated
}

function setBusyDisabled(node, b) {
    node.setAttribute("aria-busy", b)
    node.disabled = b
}

function cleanChilds(comp) {
    if (comp) {
        while (comp.firstChild) {
            comp.firstChild.remove()
        }
    }
}

// convert a unix timestamp to human readable elapsed time, like "1 day ago"
function elapsedFrom(unixTs) {
    const currentUnixTs = new Date().getTime() / 1000.0
    const delta = currentUnixTs - unixTs

    const secondsPer = [31536000, 2592000, 604800, 86400, 3600, 60, 1];
    const namesPer = ["year", "month", "week", "day", "hour", "minute", "second"];

    function numberEnding(number) {
        return (number > 1) ? 's' : ''
    }

    for (let i = 0; i < secondsPer.length; i++) {
        let current = Math.floor(delta / secondsPer[i])
        if (current) {
            return current + ' ' + namesPer[i] + numberEnding(current) + ' ago'

        }
    }

    return 'now';
}

/**
 * Truncates long identifiers (like txids and asset IDs) for display purposes
 * @param {string} identifier - The long identifier to truncate
 * @param {number} prefixLength - Number of characters to keep at the start (default: 6)
 * @param {number} suffixLength - Number of characters to keep at the end (default: 6)
 * @returns {string} Truncated identifier with ellipsis in the middle
 */
function truncateIdentifier(identifier, prefixLength = 8, suffixLength = 8) {
    if (!identifier || identifier.length <= prefixLength + suffixLength + 3) {
        return identifier;
    }
    return `${identifier.slice(0, prefixLength)}...${identifier.slice(-suffixLength)}`;
}

/// returns the Ticker if the asset id maps to featured ones
function mapAssetTicker(assetHex) {
    return _mapAssetHex(assetHex)[0]
}

/// returns the asset value with the precision associated with the given asset hex if exist or 0 precision
function mapAssetPrecision(assetHex, value) {
    const precision = _mapAssetHex(assetHex)[1]
    return formatPrecision(value, precision)
}

/// returns the jade if exists, or the softare signer, or null for watch-only
function jadeOrSwSigner() {
    const jade = getJade();
    const swSigner = getSwSigner();

    if (jade != null)
        return jade;
    else if (swSigner != null)
        return swSigner;
    else
        return null;
}

function formatPrecision(value, precision) {
    const prec = new lwk.Precision(precision)
    return prec.satsToString(value)
}

function parsePrecision(assetHex, value) {
    const valueStr = value.toString()
    const precision = _mapAssetHex(assetHex)[1]
    const prec = new lwk.Precision(precision)
    return prec.stringToSats(valueStr)
}

function _mapAssetHex(assetHex) {
    if (assetHex == "fee") {
        // TODO: handle fee in different assets
        return ["fee", 8]
    }
    const registry = getRegistry()
    if (registry == null) {
        return [assetHex, 0]
    }
    try {
        const assetId = new lwk.AssetId(assetHex)
        const asset = registry.get(assetId)

        if (asset) {
            return [asset.ticker(), asset.precision()]
        } else {
            // check if it's a reissuance token
            const asset_of_token = registry.getAssetOfToken(assetId)
            if (asset_of_token) {
                return ["Reissuance of " + asset_of_token.ticker(), 0]
            } else {
                return [assetHex, 0]
            }
        }
    } catch (_error) {
        return [assetHex, 0]
    }
}

function encodeRFC3986URIComponent(str) {
    return encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

async function broadcastContract(contract: lwk.RegistryPost) {
    try {
        const registry = getRegistry();
        const result = await registry.post(contract);
        await fetchRegistry() // update our view of the registry
        console.log(result)
        console.log('Asset registered successfully');
        return true; // Success
    } catch (error) {
        console.log('Error registering asset:', error);
        return false; // Failed
    }
}

// Cache for ticker lists
const TICKER_CACHE = {};

// Check if a ticker is already in use in the current network
async function checkTickerAvailability(ticker) {
    console.log("check ticker");
    try {
        // Determine current network
        const networkKey = network.toString();

        // Check if we need to fetch the data or can use the cache
        if (!TICKER_CACHE[networkKey]) {
            // Cache is empty, fetch new data
            const networkType = network.isMainnet() ? 'mainnet' : 'testnet';
            const tickersUrl = `https://waterfalls.liquidwebwallet.org/tickers/assets-${networkType}-tickers.json`;

            console.log(`Fetching ${networkType} ticker list...`);
            const response = await fetch(tickersUrl);

            if (!response.ok) {
                console.error(`Failed to fetch ${networkType} ticker list`);
                // If we can't check, we'll allow the ticker (better UX than blocking all issuances)
                return true;
            }

            // Update cache
            TICKER_CACHE[networkKey] = await response.json();
            console.log(`${networkType} ticker list cached`);
        } else {
            console.log(`Using cached ticker list for ${network.toString()}`);
        }

        // Check if ticker exists in the list - case sensitive comparison
        const isInUse = TICKER_CACHE[networkKey].some(item => {
            if (typeof item === 'string') {
                return item === ticker;
            } else if (item.ticker) {
                return item.ticker === ticker;
            }
            return false;
        });

        return !isInUse;
    } catch (error) {
        console.error("Error checking ticker availability:", error);
        // If there's an error in the check, we'll allow the ticker
        return true;
    }
}

async function fetchRegistry() {
    // Fetch assets metadata from the registry
    console.log("fetching Registry")
    const wollet = getWollet()
    try {
        const assetsOwned = wollet.assetsOwned()
        const registry = await lwk.Registry.defaultForNetwork(network, assetsOwned)
        setRegistry(registry)
        publish('registry-fetched', null)
    } catch (error) {
        console.error('Failed to initialize registry:', error)
    }
}

function iconUrl(assetId) {
    if (network.isMainnet()) {
        return `https://waterfalls.liquidwebwallet.org/icons/mainnet/${assetId}.png`
    } else if (network.isTestnet()) {
        return `https://waterfalls.liquidwebwallet.org/icons/testnet/${assetId}.png`
    } else {
        return `http://localhost:3000/icons/${assetId}.png`
    }
}
