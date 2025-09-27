#!/usr/bin/env node
/**
 * Code Signing Setup Script for CircuitExp1
 * Configures code signing certificates for all platforms
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class CodeSigningSetup {
  constructor() {
    this.platform = process.platform;
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, 'build');
    this.certsDir = path.join(this.buildDir, 'certificates');

    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.buildDir, this.certsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      }
    });
  }

  /**
   * Windows Code Signing Setup
   */
  async setupWindowsSigning() {
    console.log('\n🔐 Setting up Windows Code Signing...');

    const certPath = process.env.WIN_CSC_LINK;
    const certPassword = process.env.WIN_CSC_KEY_PASSWORD;

    if (!certPath || !certPassword) {
      console.log('⚠️  Windows certificate environment variables not set:');
      console.log('   WIN_CSC_LINK - Path to .pfx certificate file');
      console.log('   WIN_CSC_KEY_PASSWORD - Certificate password');
      console.log('\n   For production builds, obtain an EV Code Signing Certificate from:');
      console.log('   - DigiCert, Sectigo, GlobalSign, or other trusted CA');
      console.log('   - Store certificate in secure location');
      console.log('   - Set environment variables in CI/CD pipeline');
      return false;
    }

    // Verify certificate exists and is valid
    if (!fs.existsSync(certPath)) {
      console.error(`❌ Certificate file not found: ${certPath}`);
      return false;
    }

    try {
      // Test certificate validity (Windows only)
      if (this.platform === 'win32') {
        execSync(`certutil -dump "${certPath}"`, { stdio: 'pipe' });
        console.log('✓ Windows certificate is valid');
      }

      // Create certificate info file
      const certInfo = {
        platform: 'windows',
        type: 'pfx',
        path: certPath,
        algorithm: 'sha256',
        timestampUrl: 'http://timestamp.digicert.com',
        setupDate: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(this.certsDir, 'windows-cert-info.json'),
        JSON.stringify(certInfo, null, 2)
      );

      console.log('✓ Windows code signing configured');
      return true;
    } catch (error) {
      console.error(`❌ Windows certificate validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * macOS Code Signing Setup
   */
  async setupMacOSSigning() {
    console.log('\n🍎 Setting up macOS Code Signing...');

    const identity = process.env.CSC_NAME;
    const p12Path = process.env.CSC_LINK;
    const p12Password = process.env.CSC_KEY_PASSWORD;

    if (!identity) {
      console.log('⚠️  macOS certificate environment variables not set:');
      console.log('   CSC_NAME - Developer ID Application identity');
      console.log('   CSC_LINK - Path to .p12 certificate file (optional)');
      console.log('   CSC_KEY_PASSWORD - Certificate password (optional)');
      console.log('\n   For production builds:');
      console.log('   1. Join Apple Developer Program ($99/year)');
      console.log('   2. Create Developer ID Application certificate');
      console.log('   3. Export as .p12 file or install in keychain');
      console.log('   4. Set up App Store Connect API key for notarization');
      return false;
    }

    try {
      // Check if identity exists in keychain (macOS only)
      if (this.platform === 'darwin') {
        execSync(`security find-identity -v -p codesigning | grep "${identity}"`, { stdio: 'pipe' });
        console.log('✓ macOS signing identity found in keychain');
      }

      // Create certificate info file
      const certInfo = {
        platform: 'macos',
        type: 'developer-id',
        identity: identity,
        hardenedRuntime: true,
        entitlements: 'build/entitlements.mac.plist',
        setupDate: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(this.certsDir, 'macos-cert-info.json'),
        JSON.stringify(certInfo, null, 2)
      );

      console.log('✓ macOS code signing configured');
      return true;
    } catch (error) {
      console.error(`❌ macOS certificate validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Linux GPG Signing Setup
   */
  async setupLinuxSigning() {
    console.log('\n🐧 Setting up Linux GPG Signing...');

    const gpgKeyId = process.env.GPG_KEY_ID;
    const gpgPassphrase = process.env.GPG_PASSPHRASE;

    if (!gpgKeyId) {
      console.log('⚠️  Linux GPG environment variables not set:');
      console.log('   GPG_KEY_ID - GPG key ID for signing');
      console.log('   GPG_PASSPHRASE - GPG key passphrase (optional)');
      console.log('\n   For production builds:');
      console.log('   1. Generate GPG key: gpg --full-generate-key');
      console.log('   2. Export public key: gpg --armor --export KEY_ID > public.asc');
      console.log('   3. Export private key: gpg --armor --export-secret-keys KEY_ID > private.asc');
      console.log('   4. Store keys securely and set environment variables');
      return false;
    }

    try {
      // Check if GPG key exists (Linux/macOS only)
      if (this.platform !== 'win32') {
        execSync(`gpg --list-secret-keys ${gpgKeyId}`, { stdio: 'pipe' });
        console.log('✓ GPG signing key found');
      }

      // Create certificate info file
      const certInfo = {
        platform: 'linux',
        type: 'gpg',
        keyId: gpgKeyId,
        algorithm: 'RSA',
        setupDate: new Date().toISOString()
      };

      fs.writeFileSync(
        path.join(this.certsDir, 'linux-cert-info.json'),
        JSON.stringify(certInfo, null, 2)
      );

      console.log('✓ Linux GPG signing configured');
      return true;
    } catch (error) {
      console.error(`❌ Linux GPG validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Create signing verification script
   */
  createVerificationScript() {
    const scriptContent = `#!/usr/bin/env node
/**
 * Code Signing Verification Script
 * Verifies signed binaries for all platforms
 */

const { execSync } = require('child_process');
const fs = require('fs');
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
        const result = execSync(\`signtool verify /pa "\${file}"\`, { encoding: 'utf8' });
        console.log(\`✓ \${path.basename(file)}: Valid signature\`);
      } catch (error) {
        console.error(\`❌ \${path.basename(file)}: Invalid signature\`);
      }
    });
  }

  verifyMacOS() {
    console.log('🔍 Verifying macOS signatures...');
    const appFiles = this.findFiles(this.distDir, '.app');
    const dmgFiles = this.findFiles(this.distDir, '.dmg');

    [...appFiles, ...dmgFiles].forEach(file => {
      try {
        const result = execSync(\`codesign --verify --deep --strict "\${file}"\`, { encoding: 'utf8' });
        console.log(\`✓ \${path.basename(file)}: Valid signature\`);
      } catch (error) {
        console.error(\`❌ \${path.basename(file)}: Invalid signature\`);
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
          const result = execSync(\`gpg --verify "\${sigFile}" "\${file}"\`, { encoding: 'utf8' });
          console.log(\`✓ \${path.basename(file)}: Valid GPG signature\`);
        } catch (error) {
          console.error(\`❌ \${path.basename(file)}: Invalid GPG signature\`);
        }
      } else {
        console.error(\`❌ \${path.basename(file)}: No signature file found\`);
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
    console.log('🔐 Code Signing Verification\n');

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
`;

    fs.writeFileSync(
      path.join(this.projectRoot, 'scripts', 'verify-signatures.js'),
      scriptContent
    );

    // Make executable on Unix systems
    if (this.platform !== 'win32') {
      try {
        execSync(`chmod +x "${path.join(this.projectRoot, 'scripts', 'verify-signatures.js')}"`);
      } catch (error) {
        // Ignore chmod errors
      }
    }

    console.log('✓ Created signature verification script');
  }

  /**
   * Update package.json scripts
   */
  updatePackageScripts() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Add signing-related scripts
    const newScripts = {
      'setup:signing': 'node scripts/setup-code-signing.js',
      'verify:signatures': 'node scripts/verify-signatures.js',
      'build:signed': 'npm run build && npm run dist && npm run verify:signatures',
      'dist:win:signed': 'npm run build:icons && npm run build:ui && electron-builder --win --x64 && npm run verify:signatures',
      'dist:mac:signed': 'npm run build:icons && npm run build:ui && electron-builder --mac && npm run verify:signatures',
      'dist:linux:signed': 'npm run build:icons && npm run build:ui && electron-builder --linux && npm run verify:signatures'
    };

    Object.assign(packageJson.scripts, newScripts);

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✓ Updated package.json scripts');
  }

  /**
   * Create environment template
   */
  createEnvironmentTemplate() {
    const envTemplate = `# Code Signing Environment Variables
# Copy this file to .env.local and fill in your certificate details

# Windows Code Signing (EV Certificate)
# WIN_CSC_LINK=path/to/certificate.pfx
# WIN_CSC_KEY_PASSWORD=your_certificate_password

# macOS Code Signing (Developer ID)
# CSC_NAME="Developer ID Application: Your Company Name (TEAM_ID)"
# CSC_LINK=path/to/certificate.p12
# CSC_KEY_PASSWORD=your_certificate_password

# Apple Notarization (for distribution)
# APPLE_ID=your-apple-id@example.com
# APPLE_ID_PASSWORD=app-specific-password
# APPLE_TEAM_ID=your_team_id

# Linux GPG Signing
# GPG_KEY_ID=your_gpg_key_id
# GPG_PASSPHRASE=your_gpg_passphrase

# Certificate Acquisition Notes:
#
# Windows EV Certificate:
# - Purchase from DigiCert, Sectigo, GlobalSign, etc.
# - Requires business verification
# - Cost: $200-500/year
# - Provides immediate SmartScreen reputation
#
# Apple Developer Certificate:
# - Requires Apple Developer Program membership ($99/year)
# - Create "Developer ID Application" certificate
# - Required for distribution outside Mac App Store
#
# GPG Key (Linux):
# - Free to generate
# - Use RSA 4096-bit key for security
# - Publish public key to keyservers
`;

    fs.writeFileSync(
      path.join(this.projectRoot, '.env.signing.template'),
      envTemplate
    );

    console.log('✓ Created environment template (.env.signing.template)');
  }

  /**
   * Generate setup report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      platform: this.platform,
      certificates: {
        windows: fs.existsSync(path.join(this.certsDir, 'windows-cert-info.json')),
        macos: fs.existsSync(path.join(this.certsDir, 'macos-cert-info.json')),
        linux: fs.existsSync(path.join(this.certsDir, 'linux-cert-info.json'))
      },
      environment: {
        WIN_CSC_LINK: !!process.env.WIN_CSC_LINK,
        WIN_CSC_KEY_PASSWORD: !!process.env.WIN_CSC_KEY_PASSWORD,
        CSC_NAME: !!process.env.CSC_NAME,
        CSC_LINK: !!process.env.CSC_LINK,
        CSC_KEY_PASSWORD: !!process.env.CSC_KEY_PASSWORD,
        GPG_KEY_ID: !!process.env.GPG_KEY_ID,
        GPG_PASSPHRASE: !!process.env.GPG_PASSPHRASE
      }
    };

    fs.writeFileSync(
      path.join(this.certsDir, 'setup-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📊 Code Signing Setup Report:');
    console.log(`   Platform: ${report.platform}`);
    console.log(`   Windows Certificate: ${report.certificates.windows ? '✓' : '❌'}`);
    console.log(`   macOS Certificate: ${report.certificates.macos ? '✓' : '❌'}`);
    console.log(`   Linux GPG: ${report.certificates.linux ? '✓' : '❌'}`);
    console.log(`\n   Report saved to: ${path.join(this.certsDir, 'setup-report.json')}`);
  }

  /**
   * Main setup process
   */
  async run() {
    console.log('🔐 CircuitExp1 Code Signing Setup\n');
    console.log('This script configures code signing for all platforms.\n');

    const results = {
      windows: await this.setupWindowsSigning(),
      macos: await this.setupMacOSSigning(),
      linux: await this.setupLinuxSigning()
    };

    this.createVerificationScript();
    this.updatePackageScripts();
    this.createEnvironmentTemplate();
    this.generateReport();

    console.log('\n🎉 Code signing setup completed!');
    console.log('\nNext steps:');
    console.log('1. Copy .env.signing.template to .env.local');
    console.log('2. Fill in your certificate details');
    console.log('3. Run "npm run build:signed" to test signing');
    console.log('4. Use "npm run verify:signatures" to verify builds');

    const successCount = Object.values(results).filter(Boolean).length;
    if (successCount === 0) {
      console.log('\n⚠️  No certificates configured. See template for setup instructions.');
    } else {
      console.log(`\n✓ ${successCount}/3 platforms configured successfully`);
    }
  }
}

if (require.main === module) {
  new CodeSigningSetup().run().catch(console.error);
}

module.exports = CodeSigningSetup;
