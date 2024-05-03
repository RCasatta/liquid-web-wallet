import * as lwk from "lwk_wasm"

// Global state

var network = lwk.Network.mainnet()
var jade
var wolletSelected /*string*/
var pset

var wollet = {}
var scan = {}
var address = {}

document.getElementById("loading-wasm").remove()

class WalletHome extends HTMLElement {
    constructor() {
        super()
        this.innerHTML = "<div></div>"
    }

    connectedCallback() {
        const template = document.getElementById(
            "home-template",
        ).content.cloneNode(true)
        this.querySelector("div").appendChild(template)

    }
}


class NetworkSelector extends HTMLElement {
    constructor() {
        super()
        this.innerHTML = "<div></div>"
    }

    connectedCallback() {
        const template = document.getElementById(
            "network-selector-template",
        ).content.cloneNode(true)
        this.querySelector("div").appendChild(template)

        const radios = ["#radio-1", "#radio-2"]
        for (var i = 0, max = radios.length; i < max; i++) {
            let radio = this.querySelector(radios[i])
            radio.addEventListener('input', (event) => {
                if (radio.checked && radio.value == "Liquid") {
                    network = lwk.Network.mainnet()
                } else if (radio.checked && radio.value == "LiquidTestnet") {
                    network = lwk.Network.testnet()
                }
                this.dispatchEvent(new CustomEvent('network-change', {
                    bubbles: true,
                }))
            })
            document.addEventListener('jade-initialized', (event) => {
                this.remove()
            })
        }
    }
}


class NetworkSelected extends HTMLElement {
    constructor() {
        super()

        this.render()

        document.addEventListener('network-change', (event) => {
            this.render()
        })
    }

    render() {
        this.innerHTML = `
            <span> | </span><span>${network}</span>
        `
    }
}


class ConnectJade extends HTMLElement {
    constructor() {
        super()

        this.render()
        let connectJade = this.querySelector("button")

        connectJade.addEventListener("click", async (event) => {
            if (jade == null) {
                connectJade.setAttribute("aria-busy", true)
                connectJade.disabled = true
                jade = await new lwk.Jade(network, true) // pass false if you don't see your DYI Jade

                const insertPinMessage = document.getElementById("insert-pin-template").content.cloneNode(true)
                this.appendChild(insertPinMessage)
                const _xpub = await jade.getMasterXpub(); // asking something that requires unlock

                this.dispatchEvent(new CustomEvent('jade-initialized', {
                    bubbles: true,
                }))

                this.remove()
            } else {
                alert("Jade already connected")
            }

        }, false)
    }

    render() {
        this.innerHTML = "<p><button>Connect to Jade</button></p>"
    }
}


class JadeFingerprint extends HTMLElement {
    constructor() {
        super()

        document.addEventListener('jade-initialized', async (event) => {
            const xpub = await jade.getMasterXpub();
            const jadeIdentifier = xpub.fingerprint()
            this.innerHTML = `
                <span> | </span><code>${jadeIdentifier}</code>
            `
        })
    }
}


