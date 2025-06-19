// state.js - Application state management

/**
 * Private state object containing all application state
 */
const _state = {
    // Page state
    page: null, // id of the last rendered page

    // Wallet state
    wollet: null, // lwk.Wollet instance
    wolletSelected: null, // Current wallet type: ShWpkh, Wpkh, or multisig wallet name

    // Device state
    jade: null, // lwk.Jade instance
    ledger: null, // lwk.LedgerWeb instance
    standardDerivations: null, // {String: String} mapping bip to xpub
    xpub: null, // String - master xpub from Jade

    // Multisig state
    multiWallets: [], // Array of registered multisig wallet names

    // Signer state (testnet only)
    swSigner: null, // lwk.Signer instance

    // Scanning state
    scan: { running: false },
    scanLoop: null, // Interval ID for scan loop

    // Transaction state
    pset: null, // Current PSET being worked on
    contract: null, // lwk.RegistryPost (contract, asset_id) - last issued contract

    // Registry state
    registry: null, // lwk.Registry instance

    // Developer mode state
    devMode: false // Whether developer mode is enabled
};

// Initialize state from localStorage if available
(function initState() {
    // Initialize dev mode from localStorage
    const savedDevMode = localStorage.getItem('devMode');
    if (savedDevMode !== null) {
        _state.devMode = savedDevMode === 'true';
        console.log("Loaded dev mode from localStorage:", _state.devMode);
    }
})();

/**
 * Subscribers for state changes
 */
const _subscribers = new Map();

/**
 * Subscribe to state changes
 * @param {string} eventName - Name of the event to subscribe to
 * @param {Function} callback - Function to call when event is triggered
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(eventName, callback) {
    if (!_subscribers.has(eventName)) {
        _subscribers.set(eventName, new Set());
    }
    _subscribers.get(eventName).add(callback);

    // Return unsubscribe function
    return () => {
        const subscribers = _subscribers.get(eventName);
        if (subscribers) {
            subscribers.delete(callback);
        }
    };
}

/**
 * Publish an event
 * @param {string} eventName - Name of the event to publish
 * @param {any} data - Data to pass to subscribers
 */
export function publish(eventName, data) {
    const subscribers = _subscribers.get(eventName);
    if (subscribers) {
        subscribers.forEach(callback => callback(data));
    }
}

// Page state management
export function getCurrentPage() {
    return _state.page;
}

export function setCurrentPage(pageId) {
    _state.page = pageId;
    return _state.page;
}

// Wallet state management
export function getWollet() {
    return _state.wollet;
}

export function setWollet(wollet) {
    _state.wollet = wollet;
    publish('wollet-changed', wollet);
    return _state.wollet;
}

export function getWolletSelected() {
    return _state.wolletSelected;
}

export function setWolletSelected(walletType) {
    _state.wolletSelected = walletType;
    publish('wallet-selected', walletType);
    return _state.wolletSelected;
}

// Scan state management
export function getScanState() {
    return _state.scan;
}

export function setScanRunning(isRunning) {
    _state.scan.running = isRunning;
    publish('scan-state-changed', _state.scan);
    return _state.scan;
}

export function getScanLoop() {
    return _state.scanLoop;
}

export function setScanLoop(intervalId) {
    _state.scanLoop = intervalId;
    return _state.scanLoop;
}

// Jade state management
export function getJade() {
    return _state.jade;
}

export function setJade(jade, xpub, multiWallets, standardDerivations) {
    if (jade === undefined || xpub === undefined || multiWallets === undefined || standardDerivations === undefined) {
        throw new Error("setJade requires all parameters: jade, xpub, multiWallets, standardDerivations");
    }

    _state.jade = jade;
    _state.xpub = xpub;
    _state.multiWallets = multiWallets;
    _state.standardDerivations = standardDerivations;

    publish('jade-changed', jade);
    return _state.jade;
}

// Ledger state management
export function getLedger() {
    return _state.ledger;
}

export function setLedger(ledger) {
    _state.ledger = ledger;
    publish('ledger-changed', ledger);
    return _state.ledger;
}

export function getStandardDerivations() {
    return _state.standardDerivations;
}

export function setStandardDerivations(derivations) {
    _state.standardDerivations = derivations;
    return _state.standardDerivations;
}

export function getXpub() {
    return _state.xpub;
}

export function setXpub(xpub) {
    _state.xpub = xpub;
    return _state.xpub;
}

// Multisig state management
export function getMultiWallets() {
    return _state.multiWallets;
}

export function setMultiWallets(wallets) {
    _state.multiWallets = wallets;
    return _state.multiWallets;
}

// Software signer management
export function getSwSigner() {
    return _state.swSigner;
}

export function setSwSigner(signer) {
    _state.swSigner = signer;
    return _state.swSigner;
}

// Transaction state management
export function getPset() {
    return _state.pset;
}

export function setPset(pset) {
    _state.pset = pset;
    publish('pset-changed', pset);
    return _state.pset;
}

export function getContract() {
    return _state.contract;
}

export function setContract(contract) {
    _state.contract = contract;
    return _state.contract;
}

// Registry state management
export function getRegistry() {
    return _state.registry;
}

export function setRegistry(registry) {
    _state.registry = registry;
    publish('registry-changed', registry);
    return _state.registry;
}

// Dev mode state management
export function getDevMode() {
    return _state.devMode;
}

export function setDevMode(isDevMode) {
    // Update state, checking boolean explicitly to ensure consistency
    _state.devMode = isDevMode === true;

    // Save to localStorage
    localStorage.setItem('devMode', _state.devMode.toString());

    // Notify subscribers
    publish('dev-mode-changed', _state.devMode);

    return _state.devMode;
}

// Future state management functions will be added here 