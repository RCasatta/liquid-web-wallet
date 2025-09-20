#!/usr/bin/env node

/**
 * This script checks if the lwk_wasm package is built in debug or release mode.
 * Debug builds of WebAssembly are significantly larger than release builds.
 */

const fs = require('fs');
const path = require('path');

// Path to the lwk_wasm package
const packagePath = path.resolve(__dirname, '../node_modules/lwk_wasm');
const localPath = path.resolve(__dirname, '../../lwk/lwk_wasm/pkg');

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
    let directoryToCheck;

    // Determine which path to check
    if (fs.existsSync(localPath)) {
        directoryToCheck = localPath;
        console.log('Checking local lwk_wasm package at:', localPath);
    } else if (fs.existsSync(packagePath)) {
        directoryToCheck = packagePath;
        console.log('Checking installed lwk_wasm package at:', packagePath);
    } else {
        console.error('Error: Could not find lwk_wasm package');
        process.exit(1);
    }

    // Check if it's a debug build
    if (isDebugBuild(directoryToCheck)) {
        console.error('\n⛔ ERROR: lwk_wasm appears to be built in debug mode! ⛔');

        process.exit(1); // Exit with error code
    } else {
        console.log('✅ lwk_wasm is built in release mode.');
    }
}

main(); 