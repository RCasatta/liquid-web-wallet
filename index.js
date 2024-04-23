import * as lwk from "lwk_wasm"

// Global state
var wallet
var network = lwk.Network.mainnet()
var jade
var jadeIdentifier
var addressFor = {}
var balanceFor = {}
var transactionsFor = {}

// var state = {
//     wallet: null,
//     network: lwk.Network.mainnet()
//     jade: 
// }

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

        console.log("NetworkSelector connectedCallback")
        const radios = ["#radio-1", "#radio-2"]
        for (var i = 0, max = radios.length; i < max; i++) {
            let radio = this.querySelector(radios[i])
            radio.addEventListener('input', (event) => {
                console.log(event)
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
            <span>${network}</span>
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
                // jade = await new lwk.Jade(network, true) // pass false if you don't see your DYI Jade
                jade = await FakeAPI.create()

                this.dispatchEvent(new CustomEvent('jade-initialized', {
                    bubbles: true,
                }))

                this.remove()
            } else {
                console.log(jade)

                alert("Jade already connected")
            }

        }, false)
    }

    render() {
        this.innerHTML = "<p><button>Connect to Jade</button></p>"
    }
}


class JadeIdentifier extends HTMLElement {
    constructor() {
        super()

        document.addEventListener('jade-initialized', async (event) => {
            jadeIdentifier = await jade.identifier()
            this.render()
        })
    }

    render() {
        this.innerHTML = `
            <code>${jadeIdentifier}</code>
        `
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

            if (wallet == null) {
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

        walletSelector.onchange = () => {
            wallet = walletSelector.value
            this.dispatchEvent(new CustomEvent('wallet-selected', {
                bubbles: true,
            }))
        }
    }
}


class WalletSelected extends HTMLElement {
    constructor() {
        super()

        this.render()

        document.addEventListener('wallet-selected', (event) => {
            this.render()
        })
    }

