import * as lwk from "lwk_wasm"

// Global state
/* 
STATE.network = lwk.Network
STATE.wollet = lwk.Wollet
STATE.wolletSelected possible values: ShWpkh Wpkh, <multisig wallets>
STATE.scan.running bool
STATE.jade = lwk.Jade
STATE.xpub = String
STATE.multiWallets = [String]
*/
const STATE = {}

/// Re-enables initially disabled buttons, and add listener to buttons on the first page
/// First page doesn't use components because we want to be loaded before the wasm is loaded, which takes time
async function init() {
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
        setBusyDisabled(connectJade, true)
        STATE.jade = await new lwk.Jade(STATE.network, true) // pass false if you don't see your DYI Jade

        let connectJadeMessage = document.getElementById("connect-jade-message")
        const insertPinMessage = document.getElementById("insert-pin-template").content.cloneNode(true)
        connectJadeMessage.appendChild(insertPinMessage)
        STATE.xpub = await STATE.jade.getMasterXpub(); // asking something that requires unlock
        STATE.multiWallets = await STATE.jade.getRegisteredMultisigs();

        console.log("dispatching jade-initialized")
        document.dispatchEvent(new CustomEvent('jade-initialized'))
    })

    let descriptorTextarea = document.getElementById("descriptor-textarea")
    let exampleDescriptor = document.getElementById("example-descriptor-link")
    exampleDescriptor.addEventListener("click", (_e) => {
        const example = "ct(slip77(ac53739ddde9fdf6bba3dbc51e989b09aa8c9cdce7b7d7eddd49cec86ddf71f7),elwpkh([93970d14/84'/1'/0']tpubDC3BrFCCjXq4jAceV8k6UACxDDJCFb1eb7R7BiKYUGZdNagEhNfJoYtUrRdci9JFs1meiGGModvmNm8PrqkrEjJ6mpt6gA1DRNU8vu7GqXH/<0;1>/*))#u0y4axgs"
        descriptorTextarea.value = example
    })

    let watchOnlyButton = document.getElementById("watch-only-button")
    watchOnlyButton.addEventListener("click", async (_e) => {
        try {
            const descriptorText = descriptorTextarea.value
            console.log(descriptorText)
            const descriptor = new lwk.WolletDescriptor(descriptorText)

            // This is hacky...
            let network = descriptorText.includes("xpub") ? lwk.Network.mainnet() : lwk.Network.testnet()

            STATE.wollet = new lwk.Wollet(network, descriptor)
            STATE.network = network
            STATE.wolletSelected = "Descriptor"
            STATE.scan = { running: false }
            loadPersisted(STATE.wollet)

            document.dispatchEvent(new CustomEvent('wallet-selected'))

            await fullScanAndApply(STATE.wollet, STATE.scan)

        } catch (e) {
            // TODO show UI
            console.log(e)
        }
    })


    connectJade.disabled = false
    watchOnlyButton.disabled = false

    document.getElementById("loading-wasm").setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts
}

await init()

class MyFooter extends HTMLElement {
    constructor() {
        super()
        this.footer = this.querySelector('footer')
        document.addEventListener('jade-initialized', this.render)
        document.addEventListener('wallet-selected', this.render)

        this.render()
    }

    handleClick = (_event) => {
        this.dispatchEvent(new CustomEvent('wallet-clicked', {
            bubbles: true,
        }))
    }

    render = () => {
        var footer = '<a href="https://github.com/RCasatta/liquid-web-wallet">Source</a>'
        if (STATE.network != null) {
            footer += `<span> | </span><span>${STATE.network}</span>`
        }
        if (STATE.jade != null) {
            const jadeIdentifier = STATE.xpub.fingerprint()
            footer += `<span> | </span><span><code>${jadeIdentifier}</code></span>`
        }
        if (STATE.wolletSelected != null) {
            footer += `<span> | </span><a href="#" id="wallet">${STATE.wolletSelected}</a>`
        }
        this.footer.innerHTML = footer
        let id = this.querySelector("#wallet")
        if (id) {
            id.addEventListener("click", this.handleClick)
        }
    }
}


