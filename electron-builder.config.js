/**
 * Electron Builder Configuration with Enhanced Code Signing
 * Supports Windows EV certificates, macOS Developer ID, and Linux GPG signing
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

/**
 * Get notarization configuration for macOS
 */
function getNotarizeConfig() {
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (appleId && appleIdPassword && teamId) {
    return {
      tool: 'notarytool',
      appleId,
      appleIdPassword,
      teamId
    };
  }

  return false;
}

/**
 * Get Windows signing configuration
 */
function getWindowsConfig() {
  const config = {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    icon: 'build/icon.png',
    signingHashAlgorithms: ['sha256'],
    publisherName: 'CircuitExp1',
    verifyUpdateCodeSignature: true,
    requestedExecutionLevel: 'asInvoker'
  };

  // Add certificate configuration if available
  if (process.env.WIN_CSC_LINK) {
    config.certificateFile = process.env.WIN_CSC_LINK;
    config.certificatePassword = process.env.WIN_CSC_KEY_PASSWORD;
    config.timeStampServer = 'http://timestamp.digicert.com';
    config.rfc3161TimeStampServer = 'http://timestamp.digicert.com';
  }

  return config;
}

/**
 * Get macOS signing configuration
 */
function getMacConfig() {
  const config = {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    icon: 'build/icon.png',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    type: 'distribution'
  };

  // Add signing identity if available
  if (process.env.CSC_NAME) {
    config.identity = process.env.CSC_NAME;
  }

  return config;
}

/**
 * Get Linux configuration
 */
function getLinuxConfig() {
  return {
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64']
      },
      {
        target: 'tar.gz',
        arch: ['x64']
      }
    ],
    icon: 'build/icon.png',
    category: 'Utility',
    synopsis: 'London Metro Map style disk folder visualizer',
    description: 'A powerful file system visualization tool that displays directory structures as interactive metro maps'
  };
}

/**
 * NSIS installer configuration
 */
function getNsisConfig() {
  return {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icon.png',
    uninstallerIcon: 'build/icon.png',
    installerHeaderIcon: 'build/icon.png',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'CircuitExp1',
    include: 'build/installer.nsh',
    script: 'build/installer.nsh',
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    menuCategory: 'Development Tools'
  };
}

/**
 * DMG configuration for macOS
 */
function getDmgConfig() {
  return {
    title: 'CircuitExp1 ${version}',
    icon: 'build/icon.png',
    iconSize: 80,
    contents: [
      {
        x: 478,
        y: 192,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 192,
        type: 'file'
      }
    ],
    window: {
      width: 608,
      height: 400
    },
    backgroundColor: '#ffffff',
    format: 'UDZO'
  };
}

/**
 * Main electron-builder configuration
 */
module.exports = {
  appId: 'com.circuitexp1.app',
  productName: 'CircuitExp1',
  copyright: 'Copyright © 2025 CircuitExp1',

  directories: {
    output: 'dist',
    buildResources: 'build'
  },

  files: [
    'dist/**/*',
    'electron-main.cjs',
    'preload.cjs',
    'scan-manager.cjs',
    'favorites-store.cjs',
    'recent-scans-store.cjs',
    'user-settings-store.cjs',
    'mock-root/**/*',
    'src/security/**/*',
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/*.d.ts',
    '!**/node_modules/.bin',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
    '!**/{appveyor.yml,.travis.yml,circle.yml}',
    '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
  ],

  asar: {
    smartUnpack: true
  },

  extraMetadata: {
    main: 'electron-main.cjs',
    version: process.env.npm_package_version || '1.0.0'
  },

  // Platform-specific configurations
  win: getWindowsConfig(),
  mac: getMacConfig(),
  linux: getLinuxConfig(),

  // Installer configurations
  nsis: getNsisConfig(),
  dmg: getDmgConfig(),

  // Auto-updater configuration
  publish: {
    provider: 'github',
    owner: 'your-org',
    repo: 'CircuitExp1',
    private: true,
    releaseType: 'release'
  },

  // Notarization for macOS
  afterSign: async (context) => {
    const { electronPlatformName, appOutDir } = context;

    if (electronPlatformName === 'darwin') {
      const notarizeConfig = getNotarizeConfig();

      if (notarizeConfig) {
        console.log('🍎 Starting macOS notarization...');

        try {
          const { notarize } = require('@electron/notarize');

          await notarize({
            ...notarizeConfig,
            appBundleId: 'com.circuitexp1.app',
            appPath: path.join(appOutDir, 'CircuitExp1.app')
          });

          console.log('✓ macOS notarization completed');
        } catch (error) {
          console.error('❌ macOS notarization failed:', error);
          throw error;
        }
      } else {
        console.log('⚠️  Skipping macOS notarization (credentials not configured)');
      }
    }
  },

  // Linux post-build signing
  afterAllArtifactBuild: async (context) => {
    const { platformToTargets, outDir } = context;

    // Sign Linux AppImage with GPG if configured
    if (platformToTargets.has('linux') && process.env.GPG_KEY_ID) {
      console.log('🐧 Signing Linux artifacts with GPG...');

      const { execSync } = require('child_process');
      const glob = require('glob');

      try {
        const appImageFiles = glob.sync(path.join(outDir, '*.AppImage'));

        for (const file of appImageFiles) {
          execSync(`gpg --armor --detach-sign "${file}"`, {
            stdio: 'inherit',
            env: {
              ...process.env,
              GPG_TTY: process.env.TTY || '/dev/tty'
            }
          });

          console.log(`✓ Signed: ${path.basename(file)}`);
        }

        console.log('✓ Linux GPG signing completed');
      } catch (error) {
        console.error('❌ Linux GPG signing failed:', error);
        throw error;
      }
    }

    return [];
  },

  // Build configuration
  buildDependenciesFromSource: false,
  nodeGypRebuild: false,
  npmRebuild: false,

  // Security configuration
  electronDownload: {
    cache: path.join(__dirname, '.electron-cache')
  },

  // Compression
  compression: 'maximum',

  // Metadata
  extraResources: [
    {
      from: 'PRODUCTION_DEPLOYMENT.md',
      to: 'docs/'
    },
    {
      from: 'SECURITY_HARDENING_GUIDE.md',
      to: 'docs/'
    }
  ]
};
