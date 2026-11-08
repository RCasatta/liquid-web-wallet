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
    "https://jadepin.blockstream.com",
  ],
  testnet: [
    "https://waterfalls.liquidwebwallet.org",
    "https://assets-testnet.blockstream.info",
    "https://green-liquid-testnet.blockstream.com", "wss://green-liquid-testnet.blockstream.com",
    "https://amp2.testnet.blockstream.com",
    "https://liquidtestnet.com",
    "https://jadepin.blockstream.com",
  ],
  regtest: [
    "http://localhost:*", "ws://localhost:*", "http://127.0.0.1:*", "ws://127.0.0.1:*",
    "https://jadepin.blockstream.com",
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

function contentSecurityPolicy(network) {
  return [
    "default-src 'none'",
    // 'wasm-unsafe-eval' is needed to compile lwk_wasm; 'unsafe-eval' is not allowed.
    ["script-src 'self' 'wasm-unsafe-eval'", ...SCRIPT_SRC].join(" "),
    // 'unsafe-inline' is needed for the style attributes in index.html and index.ts.
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data:", ...IMG_SRC[network]].join(" "),
    ["connect-src 'self'", ...CONNECT_SRC[network], "https://plausible.casatta.it"].join(" "),
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

module.exports = (_env, argv) => {
  const mode = argv.mode || "development";
  const network = selectedNetwork();
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
            transform: (content) => content.toString().replace("__CSP__", contentSecurityPolicy(network)),
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
