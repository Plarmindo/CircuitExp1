#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

const packageJson = require('../package.json');

program
  .name('plugin-kit-external')
  .description('CircuitExp1 AI LLM Plugin Kit - External Integration CLI')
  .version(packageJson.version);

// Create new plugin
program
  .command('create <name>')
  .description('Create a new external plugin')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-d, --directory <directory>', 'Target directory', '.')
  .option('-i, --integration <type>', 'Integration type', 'npm-package')
  .action(async (name, options) => {
    const spinner = ora('Creating plugin...').start();
    
    try {
      await createPlugin(name, options);
      spinner.succeed(`Plugin '${name}' created successfully!`);
    } catch (error) {
      spinner.fail(`Failed to create plugin: ${error.message}`);
      process.exit(1);
    }
  });

// List available templates
program
  .command('templates')
  .description('List available templates')
  .action(() => {
    console.log(chalk.blue('Available Templates:'));
    console.log('');
    
    const templates = [
      {
        name: 'basic',
        description: 'Basic external plugin with minimal setup',
        integration: ['npm-package', 'docker', 'standalone']
      },
      {
        name: 'openai-gpt',
        description: 'OpenAI GPT integration with chat capabilities',
        integration: ['npm-package', 'docker', 'serverless']
      },
      {
        name: 'anthropic-claude',
        description: 'Anthropic Claude integration with advanced reasoning',
        integration: ['npm-package', 'docker', 'kubernetes']
      },
      {
        name: 'google-gemini',
        description: 'Google Gemini integration with multimodal support',
        integration: ['npm-package', 'docker', 'cloud-run']
      },
      {
        name: 'multi-provider',
        description: 'Multi-provider plugin supporting multiple AI services',
        integration: ['npm-package', 'docker', 'kubernetes']
      },
      {
        name: 'microservice',
        description: 'Microservice architecture plugin',
        integration: ['docker', 'kubernetes', 'serverless']
      }
    ];
    
    templates.forEach(template => {
      console.log(chalk.green(`  ${template.name}`));
      console.log(`    ${template.description}`);
      console.log(`    Integration: ${template.integration.join(', ')}`);
      console.log('');
    });
  });

// Integration setup
program
  .command('configure <integration>')
  .description('Configure integration with external platform')
  .action(async (integration) => {
    const configs = {
      'trae': configureTrae,
      'github-copilot': configureGitHubCopilot,
      'vscode': configureVSCode,
      'jetbrains': configureJetBrains,
      'custom': configureCustom
    };
    
    if (!configs[integration]) {
      console.error(chalk.red(`Unknown integration: ${integration}`));
      console.log(chalk.yellow('Available integrations: traee, github-copilot, vscode, jetbrains, custom'));
      process.exit(1);
    }
    
    await configs[integration]();
  });

// Development server
program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .action(async (options) => {
    const spinner = ora('Starting development server...').start();
    
    try {
      await startDevServer(options);
      spinner.succeed(`Development server started at http://${options.host}:${options.port}`);
    } catch (error) {
      spinner.fail(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  });

// Build commands
program
  .command('build')
  .description('Build plugin for production')
  .option('-t, --target <target>', 'Build target', 'production')
  .action(async (options) => {
    const spinner = ora('Building plugin...').start();
    
    try {
      await buildPlugin(options);
      spinner.succeed('Plugin built successfully!');
    } catch (error) {
      spinner.fail(`Build failed: ${error.message}`);
      process.exit(1);
    }
  });

// Test commands
program
  .command('test')
  .description('Run tests')
  .option('-w, --watch', 'Watch mode')
  .option('-c, --coverage', 'Generate coverage report')
  .action(async (options) => {
    const spinner = ora('Running tests...').start();
    
    try {
      await runTests(options);
      spinner.succeed('Tests passed!');
    } catch (error) {
      spinner.fail(`Tests failed: ${error.message}`);
      process.exit(1);
    }
  });

// Deploy commands
program
  .command('deploy <platform>')
  .description('Deploy to cloud platform')
  .action(async (platform) => {
    const platforms = ['aws', 'azure', 'gcp', 'docker', 'kubernetes'];
    
    if (!platforms.includes(platform)) {
      console.error(chalk.red(`Unknown platform: ${platform}`));
      console.log(chalk.yellow(`Available platforms: ${platforms.join(', ')}`));
      process.exit(1);
    }
    
    const spinner = ora(`Deploying to ${platform}...`).start();
    
    try {
      await deployToPlatform(platform);
      spinner.succeed(`Deployed to ${platform} successfully!`);
    } catch (error) {
      spinner.fail(`Deployment failed: ${error.message}`);
      process.exit(1);
    }
  });

// Plugin validation
program
  .command('validate')
  .description('Validate plugin configuration')
  .action(async () => {
    const spinner = ora('Validating plugin...').start();
    
    try {
      await validatePlugin();
      spinner.succeed('Plugin configuration is valid!');
    } catch (error) {
      spinner.fail(`Validation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Plugin info
program
  .command('info')
  .description('Display plugin information')
  .action(() => {
    console.log(chalk.blue('CircuitExp1 AI LLM Plugin Kit'));
    console.log(`Version: ${packageJson.version}`);
    console.log(`Description: ${packageJson.description}`);
    console.log('');
    console.log('Available commands:');
    console.log('  create <name>     - Create new plugin');
    console.log('  templates         - List available templates');
    console.log('  configure <type>  - Configure integration');
    console.log('  dev               - Start development server');
    console.log('  build             - Build for production');
    console.log('  test              - Run tests');
    console.log('  deploy <platform> - Deploy to cloud');
    console.log('  validate          - Validate configuration');
  });

// Helper functions
async function createPlugin(name, options) {
  const templateDir = path.join(__dirname, '..', 'templates', options.template);
  const targetDir = path.join(process.cwd(), options.directory, name);
  
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template '${options.template}' not found`);
  }
  
  await fs.ensureDir(targetDir);
  await fs.copy(templateDir, targetDir);
  
  // Customize package.json
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.name = name;
    packageJson.description = `CircuitExp1 AI LLM Plugin: ${name}`;
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }
  
  // Create integration-specific files
  await createIntegrationFiles(targetDir, options.integration);
}

async function createIntegrationFiles(targetDir, integration) {
  const integrationDir = path.join(__dirname, '..', 'templates', 'integrations', integration);
  
  if (fs.existsSync(integrationDir)) {
    await fs.copy(integrationDir, targetDir, { overwrite: false });
  }
}

async function configureTrae() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Plugin kit endpoint:',
      default: 'http://localhost:3000'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API key:',
      validate: input => input.length > 0 || 'API key is required'
    }
  ]);
  
  const config = {
    traee: {
      pluginKit: {
        endpoint: answers.endpoint,
        apiKey: answers.apiKey,
        enabled: true
      }
    }
  };
  
  await fs.writeJson('.trae-plugin-kit.json', config, { spaces: 2 });
  console.log(chalk.green('TRAE configuration created: .trae-plugin-kit.json'));
}

