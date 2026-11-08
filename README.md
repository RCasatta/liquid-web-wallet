
# Liquid web wallet

**NOTE: only a mock up for now**

A [Liquid](https://liquid.net) web wallet that runs in the browser.

Watch-only mode works in any modern browser, connection with [JADE](https://blockstream.com/jade/) requires web serial and works on chrome, chromium, edge.

Based on [LWK wasm](https://github.com/Blockstream/lwk/tree/master/lwk_wasm)



## Try locally

Requirements:

* npm

With nix install those with `nix-shell`

Execute once:

```shell
$ npm install
```

`lwk_wasm` is pinned to a release from npm. To develop against a local [LWK](https://github.com/Blockstream/lwk) build (requires `wasm-pack`), build `lwk_wasm/pkg` in a sibling `lwk` checkout and link it without committing the change to `package.json`/`package-lock.json`:

```shell
$ npm install --no-save ../lwk/lwk_wasm/pkg
```

Then

```shell
$ npm run start
```

## Deploy


```shell
$ npm run build
```

Copy `dist` folder to the web server

### Caching

`npm run build` gives every JS and WASM file a name containing a hash of its content (`bootstrap.<hash>.js`, `<id>.<hash>.js`, `<hash>.module.wasm`), and writes the entry name into `dist/index.html`. `npm run check-build-output` checks this; the deploy scripts run it.

So the web server should:

- revalidate `index.html` (and the other unhashed files) on every load, otherwise a browser can keep an old page;
- cache the hashed files forever;
- keep the files of previous deploys (the sync scripts use rsync without `--delete`): a tab already open, or a page still in a browser cache, may load them.

nginx example for the site root (mainnet), `/testnet/` and `/regtest/`:

```nginx
# Unhashed files: index.html, directory URLs, pico.min.css, favicon.webp,
# and bootstrap.js / <id>.bootstrap.js from deploys before hashed names.
location / {
    add_header Cache-Control "no-cache" always;
}

# Content-hashed files: never change.
location ~ "\.[0-9a-f]{20}\.(js|wasm)$" {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

`no-cache` means "revalidate", not "do not store": with `Last-Modified`/`ETag` an unchanged file costs a `304`. Keep these `add_header` lines in the same block as any other `add_header`, since nginx drops inherited ones when a block sets its own.

Moving from the old 7-day `bootstrap.js` caching: a browser that cached `bootstrap.js` keeps it, but the new `index.html` no longer references it, so it is not used. A browser that still has an old `index.html` in its cache (until it revalidates) keeps running the old deploy, whose files stay on the server.

### Custom Jade pinserver

The Content-Security-Policy only allows the default Jade pinservers. If your Jade is configured with your own pinserver, build and host the wallet yourself with that origin added to the policy (space separated for more than one):

```shell
$ EXTRA_CONNECT_SRC="https://pin.example.com" npm run build
```

## Avoid ids

When possible avoid ids, use web components as "namespace" and querySelector on html elements, in case of multiple elements use querySelectorAll and maps in the js class

## ADR

- Avoid js frameworks, use vanilla JS and web standards
- Use only lwk_wasm as npm dep
- Keep it simple and maintainable
- No images and almost no custom css, only picocss
- encapsulate logics in web components
- Global state, but every web component is in charge of itself, use events to communicates changes to other
- Most html stay in a `.html` -> use html templates
