import * as lwk from "lwk_wasm"

// Global state
/* 
STATE.wollet = lwk.Wollet
STATE.wolletSelected possible values: ShWpkh Wpkh, <multisig wallets>
STATE.scan.running bool
STATE.jade = lwk.Jade
STATE.xpub = String
STATE.multiWallets = [String]
STATE.swSigner = lwk.Signer # only for testnet
STATE.scanLoop = interval
STATE.page = String # id of the last rendered page
*/
const STATE = {}
const network = lwk.Network.testnet()

const RANDOM_MNEMONIC_KEY = "random_mnemonic"
const AMP2_DATA_KEY_PREFIX = "amp2_data_v2_"

let requestButton = document.getElementById("request-hid-device");
requestButton.addEventListener("click", async () => {
    let device = await lwk.searchLedgerDevice();
    let ledger = new lwk.LedgerWeb(device)
    let version = await ledger.getVersion()
    console.log(version)
});

let requestButtonXpub = document.getElementById("request-xpub");
requestButtonXpub.addEventListener("click", async () => {
    let device = await lwk.searchLedgerDevice();
    let ledger = new lwk.LedgerWeb(device)
    let xpub = await ledger.deriveXpub("m/49'/1'/0'")
    console.log(xpub)
});

let requestButtonMaster = document.getElementById("request-master");
requestButtonMaster.addEventListener("click", async () => {
    let device = await lwk.searchLedgerDevice();
    let ledger = new lwk.LedgerWeb(device)
    let master = await ledger.slip77MasterBlindingKey()
    console.log(master)
});

let requestButtonFingerprint = document.getElementById("request-fingerprint");
requestButtonFingerprint.addEventListener("click", async () => {
    let device = await lwk.searchLedgerDevice();
    let ledger = new lwk.LedgerWeb(device)
    let fingerprint = await ledger.fingerprint()
    console.log(fingerprint)
});

let requestButtonSign = document.getElementById("request-sign");
requestButtonSign.addEventListener("click", async () => {
    let device = await lwk.searchLedgerDevice();
    let ledger = new lwk.LedgerWeb(device)
    let pset = "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"
    let sign = await ledger.sign(pset)
    console.log(sign)
});

