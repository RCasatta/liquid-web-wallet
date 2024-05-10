import * as lwk from "lwk_wasm"

// Global state
/* 
STATE.network = lwk.Network
STATE.wollet = lwk.Wollet
STATE.wolletSelected possible values: ShWpkh Wpkh
STATE.scan.status possible values: never first-running running finish
STATE.jade = lwk.Jade
*/
const STATE = {}

/// Re-enables initially disabled buttons, and add listener to buttons on the first page
/// First page doesn't use components because we want to be loaded before the wasm is loaded, which takes time
function init() {
    let connectJade = document.getElementById("connect-jade-button")
    connectJade.addEventListener("click", async (_e) => {
        for (var i = 0; i < 2; i++) {
            let radio = document.getElementById("network-selector-radio-" + i)
            if (radio.checked && radio.value == "Liquid") {
                STATE.network = lwk.Network.mainnet()
            } else if (radio.checked && radio.value == "LiquidTestnet") {
                STATE.network = lwk.Network.testnet()
            }
        }
        connectJade.setAttribute("aria-busy", true)
        connectJade.disabled = true
        STATE.jade = await new lwk.Jade(STATE.network, true) // pass false if you don't see your DYI Jade

        let connectJadeMessage = document.getElementById("connect-jade-message")
        const insertPinMessage = document.getElementById("insert-pin-template").content.cloneNode(true)
        connectJadeMessage.appendChild(insertPinMessage)
        const _xpub = await STATE.jade.getMasterXpub(); // asking something that requires unlock

        document.dispatchEvent(new CustomEvent('jade-initialized'))
    })
    connectJade.disabled = false

    let watchOnly = document.getElementById("watch-only-button")
    watchOnly.disabled = false

    document.getElementById("loading-wasm").setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts
}

init()

class MyFooter extends HTMLElement {
    constructor() {
        super()
        this.footer = this.querySelector('footer')
        document.addEventListener('jade-initialized', this.render)
        document.addEventListener('wallet-selected', this.render)
        this.render()
    }

    render = async () => {
        var footer = '<a href="https://github.com/RCasatta/liquid-web-wallet">Source</a>'
        if (STATE.network != null) {
            footer += `<span> | </span><span>${STATE.network}</span>`
        }
        if (STATE.jade != null) {
            const xpub = await STATE.jade.getMasterXpub();
            const jadeIdentifier = xpub.fingerprint()
            footer += `<span> | </span><span><code>${jadeIdentifier}</code></span>`
        }
        if (STATE.wolletSelected != null) {
            footer += `<span> | </span><span>${STATE.wolletSelected}</span>`
        }
        this.footer.innerHTML = footer
    }
}


class MyNav extends HTMLElement {
    constructor() {
        super()

        this.render()

        this.addEventListener("click", this.handleClick)

        document.addEventListener('jade-initialized', (event) => {
            this.render()
        })


        document.addEventListener('wallet-selected', (event) => {
            this.render()
            this.renderPage("balance-page")
        })


        document.addEventListener('pset-ready', (event) => {
            this.renderPage("sign-page")
        })
    }

    async handleClick(event) {
        let id = event.target.id
        if (id == "disconnect") {
            location.reload()
            return
        }
        if (id == "refresh") {
            if (STATE.scan.status.includes("running")) {
                alert("Scan is running")
            } else {
                await fullScanAndApply(STATE.wollet, STATE.scan)
                document.dispatchEvent(new CustomEvent('wallet-sync-end', {
                    bubbles: true,
                }))
            }

            return
        }
        if (id == "") {
            id = "wallets-page"
        }

        this.renderPage(id)
    }

    renderPage(id) {
        const template = document.getElementById(id + "-template").content.cloneNode(true)

        cleanChilds(app)
        app.appendChild(template)
    }