class MyNav extends HTMLElement {
    constructor() {
        super()

        this.render()

        this.addEventListener("click", (event) => {
            let id = event.target.id
            if (id == "disconnect") {
                location.reload()
                return
            }
            if (id == "") {
                id = "wallets-page"
            }

            this.renderPage(id)

        })

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

    renderPage(id) {
        const template = document.getElementById(id + "-template").content.cloneNode(true)

        cleanChilds(app)
        app.appendChild(template)
    }

    render() {

        if (jade == null) {
            this.innerHTML = "<br><br>"
        } else {

            if (wolletSelected == null) {
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
        this.innerHTML = "<div></div>"
    }

    connectedCallback() {
        // TODO hide until jade unlocked
        const template = document.getElementById(
            "wallets-selector-template",
        ).content.cloneNode(true)
        this.querySelector("div").appendChild(template)

        let walletSelector = this.querySelector("select")

        walletSelector.onchange = async () => {
            wolletSelected = walletSelector.value
            var descriptor
            if (wolletSelected == "Wpkh") {
                descriptor = await jade.wpkh()
            } else if (wolletSelected == "ShWpkh") {
                descriptor = await jade.shWpkh()
            } else {
                throw new Error('Unexpected wallet selector value!');
            }
            wollet[wolletSelected] = new lwk.Wollet(network, descriptor)
            this.dispatchEvent(new CustomEvent('wallet-selected', {
                bubbles: true,
            }))
        }
    }
}


class WalletSelected extends HTMLElement {
    constructor() {
        super()

        document.addEventListener('wallet-selected', async (event) => {
            this.render()
            if (scan[wolletSelected] == null) {
                await fullScanAndApply()
            }
            this.dispatchEvent(new CustomEvent('wallet-sync-end', {
                bubbles: true,
            }))
        })
    }

    render() {
        if (wollet != null) {
            this.innerHTML = `
                <span> | </span> <span>${wolletSelected}</span>
            `
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
            address[wolletSelected] = wollet[wolletSelected].address(null)
            let index = address[wolletSelected].index()
            let fullPath = wollet[wolletSelected].addressFullPath(index)
            let variant = lwk.Singlesig.from(wolletSelected)

            this.dispatchEvent(new CustomEvent('address-asked', {
                bubbles: true,
            }))

            let jadeAddress = await jade.getReceiveAddressSingle(variant, fullPath)

            console.assert(jadeAddress == address[wolletSelected].address().toString(), "local and jade address are different!")

            button.setAttribute("aria-busy", false)
            button.disabled = false
        })
    }

    render() {
        this.innerHTML = "<p><button>Show on Jade</button></p>"
    }
}

class ReceiveAddress extends HTMLElement {
    constructor() {
        super()

        this.render()

        document.addEventListener('address-asked', (event) => {
            this.render()
        })
    }

    render() {
        if (address[wolletSelected] != null) {
            let addr = address[wolletSelected].address()
            this.innerHTML = `
                <div style="word-break: break-word"><code>${addr.toString()}</code></div><br>
                <img src="${addr.QRCodeUri(null)}" width="250px" style="image-rendering: pixelated; border: 20px solid white;"></img>
            `
        } else {
            this.innerHtml = "<p>&nbsp;</p>"
        }
    }
}

class WalletBalance extends HTMLElement {
    constructor() {
        super()
    }
    connectedCallback() {
        this.render()

        document.addEventListener('wallet-sync-end', (event) => {
            this.render()
        })
    }

    render() {
        let ready = scan[wolletSelected]

        if (ready != null && !(ready instanceof Promise)) {
            let balance = wollet[wolletSelected].balance()
            this.innerHTML = ""
            this.appendChild(mapToTable(balance))
        } else {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
        }
    }
}


class WalletTransactions extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        this.render()

        document.addEventListener('wallet-sync-end', (event) => {
            this.render()
        })
    }