async function configureGitHubCopilot() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Plugin kit endpoint:',
      default: 'http://localhost:3000'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API key:',
      validate: input => input.length > 0 || 'API key is required'
    }
  ]);
  
  const config = {
    copilot: {
      circuitexp1: {
        endpoint: answers.endpoint,
        apiKey: answers.apiKey,
        enabled: true
      }
    }
  };
  
  await fs.writeJson('.copilot-plugin-kit.json', config, { spaces: 2 });
  console.log(chalk.green('GitHub Copilot configuration created: .copilot-plugin-kit.json'));
}

async function configureVSCode() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Plugin kit endpoint:',
      default: 'http://localhost:3000'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API key:',
      validate: input => input.length > 0 || 'API key is required'
    }
  ]);
  
  const settings = {
    "circuitexp1.pluginKit": {
      "endpoint": answers.endpoint,
      "apiKey": answers.apiKey,
      "enabled": true
    }
  };
  
  const settingsPath = path.join('.vscode', 'settings.json');
  await fs.ensureDir('.vscode');
  
  let existingSettings = {};
  if (fs.existsSync(settingsPath)) {
    existingSettings = await fs.readJson(settingsPath);
  }
  
  const newSettings = { ...existingSettings, ...settings };
  await fs.writeJson(settingsPath, newSettings, { spaces: 2 });
  console.log(chalk.green('VS Code configuration updated: .vscode/settings.json'));
}

async function configureJetBrains() {
  console.log(chalk.yellow('JetBrains configuration requires manual setup'));
  console.log('Please add the following to your IDE settings:');
  console.log('');
  console.log(chalk.cyan('Settings → Plugins → Install CircuitExp1 Plugin Kit Extension'));
}

async function configureCustom() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'integrationType',
      message: 'Integration type:',
      choices: ['REST API', 'WebSocket', 'GraphQL', 'gRPC']
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'Plugin kit endpoint:',
      default: 'http://localhost:3000'
    }
  ]);
  
  const config = {
    custom: {
      type: answers.integrationType.toLowerCase().replace(' ', '-'),
      endpoint: answers.endpoint,
      configuration: {}
    }
  };
  
  await fs.writeJson('plugin-kit-custom.json', config, { spaces: 2 });
  console.log(chalk.green('Custom configuration created: plugin-kit-custom.json'));
}

async function startDevServer(options) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: options.port, HOST: options.host }
    });
    
    child.on('error', reject);
    child.on('spawn', resolve);
  });
}

async function buildPlugin(options) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: options.target }
    });
    
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
}

async function runTests(options) {
  const { spawn } = require('child_process');
  
  const args = ['test'];
  if (options.watch) args.push('--watch');
  if (options.coverage) args.push('--coverage');
  
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', ...args], {
      stdio: 'inherit'
    });
    
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Tests failed with code ${code}`));
    });
  });
}

async function deployToPlatform(platform) {
  const deployScript = path.join(process.cwd(), 'scripts', `deploy-${platform}.sh`);
  
  if (!fs.existsSync(deployScript)) {
    throw new Error(`Deploy script not found: ${deployScript}`);
  }
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [deployScript], {
      stdio: 'inherit'
    });
    
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Deployment failed with code ${code}`));
    });
  });
}

async function validatePlugin() {
  const configPath = path.join(process.cwd(), 'plugin-kit.config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('plugin-kit.config.json not found');
  }
  
  const config = await fs.readJson(configPath);
  
  // Basic validation
  if (!config.name) throw new Error('Plugin name is required');
  if (!config.version) throw new Error('Plugin version is required');
  if (!config.integration) throw new Error('Integration type is required');
  
  console.log(chalk.green('✓ Plugin configuration is valid'));
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

program.parse();