    render() {

        if (STATE.jade != null) {

            if (STATE.wolletSelected == null) {
                this.innerHTML = `
                    <a href="#" id="disconnect">Disconnect</a>
                    <br><br>
                `
                this.dispatchEvent(new Event("click"))
            } else {
                this.innerHTML = `
                    <a href="#" id="balance-page">Balance</a> |
                    <a href="#" id="transactions-page">Transactions</a> |
                    <a href="#" id="create-page">Create</a> |
                    <a href="#" id="sign-page">Sign</a> |
                    <a href="#" id="receive-page">Receive</a> |
                    <a href="#" id="refresh">Refresh</a> |
                    <a href="#" id="disconnect">Disconnect</a>

                    <br><br>
                `
            }
        }

    }
}


class WalletSelector extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        const template = document.getElementById(
            "wallets-selector-template",
        ).content.cloneNode(true)
        this.querySelector("div").appendChild(template)

        let walletSelector = this.querySelector("select")

        walletSelector.onchange = async () => {
            document.getElementById("wallets-page-progress").hidden = false

            STATE.wolletSelected = walletSelector.value
            var descriptor
            if (STATE.wolletSelected == "Wpkh") {
                descriptor = await STATE.jade.wpkh()
            } else if (STATE.wolletSelected == "ShWpkh") {
                descriptor = await STATE.jade.shWpkh()
            } else {
                throw new Error('Unexpected wallet selector value!');
            }
            STATE.wollet = new lwk.Wollet(STATE.network, descriptor)
            STATE.scan = {}
            if (loadPersisted(STATE.wollet)) {
                STATE.scan.status = "finish"
            } else {
                STATE.scan.status = "never"
            }

            this.dispatchEvent(new CustomEvent('wallet-selected', {
                bubbles: true,
            }))

            await fullScanAndApply(STATE.wollet, STATE.scan)
            console.log("finish fullScanAndApply")
            document.dispatchEvent(new CustomEvent('wallet-sync-end', {
                bubbles: true,
            }))
        }
    }
}


class AskAddress extends HTMLElement {
    constructor() {
        super()

        this.render()

        let button = this.querySelector("button")

        button.addEventListener("click", async (event) => {
            button.disabled = true
            button.setAttribute("aria-busy", true)
            let address = STATE.wollet.address(null)
            let index = address.index()
            let fullPath = STATE.wollet.addressFullPath(index)
            let variant = lwk.Singlesig.from(STATE.wolletSelected)

            let checkAddressDiv = document.getElementById("check-address-jade-message")
            const checkAddress = document.getElementById("check-address-jade-template").content.cloneNode(true)
            checkAddressDiv.appendChild(checkAddress)

            this.dispatchEvent(new CustomEvent('address-asked', {
                bubbles: true,
                detail: address
            }))

            let jadeAddress = await STATE.jade.getReceiveAddressSingle(variant, fullPath)

            console.assert(jadeAddress == address.address().toString(), "local and jade address are different!")

            button.setAttribute("aria-busy", false)
            button.disabled = false
            cleanChilds(checkAddressDiv)
        })
    }

    render() {
        this.innerHTML = "<p><button>Show on Jade</button></p>"
    }
}

class ReceiveAddress extends HTMLElement {
    constructor() {
        super()

        document.addEventListener('address-asked', (event) => {
            this.render(event.detail)
        })
    }

    render(address) {
        let addr = address.address()
        this.innerHTML = `
            <div style="word-break: break-word"><code>${addr.toString()}</code></div><br>
            <img src="${addr.QRCodeUri(null)}" width="250px" style="image-rendering: pixelated; border: 20px solid white;"></img>
        `
    }
}

class WalletBalance extends HTMLElement {
    constructor() {
        super()
    }
    connectedCallback() {
        this.render()

        console.log("adding wallet-sync-end listener WalletBalance")
        document.addEventListener('wallet-sync-end', (event) => {
            console.log("wallet-sync-end WalletBalance")

            this.render()
        })
    }

    render() {
        if (STATE.scan.status == "never" || STATE.scan.status == "first-running") {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
        } else {
            let balance = STATE.wollet.balance()
            updatedAt(STATE.wollet, document.getElementById("balance-page-updated-at"))
            this.innerHTML = ""
            this.appendChild(mapToTable(balance))
        }
    }
}


