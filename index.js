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
    getRegistryFetched, setRegistryFetched,
    subscribe, publish
} from './state.js'

// Import the jsQR library for QR code scanning
const jsQRScript = document.createElement('script');
jsQRScript.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
document.head.appendChild(jsQRScript);

// Network setup (remains global as it's a configuration not state)
const network = lwk.Network.mainnet()

// Reference to the main application container
const app = document.getElementById('app')

const RANDOM_MNEMONIC_KEY = "random_mnemonic"
const AMP2_DATA_KEY_PREFIX = "amp2_data_v2_"

/// Re-enables initially disabled buttons, and add listener to buttons on the first page
/// First page doesn't use components because we want to be loaded before the wasm is loaded, which takes time
async function init() {

    let connectJade = document.getElementById("connect-jade-button")
    let descriptorTextarea = document.getElementById("descriptor-textarea")
    let descriptorMessage = document.getElementById("descriptor-message")
    let exampleDescriptor = document.getElementById("example-descriptor-link")
    let loadingBar = document.getElementById("loading-wasm");
    let devMode = document.getElementById("dev-mode")

    // Diagnostic logging for dev mode state
    if (getDevMode()) {
        console.log("Dev mode is enabled");
    }

    const registry = lwk.Registry.defaultHardcodedForNetwork(network)
    setRegistry(registry)

    devMode.checked = getDevMode()

    // Define handleDevMode function to update state when checkbox changes
    const handleDevMode = function (e) {
        const isDevMode = e.target.checked
        console.log("Dev mode checkbox changed to:", isDevMode);
        setDevMode(isDevMode)
    }

    devMode.onchange = handleDevMode

    connectJade.addEventListener("click", async (_e) => {
        let connectJadeMessage = document.getElementById("connect-jade-message")
        try {
            setBusyDisabled(connectJade, true)

            let filter = !getDevMode()
            console.log("filter out do it yourself " + filter)

            const jade = await new lwk.Jade(network, filter)
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
            // TODO network is the most common error but we can have other error,
            // should indeed take the error message from e instead of a static value
            connectJadeMessage.innerHTML = warning(e)
            setBusyDisabled(connectJade, false)
        }
    })

    if (network.isRegtest()) {
        // Add WebSocket Jade connection functionality
        let connectJadeWebSocket = document.getElementById("connect-jade-websocket-button")
        connectJadeWebSocket.hidden = false
        connectJadeWebSocket.disabled = false

        connectJadeWebSocket.addEventListener("click", async (_e) => {
            let connectJadeWebSocketMessage = document.getElementById("connect-jade-websocket-message")
            try {
                setBusyDisabled(connectJadeWebSocket, true)

                // Connect to Jade via WebSocket on port 3331
                const jadeWs = await new lwk.JadeWebSocket(network, "ws://localhost:3331")
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

    let watchOnlyButton = document.getElementById("watch-only-button")
    watchOnlyButton.addEventListener("click", handleWatchOnlyClick)

    connectJade.disabled = false
    watchOnlyButton.disabled = false
    exampleDescriptor.disabled = false

    loadingBar.setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts

    let randomWalletButton = document.getElementById("random-wallet-button");

    let ledgerDescriptorDiv = document.getElementById("ledger-descriptor-div")
    let ledgerDescriptorButton = document.getElementById("ledger-connect-button")
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

    if (!network.isMainnet()) {
        document.getElementById("random-wallet-div").hidden = false
        randomWalletButton.disabled = false

        // Function to handle wallet creation with a specific mnemonic
        const createWalletWithMnemonic = (mnemonicStr) => {
            const mnemonicToUse = new lwk.Mnemonic(mnemonicStr)
            const swSigner = new lwk.Signer(mnemonicToUse, network)
            setSwSigner(swSigner)
            let desc = swSigner.wpkhSlip77Descriptor()
            descriptorTextarea.value = desc.toString()
            handleWatchOnlyClick()
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

            let mnemonicFromCookie = localStorage.getItem(RANDOM_MNEMONIC_KEY)
            var mnemonicToUse
            if (mnemonicFromCookie == null) {
                mnemonicToUse = lwk.Mnemonic.fromRandom(12)
                localStorage.setItem(RANDOM_MNEMONIC_KEY, mnemonicToUse.toString())
            } else {
                try {
                    mnemonicToUse = new lwk.Mnemonic(mnemonicFromCookie)
                } catch {
                    mnemonicToUse = lwk.Mnemonic.fromRandom(12)
                    localStorage.setItem(RANDOM_MNEMONIC_KEY, mnemonicToUse.toString())
                }
            }
            const swSigner = new lwk.Signer(mnemonicToUse, network)
            setSwSigner(swSigner)
            let desc = swSigner.wpkhSlip77Descriptor()

            descriptorTextarea.value = desc.toString()
            handleWatchOnlyClick()
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

async function handleWatchOnlyClick(_e) {
    let descriptorMessage = document.getElementById("descriptor-message")
    try {
        let descriptorTextarea = document.getElementById("descriptor-textarea")
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
        setWolletSelected("Descriptor")
        setScanRunning(false)
        loadPersisted(wollet)

        await fullScanAndApply(wollet, getScanState())
    } catch (e) {
        descriptorMessage.innerHTML = warning(e)
    }
}

await init()

class MyFooter extends HTMLElement {
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

    handleContactClick = (_event) => {
        this.dispatchEvent(new CustomEvent('contact-clicked', {
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
        footer += `<span> | </span><a href="#" id="contact">Contact</a>`

        footer += `<span> | </span><span>${network}</span>`
        if (getJade() != null) {
            const jadeIdentifier = getXpub().fingerprint()
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
        let idContact = this.querySelector("#contact")
        if (idContact) {
            idContact.addEventListener("click", this.handleContactClick)
        }
    }
}

class MyNav extends HTMLElement {
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

        document.addEventListener('contact-clicked', () => {
            this.renderPage("contact-page")
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
        const template = document.getElementById(id + "-template").content.cloneNode(true)

        cleanChilds(app)
        app.appendChild(template)
    }

    render = async (_e) => {
        if (getWolletSelected() != null) {
            this.innerHTML = `
                    <a href="#" id="balance-page">Balance</a> |
                    <a href="#" id="transactions-page">Transactions</a> |
                    <a href="#" id="create-page">Create</a> |
                    <a href="#" id="sign-page">Sign</a> |
                    <a href="#" id="receive-page">Receive</a> |
                    <a href="#" id="disconnect">Disconnect</a>

                    <br><br>
                `
        }
    }
}


class WalletSelector extends HTMLElement {
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
        setScanRunning(false)
        loadPersisted(wollet)

        await fullScanAndApply(wollet, getScanState())
    }
}


class AddressView extends HTMLElement {
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
        this.paymentNotification = this.querySelector(".payment-notification")
        this.pingInterval = null
        this.currentUnconfidential = null

        this.showButton.addEventListener("click", this.handleShow)
    }

    disconnectedCallback() {
        // Clear ping interval when component is removed
        this.clearPingInterval();
    }

    clearPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log("Cleared websocket ping interval");
        }
    }

    displayAddress(address) {
        // Clear any existing ping interval
        this.clearPingInterval();

        // Clear payment notification when showing a new address
        this.paymentNotification.innerHTML = "";

        const addr = address.address()
        const addrString = addr.toString()

        // Update the address code element
        this.addressCode.textContent = addrString
        this.addressText.hidden = false

        // Update the QR code link and image
        this.addressLink.href = `liquidnetwork:${addrString}`
        this.addressImage.src = addr.QRCodeUri(null)
        this.addressQR.hidden = false

        const unconfidential = addr.toUnconfidential().toString();
        this.currentUnconfidential = unconfidential;
        const subscribe = `SUBSCRIBE|||${unconfidential.length}|${unconfidential}`
        console.log(subscribe)
        const ws = websocketClient();

        // Setup websocket message listener - check for payments
        ws.onmessage = (event) => {
            console.log("Received websocket message:", event.data)

            // Check if message contains the unconfidential address we're monitoring
            if (typeof event.data === 'string' &&
                this.currentUnconfidential &&
                event.data.includes(this.currentUnconfidential)) {
                // TODO: Trigger a full scan to update the wallet
                // TODO: Here only the unconfidential address is monitored, 
                // so if someone pay on the wrong blinding key, you still see payment received, 
                // but you can't use those funds.
                console.log("Payment detected for monitored address!");
                this.paymentNotification.innerHTML = success("Payment received!");
            }
        }

        ws.onopen = () => {
            ws.send(subscribe);
            console.log("Websocket connection opened and subscription sent")

            // Set up a ping interval to keep the connection alive
            this.pingInterval = setInterval(() => {
                const ping = "PING||||";
                ws.send(ping);
                console.log("Sent ping to websocket");
            }, 25000); // 25 seconds
        }

        ws.onerror = (error) => {
            console.error("Websocket error:", error)
            this.clearPingInterval();
        }

        ws.onclose = () => {
            console.log("Websocket connection closed");
            this.clearPingInterval();
        }
    }

    handleShow = async (_e) => {
        try {
            // Set button to busy state at the beginning
            setBusyDisabled(this.showButton, true)

            if (getJade() != null) {
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

    handleShowOnLedger = async (_e) => {
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

    handleShowOnJade = async (_e) => {
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
            jadeAddress = await getJade().getReceiveAddressMulti(getWolletSelected(), [0, index])
        }

        console.assert(jadeAddress == address.address().toString(), "local and jade address are different!")
        this.messageDiv.hidden = true
    }
}

class WalletBalance extends HTMLElement {
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
            subscribe('registry-fetched', this.render)
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
        const address = getWollet().address(null).address().toString()
        const url = `https://liquidtestnet.com/api/faucet?address=${address}&action=lbtc`
        console.log(url)
        this.messageDiv.innerHTML = success("Sending request to the faucet...")
        await fetch(url, { mode: "no-cors" })
        this.messageDiv.innerHTML = success("Request sent to the faucet, wait a bit to see funds")
    }

    render = () => {
        console.log("render balance")
        const wollet = getWollet();
        if (!wollet || wollet.neverScanned()) {
            return
        }
        const balance = wollet.balance()

        const lbtc = balance.get(network.policyAsset().toString())
        if (lbtc == 0 && !network.isMainnet()) {
            this.faucetRequest.hidden = false
        }

        updatedAt(wollet, this.subtitle)

        cleanChilds(this.div)
        this.div.appendChild(mapToTable(mapBalance(balance)))
    }
}


class WalletTransactions extends HTMLElement {
    constructor() {
        super()
        this.txsTitle = this.querySelector("h2")
        this.subtitle = this.querySelector("p")
        this.div = this.querySelector("div")

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
        let transactions = wollet.transactions()
        if (transactions.length > 1) {
            this.txsTitle.innerText = transactions.length + " Transactions"
        }
        let div = document.createElement("div")
        div.setAttribute("class", "overflow-auto")
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

        updatedAt(wollet, this.subtitle)
        cleanChilds(this.div)
        this.div.appendChild(div)
    }
}


class CreateTransaction extends HTMLElement {
    constructor() {
        super()
        this.createButton = this.querySelector("button.create")
        this.createButton.addEventListener("click", this.handleCreate)
        this.busy = this.querySelector("article")
        const selects = this.querySelectorAll("select")
        this.selectAssetInRecipient = selects[0]
        this.div = this.querySelector("div")
        const inputs = this.querySelectorAll("input")
        this.addressInput = inputs[0]
        this.satoshisInput = inputs[1]
        this.addRecipient = inputs[2]
        this.addRecipient.addEventListener("click", this.handleAdd)

        // Setup QR Code scanner
        this.qrScanButton = this.querySelector("button.qr-scan-button")
        this.qrScanButton.addEventListener("click", this.handleQrScan)
        this.qrScannerModal = document.getElementById("qr-scanner-modal")
        this.qrVideo = document.getElementById("qr-video")
        this.qrCloseButton = document.getElementById("qr-scanner-close")
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
            setPset(builder.finish(getWollet()))

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
            const tokenAddr = this.tokenAmount.value > 0 && this.tokenAddress.value != '' ? new lwk.Address(this.tokenAddress.value) : null
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
        let balance = wollet.balance()

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
                utxos.forEach((utxo, index) => {
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
                const recipientAsset = new lwk.AssetId(recipient.querySelector("input.assetid").value)
                const satoshis = parsePrecision(recipientAsset.toString(), recipient.querySelector("input.amount").value)

                if (recipient.querySelector("input.address").value == "BURN") {
                    builder = builder.addBurn(satoshis, recipientAsset)
                } else {
                    // address already validated during add phase
                    const recipientAddress = new lwk.Address(recipient.querySelector("input.address").value)
                    builder = builder.addRecipient(recipientAddress, satoshis, recipientAsset)
                }
            }
            setPset(builder.finish(getWollet()))

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
                    element.setAttribute("aria-invalid", true)
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

        this.selectAssetInBurn.setAttribute("aria-invalid", false)
        var assetInBurn
        try {
            assetInBurn = new lwk.AssetId(this.selectAssetInBurn.value)
        } catch (e) {
            this.selectAssetInBurn.setAttribute("aria-invalid", true)
            inputsValid += "Invalid asset. " + e.toString()
        }

        this.amountBurn.setAttribute("aria-invalid", false)
        const satoshis = parsePrecision(assetInBurn.toString(), this.amountBurn.value)
        if (!satoshis || satoshis <= 0) {
            this.amountBurn.setAttribute("aria-invalid", true)
            inputsValid += "Invalid value. "
        }

        if (inputsValid != "") {
            this.messageBurn.innerHTML = warning(inputsValid)
            return
        }

        this.listRecipients.hidden = false

        // Add recipient row
        const content = this.template.content.cloneNode(true)

        const el = content.querySelector("fieldset")
        const inputs = content.querySelectorAll("input")
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
        this.addressInput.setAttribute("aria-invalid", false)
        var recipientAddress
        try {
            recipientAddress = lwk.Address.parse(this.addressInput.value, network)
        } catch (e) {
            this.addressInput.setAttribute("aria-invalid", true)
            inputsValid += e.toString() + ". "
        }

        this.selectAssetInRecipient.setAttribute("aria-invalid", false)
        var recipientAsset
        try {
            recipientAsset = new lwk.AssetId(this.selectAssetInRecipient.value)
        } catch (_e) {
            this.selectAssetInRecipient.setAttribute("aria-invalid", true)
            inputsValid += "Invalid asset. "
        }

        this.satoshisInput.setAttribute("aria-invalid", false)
        const satoshis = parsePrecision(recipientAsset.toString(), this.satoshisInput.value)
        if (!satoshis || satoshis <= 0) {
            this.satoshisInput.setAttribute("aria-invalid", true)
            inputsValid += "Invalid value. "
        }

        if (inputsValid != "") {
            this.message.innerHTML = warning(inputsValid)
            return
        }
        // end other validations

        // Add recipient row
        const content = this.template.content.cloneNode(true)

        const el = content.querySelector("fieldset")
        const inputs = content.querySelectorAll("input")
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
            const validatedProposal = unvalidatedProposal.insecure_validate()
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
    constructor() {
        super()

        const textareas = this.querySelectorAll("textarea")
        this.pset = textareas[0]
        this.contract = textareas[1]
        this.mnemonic = textareas[2]
        this.combineTextarea = textareas[3]
        this.contractSection = this.querySelector("div.contract-section")
        this.analyzeButton = this.querySelector("button.analyze")
        this.signButton = this.querySelector("button.sign")
        this.cosignButton = this.querySelector("button.cosign")
        this.broadcastButton = this.querySelector("button.broadcast")
        this.downloadPsetButton = this.querySelector("a.download-pset-icon")
        this.uploadPsetFile = this.querySelector("#upload-pset-input")
        this.proposalButton = this.querySelector("button.proposal")
        this.publishButton = this.querySelector("button.publish-proposal")
        this.combineButton = this.querySelector("button.combine")
        this.saveMnemonicButton = this.querySelector("button.saveMnemonic")

        this.messageDiv = this.querySelector("div.message")
        this.contractDiv = this.querySelector("div.contract")
        this.signDivAnalyze = this.querySelector("div.analyze")
        this.recipientsDiv = this.querySelector("div.recipients")
        this.proposalContainer = this.querySelector("div.proposal-container")
        this.proposalText = this.querySelector("textarea.proposal-text")

        const details = this.querySelectorAll("details")
        this.signDetails = details[0]

        this.signDetails.hidden = network.isMainnet()

        this.analyzeButton.addEventListener("click", (_e) => {
            this.renderAnalyze()
        })
        this.signButton.addEventListener("click", this.handleSignClick)
        this.cosignButton.addEventListener("click", this.handleCosignClick)
        this.proposalButton.addEventListener("click", this.handleProposal)
        this.broadcastButton.addEventListener("click", this.handleBroadcastClick)
        this.downloadPsetButton.addEventListener("click", this.handleDownloadPset)
        this.uploadPsetFile.addEventListener("change", this.handleUploadPset)
        this.publishButton.addEventListener("click", this.handlePublishProposal)
        this.combineButton.addEventListener("click", this.handleCombineClick)

        this.saveMnemonicButton.addEventListener("click", this.handleSaveMnemonicClick)

        if (getPset() != null) {
            this.pset.value = getPset().toString()
            setPset(null)
        }

        if (getContract() != null) {
            this.contract.value = getContract().toString()
            this.contractSection.hidden = false
        }

        if (getSwSigner() != null) {
            this.mnemonic.value = getSwSigner().mnemonic()
        }

        this.renderAnalyze()
    }

    handleSignWithJadeClick = async (_e) => {
        setBusyDisabled(this.signWithJadeButton, true)
        try {
            let psetString = this.pset.value
            let pset = new lwk.Pset(psetString)
            let jade = await new lwk.Jade(network, true)
            let signedPset = await jade.sign(pset)
            this.pset.value = signedPset
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.signWithJadeButton, false)
        }
    }


    handleSignWithLedgerClick = async (_e) => {
        setBusyDisabled(this.signWithLedgerButton, true)
        try {
            let psetString = this.pset.value
            let pset = new lwk.Pset(psetString)
            let device = await lwk.searchLedgerDevice()
            let ledger = new lwk.LedgerWeb(device, network)
            let signedPset = await ledger.sign(pset)
            this.pset.value = signedPset.toString()
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.signWithLedgerButton, false)
        }
    }

    handleSoftwareSignClick = async (_e) => {
        setBusyDisabled(this.softwareSignButton, true)
        try {
            let psetString = this.pset.value
            let pset = new lwk.Pset(psetString)

            let mnemonicStr = this.mnemonic.value
            let mnemonic = new lwk.Mnemonic(mnemonicStr)

            let signer = new lwk.Signer(mnemonic, network)
            let signedPset = signer.sign(pset)

            this.pset.value = signedPset
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")

        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())

        }
        setBusyDisabled(this.softwareSignButton, false)
    }

    handleBroadcastClick = async (_e) => {
        try {
            let psetString = this.pset.value
            let pset = new lwk.Pset(psetString)
            let psetFinalized = getWollet().finalize(pset)
            let tx = psetFinalized.extractTx().toString()
            console.log("broadcasting:")
            console.log(tx)
            setBusyDisabled(this.broadcastButton, true)
            let client = esploraClient()
            let txid = await client.broadcast(psetFinalized)
            this.messageDiv.innerHTML = success(txid, "Tx broadcasted!")

            this.broadcastContractIfAny()

        } catch (e) {
            this.messageDiv.innerHTML = warning("Cannot broadcast tx, is it signed?")
            console.error(e)
        }
        setBusyDisabled(this.broadcastButton, false)
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
                        this.contractDiv.innerHTML = success("Asset registered in the asset registry")
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

    handleSignClick = async (_e) => {
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
                this.messageDiv.innerHTML = warning("Check the transaction on the Jade")
                signedPset = await getJade().sign(pset)
            }
            // Try to sign with Ledger if available
            else if (getLedger() != null) {
                this.messageDiv.innerHTML = warning("Check the transaction on the Ledger")
                let ledger = getLedger()
                signedPset = await ledger.sign(pset)
                signedPset = signedPset.toString() // Ensure consistent return type
            }
            // Try software signer as last resort
            else if (getSwSigner() != null) {
                const signer = getSwSigner()
                signedPset = signer.sign(pset)
            }
            // No signing method available
            else {
                throw new Error("No wallet available for signing")
            }

            // Update the UI with the signed PSET
            this.pset.value = signedPset
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")

        } catch (error) {
            this.messageDiv.innerHTML = warning(error.toString())
        } finally {
            // Always reset button state when operation is complete
            setBusyDisabled(this.signButton, false)
        }
    }


    handleCosignClick = async (_e) => {
        let psetString = this.pset.value
        let pset = new lwk.Pset(psetString)
        setBusyDisabled(this.cosignButton, true)

        let amp2 = lwk.Amp2.new_testnet()

        try {
            let signedPset = await amp2.cosign(pset)
            this.messageDiv.innerHTML = success("Transaction cosigned!")
            this.pset.value = signedPset
            this.renderAnalyze()
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.cosignButton, false)
        }

    }


    handleCombineClick = async (_e) => {
        const pset1Str = this.pset.value
        const pset2Str = this.combineTextarea.value
        try {
            if (pset1Str === "" || pset2Str === "") {
                throw new Error("Both PSET must be non-empty")
            }
            const pset1 = new lwk.Pset(pset1Str)
            const pset2 = new lwk.Pset(pset2Str)
            pset1.combine(pset2)
            this.pset.value = pset1
            this.combineTextarea.value = ""
            this.renderAnalyze()

            this.messageDiv.innerHTML = success("PSET combined!")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        }
    }

    handleSaveMnemonicClick = async (_e) => {
        try {
            setBusyDisabled(this.saveMnemonicButton, true)

            const mnemonicStr = this.mnemonic.value.trim()
            if (!mnemonicStr) {
                throw new Error("Mnemonic cannot be empty")
            }

            // Validate the mnemonic by creating a Mnemonic object
            const mnemonic = new lwk.Mnemonic(mnemonicStr)

            // Create a signer with the validated mnemonic
            const signer = new lwk.Signer(mnemonic, network)

            // Save to state
            setSwSigner(signer)

            // Also save raw mnemonic to localStorage for persistence
            localStorage.setItem(RANDOM_MNEMONIC_KEY, mnemonicStr)

            // Update UI
            this.mnemonic.disabled = true
            this.messageDiv.innerHTML = success("Mnemonic saved successfully")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.saveMnemonicButton, false)
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

        cleanChilds(this.signDivAnalyze)
        let hgroup = document.createElement("hgroup")
        hgroup.innerHTML = `
                <h3>Net balance</h3><p>From the perspective of the current wallet</p>
            `
        this.signDivAnalyze.appendChild(hgroup)

        var psetBalance = details.balance().balances()
        psetBalance.set("fee", details.balance().fee())
        this.signDivAnalyze.appendChild(mapToTable(mapBalance(psetBalance), true, true))

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

    handleProposal = async (_e) => {
        try {
            const psetString = this.pset.value
            if (!psetString.trim()) {
                throw new Error("PSET cannot be empty")
            }

            setBusyDisabled(this.proposalButton, true)

            // Create a Pset object from the string
            const pset = new lwk.Pset(psetString)

            // Convert to UnvalidatedLiquidexProposal
            const proposal = lwk.UnvalidatedLiquidexProposal.from_pset(pset)

            // Populate the proposal textarea and show it
            this.proposalText.value = proposal.toString()
            this.proposalContainer.hidden = false

            // Show the publish button
            this.publishButton.hidden = false

            this.messageDiv.innerHTML = success("Proposal generated!")
        } catch (error) {
            this.messageDiv.innerHTML = warning(error.toString())
        } finally {
            setBusyDisabled(this.proposalButton, false)
        }
    }

    // Add handler for the publish proposal button
    handlePublishProposal = async (_e) => {
        try {
            // Get the proposal from the textarea
            const proposalText = this.proposalText.value.trim()
            if (!proposalText) {
                throw new Error("No proposal to publish")
            }

            // Set button to busy state
            setBusyDisabled(this.publishButton, true)

            // Get websocket client and send the proposal
            const ws = websocketClient()

            // Format the message for the websocket (PROPOSAL|||length|data)
            const message = `PUBLISH_PROPOSAL|||${proposalText.length}|${proposalText}`

            // Create a promise to handle the websocket connection
            const publishPromise = new Promise((resolve, reject) => {
                ws.onopen = () => {
                    ws.send(message)
                    console.log("Proposal published to websocket")
                    resolve()
                }

                ws.onerror = (error) => {
                    console.error("Websocket error:", error)
                    reject(new Error("Failed to connect to server"))
                }

                // Set a timeout in case the connection hangs
                setTimeout(() => reject(new Error("Connection timeout")), 10000)
            })

            await publishPromise

            this.messageDiv.innerHTML = success("Proposal published!")
        } catch (error) {
            this.messageDiv.innerHTML = warning(error.toString())
        } finally {
            setBusyDisabled(this.publishButton, false)
        }
    }

    handleDownloadPset = (e) => {
        e.preventDefault()
        const psetText = this.pset.value
        if (!psetText) {
            this.messageDiv.innerHTML = warning("PSET is empty, nothing to download.")
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
            this.pset.value = content
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("PSET loaded successfully.")
        }
        reader.onerror = (error) => {
            this.messageDiv.innerHTML = warning(`Error reading file: ${error}`)
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
    constructor() {
        super()
        this.textarea = this.querySelector("textarea")
        this.quickLink = this.querySelector("a")

        let descriptor = getWollet().descriptor().toString()
        this.textarea.innerText = descriptor
        this.quickLink.href = "#" + encodeRFC3986URIComponent(descriptor)
    }
}


class WalletAmp2 extends HTMLElement {
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
            let amp2 = lwk.Amp2.new_testnet()
            let keyoriginXpub = await keyoriginXpubUnified(lwk.Bip.bip87());
            let amp2_desc = amp2.descriptor_from_str(keyoriginXpub)
            let uuid = await amp2.register(amp2_desc);
            let uuid_descriptor = uuid + "|" + amp2_desc.descriptor(); // TODO: remove `descriptor()` once Amp2Descriptor support toString()
            localStorage.setItem(AMP2_DATA_KEY_PREFIX + keyoriginXpub, uuid_descriptor)
            this.render()
        } catch (e) {
            setBusyDisabled(this.button, false)

        }
    }
}


class WalletXpubs extends HTMLElement {
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

async function jadeStandardDerivations(jade) {
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
        this.messageDivCreate = messagDivs[0]
        this.messageDivRegister = messagDivs[1]

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
            this.jadeName.setAttribute("aria-invalid", true)
            inputsValid = false
        }
        var descriptor
        try {
            descriptor = new lwk.WolletDescriptor(this.descriptor.value)
            this.descriptor.removeAttribute("aria-invalid")
        } catch (e) {
            console.log(e)
            this.descriptor.setAttribute("aria-invalid", true)
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
        if (thresholdVal && thresholdVal > 0) {
            this.threshold.removeAttribute("aria-invalid")
        } else {
            this.threshold.setAttribute("aria-invalid", true)
            inputsValid = false
        }

        const participants = Array.from(this.querySelectorAll("input.participant")).map((s) => s.value)
        if (participants.length > 0) {
            this.keyoriginXpub.removeAttribute("aria-invalid")
        } else {
            this.keyoriginXpub.setAttribute("aria-invalid", true)
            inputsValid = false
        }
        if (inputsValid && thresholdVal > participants.length) {
            this.messageDivCreate.innerHTML = warning("Threshold cannot be higher than participant")
            inputsValid = false
        }
        if (!inputsValid) {
            return
        }

        const desc = lwk.WolletDescriptor.newMultiWshSlip77(thresholdVal, participants)

        this.descriptor.value = desc.toString()
    }

    handleAdd = (_) => {
        const keyoriginXpub = this.keyoriginXpub.value
        if (lwk.Xpub.isValidWithKeyOrigin(keyoriginXpub)) {
            this.addValidParticipant(keyoriginXpub)
        } else {
            this.keyoriginXpub.setAttribute("aria-invalid", true)
        }
    }

    handleAddJade = async (_) => {
        this.addJade.setAttribute("aria-busy", true)
        const jadePart = keyoriginXpubUnified(lwk.Bip.bip87())
        this.addValidParticipant(jadePart)
        this.addJade.removeAttribute("aria-busy")
    }

    addValidParticipant = (keyoriginXpub) => {
        const content = this.templatePart.content.cloneNode(true)
        const el = content.querySelector("fieldset")
        const inputs = content.querySelectorAll("input")
        inputs[0].value = keyoriginXpub
        inputs[1].addEventListener("click", (_e) => {
            this.listDiv.removeChild(el)
        })
        this.listDiv.appendChild(content)
        this.keyoriginXpub.value = ""
        this.keyoriginXpub.removeAttribute("aria-invalid")
    }
}

customElements.define("my-nav", MyNav)
customElements.define("my-footer", MyFooter)

customElements.define("wallet-selector", WalletSelector)
customElements.define("address-view", AddressView)
customElements.define("wallet-descriptor", WalletDescriptor)
customElements.define("wallet-xpubs", WalletXpubs)
customElements.define("wallet-amp2", WalletAmp2)

customElements.define("wallet-balance", WalletBalance)
customElements.define("wallet-transactions", WalletTransactions)
customElements.define("create-transaction", CreateTransaction)
customElements.define("sign-transaction", SignTransaction)
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
        } catch (_) {
            return value
        }
    }
}


const DEFAULT_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiNlNWU3ZWIiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTggMTRBNiA2IDAgMSAwIDggMkE2IDYgMCAwIDAgOCAxNFpNOCA0QTQgNCAwIDEgMSA4IDEyQTQgNCAwIDAgMSA4IDRaIiBmaWxsPSIjOWNhM2FmIi8+CjxwYXRoIGQ9Ik04IDZBMiAyIDAgMSAwIDggMTBBMiAyIDAgMCAwIDggNloiIGZpbGw9IiM5Y2EzYWYiLz4KPC9zdmc+Cjwvc3ZnPgo=';
var notfound = new Set()
function createAssetIconCell(assetId) {
    let iconCell = document.createElement("td")
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

function mapToTable(map) {
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

            let iconCell = createAssetIconCell(key)
            newRow.appendChild(iconCell)

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

function loadPersisted(wolletLocal) {
    const descriptor = wolletLocal.descriptor()
    var loaded = false
    var precStatus
    while (true) {
        const walletStatus = wolletLocal.status()
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

function websocketClient() {
    const mainnetUrl = "https://nexus.liquidwebwallet.org/"
    const testnetUrl = "https://nexus.liquidwebwallet.org/testnet"
    const regtestUrl = "http://localhost:3330/"
    const wsUrl = network.isMainnet() ? mainnetUrl : network.isTestnet() ? testnetUrl : regtestUrl
    const ws = new WebSocket(wsUrl);
    return ws;
}

function esploraClient() {
    const mainnetUrl = "https://waterfalls.liquidwebwallet.org/liquid/api"
    const testnetUrl = "https://waterfalls.liquidwebwallet.org/liquidtestnet/api"
    const regtestUrl = "http://localhost:3000/"
    const url = network.isMainnet() ? mainnetUrl : network.isTestnet() ? testnetUrl : regtestUrl
    const client = new lwk.EsploraClient(network, url, true, 4)
    if (network.isMainnet() || network.isTestnet()) {
        client.set_waterfalls_server_recipient("age1xxzrgrfjm3yrwh3u6a7exgrldked0pdauvr3mx870wl6xzrwm5ps8s2h0p");
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

async function fullScanAndApply(wolletLocal, scanState) {
    var updated = false

    if (!scanState.running) {
        setScanRunning(true)

        // Publish a scan-start event instead of dispatching a DOM event
        publish('scan-start', null)

        let client = esploraClient()

        try {
            const update = await client.fullScan(wolletLocal)

            if (update instanceof lwk.Update) {
                console.log("update")
                publish('scan-update', update)
                updated = true
                const walletStatus = wolletLocal.status()
                wolletLocal.applyUpdate(update)
                if (update.onlyTip()) {
                    // this is a shortcut, the restored from persisted state UI won't see "updated at <most recent scan>" but "updated at <most recent scan with tx>".
                    // The latter is possible by deleting the previous update if both this and the previous are `onlyTip()` but the
                    // more complex logic is avoided for now
                    console.log("avoid persisting only tip update")
                } else {
                    console.log("Saving persisted update " + walletStatus)
                    update.prune(wolletLocal)
                    const base64 = update.serializeEncryptedBase64(wolletLocal.descriptor())

                    try {
                        localStorage.setItem(walletStatus, base64)
                    } catch (e) {
                        console.log("Saving persisted update " + walletStatus + " failed, too big")
                        alert("Attempt to store too much data in the local storage, skipping")
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
    } catch (error) {
        return [assetHex, 0]
    }
}

function encodeRFC3986URIComponent(str) {
    return encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

async function broadcastContract(contract) {
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