{
  description = "Liquid Web Wallet development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js and package managers
            nodejs_20
            
            # Playwright
            playwright-driver
            # Browsers that work with NixOS
            chromium
            
            # Additional utilities
            rsync # for deploy scripts
            jq    # for JSON manipulation
          ];

          shellHook = ''
            echo "🌊 Liquid Web Wallet Development Environment"
            echo "Node.js version: $(node --version)"
            echo "npm version: $(npm --version)"
            echo "Chromium path: ${pkgs.chromium}/bin/chromium"
            
            # Set up Playwright to use system chromium
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="${pkgs.chromium}/bin/chromium"
            
            # Ensure npm packages can find native dependencies
            export PKG_CONFIG_PATH="${pkgs.pkg-config}/lib/pkgconfig"
            
            echo ""
            echo "Available commands:"
            echo "  npm install  - Install dependencies"
            echo "  npm test     - Run Playwright tests (now with NixOS system Chromium)"
            echo "  npm start    - Start development server"
            echo ""
          '';

          # Environment variables that are always set
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
        };
      });
} 