class WalletTransactions extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.render()

        console.log("adding wallet-sync-end listener WalletTransactions")
        document.addEventListener('wallet-sync-end', (event) => {
            console.log("wallet-sync-end WalletTransactions")

            this.render()
        })
    }

    render() {
        if (STATE.scan.status == "never" || STATE.scan.status == "first-running") {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
        } else {
            let transactions = STATE.wollet.transactions()
            this.innerHTML = ""

            let div = document.createElement("div")
            div.setAttribute("class", "overflow-auto")
            let table = document.createElement("table")
            table.setAttribute("class", "striped")
            div.appendChild(table)
            transactions.forEach((val) => {

                let newRow = document.createElement("tr")
                table.appendChild(newRow)

                let txid = document.createElement("td")
                txid.innerHTML = `
                    <code><a href="${val.unblindedUrl(STATE.network.defaultExplorerUrl())}" target="_blank">${val.txid()}</a></code>
                `
                let txType = document.createElement("td")
                txType.innerHTML = `
                    <span>${val.txType()}</span>
                `
                let heightCell = document.createElement("td")

                var height = (typeof val.height() === 'undefined') ? "unconfirmed" : val.height();
                heightCell.innerHTML = `
                    <span>${height}</span>
                `
                heightCell.setAttribute("style", "text-align:right")

                newRow.appendChild(txid)
                newRow.appendChild(txType)
                newRow.appendChild(heightCell)
            });
            this.appendChild(div)
            updatedAt(STATE.wollet, document.getElementById("transactions-page-updated-at"))

        }
    }
}


class CreateTransaction extends HTMLElement {
    constructor() {
        super()

        this.innerHTML = "<div></div>"
    }

    connectedCallback() {
        this.render()

        console.log("adding wallet-sync-end listener CreateTransaction")
        document.addEventListener('wallet-sync-end', (event) => {
            console.log("wallet-sync-end CreateTransaction")

            this.render()
        })
    }

    render() {
        if (STATE.scan.status == "never" || STATE.scan.status == "first-running") {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
        } else {

            let balance = STATE.wollet.balance()
            const template = document.getElementById(
                "create-transaction-form-template",
            ).content.cloneNode(true)

            const selectAsset = template.getElementById('create-transaction-div-select-asset')
            let select = document.createElement("select")
            select.setAttribute("id", "create-transaction-input-asset")
            let option = document.createElement("option")
            option.innerText = "Select Asset"
            select.appendChild(option)
            balance.forEach((_val, key) => {
                let option = document.createElement("option")
                option.innerText = mapAssetHex(key)
                option.setAttribute("value", key)
                select.appendChild(option)
            })
            selectAsset.appendChild(select)

            const createButton = template.getElementById('create-transaction-button-create')

            createButton.addEventListener("click", (_e) => {
                var valid = true; // inputs are valid

                let addressInput = document.getElementById("create-transaction-input-address")
                addressInput.setAttribute("aria-invalid", false)
                var recipientAddress
                try {
                    recipientAddress = new lwk.Address(addressInput.value)
                    // TODO check right network
                } catch (_e) {
                    addressInput.setAttribute("aria-invalid", true)
                    valid = false
                }

                let satoshisInput = document.getElementById("create-transaction-input-satoshis")
                satoshisInput.setAttribute("aria-invalid", false)
                var satoshis = satoshisInput.value
                if (!satoshis) {
                    satoshisInput.setAttribute("aria-invalid", true)
                    valid = false
                }

                let assetInput = document.getElementById("create-transaction-input-asset")
                assetInput.setAttribute("aria-invalid", false)
                var recipientAsset
                try {
                    recipientAsset = new lwk.AssetId(assetInput.value)
                } catch (_e) {
                    assetInput.setAttribute("aria-invalid", true)
                    valid = false
                }

                if (!valid) {
                    return
                }

                var builder = new lwk.TxBuilder(STATE.network);
                builder = builder.addRecipient(recipientAddress, satoshis, recipientAsset)

                STATE.pset = builder.finish(STATE.wollet)

                this.dispatchEvent(new CustomEvent('pset-ready', {
                    bubbles: true,
                }))

            })

            const createDiv = this.querySelector("div")
            if (createDiv) {
                cleanChilds(createDiv)
                createDiv.appendChild(template)
            }

        }
    }
}