    render() {
        let ready = scan[wolletSelected]
        if (ready != null && !(ready instanceof Promise)) {
            let transactions = wollet[wolletSelected].transactions()
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
                    <code><a href="${val.unblindedUrl(network.defaultExplorerUrl())}" target="_blank">${val.txid()}</a></code>
                `
                let txType = document.createElement("td")
                txType.innerHTML = `
                    <span>${val.txType()}</span>
                `
                let height = document.createElement("td")
                height.innerHTML = `
                    <span>${val.height()}</span>
                `
                height.setAttribute("style", "text-align:right")

                newRow.appendChild(txid)
                newRow.appendChild(txType)
                newRow.appendChild(height)
            });
            this.appendChild(div)
        } else {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
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

        document.addEventListener('wallet-sync-end', (event) => {
            this.render()
        })
    }

    render() {
        let ready = scan[wolletSelected]
        if (ready != null && !(ready instanceof Promise)) {

            let balance = wollet[wolletSelected].balance()
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

            createButton.addEventListener("click", (_event) => {
                let addressInput = document.getElementById("create-transaction-input-address").value
                let satoshisInput = document.getElementById("create-transaction-input-satoshis").value
                let assetInput = document.getElementById("create-transaction-input-asset").value

                // TODO validation of inputs

                let recipientAddress = new lwk.Address(addressInput)
                let recipientAsset = new lwk.AssetId(assetInput)

                var builder = new lwk.TxBuilder(network);
                builder = builder.addRecipient(recipientAddress, satoshisInput, recipientAsset)

                pset = builder.finish(wollet[wolletSelected])

                this.dispatchEvent(new CustomEvent('pset-ready', {
                    bubbles: true,
                }))

            })

            cleanChilds(this.querySelector("div"))
            this.querySelector("div").appendChild(template)

        } else {
            this.querySelector("div").innerHTML = "<article aria-busy=\"true\"></article>"
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

        if (pset != null) {
            template.getElementById('sign-transaction-textarea').textContent = pset.toString()
        }

        const analyzeButton = template.getElementById('sign-transaction-button-analyze')
        analyzeButton.addEventListener("click", (_event) => {
            this.renderAnalyze()

        })

        const signButton = template.getElementById('sign-transaction-button-sign')
        signButton.addEventListener("click", async (_event) => {
            let psetString = document.getElementById('sign-transaction-textarea').textContent
            let pset = new lwk.Pset(psetString)
            signButton.setAttribute("aria-busy", true)
            signButton.disabled = true
            let signedPset = await jade.sign(pset)
            signButton.setAttribute("aria-busy", false)
            signButton.disabled = false
            document.getElementById('sign-transaction-textarea').textContent = signedPset
            this.renderAnalyze()
        })

        const broadcastButton = template.getElementById('sign-transaction-button-broadcast')
        broadcastButton.addEventListener("click", async (_event) => {
            let psetString = document.getElementById('sign-transaction-textarea').textContent
            let pset = new lwk.Pset(psetString)
            let psetFinalized = wollet[wolletSelected].finalize(pset)
            broadcastButton.setAttribute("aria-busy", true)
            broadcastButton.disabled = true
            let client = network.defaultEsploraClient()
            let txid = await client.broadcast(psetFinalized)
            broadcastButton.setAttribute("aria-busy", false)
            broadcastButton.disabled = false
            document.getElementById('sign-transaction-div-broadcast').textContent = "tx broadcasted: " + txid
        })

        cleanChilds(this)
        this.appendChild(template)
        this.renderAnalyze()

    }

    renderAnalyze() {
        let psetString = document.getElementById('sign-transaction-textarea').textContent
        if (psetString) {
            let pset = new lwk.Pset(psetString)
            let details = wollet[wolletSelected].psetDetails(pset)

            let div = document.getElementById('sign-transaction-div-analyze')
            cleanChilds(div)
            let hgroup = document.createElement("hgroup");
            hgroup.innerHTML = `
                <h3>Net balance</h3><p>From the perspective of ${wolletSelected}</p>
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
customElements.define("wallet-home", WalletHome)
customElements.define("network-selector", NetworkSelector)
customElements.define("network-selected", NetworkSelected)
customElements.define("connect-jade", ConnectJade)
customElements.define("jade-fingerprint", JadeFingerprint)
customElements.define("wallet-selected", WalletSelected)
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


async function fullScanAndApply() {
    let client = network.defaultEsploraClient()

    scan[wolletSelected] = client.fullScan(wollet[wolletSelected])
    scan[wolletSelected] = await scan[wolletSelected]
    wollet[wolletSelected].applyUpdate(scan[wolletSelected])

}

function cleanChilds(comp) {
    while (comp.firstChild) {
        comp.firstChild.remove()
    }
}

function mapAssetHex(assetHex) {
    switch (assetHex) {
        case "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d": return "L-BTC"
        case "144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49": return "tL-BTC"
        default: return assetHex
    }
}