/// Re-enables initially disabled buttons, and add listener to buttons on the first page
/// First page doesn't use components because we want to be loaded before the wasm is loaded, which takes time
async function init() {
    let connectJade = document.getElementById("connect-jade-button")
    let descriptorTextarea = document.getElementById("descriptor-textarea")
    let descriptorMessage = document.getElementById("descriptor-message")
    let exampleDescriptor = document.getElementById("example-descriptor-link")

    connectJade.addEventListener("click", async (_e) => {
        let connectJadeMessage = document.getElementById("connect-jade-message")
        try {
            setBusyDisabled(connectJade, true)

            let filter = !document.getElementById("diy-jade").checked
            console.log("filter out do it yourself " + filter)

            STATE.jade = await new lwk.Jade(network, filter)
            connectJadeMessage.innerHTML = warning("Insert the PIN on the Jade")
            STATE.xpub = await STATE.jade.getMasterXpub() // asking something that requires unlock
            STATE.multiWallets = await STATE.jade.getRegisteredMultisigs()
            document.dispatchEvent(new CustomEvent('jade-initialized'))
        } catch (e) {
            // TODO network is the most common error but we can have other error,
            // should indeed take the error message from e instead of a static value
            connectJadeMessage.innerHTML = warning(e)
            setBusyDisabled(connectJade, false)
        }
    })

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

    document.getElementById("loading-wasm").setAttribute("style", "visibility: hidden;") // by using visibility we avoid layout shifts

    let randomWalletButton = document.getElementById("random-wallet-button");
    if (!network.isMainnet()) {
        document.getElementById("random-wallet-div").hidden = false
        randomWalletButton.disabled = false
        randomWalletButton.addEventListener("click", (_e) => {

            let mnemonicFromCookie = localStorage.getItem(RANDOM_MNEMONIC_KEY)
            var randomMnemonic
            if (mnemonicFromCookie == null) {
                randomMnemonic = lwk.Mnemonic.fromRandom(12)
                localStorage.setItem(RANDOM_MNEMONIC_KEY, randomMnemonic.toString())
            } else {
                try {
                    randomMnemonic = new lwk.Mnemonic(mnemonicFromCookie)
                } catch {
                    randomMnemonic = lwk.Mnemonic.fromRandom(12)
                    localStorage.setItem(RANDOM_MNEMONIC_KEY, randomMnemonic.toString())
                }
            }
            STATE.swSigner = new lwk.Signer(randomMnemonic, network)
            let desc = STATE.swSigner.wpkhSlip77Descriptor()

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

        STATE.wollet = new lwk.Wollet(network, descriptor)
        STATE.wolletSelected = "Descriptor"
        STATE.scan = { running: false }
        loadPersisted(STATE.wollet)

        document.dispatchEvent(new CustomEvent('wallet-selected'))

        await fullScanAndApply(STATE.wollet, STATE.scan)
    } catch (e) {
        descriptorMessage.innerHTML = warning(e)
    }
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
        if (STATE.jade != null) {
            const jadeIdentifier = STATE.xpub.fingerprint()
            footer += `<span> | </span><span><code>${jadeIdentifier}</code></span>`
        }
        if (STATE.wolletSelected != null) {
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

        this.render()

        this.addEventListener("click", this.handleClick)

        document.addEventListener('jade-initialized', this.render)
        document.addEventListener('wallet-sync-end', this.render)
        document.addEventListener('wallet-sync-start', this.render)

        document.addEventListener('wallet-selected', (event) => {
            scanLoop()
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

        document.addEventListener('contact-clicked', (event) => {
            this.renderPage("contact-page")
        })

        document.addEventListener('reload-page', (event) => {
            if (STATE.page != null) {
                if (STATE.page == "balance-page" || STATE.page == "transactions-page") {
                    this.renderPage(STATE.page)
                }
            }
        })
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
        STATE.page = id
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
        STATE.wollet = new lwk.Wollet(network, descriptor)
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
        this.messageDiv = this.querySelector("div.message")

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

        if (STATE.jade == null) {
            setBusyDisabled(this.button, false)
            this.messageDiv.innerHTML = warning("Address generated without double checking with the Jade are risky!")
            return
        }
        this.messageDiv.innerHTML = warning("Check the address on the Jade!")
        var jadeAddress
        if (STATE.wolletSelected === "Wpkh" || STATE.wolletSelected === "ShWpkh") {
            // FIXME it breakes if someone call his registered wallet "Wpkh" or "ShWpkh"
            let fullPath = STATE.wollet.addressFullPath(index)
            let variant = lwk.Singlesig.from(STATE.wolletSelected)
            jadeAddress = await STATE.jade.getReceiveAddressSingle(variant, fullPath)
        } else {
            // 0 means external chain
            jadeAddress = await STATE.jade.getReceiveAddressMulti(STATE.wolletSelected, [0, index])
        }


        console.assert(jadeAddress == address.address().toString(), "local and jade address are different!")
        this.messageDiv.hidden = true
        setBusyDisabled(this.button, false)
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
        this.faucetRequest = this.querySelector("button")
        document.addEventListener('wallet-sync-end', this.render)
        this.faucetRequest.addEventListener('click', this.handleFaucetRequest)
        this.messageDiv = this.querySelector("div.message")

        this.render()
    }

    handleFaucetRequest = async () => {
        this.faucetRequest.hidden = true
        const address = STATE.wollet.address(null).address().toString()
        const url = `https://liquidtestnet.com/api/faucet?address=${address}&action=lbtc`
        console.log(url)
        this.messageDiv.innerHTML = success("Sending request to the faucet...")
        await fetch(url, { mode: "no-cors" })
        this.messageDiv.innerHTML = success("Request sent to the faucet, wait a bit to see funds")
    }

    render = () => {
        if (STATE.wollet.neverScanned()) {
            return
        }
        const balance = STATE.wollet.balance()

        const lbtc = balance.get(network.policyAsset().toString())
        if (lbtc == 0 && !network.isMainnet()) {
            this.faucetRequest.hidden = false
        }

        updatedAt(STATE.wollet, this.subtitle)

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
        document.addEventListener('wallet-sync-end', this.render)
        this.render()
    }

    render = () => {
        if (STATE.wollet.neverScanned()) {
            return
        }
        let transactions = STATE.wollet.transactions()
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

        updatedAt(STATE.wollet, this.subtitle)
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
        this.select = this.querySelector("select")
        this.div = this.querySelector("div")
        const inputs = this.querySelectorAll("input")
        this.addressInput = inputs[0]
        this.satoshisInput = inputs[1]
        this.addRecipient = inputs[2]
        this.addRecipient.addEventListener("click", this.handleAdd)

        this.assetInput = this.querySelector("select")
        this.message = this.querySelector("div.message")
        this.messageCreate = this.querySelector("div.messageCreate")

        this.template = this.querySelector("template")
        this.listRecipients = this.querySelector("div.recipients")

        let issuanceSection = this.querySelector("details")
        if (network.isMainnet()) {
            issuanceSection.hidden = true
        } else {
            this.issueButton = issuanceSection.querySelector("button")
            this.issueButton.addEventListener("click", this.handleIssue)
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
        }

        this.render()
    }

    handleIssue = (e) => {
        e.preventDefault()
        // Get form and validate using built-in HTML5 validation
        const form = e.target.form

        // initIssuanceForm() // TODO: mockup data, remove this

        if (!form.checkValidity()) {
            form.reportValidity()
            return
        }

        try {
            var builder = new lwk.TxBuilder(network)

            const assetAddr = new lwk.Address(this.assetAddress.value)
            const tokenAddr = this.tokenAmount.value > 0 ? new lwk.Address(this.tokenAddress.value) : null
            const contract = new lwk.Contract(
                this.domain.value,
                this.pubkey.value,
                this.name.value,
                parseInt(this.precision.value),
                this.ticker.value,
                0,
            )

            builder = builder.issueAsset(
                this.assetAmount.value,
                assetAddr,
                this.tokenAmount.value,
                tokenAddr,
                contract
            )
            STATE.pset = builder.finish(STATE.wollet)

            this.dispatchEvent(new CustomEvent('pset-ready', {
                bubbles: true,
            }))

        } catch (e) {
            this.messageIssuance.innerHTML = warning(e)
            return
        }

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
            option.innerText = mapAssetTicker(key)
            option.setAttribute("value", key)
            this.select.appendChild(option)
        })

        this.busy.hidden = true
        this.div.hidden = false

    }

    handleCreate = (_e) => {

        this.messageCreate.innerHTML = ""
        // verify at least 1 row

        const inputsEmpty = this.checkEmptyness(false)
        if (inputsEmpty.length == 0) {
            this.messageCreate.innerHTML = warning("Click '+' to add the output")
            return
        }

        const recipients = Array.from(this.querySelectorAll("fieldset.recipients"))
        if (recipients.length == 0) {
            this.messageCreate.innerHTML = warning("Cannot create a transaction with no recipients")
            return
        }



        try {
            var builder = new lwk.TxBuilder(network)

            for (const recipient of recipients) {
                // inputs already validated during add phase
                const recipientAddress = new lwk.Address(recipient.querySelector("input.address").value)
                const recipientAsset = new lwk.AssetId(recipient.querySelector("input.assetid").value)
                const satoshis = parsePrecision(recipientAsset.toString(), recipient.querySelector("input.amount").value)

                builder = builder.addRecipient(recipientAddress, satoshis, recipientAsset)
            }
            STATE.pset = builder.finish(STATE.wollet)
        } catch (e) {
            this.messageCreate.innerHTML = warning(e)
            return
        }

        this.dispatchEvent(new CustomEvent('pset-ready', {
            bubbles: true,
        }))



    }

    checkEmptyness = (setAria) => {
        var inputsEmpty = []
        for (const element of [this.addressInput, this.satoshisInput, this.assetInput]) {
            if (element.value === "" || (element.name == "asset" && element.value === "Select Asset")) {
                if (setAria) {
                    element.setAttribute("aria-invalid", true)
                }
                inputsEmpty.push(element.name)
            }
        }
        return inputsEmpty

    }

    handleAdd = (_e) => {
        this.listRecipients.hidden = false
        this.message.innerHTML = ""
        this.messageCreate.innerHTML = ""

        var inputsValid = ""

        const inputsEmpty = this.checkEmptyness(true)
        if (inputsEmpty.length > 0) {
            this.message.innerHTML = warning(inputsEmpty.join(", ") + " cannot be empty")
            return
        }

        /// Other validations such as valid address
        this.addressInput.setAttribute("aria-invalid", false)
        var recipientAddress
        try {
            recipientAddress = new lwk.Address(this.addressInput.value)
            if (!recipientAddress.isBlinded()) {
                throw new Error('Address is not confidential')
            }
            if (network.isMainnet() != recipientAddress.isMainnet()) {
                throw new Error("Invalid address network")
            }
        } catch (e) {
            this.addressInput.setAttribute("aria-invalid", true)
            inputsValid += e.toString() + ". "
        }

        this.assetInput.setAttribute("aria-invalid", false)
        var recipientAsset
        try {
            recipientAsset = new lwk.AssetId(this.assetInput.value)
        } catch (_e) {
            this.assetInput.setAttribute("aria-invalid", true)
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
        inputs[2].value = mapAssetTicker(this.assetInput.value) // value seen
        inputs[3].value = this.assetInput.value                 // value used
        inputs[4].addEventListener("click", (_e) => {
            this.listRecipients.removeChild(el)
        })
        this.listRecipients.appendChild(content)
        // end add recipient row

        // Reset fields
        this.addressInput.value = ""
        this.satoshisInput.value = ""
        this.assetInput.value = "Select Asset"
        this.addressInput.removeAttribute("aria-invalid")
        this.satoshisInput.removeAttribute("aria-invalid")
        this.assetInput.removeAttribute("aria-invalid")
        // end reset fields
    }
}



class SignTransaction extends HTMLElement {
    constructor() {
        super()

        const textareas = this.querySelectorAll("textarea")
        this.textarea = textareas[0]
        this.mnemonic = textareas[1]
        this.combineTextarea = textareas[2]
        this.analyzeButton = this.querySelector("button.analyze")
        this.signButton = this.querySelector("button.sign")
        this.cosignButton = this.querySelector("button.cosign")
        this.signWithJadeButton = this.querySelector("button.sign-with-jade")

        this.softwareSignButton = this.querySelector("button.ss")
        this.broadcastButton = this.querySelector("button.broadcast")
        this.combineButton = this.querySelector("button.combine")

        this.messageDiv = this.querySelector("div.message")
        this.signDivAnalyze = this.querySelector("div.analyze")
        this.recipientsDiv = this.querySelector("div.recipients")

        const details = this.querySelectorAll("details")
        this.signDetails = details[0]

        this.signDetails.hidden = network.isMainnet()

        this.analyzeButton.addEventListener("click", (_e) => {
            this.renderAnalyze()
        })
        this.signButton.addEventListener("click", this.handleSignClick)
        this.cosignButton.addEventListener("click", this.handleCosignClick)

        this.broadcastButton.addEventListener("click", this.handleBroadcastClick)

        this.combineButton.addEventListener("click", this.handleCombineClick)

        this.softwareSignButton.addEventListener("click", this.handleSoftwareSignClick)

        this.signWithJadeButton.addEventListener("click", this.handleSignWithJadeClick)

        if (STATE.pset != null) {
            this.textarea.value = STATE.pset.toString()
            STATE.pset = null
        }

        if (STATE.jade == null) {
            this.signButton.hidden = true
        }

        if (STATE.swSigner != null) {
            this.mnemonic.value = STATE.swSigner.mnemonic()
            this.mnemonic.disabled = true
        }

        if (STATE.jade == null && STATE.swSigner == null) {
            this.signWithJadeButton.hidden = false
        }

        this.renderAnalyze()
    }

    handleSignWithJadeClick = async (_e) => {
        setBusyDisabled(this.signWithJadeButton, true)
        try {
            let psetString = this.textarea.value
            let pset = new lwk.Pset(psetString)
            let jade = await new lwk.Jade(network, true)
            let signedPset = await jade.sign(pset)
            this.textarea.value = signedPset
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.signWithJadeButton, false)
        }
    }

    handleSoftwareSignClick = async (_e) => {
        setBusyDisabled(this.softwareSignButton, true)
        try {
            let psetString = this.textarea.value
            let pset = new lwk.Pset(psetString)

            let mnemonicStr = this.mnemonic.value
            let mnemonic = new lwk.Mnemonic(mnemonicStr)

            let signer = new lwk.Signer(mnemonic, network)
            let signedPset = signer.sign(pset)

            this.textarea.value = signedPset
            this.renderAnalyze()
            this.messageDiv.innerHTML = success("Transaction signed!")

        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())

        }
        setBusyDisabled(this.softwareSignButton, false)
    }

    handleBroadcastClick = async (_e) => {
        try {
            let psetString = this.textarea.value
            let pset = new lwk.Pset(psetString)
            let psetFinalized = STATE.wollet.finalize(pset)
            let tx = psetFinalized.extractTx().toString()
            console.log("broadcasting:")
            console.log(tx)
            setBusyDisabled(this.broadcastButton, true)
            let client = esploraClient()
            let txid = await client.broadcast(psetFinalized)
            this.messageDiv.innerHTML = success(txid, "Tx broadcasted!")
        } catch (e) {
            this.messageDiv.innerHTML = warning("Cannot broadcast tx, is it signed?")
        }
        setBusyDisabled(this.broadcastButton, false)
    }

    handleSignClick = async (_e) => {
        let psetString = this.textarea.value
        let pset = new lwk.Pset(psetString)
        setBusyDisabled(this.signButton, true)

        this.messageDiv.innerHTML = warning("Check the transactions on the Jade")

        let signedPset = await STATE.jade.sign(pset)
        setBusyDisabled(this.signButton, false)

        this.messageDiv.innerHTML = success("Transaction signed!")

        this.textarea.value = signedPset
        this.renderAnalyze()
    }


    handleCosignClick = async (_e) => {
        let psetString = this.textarea.value
        let pset = new lwk.Pset(psetString)
        setBusyDisabled(this.cosignButton, true)

        let amp2 = lwk.Amp2.new_testnet()

        try {
            let signedPset = await amp2.cosign(pset)
            this.messageDiv.innerHTML = success("Transaction cosigned!")
            this.textarea.value = signedPset
            this.renderAnalyze()
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        } finally {
            setBusyDisabled(this.cosignButton, false)
        }

    }


    handleCombineClick = async (_e) => {
        const pset1Str = this.textarea.value
        const pset2Str = this.combineTextarea.value
        try {
            if (pset1Str === "" || pset2Str === "") {
                throw new Error("Both PSET must be non-empty")
            }
            const pset1 = new lwk.Pset(pset1Str)
            const pset2 = new lwk.Pset(pset2Str)
            pset1.combine(pset2)
            this.textarea.value = pset1
            this.combineTextarea.value = ""
            this.renderAnalyze()

            this.messageDiv.innerHTML = success("PSET combined!")
        } catch (e) {
            this.messageDiv.innerHTML = warning(e.toString())
        }
    }

    renderAnalyze() {
        this.messageDiv.innerHTML = ""
        let psetString = this.textarea.value
        if (!psetString) {
            return
        }
        let pset = new lwk.Pset(psetString)
        let details = STATE.wollet.psetDetails(pset)

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
            recipientsMap.set(recipient.address().toString() + " " + mapAssetTicker(recipient.asset().toString()), recipient.value().toString())
        }
        this.recipientsDiv.innerHTML = "<h3>Recipients</h3>"
        this.recipientsDiv.appendChild(mapToTable(recipientsMap))


        // TODO issuances
    }
}