class MyNav extends HTMLElement {
    constructor() {
        super()

        this.render()

        this.addEventListener("click", this.handleClick)

        document.addEventListener('jade-initialized', this.render)
        document.addEventListener('wallet-sync-end', this.render)
        document.addEventListener('wallet-sync-start', this.render)

        document.addEventListener('wallet-selected', (event) => {
            this.render()
            this.renderPage("balance-page")
        })

        document.addEventListener('pset-ready', (event) => {
            this.renderPage("sign-page")
        })

        document.addEventListener('wallet-clicked', (event) => {
            this.renderPage("wallet-page")
        })

        document.addEventListener('register-clicked', (event) => {
            this.renderPage("register-multisig-page")
        })
    }

    handleClick = async (event) => {
        let id = event.target.id
        if (id === "") {
            return
        }
        if (id == "disconnect") {
            location.reload()
            return
        }
        if (id == "scan") {
            if (STATE.scan.running) {
                alert("Scan is running")
            } else {
                await fullScanAndApply(STATE.wollet, STATE.scan)
            }
            return
        }

        this.renderPage(id)
    }

    renderPage(id) {
        const template = document.getElementById(id + "-template").content.cloneNode(true)

        cleanChilds(app)
        app.appendChild(template)
    }

    render = async (_e) => {

        if (STATE.jade != null && STATE.wolletSelected == null) {
            this.innerHTML = `
                    <a href="#" id="disconnect">Disconnect</a>
                    <br><br>
                `
            this.renderPage("wallets-page")
        } else if (STATE.scan) {
            let signTitle = STATE.jade ? "Sign" : "Analyze"
            this.innerHTML = `
                    <a href="#" id="balance-page">Balance</a> |
                    <a href="#" id="transactions-page">Transactions</a> |
                    <a href="#" id="create-page">Create</a> |
                    <a href="#" id="sign-page">${signTitle}</a> |
                    <a href="#" id="receive-page">Receive</a> |
                    <a href="#" id="scan" aria-busy="${STATE.scan.running}" >Scan</a> |
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
        STATE.multiWallets.forEach((w) => {
            let option = document.createElement("option")
            option.innerText = w + " (multisig)"
            option.setAttribute("value", w)
            this.walletSelector.appendChild(option)
        })
    }

    handleSelect = async () => {
        this.walletProgress.hidden = false

        STATE.wolletSelected = this.walletSelector.value
        var descriptor
        if (STATE.wolletSelected == "Wpkh") {
            descriptor = await STATE.jade.wpkh()
        } else if (STATE.wolletSelected == "ShWpkh") {
            descriptor = await STATE.jade.shWpkh()
        } else {
            descriptor = await STATE.jade.multi(STATE.wolletSelected)
        }
        console.log(descriptor.toString())
        STATE.wollet = new lwk.Wollet(STATE.network, descriptor)
        STATE.scan = { running: false }
        loadPersisted(STATE.wollet)

        this.dispatchEvent(new CustomEvent('wallet-selected', {
            bubbles: true,
        }))

        await fullScanAndApply(STATE.wollet, STATE.scan)
    }
}


class AskAddress extends HTMLElement {
    constructor() {
        super()

        this.button = this.querySelector("button")
        this.checkAddressDiv = this.querySelector("#check-address-jade-message")
        this.checkAddressDiv.hidden = true
        this.shouldCheckAddressDiv = this.querySelector("#should-check-address-jade-message")
        this.claimTestnetCoins = this.querySelector("#claim-testnet-coin-message")

        this.button.addEventListener("click", this.handleClick)
        if (STATE.jade == null) {
            this.button.innerText = "Show"
        }

    }

    handleClick = async (_e) => {
        setBusyDisabled(this.button, true)
        let address = STATE.wollet.address(null)
        let index = address.index()
        console.log(address.address().toString())

        this.dispatchEvent(new CustomEvent('address-asked', {
            bubbles: true,
            detail: address
        }))

        if (!STATE.network.isMainnet()) {
            this.claimTestnetCoins.hidden = false
        }

        if (STATE.jade == null) {
            setBusyDisabled(this.button, false)
            this.shouldCheckAddressDiv.hidden = false
            return
        }
        this.checkAddressDiv.hidden = false
        var jadeAddress
        if (STATE.wolletSelected === "Wpkh" || STATE.wolletSelected === "ShWpkh") {
            // FIXME it breakes if someone call his registered wallet "Wpkh" or "ShWpkh"
            let fullPath = STATE.wollet.addressFullPath(index)
            let variant = lwk.Singlesig.from(STATE.wolletSelected)
            jadeAddress = await STATE.jade.getReceiveAddressSingle(variant, fullPath)
        } else {
            // 0 means external chain
            jadeAddress = await STATE.jade.getReceiveAddressMulti(STATE.wolletSelected, [0, index]);
        }


        console.assert(jadeAddress == address.address().toString(), "local and jade address are different!")

        setBusyDisabled(this.button, false)
        this.checkAddressDiv.hidden = true
    }
}

class ReceiveAddress extends HTMLElement {
    constructor() {
        super()

        document.addEventListener('address-asked', this.render)
    }

    render = (event) => {
        console.log("Receive Address render")
        let addr = event.detail.address()
        let addrString = addr.toString()
        this.innerHTML = `
            <div style="word-break: break-word"><code>${addrString}</code></div><br>
            <a href="liquidnetwork:${addrString}">
                <img src="${addr.QRCodeUri(null)}" width="300px" style="image-rendering: pixelated; border: 20px solid white;"></img>
            </a>
        `
    }
}

class WalletBalance extends HTMLElement {
    constructor() {
        super()
        this.subtitle = this.querySelector("p")
        this.div = this.querySelector("div")
        document.addEventListener('wallet-sync-end', this.render)
        this.render()
    }

    render = () => {
        if (STATE.wollet.neverScanned()) {
            return
        }
        const balance = STATE.wollet.balance()

        updatedAt(STATE.wollet, this.subtitle)
        cleanChilds(this.div)
        this.div.appendChild(mapToTable(balance))
    }
}


class WalletTransactions extends HTMLElement {
    constructor() {
        super()
        this.subtitle = this.querySelector("p")
        this.div = this.querySelector("div")
        document.addEventListener('wallet-sync-end', this.render)
        this.render()
    }

    render = () => {
        if (STATE.wollet.neverScanned()) {
            return
        }
        let transactions = STATE.wollet.transactions()
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

        updatedAt(STATE.wollet, this.subtitle)
        cleanChilds(this.div)
        this.div.appendChild(div)

    }
}


class CreateTransaction extends HTMLElement {
    constructor() {
        super()
        this.selectAssetDiv = this.querySelector("#create-transaction-div-select-asset")
        this.createButton = this.querySelector("#create-transaction-button-create")
        this.createButton.addEventListener("click", this.handleCreate)
        this.busy = this.querySelector("article")
        this.select = this.querySelector("select")
        this.div = this.querySelector("div")
        document.addEventListener('wallet-sync-end', this.render)
        this.render()
    }

    render = () => {
        if (STATE.wollet.neverScanned()) {
            return
        }
        let balance = STATE.wollet.balance()

        cleanChilds(this.select)
        let option = document.createElement("option")
        option.innerText = "Select Asset"
        this.select.appendChild(option)
        balance.forEach((_val, key) => {
            let option = document.createElement("option")
            option.innerText = mapAssetHex(key)
            option.setAttribute("value", key)
            this.select.appendChild(option)
        })

        this.busy.hidden = true
        this.div.hidden = false

    }

    handleCreate = (_e) => {
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

    };
}



class SignTransaction extends HTMLElement {
    constructor() {
        super()

        this.textarea = this.querySelector("#sign-transaction-textarea")
        this.analyzeButton = this.querySelector("#sign-transaction-button-analyze")
        this.signButton = this.querySelector("#sign-transaction-button-sign")
        this.broadcastButton = this.querySelector("#sign-transaction-button-broadcast")
        this.signWarnDiv = this.querySelector("#sign-transaction-div-jade-sign")
        this.signDivBroadcast = this.querySelector("#sign-transaction-div-broadcast")
        this.signJadeTemplate = this.querySelector("#sign-jade-template")
        this.signedJadeTemplate = this.querySelector("#signed-jade-template")
        this.signDivAnalyze = this.querySelector("#sign-transaction-div-analyze")

        this.analyzeButton.addEventListener("click", (_e) => {
            this.renderAnalyze()
        })
        this.signButton.addEventListener("click", this.handleSignClick)

        this.broadcastButton.addEventListener("click", this.handleBroadcastClick)

        if (STATE.pset != null) {
            this.textarea.textContent = STATE.pset.toString()
            STATE.pset = null
        }

        if (STATE.jade == null) {
            this.signButton.hidden = true
        }

        this.renderAnalyze()
    }

    handleBroadcastClick = async (_e) => {
        cleanChilds(this.signWarnDiv)

        let psetString = this.textarea.textContent
        let pset = new lwk.Pset(psetString)
        let psetFinalized = STATE.wollet.finalize(pset)
        setBusyDisabled(this.broadcastButton, true)

        let client = esploraClient()
        let txid = await client.broadcast(psetFinalized)
        setBusyDisabled(this.broadcastButton, false)

        this.signDivBroadcast.innerHTML = `
                <div>
                    <input aria-invalid="false" aria-describedby="broadcasted-description" readonly="true" value="${txid}">
                    <small id="broadcasted-description">Tx broadcasted!</small>
                </div>
                <br><br>
            `
    }

    handleSignClick = async (_e) => {
        let psetString = this.textarea.textContent
        let pset = new lwk.Pset(psetString)
        setBusyDisabled(this.signButton, true)

        const signWarn = this.signJadeTemplate.content.cloneNode(true)
        this.signWarnDiv.appendChild(signWarn)

        let signedPset = await STATE.jade.sign(pset)
        setBusyDisabled(this.signButton, false)

        cleanChilds(this.signWarnDiv)
        const signDone = this.signedJadeTemplate.content.cloneNode(true)
        this.signWarnDiv.appendChild(signDone)

        this.textarea.textContent = signedPset
        this.renderAnalyze()
    }

    renderAnalyze() {
        let psetString = this.textarea.textContent
        if (!psetString) {
            return
        }
        let pset = new lwk.Pset(psetString)
        let details = STATE.wollet.psetDetails(pset)

        cleanChilds(this.signDivAnalyze)
        let hgroup = document.createElement("hgroup");
        hgroup.innerHTML = `
                <h3>Net balance</h3><p>From the perspective of ${STATE.wolletSelected}</p>
            `
        this.signDivAnalyze.appendChild(hgroup)

        var psetBalance = details.balance().balances();
        psetBalance.set("fee", details.balance().fee());
        this.signDivAnalyze.appendChild(mapToTable(psetBalance))

        let h3 = document.createElement("h3");
        h3.innerText = "Signatures"
        this.signDivAnalyze.appendChild(h3)
        const sigMap = new Map();

        let has = details.fingerprintsHas()
        let missing = details.fingerprintsMissing()

        if (has.length > 0) {
            sigMap.set("Has", has)
        }
        if (missing.length > 0) {
            sigMap.set("Missing", missing)
        }

        this.signDivAnalyze.appendChild(mapToTable(sigMap, false, true))
        // TODO issuances
    }
}


class WalletDescriptor extends HTMLElement {
    constructor() {
        super()
        this.textarea = this.querySelector("textarea")
        this.textarea.innerText = STATE.wollet.descriptor().toString()
    }
}


class RegisterWallet extends HTMLElement {
    constructor() {
        super()
        const inputs = this.querySelectorAll("input")
        this.threshold = inputs[0]
        this.keyoriginXpub = inputs[1]  // html node in template doesn't count
        this.addParticipant = inputs[2]
        this.jadeName = inputs[3]
        this.jadeRegisterSuccess = inputs[4]
        this.jadeRegisterFail = inputs[5]
        const buttons = this.querySelectorAll("button")
        this.create = buttons[0]
        this.addJade = buttons[1]
        this.register = buttons[2]
        this.listDiv = this.querySelector("div")
        this.templatePart = this.querySelector("template")
        this.descriptor = this.querySelector("textarea")

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

        setBusyDisabled(this.register, true)
        let result = await STATE.jade.registerDescriptor(jadeName, descriptor)
        setBusyDisabled(this.register, false)

        if (result) {
            this.jadeRegisterSuccess.hidden = false
        } else {
            this.jadeRegisterFail.hidden = false
        }

        console.log(result)
    }

    handleCreate = (_) => {
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
            alert("Threshold cannot be higher than participant")
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
        const jadePart = await STATE.jade.keyoriginXpubBip87()
        this.addValidParticipant(jadePart)
        this.addJade.removeAttribute("aria-busy")
    }

    addValidParticipant = (keyoriginXpub) => {
        const content = this.templatePart.content.cloneNode(true)
        const el = content.querySelector("fieldset")
        console.log(content)
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
customElements.define("receive-address", ReceiveAddress)
customElements.define("ask-address", AskAddress)
customElements.define("wallet-descriptor", WalletDescriptor)
customElements.define("wallet-balance", WalletBalance)
customElements.define("wallet-transactions", WalletTransactions)
customElements.define("create-transaction", CreateTransaction)
customElements.define("sign-transaction", SignTransaction)
customElements.define("register-wallet", RegisterWallet)


function mapToTable(map, firstCode = true, secondCode = false) {
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
        if (firstCode) {
            asset.innerHTML = `<code>${mapAssetHex(key)}</code>`
        } else {
            asset.innerHTML = key
        }
        newRow.appendChild(asset)

        let secondCell = document.createElement("td")
        secondCell.setAttribute("style", "text-align:right")
        if (secondCode) {
            secondCell.innerHTML = `<code>${val}</code>`
        } else {
            secondCell.textContent = val
        }
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
    if (node) {
        const unix_ts = wolletLocal.tip().timestamp()
        node.innerText = "updated at " + new Date(unix_ts * 1000).toLocaleString()
    }
}

function esploraClient() {
    var client
    if (STATE.network.isMainnet()) {
        client = new lwk.EsploraClient("https://esplora.blockstream.com/liquid/api")
    } else {
        client = new lwk.EsploraClient("https://esplora.blockstream.com/liquidtestnet/api")
    }
    return client
}

async function fullScanAndApply(wolletLocal, scanLocal) {

    if (!scanLocal.running) {
        scanLocal.running = true

        document.dispatchEvent(new CustomEvent('wallet-sync-start'))
        let client = esploraClient()

        const update = await client.fullScan(wolletLocal)
        if (update instanceof lwk.Update) {
            const walletStatus = wolletLocal.status()
            wolletLocal.applyUpdate(update)
            if (update.onlyTip()) {
                // this is a shortcut, the restored from persisted state UI won't see "updated at <most recent scan>" but "updated at <most recent scan with tx>".
                // The latter is possible by deleting the previous update if both this and the previous are `onlyTip()` but the 
                // more complex logic is avoided for now
                console.log("avoid persisting only tip update")
            } else {
                console.log("Saving persisted update " + walletStatus)
                const base64 = update.serializeEncryptedBase64(wolletLocal.descriptor())
                localStorage.setItem(walletStatus, base64)
            }
        }
        scanLocal.running = false
        document.dispatchEvent(new CustomEvent('wallet-sync-end'))

    }
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

/// returns the Ticker if the asset id maps to featured ones
function mapAssetHex(assetHex) {
    switch (assetHex) {
        case "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d": return "L-BTC"
        case "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49": return "tL-BTC"
        case "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2": return "USDt"
        case "0e99c1a6da379d1f4151fb9df90449d40d0608f6cb33a5bcbfc8c265f42bab0a": return "LCAD"
        case "18729918ab4bca843656f08d4dd877bed6641fbd596a0a963abbf199cfeb3cec": return "EURx"
        case "78557eb89ea8439dc1a519f4eb0267c86b261068648a0f84a5c6b55ca39b66f1": return "B-JDE"
        case "11f91cb5edd5d0822997ad81f068ed35002daec33986da173461a8427ac857e1": return "BMN1"
        case "52d77159096eed69c73862a30b0d4012b88cedf92d518f98bc5fc8d34b6c27c9": return "EXOeu"
        case "9c11715c79783d7ba09ecece1e82c652eccbb8d019aec50cf913f540310724a6": return "EXOus"
        case "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": return "TEST"

        default: return assetHex
    }
}
