#!/usr/bin/env node

/**
 * Quality Gates Checker
 * Validates that all quality gates are met before deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = require('../quality-gates.config.cjs');

class QualityGateChecker {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  async checkAll() {
    console.log('🚀 Running Quality Gate Checks...\n');

    await this.checkCoverage();
    await this.checkLinting();
    await this.checkTypeScript();
    await this.checkSecurity();
    await this.checkPerformance();
    await this.checkBuild();

    this.printResults();
    return this.results.failed.length === 0;
  }

  async checkCoverage() {
    console.log('📊 Checking test coverage...');

    try {
      // Run coverage and parse results
      execSync('npm run coverage:ci', { stdio: 'pipe' });

      const coverageFile = path.join(process.cwd(), 'coverage/coverage-summary.json');
      if (!fs.existsSync(coverageFile)) {
        this.fail('Coverage', 'Coverage report not found');
        return;
      }

      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      const total = coverage.total;

      // Check global thresholds
      const checks = [
        { name: 'Lines', actual: total.lines.pct, required: config.coverage.global.lines },
        { name: 'Branches', actual: total.branches.pct, required: config.coverage.global.branches },
        { name: 'Functions', actual: total.functions.pct, required: config.coverage.global.functions },
        { name: 'Statements', actual: total.statements.pct, required: config.coverage.global.statements },
      ];

      let allPassed = true;
      for (const check of checks) {
        if (check.actual >= check.required) {
          this.pass('Coverage', `${check.name}: ${check.actual}% (>= ${check.required}%)`);
        } else {
          this.fail('Coverage', `${check.name}: ${check.actual}% (< ${check.required}%)`);
          allPassed = false;
        }
      }

      if (allPassed) {
        this.pass('Coverage', 'All coverage thresholds met');
      }
    } catch (error) {
      this.fail('Coverage', `Failed to check coverage: ${error.message}`);
    }
  }

  async checkLinting() {
    console.log('🧹 Checking lint violations...');

    try {
      const result = execSync('npm run lint -- --format json', {
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const lintResults = JSON.parse(result);
      let totalErrors = 0;
      let totalWarnings = 0;

      lintResults.forEach(file => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;
      });

      if (totalErrors <= config.lint.maxErrors) {
        this.pass('Lint', `Errors: ${totalErrors} (<= ${config.lint.maxErrors})`);
      } else {
        this.fail('Lint', `Errors: ${totalErrors} (> ${config.lint.maxErrors})`);
      }

      if (totalWarnings <= config.lint.maxWarnings) {
        this.pass('Lint', `Warnings: ${totalWarnings} (<= ${config.lint.maxWarnings})`);
      } else {
        this.warn('Lint', `Warnings: ${totalWarnings} (> ${config.lint.maxWarnings})`);
      }
    } catch (error) {
      // ESLint returns non-zero exit code when there are violations
      this.fail('Lint', 'Lint violations found');
    }
  }

  async checkTypeScript() {
    console.log('📝 Checking TypeScript compilation...');

    try {
      execSync('npm run type-check', { stdio: 'pipe' });
      this.pass('TypeScript', 'No type errors found');
    } catch (error) {
      this.fail('TypeScript', 'Type errors found');
    }
  }

  async checkSecurity() {
    console.log('🔒 Checking security vulnerabilities...');

    try {
      const auditResult = execSync('npm audit --json', {
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const audit = JSON.parse(auditResult);
      const vulnerabilities = audit.vulnerabilities || {};

      let criticalCount = 0;
      let highCount = 0;
      let moderateCount = 0;
      let lowCount = 0;

      Object.values(vulnerabilities).forEach(vuln => {
        switch (vuln.severity) {
          case 'critical': criticalCount++; break;
          case 'high': highCount++; break;
          case 'moderate': moderateCount++; break;
          case 'low': lowCount++; break;
        }
      });

      const checks = [
        { name: 'Critical', count: criticalCount, max: config.security.maxVulnerabilities.critical },
        { name: 'High', count: highCount, max: config.security.maxVulnerabilities.high },
        { name: 'Moderate', count: moderateCount, max: config.security.maxVulnerabilities.moderate },
        { name: 'Low', count: lowCount, max: config.security.maxVulnerabilities.low },
      ];

      let allPassed = true;
      for (const check of checks) {
        if (check.count <= check.max) {
          this.pass('Security', `${check.name}: ${check.count} (<= ${check.max})`);
        } else {
          this.fail('Security', `${check.name}: ${check.count} (> ${check.max})`);
          allPassed = false;
        }
      }

      if (allPassed) {
        this.pass('Security', 'All vulnerability thresholds met');
      }
    } catch (error) {
      this.warn('Security', 'Could not check vulnerabilities');
    }
  }

  async checkPerformance() {
    console.log('⚡ Checking performance metrics...');

    try {
      // Check if performance test results exist
      const perfResultsPath = path.join(process.cwd(), 'performance-results.json');
      if (fs.existsSync(perfResultsPath)) {
        const results = JSON.parse(fs.readFileSync(perfResultsPath, 'utf8'));

        if (results.memoryLeakRate <= config.performance.memoryLeaks.maxGrowthRate) {
          this.pass('Performance', `Memory leak rate: ${results.memoryLeakRate}%`);
        } else {
          this.fail('Performance', `Memory leak rate: ${results.memoryLeakRate}% (> ${config.performance.memoryLeaks.maxGrowthRate}%)`);
        }
      } else {
        this.warn('Performance', 'No performance test results found');
      }
    } catch (error) {
      this.warn('Performance', `Could not check performance: ${error.message}`);
    }
  }

  async checkBuild() {
    console.log('🏗️ Checking build artifacts...');

    try {
      // Check if build directory exists
      const distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distPath)) {
        this.fail('Build', 'dist directory not found');
        return;
      }

      // Check required artifacts
      let allArtifactsExist = true;
      for (const artifact of config.build.requiredArtifacts) {
        const artifactPath = path.join(process.cwd(), artifact);
        if (fs.existsSync(artifactPath)) {
          this.pass('Build', `Artifact exists: ${artifact}`);
        } else {
          this.fail('Build', `Missing artifact: ${artifact}`);
          allArtifactsExist = false;
        }
      }

      if (allArtifactsExist) {
        this.pass('Build', 'All required build artifacts present');
      }
    } catch (error) {
      this.fail('Build', `Build check failed: ${error.message}`);
    }
  }

  pass(category, message) {
    this.results.passed.push({ category, message });
    console.log(`  ✅ ${category}: ${message}`);
  }

  fail(category, message) {
    this.results.failed.push({ category, message });
    console.log(`  ❌ ${category}: ${message}`);
  }

  warn(category, message) {
    this.results.warnings.push({ category, message });
    console.log(`  ⚠️  ${category}: ${message}`);
  }

  printResults() {
    console.log('\n📋 Quality Gate Results:');
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);

    if (this.results.failed.length > 0) {
      console.log('\n❌ Failed Checks:');
      this.results.failed.forEach(result => {
        console.log(`  - ${result.category}: ${result.message}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach(result => {
        console.log(`  - ${result.category}: ${result.message}`);
      });
    }

    const overallStatus = this.results.failed.length === 0 ? 'PASSED' : 'FAILED';
    console.log(`\n🎯 Overall Status: ${overallStatus}`);
  }
}

// Run quality gates if called directly
if (require.main === module) {
  const checker = new QualityGateChecker();
  checker.checkAll().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(error => {
    console.error('Quality gate check failed:', error);
    process.exit(1);
  });
}

module.exports = QualityGateChecker;
