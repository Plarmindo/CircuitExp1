#!/usr/bin/env node
/*
 * Consolidate license and vulnerability audit outputs into a single JSON + markdown summary.
 * Inputs (must exist, else script exits non-zero):
 *  - licenses-summary.json (from npm run audit:licenses)
 *  - npm-audit.json (from npm run audit:vulns)
 * Output:
 *  - audit-report.json
 *  - audit-report.md (human readable)
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const licPath = path.join(root, 'licenses-summary.json');
const vulnPath = path.join(root, 'npm-audit.json');
if (!fs.existsSync(licPath) || !fs.existsSync(vulnPath)) {
  console.error('[audit:report] Missing input files. Run npm run audit:licenses && npm run audit:vulns first.');
  process.exit(1);
}

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
const licenses = readJSON(licPath);
const audit = readJSON(vulnPath);

// Normalize license stats
const licenseCounts = {};
Object.values(licenses).forEach(entry => {
  const lic = entry.licenses || 'UNKNOWN';
  licenseCounts[lic] = (licenseCounts[lic]||0)+1;
});

// Extract vulnerability stats (npm audit v7 style JSON)
let advisories = [];
if (audit.vulnerabilities) {
  // Newer npm audit aggregates by package
  for (const [name, info] of Object.entries(audit.vulnerabilities)) {
    advisories.push({
      name,
      severity: info.severity,
      via: info.via,
      effects: info.effects,
      range: info.range
    });
  }
} else if (audit.advisories) {
  advisories = Object.values(audit.advisories).map(a => ({
    name: a.module_name,
    severity: a.severity,
    title: a.title,
    url: a.url,
    vulnerable_versions: a.vulnerable_versions,
    patched_versions: a.patched_versions
  }));
}

const severityOrder = ['critical','high','moderate','low'];
const bySeverity = {};
for (const adv of advisories) {
  const sev = adv.severity || 'unknown';
  bySeverity[sev] = (bySeverity[sev]||0)+1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  licenseCounts,
  totalPackages: Object.keys(licenses).length,
  vulnerabilities: {
    counts: bySeverity,
    total: advisories.length,
  },
  remediation: []
};

// Simple remediation suggestions (upgrade hints) for moderate+ severities
for (const adv of advisories) {
  if (['critical','high','moderate'].includes(adv.severity)) {
    summary.remediation.push({
      package: adv.name,
      severity: adv.severity,
      action: 'Review and upgrade to a non-vulnerable version if available.'
    });
  }
}

fs.writeFileSync('audit-report.json', JSON.stringify(summary,null,2));

// Markdown report
let md = '# Dependency & License Audit Report\n\n';
md += `Generated: ${summary.generatedAt}\n\n`;
md += '## License Distribution\n\n';
for (const [lic,count] of Object.entries(licenseCounts).sort((a,b)=>b[1]-a[1])) {
  md += `- ${lic}: ${count}\n`;
}
md += '\n## Vulnerabilities\n\n';
if (!advisories.length) {
  md += 'No vulnerabilities detected.\n';
} else {
  for (const sev of severityOrder) {
    if (bySeverity[sev]) md += `- ${sev}: ${bySeverity[sev]}\n`;
  }
  md += '\n### Remediation Suggestions\n';
  summary.remediation.forEach(r => { md += `- ${r.package} (${r.severity}): ${r.action}\n`; });
}
fs.writeFileSync('audit-report.md', md);
console.log('[audit:report] Wrote audit-report.json and audit-report.md');
