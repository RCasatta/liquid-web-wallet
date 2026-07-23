// A dependency graph that contains any wasm must all be imported
// asynchronously. This `bootstrap.js` file does the single async import, so
// that no one else needs to worry about it again.

// Declare webpack global variable
declare var __webpack_public_path__: string;

import("./index")
  .catch(e => console.error("Error importing `index`:", e));

// Keep mainnet (/) and testnet (/testnet) pointing to the same WASM file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
__webpack_public_path__ = "/"
