#!/usr/bin/env node
/**
 * Code Signing Verification Script
 * Verifies signed binaries for all platforms
 */

const { execSync } = require('child_process');
const _fs = require('fs');
const path = require('path');

class SigningVerifier {
  constructor() {
    this.distDir = path.join(__dirname, '..', 'dist');
  }

  verifyWindows() {
    console.log('🔍 Verifying Windows signatures...');
    const exeFiles = this.findFiles(this.distDir, '.exe');

    exeFiles.forEach(file => {
      try {
        const _result = execSync(`signtool verify /pa "${file}"`, { encoding: 'utf8' });
        console.log(`✓ ${path.basename(file)}: Valid signature`);
      } catch (_error) {
        console.error(`❌ ${path.basename(file)}: Invalid signature`);
      }
    });
  }

  verifyMacOS() {
    console.log('🔍 Verifying macOS signatures...');
    const appFiles = this.findFiles(this.distDir, '.app');
    const dmgFiles = this.findFiles(this.distDir, '.dmg');

    [...appFiles, ...dmgFiles].forEach(file => {
      try {
        const _result = execSync(`codesign --verify --deep --strict "${file}"`, { encoding: 'utf8' });
        console.log(`✓ ${path.basename(file)}: Valid signature`);
      } catch (_error) {
        console.error(`❌ ${path.basename(file)}: Invalid signature`);
      }
    });
  }

  verifyLinux() {
    console.log('🔍 Verifying Linux signatures...');
    const appImageFiles = this.findFiles(this.distDir, '.AppImage');

    appImageFiles.forEach(file => {
      const sigFile = file + '.sig';
      if (fs.existsSync(sigFile)) {
        try {
          const _result = execSync(`gpg --verify "${sigFile}" "${file}"`, { encoding: 'utf8' });
          console.log(`✓ ${path.basename(file)}: Valid GPG signature`);
        } catch (_error) {
          console.error(`❌ ${path.basename(file)}: Invalid GPG signature`);
        }
      } else {
        console.error(`❌ ${path.basename(file)}: No signature file found`);
      }
    });
  }

  findFiles(dir, extension) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (fullPath.endsWith(extension)) {
          files.push(fullPath);
        }
      });
    };

    walk(dir);
    return files;
  }

  run() {
    console.log('🔐 Code Signing Verification');

    if (process.platform === 'win32') {
      this.verifyWindows();
    } else if (process.platform === 'darwin') {
      this.verifyMacOS();
    } else {
      this.verifyLinux();
    }
  }
}

if (require.main === module) {
  new SigningVerifier().run();
}

module.exports = SigningVerifier;
