const CopyWebpackPlugin = require("copy-webpack-plugin");
const fs = require("fs");
const path = require('path');

// The network is chosen by editing index.ts (see the mainnet/testnet/regtest npm scripts).
function selectedNetwork() {
  const source = fs.readFileSync(path.resolve(__dirname, "index.ts"), "utf8");
  const match = source.match(/const network: lwk\.Network = lwk\.Network\.(mainnet|testnet|regtestDefault)\(\)/);
  if (!match) {
    throw new Error("Cannot find the network in index.ts");
  }
  return match[1] === "regtestDefault" ? "regtest" : match[1];
}

// Servers each network talks to, from index.ts and lwk_wasm.
const CONNECT_SRC = {
  mainnet: [
    "https://waterfalls.liquidwebwallet.org",
    "https://assets.blockstream.info",
    "https://green-liquid-mainnet.blockstream.com", "wss://green-liquid-mainnet.blockstream.com",
    "https://api.boltz.exchange", "wss://api.boltz.exchange",
    "https://jadepin.blockstream.com", "https://j8d.io",
  ],
  testnet: [
    "https://waterfalls.liquidwebwallet.org",
    "https://assets-testnet.blockstream.info",
    "https://green-liquid-testnet.blockstream.com", "wss://green-liquid-testnet.blockstream.com",
    "https://amp2.testnet.blockstream.com",
    "https://liquidtestnet.com",
    "https://jadepin.blockstream.com", "https://j8d.io",
  ],
  regtest: [
    "http://localhost:*", "ws://localhost:*", "http://127.0.0.1:*", "ws://127.0.0.1:*",
    "https://jadepin.blockstream.com", "https://j8d.io",
  ],
};

const IMG_SRC = {
  mainnet: ["https://waterfalls.liquidwebwallet.org"],
  testnet: ["https://waterfalls.liquidwebwallet.org"],
  regtest: ["http://localhost:3000"],
};

// Third party scripts are allowed by exact URL and also carry SRI hashes
// (index.html for Plausible, index.ts for jsQR).
const SCRIPT_SRC = [
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  "https://plausible.casatta.it/js/script.js",
];

// Extra origins for connect-src, e.g. a custom Jade pinserver for a self-hosted deployment:
//   EXTRA_CONNECT_SRC="https://pin.example.com" npm run build
// Space separated; each entry must be a plain https origin.
function extraConnectSrc() {
  const entries = (process.env.EXTRA_CONNECT_SRC || "").split(/\s+/).filter(Boolean);
  for (const entry of entries) {
    if (!/^https:\/\/[a-z0-9.-]+(:[0-9]{1,5})?$/.test(entry)) {
      throw new Error(`EXTRA_CONNECT_SRC: "${entry}" is not an https origin like https://pin.example.com`);
    }
  }
  return entries;
}

function contentSecurityPolicy(network) {
  return [
    "default-src 'none'",
    // 'wasm-unsafe-eval' is needed to compile lwk_wasm; 'unsafe-eval' is not allowed.
    ["script-src 'self' 'wasm-unsafe-eval'", ...SCRIPT_SRC].join(" "),
    // 'unsafe-inline' is needed for the style attributes in index.html and index.ts.
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data:", ...IMG_SRC[network]].join(" "),
    ["connect-src 'self'", ...CONNECT_SRC[network], ...extraConnectSrc(), "https://plausible.casatta.it"].join(" "),
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

module.exports = (_env, argv) => {
  const mode = argv.mode || "development";
  extraConnectSrc(); // fail early on a malformed EXTRA_CONNECT_SRC
  return {
    entry: "./bootstrap.ts",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bootstrap.js",
    },
    mode,
    // The development default ("eval") needs 'unsafe-eval'; use separate source map files instead.
    devtool: mode === "production" ? false : "source-map",
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "index.html",
            // Read the network on every build: the dev server keeps running when an npm script switches it.
            transform: (content) => content.toString().replace("__CSP__", contentSecurityPolicy(selectedNetwork())),
          },
          "pico.min.css",
          "favicon.webp",
        ]
      })
    ],
    experiments: {
      asyncWebAssembly: true,
      syncWebAssembly: true
    },
    optimization: {
      minimize: false,
    },
    performance: {
      maxAssetSize: 10 * 1024 * 1024,
      maxEntrypointSize: 10 * 1024 * 1024,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    devServer: {
      port: 8383,
    },
  };
};
