requires launching a regtest environment

```
cd lwk/lwk_test/lwk_test_util
./wasm_test_env.sh
```


then, from this project root

```
npm run test
```

`address-verification.spec.ts` also needs the Jade emulator (docker) and its
WebSocket bridge (websocat) on `ws://localhost:3331`, both started by
`wasm_test_env.sh` unless `SKIP_JADE=1`. To run only those tests:

```
PLAYWRIGHT_HTML_OPEN=never npm test -- address-verification
```