    render() {
        if (wallet != null) {
            this.innerHTML = `
                    <span>${wallet}</span>
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
            addressFor[wallet] = jade.getAddress()
            addressFor[wallet] = await addressFor[wallet]

            button.setAttribute("aria-busy", false)
            button.disabled = false
            this.dispatchEvent(new CustomEvent('address-asked', {
                bubbles: true,
            }))
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
        let address = addressFor[wallet]
        if (address != null && !(address instanceof Promise)) {
            // use template
            this.innerHTML = `
                <div style="word-break: break-word"><code>${address}</code></div><br>
                <img src="${fakeQR}" width="250px" style="image-rendering: pixelated; border: 20px solid white;"></img>
            `
        } else {
            this.innerHtml = "<p>&nbsp;</p>"
        }
    }
}


class WalletBalance extends HTMLElement {
    constructor() {
        super()

        this.render()
    }
    async connectedCallback() {
        if (balanceFor[wallet]) {
            return
        }
        balanceFor[wallet] = jade.getBalance()
        balanceFor[wallet] = await balanceFor[wallet]
        this.render()
    }

    render() {
        let balance = balanceFor[wallet]
        if (balance != null && !(balance instanceof Promise)) {
            this.innerHTML = ""

            let div = document.createElement("div")
            div.setAttribute("class", "overflow-auto")
            let table = document.createElement("table")
            table.setAttribute("class", "striped")
            div.appendChild(table)
            for (let key in balance) {
                let newRow = document.createElement("tr")
                table.appendChild(newRow)

                let firstCell = document.createElement("td")
                firstCell.textContent = key
                newRow.appendChild(firstCell)

                let secondCell = document.createElement("td")
                secondCell.setAttribute("style", "text-align:right")
                secondCell.textContent = balance[key]
                newRow.appendChild(secondCell)
            }
            this.appendChild(div)
        } else {
            this.innerHTML = "<article aria-busy=\"true\"></article>"
        }
    }
}


class WalletTransactions extends HTMLElement {
    constructor() {
        super()

        this.render()
    }
    async connectedCallback() {
        if (transactionsFor[wallet]) {
            return
        }
        transactionsFor[wallet] = jade.getTransactions()
        transactionsFor[wallet] = await transactionsFor[wallet]
        this.render()
    }

    render() {
        let transactions = transactionsFor[wallet]
        if (transactions != null && !(transactions instanceof Promise)) {
            this.innerHTML = ""

            let div = document.createElement("div")
            div.setAttribute("class", "overflow-auto")
            let table = document.createElement("table")
            table.setAttribute("class", "striped")
            div.appendChild(table)
            for (let key in transactions) {
                let newRow = document.createElement("tr")
                table.appendChild(newRow)

                let firstCell = document.createElement("td")
                firstCell.innerHTML = `
                    <a href="${transactions[key].unblinded_url}" target="_blank">${transactions[key].txid}</a>
                `
                newRow.appendChild(firstCell)
            }
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
customElements.define("jade-identifier", JadeIdentifier)
customElements.define("wallet-selected", WalletSelected)
customElements.define("wallet-selector", WalletSelector)
customElements.define("receive-address", ReceiveAddress)
customElements.define("ask-address", AskAddress)
customElements.define("wallet-balance", WalletBalance)
customElements.define("wallet-transactions", WalletTransactions)


const fakeQR = "data:image/bmp;base64,Qk1SBAAAAAAAAD4AAAAoAAAAVwAAAFcAAAABAAEAAAAAABQEAAAAAgAAAAIAAAIAAAACAAAA////AAAAAAD///jgAD//j8D8fgD///jgAD//j8D8fgD///jgAD//j8D8fgDgADgAAAcADjgfjgDgADgAAAcADjgfjgDgADgAAAcADjgfjgDj/jjj8AD8f8f//gDj/jjj8AD8f8f//gDj/jjj8AD8f8f//gDj/jgDjgcf/8cD8ADj/jgDjgcf/8cD8ADj/jgDjgcf/8cD8ADj/jgfj8ccf///8ADj/jgfj8ccf///8ADj/jgfj8ccf///8ADgADgfgcfj/gDgcADgADgfgcfj/gDgcADgADgfgcfj/gDgcAD///jgfgccfjj//gD///jgfgccfjj//gD///jgfgccfjj//gAAAAD8D/j//gD8DgAAAAD8D/j//gD8DgAAAAD8D/j//gD8DgD8cf/8cf/gD//8fgD8cf/8cf/gD//8fgD8cf/8cf/gD//8fgAD8ccccD8cD8AAAAAD8ccccD8cD8AAAAAD8ccccD8cD8AAAAD/jjgcD/j8fj/j/gD/jjgcD/j8fj/j/gD/jjgcD/j8fj/j/gAfgADj8AccAAf/8AAfgADj8AccAAf/8AAfgADj8AccAAf/8AD8ADgD8cAfgf/gcAD8ADgD8cAfgf/gcAD8ADgD8cAfgf/gcAD/jgAf8cfgccfjjgD/jgAf8cfgccfjjgD/jgAf8cfgccfjjgDgfj8AAAfj/gfjjgDgfj8AAAfj/gfjjgDgfj8AAAfj/gfjjgAD8cAfgf8cAD/gAAAD8cAfgf8cAD/gAAAD8cAfgf8cAD/gAAD/8fjgD/8fgfj8cAD/8fjgD/8fgfj8cAD/8fjgD/8fgfj8cAD/8cf8fjj8AADj/gD/8cf8fjj8AADj/gD/8cf8fjj8AADj/gD/j/8fj/gfjgccfgD/j/8fj/gfjgccfgD/j/8fj/gfjgccfgDjgcD/gAfgAf8AcADjgcD/gAfgAf8AcADjgcD/gAfgAf8AcADjgD8cAcfgAAcDjgDjgD8cAcfgAAcDjgDjgD8cAcfgAAcDjgAAAAAcf8AD/gAAAAAAAAAcf8AD/gAAAAAAAAAcf8AD/gAAAAD///jjjjjjjj///gD///jjjjjjjj///gD///jjjjjjjj///gDgADj8f/gcADgADgDgADj8f/gcADgADgDgADj8f/gcADgADgDj/jgf8AfjgDj/jgDj/jgf8AfjgDj/jgDj/jgf8AfjgDj/jgDj/jgAAAcD/jj/jgDj/jgAAAcD/jj/jgDj/jgAAAcD/jj/jgDj/jj8AcAAfjj/jgDj/jj8AcAAfjj/jgDj/jj8AcAAfjj/jgDgADgADgcADjgADgDgADgADgcADjgADgDgADgADgcADjgADgD///j8D/8D/j///gD///j8D/8D/j///gD///j8D/8D/j///gA="

class FakeAPI {
    constructor() {

    }

    static async create() {
        await delay(500)

        return new FakeAPI
    }

    async identifier() {
        await delay(1000)

        return "e34ac902"
    }

    async getAddress() {
        await delay(1000)

        if (wallet == "Wpkh") {
            if (network == "Liquid") {
                return "lq1qqf8er278e6nyvuwtgf39e6ewvdcnjupn9a86rzpx655y5lhkt0walu3djf9cklkxd3ryld97hu8h3xepw7sh2rlu7q45dcew5"
            } else {
                return "el1qq0umk3pez693jrrlxz9ndlkuwne93gdu9g83mhhzuyf46e3mdzfpva0w48gqgzgrklncnm0k5zeyw8my2ypfsmxh4xcjh2rse"
            }
        } else {
            if (network == "Liquid") {
                return "VJLDwMVWXg8RKq4mRe3YFNTAEykVN6V8x5MRUKKoC3nfRnbpnZeiG3jygMC6A4Gw967GY5EotJ4Rau2F"
            } else {
                return "CTEo6VKG8xbe7HnfVW9mQoWTgtgeRSPktwTLbELzGw5tV8Ngzu53EBiasFMQKVbWmKWWTAdN5AUf4M6Y"
            }
        }
    }

    async getBalance() {
        await delay(1500)

        if (wallet == "Wpkh") {

            if (network == "Liquid") {
                return {
                    "L-BTC": 100000,
                    "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": 5000,
                    "Wpkh - Liquid": 5000

                }
            } else {
                return {
                    "tL-BTC": 100,
                    "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": 50,
                    "Wpkh - LiquidTestnet": 5000
                }
            }
        } else {
            if (network == "Liquid") {
                return {
                    "L-BTC": 200000,
                    "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": 2000,
                    "ShWpkh - Liquid": 5000
                }
            } else {
                return {
                    "tL-BTC": 200,
                    "38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5": 20,
                    "ShWpkh - LiquidTestnet": 5000
                }
            }
        }
    }

    async getTransactions() {
        await delay(1000)

        return [{
            "txid": "4c36369a7fbbaf18aa6ea31925dd827c50598c425b124599d5cea11463b106d8",
            "unblinded_url": "https://blockstream.info/liquidtestnet/tx/4c36369a7fbbaf18aa6ea31925dd827c50598c425b124599d5cea11463b106d8#blinded=5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,b0496b2fa634ef93409cace7ad2758c6c3d5b992c4436da0cd19672fd13732f5,70c73a1f950227043b77fbaf978af647a53929cb3362dc98fcb4776c43e4c974"
        }, {
            "txid": "ad1dad61be1edb43d4c25b33944db37bb62f2f59e7fbc8f5745232b5bdb21cd8",
            "unblinded_url": "https://blockstream.info/liquidtestnet/tx/ad1dad61be1edb43d4c25b33944db37bb62f2f59e7fbc8f5745232b5bdb21cd8#blinded=100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,e7653d56719e60b39bb599227db15c16c890a41d8ec88c25373138715f86d021,15e34a43edb8e38e2bc336c997323b6ee6ebd03a0fcd33f9a306d6d8ebabb994"
        }]
    }
}


function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time))
}