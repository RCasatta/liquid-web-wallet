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
    let xpub = await ledger.deriveXpub("m/44'/1'/0'")
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
    let pset = "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";
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
