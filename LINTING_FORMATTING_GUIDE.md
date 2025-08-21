# Linting and Formatting Configuration Guide

This document describes the comprehensive linting and formatting setup for the CircuitExp1 project.

## Overview

The project uses a combination of ESLint, Prettier, and Husky to ensure consistent code quality and formatting across
all files. This setup includes:

- **ESLint**: Code linting and static analysis
- **Prettier**: Code formatting and style enforcement
- **Husky**: Git hooks for pre-commit validation
- **lint-staged**: Run linting/formatting only on staged files

## Configuration Files

### ESLint Configuration

- **File**: `eslint.config.js`
- **Type**: Flat config format (ESLint 9+)
- **Features**:
  - TypeScript strict type checking
  - React and React Hooks rules
  - Security-focused rules
  - Import sorting and organization
  - Electron-specific configurations
  - Test-specific relaxed rules

### Prettier Configuration

- **File**: `.prettierrc`
- **Features**:
  - 2-space indentation
  - Single quotes for strings
  - Trailing commas (ES5 compatible)
  - 100 character line width
  - Consistent formatting across file types

### Editor Configuration

- **File**: `.editorconfig`
- **Purpose**: Ensures consistent editor settings across different IDEs
- **Features**:
  - UTF-8 encoding
  - Unix-style line endings
  - Trim trailing whitespace
  - Insert final newlines

### Git Hooks

- **Directory**: `.husky/`
- **Pre-commit hook**: `.husky/pre-commit`
- **Function**: Runs lint-staged on all staged files before commit

## Available Scripts

### Linting Commands

```bash
# Run ESLint on all files
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Check formatting without changes
npm run format:check

# Format all files
npm run format

# Type checking
npm run type-check

# Run all quality checks
npm run validate
```

### Pre-commit Behavior

- Automatically runs on every `git commit`
- Only processes staged files (faster)
- Runs ESLint with auto-fix
- Runs Prettier formatting
- Blocks commit if any issues remain

## File Type Support

### JavaScript/TypeScript Files

- `.js`, `.jsx`, `.ts`, `.tsx`
- `.cjs`, `.mjs` (CommonJS/ES modules)
- ESLint rules: Code quality, security, best practices
- Prettier: Consistent formatting

### Configuration Files

- `.json`, `.yml`, `.yaml`
- `.css`, `.md`
- Prettier formatting only (no ESLint)

### Special Cases

- **Test files**: Relaxed ESLint rules in `tests/` directory
- **Electron main process**: Node.js globals allowed
- **Build artifacts**: Excluded from linting/formatting

## IDE Integration

### VS Code Setup

1. Install extensions:
   - ESLint
   - Prettier - Code formatter
   - EditorConfig for VS Code

2. Settings configuration:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### WebStorm/IntelliJ

1. Enable ESLint integration: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
2. Enable Prettier: Settings → Languages & Frameworks → JavaScript → Prettier
3. Enable EditorConfig support: Settings → Editor → Code Style → Enable EditorConfig support

## Custom Rules and Exceptions

### ESLint Rules

- **Security**: Enforces secure coding practices
- **React**: Enforces React best practices
- **Import**: Organizes and sorts imports
- **TypeScript**: Strict type checking enabled

### Prettier Overrides

- **JSON files**: 2-space indentation
- **Markdown**: Wrap prose at 100 characters
- **YAML**: 2-space indentation, no tabs

### Ignored Files

- Build artifacts (`dist/`, `node_modules/`)
- Lock files (`package-lock.json`, `yarn.lock`)
- Generated files
- Test fixtures and mock data

## Troubleshooting

### Common Issues

1. **ESLint not working in VS Code**
   - Ensure ESLint extension is installed
   - Reload window after config changes
   - Check `.vscode/settings.json`

2. **Prettier conflicts with ESLint**
   - Prettier handles formatting, ESLint handles code quality
   - No conflicts expected with current setup

3. **Pre-commit hook failing**
   - Run `npm run lint:fix` and `npm run format` manually
   - Check specific error messages
   - Ensure all dependencies are installed

4. **Husky not running**
   - Run `npm install` to trigger prepare script
   - Check `.husky/pre-commit` file permissions

### Manual Override

To skip pre-commit hooks (not recommended):

```bash
git commit --no-verify -m "Your message"
```

## Extending the Configuration

### Adding New Rules

1. Modify `eslint.config.js` for new linting rules
2. Update `.prettierrc` for formatting changes
3. Test changes with `npm run validate`

### Adding New File Types

1. Update ESLint config in `eslint.config.js`
2. Add file patterns to `.lintstagedrc.json`
3. Update `.prettierignore` if needed

## Performance Considerations

- **lint-staged**: Only processes staged files
- **ESLint caching**: Enabled for faster subsequent runs
- **Prettier caching**: Not needed due to fast processing
- **Git hooks**: Fast execution prevents slow commits

## Migration from Legacy Configurations

If migrating from older ESLint configurations:

1. Remove legacy `.eslintrc.*` files
2. Remove legacy `.prettierrc.*` files
3. Update scripts to use new commands
4. Test all functionality with `npm run validate`

## Support and Maintenance

- **Regular updates**: Keep dependencies current
- **Rule review**: Periodically review and update rules
- **Team onboarding**: Ensure all team members configure IDEs
- **CI/CD integration**: Add validation to build pipeline

For questions or issues, please check the troubleshooting section or create an issue in the project repository.
