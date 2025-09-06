#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PLUGIN_DIR = path.join(__dirname, 'samples', 'anthropic-claude-plugin');

console.log('🔧 Setting up Plugin Development Environment...\n');

// Check if .env file exists, create from example if not
const envPath = path.join(PLUGIN_DIR, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📋 Creating .env file from example...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please edit it with your API keys.');
} else {
  console.log('✅ .env file already exists');
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { cwd: PLUGIN_DIR, stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create logs directory
const logsDir = path.join(PLUGIN_DIR, 'logs');
if (!fs.existsSync(logsDir)) {
  console.log('\n📁 Creating logs directory...');
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Logs directory created');
}

// Create test data directory
const testDataDir = path.join(PLUGIN_DIR, 'test-data');
if (!fs.existsSync(testDataDir)) {
  console.log('\n📁 Creating test data directory...');
  fs.mkdirSync(testDataDir, { recursive: true });
  console.log('✅ Test data directory created');
}

// Copy development config
const devConfigPath = path.join(__dirname, 'development.config.json');
const targetDevConfigPath = path.join(PLUGIN_DIR, 'development.config.json');
if (fs.existsSync(devConfigPath) && !fs.existsSync(targetDevConfigPath)) {
  console.log('\n📋 Copying development configuration...');
  fs.copyFileSync(devConfigPath, targetDevConfigPath);
  console.log('✅ Development configuration copied');
}

console.log('\n🎉 Development environment setup complete!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your API keys');
console.log('2. Run: npm run dev');
console.log('3. Visit: http://localhost:3000/api/health');
console.log('\nFor testing, run: npm test');