function scanLoop() {
    if (STATE.scanLoop == null) {
        STATE.scanLoop = setInterval(
            async function () {
                await fullScanAndApply(STATE.wollet, STATE.scan)
                // TODO dispatch only on effective change
                window.dispatchEvent(new CustomEvent("reload-page"))
            },
            10000
        )
    }
}
function stopScanLoop() {
    if (STATE.scanLoop != null) {
        clearInterval(STATE.scanLoop)
    }
}

class WalletDescriptor extends HTMLElement {
    constructor() {
        super()
        this.textarea = this.querySelector("textarea")
        this.quickLink = this.querySelector("a")

        let descriptor = STATE.wollet.descriptor().toString()
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

    render = async (_) => {
        let keyoriginXpub = await keyoriginXpubUnified(lwk.Bip.bip87());
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
            }

            this.render()
        }
    }

    render = async (_) => {
        for (let i = 0; i < 3; i++) {
            this.textareas[i].value = await keyoriginXpubUnified(this.bips[i]);
        }
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
            let result = await STATE.jade.registerDescriptor(jadeName, descriptor)
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
        const jadePart = await STATE.jade.keyoriginXpubBip87()
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
customElements.define("receive-address", ReceiveAddress)
customElements.define("ask-address", AskAddress)
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
            return `<code>${value}</code>`
        } catch (_) {
            return value
        }
    }
}

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

        asset.innerHTML = useCodeIfNecessary(mapAssetTicker(key))

        newRow.appendChild(asset)

        let secondCell = document.createElement("td")
        secondCell.setAttribute("style", "text-align:right")

        secondCell.innerHTML = useCodeIfNecessary(val)

        newRow.appendChild(secondCell)
    })
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