class SignTransaction extends HTMLElement {
    constructor() {
        super()

    }

    connectedCallback() {
        this.render()
    }

    render() {
        const template = document.getElementById("sign-transaction-template").content.cloneNode(true)

        if (STATE.pset != null) {
            template.getElementById('sign-transaction-textarea').textContent = STATE.pset.toString()
            STATE.pset = null
        }

        const analyzeButton = template.getElementById('sign-transaction-button-analyze')
        analyzeButton.addEventListener("click", (_e) => {
            this.renderAnalyze()

        })

        const signButton = template.getElementById('sign-transaction-button-sign')
        signButton.addEventListener("click", async (_e) => {
            let psetString = document.getElementById('sign-transaction-textarea').textContent
            let pset = new lwk.Pset(psetString)
            signButton.setAttribute("aria-busy", true)
            signButton.disabled = true

            let signWarnDiv = document.getElementById("sign-transaction-div-jade-sign")
            const signWarn = document.getElementById("sign-jade-template").content.cloneNode(true)
            signWarnDiv.appendChild(signWarn)

            let signedPset = await STATE.jade.sign(pset)
            signButton.setAttribute("aria-busy", false)
            signButton.disabled = false

            cleanChilds(signWarnDiv)
            const signDone = document.getElementById("signed-jade-template").content.cloneNode(true)
            signWarnDiv.appendChild(signDone)

            document.getElementById('sign-transaction-textarea').textContent = signedPset
            this.renderAnalyze()
        })

        const broadcastButton = template.getElementById('sign-transaction-button-broadcast')
        broadcastButton.addEventListener("click", async (_e) => {
            let signWarnDiv = document.getElementById("sign-transaction-div-jade-sign")
            cleanChilds(signWarnDiv)

            let psetString = document.getElementById('sign-transaction-textarea').textContent
            let pset = new lwk.Pset(psetString)
            let psetFinalized = STATE.wollet.finalize(pset)
            broadcastButton.setAttribute("aria-busy", true)
            broadcastButton.disabled = true
            let client = STATE.network.defaultEsploraClient()
            let txid = await client.broadcast(psetFinalized)
            broadcastButton.setAttribute("aria-busy", false)
            broadcastButton.disabled = false


            document.getElementById('sign-transaction-div-broadcast').innerHTML = `
                <div>
                    <input aria-invalid="false" aria-describedby="broadcasted-description" readonly="true" value="${txid}">
                    <small id="broadcasted-description">Tx broadcasted!</small>
                </div>
                <br><br>
            `
        })

        cleanChilds(this)
        this.appendChild(template)
        this.renderAnalyze()

    }

    renderAnalyze() {
        let psetString = document.getElementById('sign-transaction-textarea').textContent
        if (psetString) {
            let pset = new lwk.Pset(psetString)
            let details = STATE.wollet.psetDetails(pset)

            let div = document.getElementById('sign-transaction-div-analyze')
            cleanChilds(div)
            let hgroup = document.createElement("hgroup");
            hgroup.innerHTML = `
                <h3>Net balance</h3><p>From the perspective of ${STATE.wolletSelected}</p>
            `
            div.appendChild(hgroup)

            var psetBalance = details.balance().balances();
            psetBalance.set("fee", details.balance().fee());
            div.appendChild(mapToTable(psetBalance))

            let h3 = document.createElement("h3");
            h3.innerText = "Signatures"
            div.appendChild(h3)
            const sigMap = new Map();
            let signatures = details.signatures()
            for (let i = 0; i < signatures.length; i++) {
                let sig = signatures[i]

                var msg
                if (sig.hasSignature().length == 0) {
                    msg = `missing ${sig.missingSignature().map(x => x[1])}`
                } else if (sig.missingSignature().length == 0) {
                    msg = `has ${sig.hasSignature().map(x => x[1])}`
                } else {
                    msg = `missing ${sig.missingSignature().map(x => x[1])} has ${sig.hasSignature().map(x => x[1])}`
                }

                sigMap.set("input #" + i, msg)
            }
            div.appendChild(mapToTable(sigMap))
            // TODO issuances

        }
    }
}

