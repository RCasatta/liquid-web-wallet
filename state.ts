// state.js - Application state management

import * as lwk from "lwk_wasm"

/**
 * Private state object containing all application state
 */
const _state: {
    page: string | null;
    wollet: lwk.Wollet | null;
    wolletSelected: string | null;
    jade: lwk.Jade | null;
    ledger: lwk.LedgerWeb | null;
    standardDerivations: { [key: string]: string } | null;
    xpub: lwk.Xpub | null;
    multiWallets: string[];
    swSigner: lwk.Signer | null;
    scan: { running: boolean };
    walletSync: any;
    pset: lwk.Pset | null;
    contract: lwk.RegistryPost | null;
    registry: lwk.Registry | null;
    registryFetched: boolean;
    devMode: boolean;
    utxoOnly: boolean;
    amp0: lwk.Amp0 | null;
    amp0Pset: lwk.Amp0Pset | null;
    boltzSession: lwk.BoltzSession | null;
    localStorageFullAlertShown: boolean;
    notifications: WalletNotification[];
} = {
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

    // Scanning and subscription state
    scan: { running: false },
    walletSync: null, // Active wallet SSE subscription handle

    // Transaction state
    pset: null, // Current PSET being worked on
    contract: null, // lwk.RegistryPost (contract, asset_id) - last issued contract

    // Registry state
    registry: null, // lwk.Registry instance
    registryFetched: false, // Whether registry has been fetched

    // Developer mode state
    devMode: false, // Whether developer mode is enabled

    // UTXO only mode state
    utxoOnly: false, // Whether UTXO only mode is enabled

    // Amp0 state
    amp0: null, // lwk.Amp0 instance
    amp0Pset: null, // Amp0 PSET object for cosigning

    // Boltz session state
    boltzSession: null, // lwk.BoltzSession instance

    // LocalStorage state
    localStorageFullAlertShown: false, // Whether the localStorage full alert has been shown

    // UI notifications
    notifications: []
};

export type WalletNotificationLevel = "info" | "success" | "warning" | "error";

export interface WalletNotificationInput {
    id?: string;
    level?: WalletNotificationLevel;
    title?: string;
    message: string;
    timeoutMs?: number | null;
    closable?: boolean;
}

export type WalletNotificationOptions = Omit<WalletNotificationInput, "level" | "title" | "message">;

export interface WalletNotification {
    id: string;
    level: WalletNotificationLevel;
    title: string;
    message: string;
    timeoutMs: number | null;
    closable: boolean;
    createdAt: number;
}

const DEFAULT_NOTIFICATION_TIMEOUT_MS = 6000;
const MAX_NOTIFICATIONS = 5;
let notificationSequence = 0;

