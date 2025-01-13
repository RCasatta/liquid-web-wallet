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

            let mnemonicFromCookie = localStorage.getItem("random_mnemonic")
            var randomMnemonic
            if (mnemonicFromCookie == null) {
                randomMnemonic = lwk.Mnemonic.fromRandom(12)
                localStorage.setItem("random_mnemonic", randomMnemonic.toString())
            } else {
                try {
                    randomMnemonic = new lwk.Mnemonic(mnemonicFromCookie)
                } catch {
                    randomMnemonic = lwk.Mnemonic.fromRandom(12)
                    localStorage.setItem("random_mnemonic", randomMnemonic.toString())
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
                    <a href="#" id="sign-page">PSET</a> |
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

            builder = builder.enableCtDiscount()

            const assetAddr = new lwk.Address(this.assetAddress.value)
            const tokenAddr = new lwk.Address(this.tokenAddress.value)
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

            builder = builder.enableCtDiscount()

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

        this.softwareSignButton = this.querySelector("button.ss")
        this.broadcastButton = this.querySelector("button.broadcast")
        this.combineButton = this.querySelector("button.combine")

        this.messageDiv = this.querySelector("div.message")
        this.signDivAnalyze = this.querySelector("div.analyze")
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

        this.renderAnalyze()
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
        let uuid_descriptor = localStorage.getItem("amp2_data_" + keyoriginXpub)
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
            localStorage.setItem("amp2_data_" + keyoriginXpub, uuid_descriptor)
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


// TODO: remove me
function initIssuanceForm() {
    const form = document.querySelector('create-transaction details form');
    if (!form) return;

    // Sample data that meets validation requirements
    const mockData = {
        asset_amount: 1000,
        asset_address: "tlq1qqw4c6fpq7luwl7ka9rdrgtgef3nycm5dw85h0tz4sezvd9svh28p055pq2sj6g6ka5veatxnyhgcx2rlzhx0sns7dec5wz6ug",
        token_amount: 1,
        token_address: "tlq1qqw4c6fpq7luwl7ka9rdrgtgef3nycm5dw85h0tz4sezvd9svh28p055pq2sj6g6ka5veatxnyhgcx2rlzhx0sns7dec5wz6ug",
        domain: "example.com",
        name: "Example Asset Token",  // min 5 chars, max 255
        ticker: "EAT",               // min 3 chars, max 5
        precision: 8,                // min 0, max 8
        pubkey: "02c095d069538f96bf14c5f90f6c0851bdf354a0ec86039a24bf38a73f705adc2c" // sample public key
    };

    // Set values for each form input
    Object.entries(mockData).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = value;
        }
    });
}
