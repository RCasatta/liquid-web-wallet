## ADR

- Avoid js frameworks, use vanilla JS and web standards
- Use only lwk_wasm as npm dep
- Keep it simple and maintainable
- No images and almost no custom css, only picocss
- encapsulate logics in web components
- Global state, but every web component is in charge of itself, use events to communicates changes to other
- Most html stay in a `.html` -> use html templates