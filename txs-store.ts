const LOCAL_STORAGE_NULL_VALUE = "__null__"
const WOLLET_TX_KEY_PREFIX = "wollet:tx:"

export type JsStorage = {
    get(key: string): Uint8Array | null;
    put(key: string, value: Uint8Array | null): void;
    remove(key: string): void;
    isPersisted(): boolean;
}

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = ""
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

export function isRemoteStoreDebugEnabled(): boolean {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get("remoteStoreDebug") === "true"
}

export function debugRemoteStore(message: string, details?: unknown): void {
    if (!isRemoteStoreDebugEnabled()) {
        return
    }

    if (details === undefined) {
        console.log(`[RemoteStore] ${message}`)
    } else {
        console.log(`[RemoteStore] ${message}`, details)
    }
}

export function createRemoteTxsStore(baseUrl: string, prefix: string): JsStorage {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "")
    const txCache = new Map<string, Uint8Array | null>()
    return {
        get(key: string): Uint8Array | null {
            if (!key.startsWith(WOLLET_TX_KEY_PREFIX)) {
                const stored = localStorage.getItem(prefix + key)
                if (stored == null || stored === LOCAL_STORAGE_NULL_VALUE) {
                    debugRemoteStore(`tx metadata get miss ${key}`)
                    return null
                }
                debugRemoteStore(`tx metadata get hit ${key}`, { bytes: stored.length })
                return base64ToBytes(stored)
            }

            const cached = txCache.get(key)
            if (cached !== undefined) {
                debugRemoteStore(`tx get memory cache ${key}`, { hit: cached !== null, bytes: cached?.length ?? 0 })
                return cached
            }

            const txid = key.slice(WOLLET_TX_KEY_PREFIX.length)
            const request = new XMLHttpRequest()
            if (isRemoteStoreDebugEnabled()) {
                console.groupCollapsed(`[RemoteStore] tx fetch ${txid}`)
                console.trace("[RemoteStore] tx fetch caller")
                console.groupEnd()
            }
            try {
                request.open("GET", `${normalizedBaseUrl}/tx/${txid}/raw`, false)
                request.overrideMimeType("text/plain; charset=x-user-defined")
                request.send()
            } catch (error) {
                console.log(`Error fetching transaction ${txid}:`, error)
                txCache.set(key, null)
                return null
            }

            if (request.status < 200 || request.status >= 300 || request.responseText == null) {
                console.log(`Transaction ${txid} fetch failed with status ${request.status}`)
                txCache.set(key, null)
                return null
            }

            const bytes = new Uint8Array(request.responseText.length)
            for (let i = 0; i < request.responseText.length; i++) {
                bytes[i] = request.responseText.charCodeAt(i) & 0xff
            }
            txCache.set(key, bytes)
            debugRemoteStore(`tx fetch success ${txid}`, { bytes: bytes.length })
            return bytes
        },
        put(key: string, value: Uint8Array | null): void {
            if (!key.startsWith(WOLLET_TX_KEY_PREFIX)) {
                const encoded = value == null ? LOCAL_STORAGE_NULL_VALUE : bytesToBase64(new Uint8Array(value))
                debugRemoteStore(`tx metadata put ${key}`, { bytes: value?.length ?? 0 })
                localStorage.setItem(prefix + key, encoded)
                return
            }

            debugRemoteStore(`tx put memory only ${key}`, { bytes: value?.length ?? 0 })
            txCache.set(key, value == null ? null : new Uint8Array(value))
        },
        remove(key: string): void {
            if (!key.startsWith(WOLLET_TX_KEY_PREFIX)) {
                debugRemoteStore(`tx metadata remove ${key}`)
                localStorage.removeItem(prefix + key)
                return
            }
            debugRemoteStore(`tx remove memory cache ${key}`)
            txCache.delete(key)
        },
        isPersisted(): boolean {
            return true
        }
    }
}
