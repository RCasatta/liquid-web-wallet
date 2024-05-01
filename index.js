import * as lwk from "lwk_wasm"

// Global state

var network = lwk.Network.mainnet()
var jade
var wolletSelected /*string*/

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

        this.addEventListener("click", async (event) => {
            if (jade == null) {
                connectJade.setAttribute("aria-busy", true)
                jade = await new lwk.Jade(network, true) // pass false if you don't see your DYI Jade
                // jade.unlock()
                // jade = await FakeAPI.create()

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
            this.innerHTML = `
                <span> | </span><mark>Unlock Jade</mark>
            `
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

            const template = document.getElementById(id + "-template").content.cloneNode(true)

            while (app.firstChild) {
                app.firstChild.remove()
            }
            app.appendChild(template)

        })

        document.addEventListener('jade-initialized', (event) => {
            this.render()
        })


        document.addEventListener('wallet-selected', (event) => {
            this.render()
        })
    }

    render() {

        if (jade == null) {
            this.innerHTML = "<p>&nbsp;</p>"
        } else {

            if (wolletSelected == null) {
                this.innerHTML = "<p>&nbsp;</p>"
                this.dispatchEvent(new Event("click"))
            } else {
                this.innerHTML = `
                    <a href="#" id="wallets-page">Wallets</a> |
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
                descriptor = await jade.sh_wpkh()
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
            await startSync()
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

            let div = document.createElement("div")
            div.setAttribute("class", "overflow-auto")
            let table = document.createElement("table")
            table.setAttribute("class", "striped")
            div.appendChild(table)
            // for (let key in balance) {
            balance.forEach((val, key) => {
                let newRow = document.createElement("tr")
                table.appendChild(newRow)

                let firstCell = document.createElement("td")
                firstCell.textContent = key
                newRow.appendChild(firstCell)

                let secondCell = document.createElement("td")
                secondCell.setAttribute("style", "text-align:right")
                secondCell.textContent = val
                newRow.appendChild(secondCell)
            });
            this.appendChild(div)
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

                let firstCell = document.createElement("td")
                firstCell.innerHTML = `
                    <a href="${val.unblindedUrl(network.defaultExplorerUrl())}" target="_blank">${val.txid()}</a>
                `
                newRow.appendChild(firstCell)
            });
            this.appendChild(div)
        } else {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
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

async function startSync() {
    let client = network.defaultEsploraClient()

    scan[wolletSelected] = client.fullScan(wollet[wolletSelected])
    scan[wolletSelected] = await scan[wolletSelected]
    wollet[wolletSelected].applyUpdate(scan[wolletSelected])

}