function esploraClient() {
    const mainnetUrl = "https://waterfalls.liquidwebwallet.org/liquid/api"
    const testnetUrl = "https://waterfalls.liquidwebwallet.org/liquidtestnet/api"
    const url = network.isMainnet() ? mainnetUrl : testnetUrl
    const client = new lwk.EsploraClient(network, url, true)
    client.set_waterfalls_server_recipient("age1xxzrgrfjm3yrwh3u6a7exgrldked0pdauvr3mx870wl6xzrwm5ps8s2h0p");
    return client
}

async function keyoriginXpubUnified(bip) {
    if (STATE.jade != null) {
        return await
            STATE.jade.keyoriginXpub(bip)
    } else if (STATE.swSigner != null) {
        return STATE.swSigner.keyoriginXpub(bip)
    } else {
        return null
    }
}

async function fullScanAndApply(wolletLocal, scanLocal) {

    if (!scanLocal.running) {
        scanLocal.running = true

        document.dispatchEvent(new CustomEvent('wallet-sync-start'))
        let client = esploraClient()

        var update = await client.fullScan(wolletLocal)
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
    if (STATE.jade != null)
        return STATE.jade
    else if (STATE.swSigner != null)
        return STATE.swSigner
    else
        return null
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
    switch (assetHex) {
        case "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d": return ["L-BTC", 8]
        case "fee": return ["fee", 8]
        case "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49": return ["tL-BTC", 8]

        case "ce091c998b83c78bb71a632313ba3760f1763d9cfcffae02258ffa9865a37bd2": return ["USDt", 8]
        case "0e99c1a6da379d1f4151fb9df90449d40d0608f6cb33a5bcbfc8c265f42bab0a": return ["LCAD", 8]
        case "18729918ab4bca843656f08d4dd877bed6641fbd596a0a963abbf199cfeb3cec": return ["EURx", 8]
        case "78557eb89ea8439dc1a519f4eb0267c86b261068648a0f84a5c6b55ca39b66f1": return ["B-JDE", 0]
        case "11f91cb5edd5d0822997ad81f068ed35002daec33986da173461a8427ac857e1": return ["BMN1", 2]
        case "52d77159096eed69c73862a30b0d4012b88cedf92d518f98bc5fc8d34b6c27c9": return ["EXOeu", 0]
        case "9c11715c79783d7ba09ecece1e82c652eccbb8d019aec50cf913f540310724a6": return ["EXOus", 0]
        case "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": return ["TEST", 3] // testnet

        case "26ac924263ba547b706251635550a8649545ee5c074fe5db8d7140557baaf32e": return ["MEX", 8]

        default: return [assetHex, 0]
    }
}

function encodeRFC3986URIComponent(str) {
    return encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}