customElements.define("my-nav", MyNav)
customElements.define("my-footer", MyFooter)

customElements.define("wallet-selector", WalletSelector)
customElements.define("receive-address", ReceiveAddress)
customElements.define("ask-address", AskAddress)
customElements.define("wallet-balance", WalletBalance)
customElements.define("wallet-transactions", WalletTransactions)
customElements.define("create-transaction", CreateTransaction)
customElements.define("sign-transaction", SignTransaction)


function mapToTable(map) {
    let div = document.createElement("div")
    div.setAttribute("class", "overflow-auto")
    let table = document.createElement("table")
    table.setAttribute("class", "striped")
    div.appendChild(table)
    // for (let key in balance) {
    map.forEach((val, key) => {
        let newRow = document.createElement("tr")
        table.appendChild(newRow)

        let asset = document.createElement("td")
        asset.innerHTML = `
                        <code>${mapAssetHex(key)}</code>
                    `
        newRow.appendChild(asset)

        let secondCell = document.createElement("td")
        secondCell.setAttribute("style", "text-align:right")
        secondCell.textContent = val
        newRow.appendChild(secondCell)
    })
    return div
}


function loadPersisted(wolletLocal) {
    const descriptor = wolletLocal.descriptor()
    var loaded = false
    while (true) {
        const walletStatus = wolletLocal.status()
        const retrievedUpdate = localStorage.getItem(walletStatus)
        if (retrievedUpdate) {
            console.log("Found persisted update, applying " + walletStatus)
            const update = lwk.Update.deserializeDecryptedBase64(retrievedUpdate, descriptor)
            wolletLocal.applyUpdate(update)
            loaded = true
        } else {
            return loaded
        }
    }
}

function updatedAt(wolletLocal, node) {
    // if (node) {
    //     const unix_ts = wolletLocal.tip().timestamp()
    //     node.innerText = "updated at " + new Date(unix_ts * 1000).toLocaleString()
    // }
}

async function fullScanAndApply(wolletLocal, scanLocal) {

    if (!scanLocal.status.includes("running")) {
        if (scanLocal.status == "never") {
            scanLocal.status = "first-running"
        } else {
            scanLocal.status = "running"
        }
        let client = STATE.network.defaultEsploraClient()

        const update = await client.fullScan(wolletLocal)
        if (update instanceof lwk.Update) {
            if (update.onlyTip()) {
                // this is a shortcut, the UI won't see "updated at <most recent scan>" but "updated at <most recent scan with tx>".
                // The latter is possible by deleting the previous update if both this and the previous are `onlyTip()` but the 
                // more complex logic is avoided for now
                console.log("avoid persisting only tip update")
            } else {
                const walletStatus = wolletLocal.status()
                console.log("Saving persisted update " + walletStatus)
                wolletLocal.applyUpdate(update)
                const base64 = update.serializeEncryptedBase64(wolletLocal.descriptor())
                localStorage.setItem(walletStatus, base64)
            }
        }
        scanLocal.status = "finish"
    }
}

function cleanChilds(comp) {
    if (comp) {
        while (comp.firstChild) {
            comp.firstChild.remove()
        }
    }
}

function mapAssetHex(assetHex) {
    switch (assetHex) {
        case "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d": return "L-BTC"
        case "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49": return "tL-BTC"
        default: return assetHex
    }
}
