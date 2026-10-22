#!/usr/bin/env node

/**
 * This script checks if the lwk_wasm package is built in debug or release mode.
 * Debug builds of WebAssembly are significantly larger than release builds.
 */

const fs = require('fs');
const path = require('path');

// Path to the installed lwk_wasm package (the one webpack bundles).
// If a local build was linked with `npm install --no-save ../lwk/lwk_wasm/pkg`,
// this is a symlink to it and gets resolved below.
const packagePath = path.resolve(__dirname, '../node_modules/lwk_wasm');

// Function to check if the build is a debug build based on file size
function isDebugBuild(directoryPath) {
    try {
        // Find the .wasm file in the directory
        const files = fs.readdirSync(directoryPath);
        const wasmFile = files.find(file => file.endsWith('.wasm'));

        if (!wasmFile) {
            console.error(`No .wasm file found in ${directoryPath}`);
            return true; // If we can't find the wasm file, assume it's debug for safety
        }

        const wasmFilePath = path.join(directoryPath, wasmFile);
        const stats = fs.statSync(wasmFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        // This threshold may need adjustment based on your specific wasm file
        // Typically debug builds are several times larger than release builds
        const THRESHOLD_MB = 10; // Adjust this based on expected release size

        console.log(`WASM file size: ${fileSizeInMB.toFixed(2)} MB`);

        // Consider it a debug build if it's larger than threshold OR has debug indicators
        return fileSizeInMB > THRESHOLD_MB;
    } catch (err) {
        console.error(`Error checking build type: ${err.message}`);
        return true; // If there's an error, assume it's debug for safety
    }
}

// Main function
function main() {
    if (!fs.existsSync(packagePath)) {
        console.error('Error: Could not find installed lwk_wasm package at', packagePath);
        process.exit(1);
    }
    const directoryToCheck = fs.realpathSync(packagePath);
    console.log('Checking installed lwk_wasm package at:', directoryToCheck);

    // Check if it's a debug build
    if (isDebugBuild(directoryToCheck)) {
        console.error('\n⛔ ERROR: lwk_wasm appears to be built in debug mode! ⛔');

        process.exit(1); // Exit with error code
    } else {
        console.log('✅ lwk_wasm is built in release mode.');
    }
}

main(); 