// Initialize state from localStorage if available
(function initState() {
    // Initialize dev mode from localStorage
    const savedDevMode = localStorage.getItem('devMode');
    if (savedDevMode !== null) {
        _state.devMode = savedDevMode === 'true';
        console.log("Loaded dev mode from localStorage:", _state.devMode);
    }

    // Initialize UTXO only mode from localStorage
    const savedUtxoOnly = localStorage.getItem('utxoOnly');
    if (savedUtxoOnly !== null) {
        _state.utxoOnly = savedUtxoOnly === 'true';
        console.log("Loaded UTXO only mode from localStorage:", _state.utxoOnly);
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
export function subscribe(eventName: string, callback: (data: any) => void): () => void {
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
export function publish(eventName: string, data: any): void {
    const subscribers = _subscribers.get(eventName);
    if (subscribers) {
        subscribers.forEach(callback => callback(data));
    }
}

export function getWalletNotifications(): WalletNotification[] {
    return [..._state.notifications];
}

export function notifyWallet(input: WalletNotificationInput): WalletNotification {
    const closable = input.closable === true;
    const notification: WalletNotification = {
        id: input.id || `notification-${Date.now()}-${notificationSequence++}`,
        level: input.level || "info",
        title: input.title || "",
        message: input.message,
        timeoutMs: input.timeoutMs === undefined ? (closable ? null : DEFAULT_NOTIFICATION_TIMEOUT_MS) : input.timeoutMs,
        closable,
        createdAt: Date.now()
    };

    _state.notifications = [..._state.notifications, notification].slice(-MAX_NOTIFICATIONS);
    publish('wallet-notifications-changed', getWalletNotifications());
    return notification;
}

export function notifySuccess(title: string, message = "", options: WalletNotificationOptions = {}): WalletNotification {
    return notifyWallet({
        ...options,
        level: "success",
        title,
        message,
    });
}

export function notifyInfo(title: string, message = "", options: WalletNotificationOptions = {}): WalletNotification {
    return notifyWallet({
        ...options,
        level: "info",
        title,
        message,
    });
}

export function notifyError(title: string, message: string, options: WalletNotificationOptions = {}): WalletNotification {
    return notifyWallet({
        closable: true,
        ...options,
        level: "error",
        title,
        message,
    });
}

export function notifyWarning(title: string, message = "", options: WalletNotificationOptions = {}): WalletNotification {
    return notifyWallet({
        closable: true,
        ...options,
        level: "warning",
        title,
        message,
    });
}

export function dismissWalletNotification(id: string | string[]): void {
    const ids = Array.isArray(id) ? id : [id];
    const idsToDismiss = new Set(ids);
    _state.notifications = _state.notifications.filter(notification => !idsToDismiss.has(notification.id));
    publish('wallet-notifications-changed', getWalletNotifications());
}

export function clearWalletNotifications(): void {
    _state.notifications = [];
    publish('wallet-notifications-changed', getWalletNotifications());
}

// Page state management
export function getCurrentPage(): string | null {
    return _state.page;
}

export function setCurrentPage(pageId: string): string {
    _state.page = pageId;
    return _state.page;
}

// Wallet state management
export function getWollet(): lwk.Wollet | null {
    return _state.wollet;
}

export function setWollet(wollet: lwk.Wollet | null): lwk.Wollet | null {
    _state.wollet = wollet;
    publish('wollet-changed', wollet);
    return _state.wollet;
}

export function getWolletSelected() {
    return _state.wolletSelected;
}

export function setWolletSelected(walletType: string | null): string | null {
    _state.wolletSelected = walletType;
    publish('wallet-selected', walletType);
    return _state.wolletSelected;
}

// Scan state management
export function getScanState(): { running: boolean } {
    return _state.scan;
}

export function setScanRunning(isRunning: boolean): { running: boolean } {
    _state.scan.running = isRunning;
    publish('scan-state-changed', _state.scan);
    return _state.scan;
}

export function getWalletSync(): any {
    return _state.walletSync;
}

export function setWalletSync(handle: any): any {
    _state.walletSync = handle;
    return _state.walletSync;
}

// Jade state management
export function getJade(): lwk.Jade | null {
    return _state.jade;
}

export function setJade(jade: lwk.Jade | null, xpub: lwk.Xpub | null, multiWallets: string[], standardDerivations: { [key: string]: string } | null): lwk.Jade | null {
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
export function getLedger(): lwk.LedgerWeb | null {
    return _state.ledger;
}

export function setLedger(ledger: lwk.LedgerWeb | null): lwk.LedgerWeb | null {
    _state.ledger = ledger;
    publish('ledger-changed', ledger);
    return _state.ledger;
}

export function getStandardDerivations(): { [key: string]: string } | null {
    return _state.standardDerivations;
}

export function setStandardDerivations(derivations: { [key: string]: string } | null): { [key: string]: string } | null {
    _state.standardDerivations = derivations;
    return _state.standardDerivations;
}

export function getXpub(): lwk.Xpub | null {
    return _state.xpub;
}

export function setXpub(xpub: lwk.Xpub | null): lwk.Xpub | null {
    _state.xpub = xpub;
    return _state.xpub;
}

// Multisig state management
export function getMultiWallets(): string[] {
    return _state.multiWallets;
}

export function setMultiWallets(wallets: string[]): string[] {
    _state.multiWallets = wallets;
    return _state.multiWallets;
}

// Software signer management
export function getSwSigner(): lwk.Signer | null {
    return _state.swSigner;
}

export function setSwSigner(signer: lwk.Signer | null): lwk.Signer | null {
    _state.swSigner = signer;
    return _state.swSigner;
}

// Transaction state management
export function getPset(): lwk.Pset | null {
    return _state.pset;
}

export function setPset(pset: lwk.Pset | null): lwk.Pset | null {
    _state.pset = pset;
    publish('pset-changed', pset);
    return _state.pset;
}

export function getContract(): lwk.RegistryPost | null {
    return _state.contract;
}

export function setContract(contract: lwk.RegistryPost | null): lwk.RegistryPost | null {
    _state.contract = contract;
    return _state.contract;
}

// Registry state management
export function getRegistry(): lwk.Registry | null {
    return _state.registry;
}

export function setRegistry(registry: lwk.Registry | null): lwk.Registry | null {
    _state.registry = registry;
    publish('registry-changed', registry);
    return _state.registry;
}

// Dev mode state management
export function getDevMode(): boolean {
    return _state.devMode;
}

export function setDevMode(isDevMode: boolean): boolean {
    // Update state, checking boolean explicitly to ensure consistency
    _state.devMode = isDevMode === true;

    // Save to localStorage
    localStorage.setItem('devMode', _state.devMode.toString());

    // Notify subscribers
    publish('dev-mode-changed', _state.devMode);

    return _state.devMode;
}

// UTXO only mode state management
export function getUtxoOnly(): boolean {
    return _state.utxoOnly;
}

export function setUtxoOnly(isUtxoOnly: boolean): boolean {
    // Update state, checking boolean explicitly to ensure consistency
    _state.utxoOnly = isUtxoOnly === true;

    // Save to localStorage
    localStorage.setItem('utxoOnly', _state.utxoOnly.toString());

    // Notify subscribers
    publish('utxo-only-changed', _state.utxoOnly);

    return _state.utxoOnly;
}

// Registry fetched state management
export function getRegistryFetched(): boolean {
    return _state.registryFetched;
}

export function setRegistryFetched(isFetched: boolean): boolean {
    _state.registryFetched = isFetched === true;
    return _state.registryFetched;
}

// Amp0 state management
export function getAmp0(): lwk.Amp0 | null {
    return _state.amp0;
}

export function setAmp0(amp0: lwk.Amp0 | null): lwk.Amp0 | null {
    _state.amp0 = amp0;
    publish('amp0-changed', amp0);
    return _state.amp0;
}

// Amp0 PSET state management
export function getAmp0Pset(): lwk.Amp0Pset | null {
    return _state.amp0Pset;
}

export function setAmp0Pset(amp0Pset: lwk.Amp0Pset | null): lwk.Amp0Pset | null {
    _state.amp0Pset = amp0Pset;
    publish('amp0-pset-changed', amp0Pset);
    return _state.amp0Pset;
}

// Boltz session state management
export function getBoltzSession(): lwk.BoltzSession | null {
    return _state.boltzSession;
}

export function setBoltzSession(boltzSession: lwk.BoltzSession | null): lwk.BoltzSession | null {
    _state.boltzSession = boltzSession;
    publish('boltz-session-changed', boltzSession);
    return _state.boltzSession;
}

// LocalStorage state management
export function getLocalStorageFull(): boolean {
    return _state.localStorageFullAlertShown;
}

export function setLocalStorageFull(shown: boolean): boolean {
    _state.localStorageFullAlertShown = shown === true;
    return _state.localStorageFullAlertShown;
}

// Swap storage management
const SWAPS_STORAGE_KEY_PREFIX = 'swaps-';

/**
 * Interface for objects that can be saved as swaps (PreparePayResponse or InvoiceResponse)
 */
interface Swappable {
    swapId(): string;
    serialize(): string;
}

/**
 * Get the localStorage key for swaps based on the current wollet's dwid
 */
function getSwapsStorageKey(): string {
    const wollet = _state.wollet;
    if (!wollet) {
        throw new Error("No wollet available for swap storage");
    }
    return SWAPS_STORAGE_KEY_PREFIX + wollet.dwid();
}

/**
 * Save a swap to localStorage
 * @param swap - A swap object with swapId() and serialize() methods
 */
export function saveSwap(swap: Swappable): void {
    const storageKey = getSwapsStorageKey();
    const swaps = getAllSwaps();
    swaps[swap.swapId()] = swap.serialize();
    console.log("saving swap to localStorage", storageKey, swap.swapId());
    localStorage.setItem(storageKey, JSON.stringify(swaps));
}

/**
 * Remove a swap from localStorage
 * @param swapKey - Unique identifier for the swap to remove
 * @returns true if the swap was found and removed, false otherwise
 */
export function removeSwap(swapKey: string): boolean {
    const storageKey = getSwapsStorageKey();
    const swaps = getAllSwaps();
    if (swapKey in swaps) {
        delete swaps[swapKey];
        localStorage.setItem(storageKey, JSON.stringify(swaps));
        return true;
    }
    return false;
}

/**
 * Get all stored swaps for the current wollet
 * @returns Object mapping swapKey to serialized swap data
 */
export function getAllSwaps(): { [key: string]: string } {
    const storageKey = getSwapsStorageKey();
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return {};
        }
    }
    return {};
}

/**
 * Get a specific swap by key
 * @param swapKey - Unique identifier for the swap
 * @returns Serialized swap data or null if not found
 */
export function getSwap(swapKey: string): string | null {
    const swaps = getAllSwaps();
    return swaps[swapKey] ?? null;
}
