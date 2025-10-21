#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

interface AuditReport {
  missingInEN: string[];
  missingInTR: string[];
  unusedKeysEN: string[];
  unusedKeysTR: string[];
  duplicateKeysEN: string[];
  duplicateKeysTR: string[];
  hardcodedStrings: Array<{ file: string; line: number; text: string }>;
  summary: {
    totalUsedKeys: number;
    totalDefinedKeysEN: number;
    totalDefinedKeysTR: number;
    totalMissing: number;
    totalUnused: number;
    totalDuplicates: number;
    totalHardcoded: number;
  };
}

// Extract all t('...') and t("...") calls from source files
const extractUsedKeys = (dir: string): Set<string> => {
  const usedKeys = new Set<string>();
  
  const walk = (currentPath: string) => {
    const files = fs.readdirSync(currentPath);
    
    files.forEach(file => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
          walk(filePath);
        }
      } else if ((file.endsWith('.tsx') || file.endsWith('.ts')) && !file.endsWith('.test.tsx') && !file.endsWith('.test.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Match t('key') and t("key") - handles both single and double quotes
        const matches = content.matchAll(/t\(['"]([\w]+)['"]\)/g);
        for (const match of matches) {
          usedKeys.add(match[1]);
        }
      }
    });
  };
  
  walk(dir);
  return usedKeys;
};

// Find hardcoded English strings in JSX
const findHardcodedStrings = (dir: string): Array<{ file: string; line: number; text: string }> => {
  const hardcoded: Array<{ file: string; line: number; text: string }> = [];
  
  const walk = (currentPath: string) => {
    const files = fs.readdirSync(currentPath);
    
    files.forEach(file => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
          walk(filePath);
        }
      } else if (file.endsWith('.tsx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, idx) => {
          // Look for potential hardcoded strings in JSX (3+ consecutive letters)
          // Exclude imports, comments, code strings
          if (line.includes('import ') || line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          
          // Match text inside JSX tags or attributes that aren't using t()
          const jsxTextMatches = line.matchAll(/>[^<]*([A-Z][a-z]{2,}[^<]*)</g);
          for (const match of jsxTextMatches) {
            if (!match[0].includes('t(') && !match[0].includes('className') && !match[0].includes('https://')) {
              hardcoded.push({
                file: filePath.replace(process.cwd(), '.'),
                line: idx + 1,
                text: match[0].substring(0, 50)
              });
            }
          }
        });
      }
    });
  };
  
  walk(dir);
  return hardcoded;
};

// Extract defined keys from LanguageContext
const extractDefinedKeys = (lang: 'en' | 'tr'): { keys: Set<string>; duplicates: string[] } => {
  const contextPath = path.join(__dirname, '../src/contexts/LanguageContext.tsx');
  const content = fs.readFileSync(contextPath, 'utf8');
  
  // Extract language section
  const regex = lang === 'en' 
    ? /en:\s*{([^}]+(?:{[^}]+})*?)}\s*,\s*tr:/s
    : /tr:\s*{([^}]+(?:{[^}]+})*?)}\s*},?\s*};/s;
    
  const match = content.match(regex);
  if (!match) {
    console.error(`Could not parse LanguageContext.tsx ${lang} section`);
    return { keys: new Set(), duplicates: [] };
  }
  
  const keyMatches = [...match[1].matchAll(/(\w+):/g)];
  const keys = keyMatches.map(m => m[1]);
  
  // Find duplicates
  const seen = new Set<string>();
  const duplicates: string[] = [];
  keys.forEach(key => {
    if (seen.has(key)) {
      duplicates.push(key);
    } else {
      seen.add(key);
    }
  });
  
  return { keys: seen, duplicates };
};

// Generate markdown report
const generateMarkdownReport = (report: AuditReport): string => {
  let md = '# i18n Audit Report\n\n';
  
  md += '## Summary\n\n';
  md += `- **Total Keys Used in Code**: ${report.summary.totalUsedKeys}\n`;
  md += `- **Total Keys Defined (EN)**: ${report.summary.totalDefinedKeysEN}\n`;
  md += `- **Total Keys Defined (TR)**: ${report.summary.totalDefinedKeysTR}\n`;
  md += `- **Missing Keys**: ${report.summary.totalMissing}\n`;
  md += `- **Unused Keys**: ${report.summary.totalUnused}\n`;
  md += `- **Duplicate Keys**: ${report.summary.totalDuplicates}\n`;
  md += `- **Hardcoded Strings**: ${report.summary.totalHardcoded}\n\n`;
  
  if (report.missingInEN.length > 0) {
    md += '## ❌ Missing Keys in EN\n\n';
    report.missingInEN.forEach(key => md += `- \`${key}\`\n`);
    md += '\n';
  }
  
  if (report.missingInTR.length > 0) {
    md += '## ❌ Missing Keys in TR\n\n';
    report.missingInTR.forEach(key => md += `- \`${key}\`\n`);
    md += '\n';
  }
  
  if (report.unusedKeysEN.length > 0) {
    md += '## ⚠️ Unused Keys (can be removed)\n\n';
    report.unusedKeysEN.slice(0, 20).forEach(key => md += `- \`${key}\`\n`);
    if (report.unusedKeysEN.length > 20) {
      md += `\n_... and ${report.unusedKeysEN.length - 20} more_\n`;
    }
    md += '\n';
  }
  
  if (report.duplicateKeysEN.length > 0 || report.duplicateKeysTR.length > 0) {
    md += '## 🔴 Duplicate Keys (must fix!)\n\n';
    if (report.duplicateKeysEN.length > 0) {
      md += '**English:**\n';
      report.duplicateKeysEN.forEach(key => md += `- \`${key}\`\n`);
    }
    if (report.duplicateKeysTR.length > 0) {
      md += '**Turkish:**\n';
      report.duplicateKeysTR.forEach(key => md += `- \`${key}\`\n`);
    }
    md += '\n';
  }
  
  if (report.hardcodedStrings.length > 0) {
    md += '## 🟡 Potential Hardcoded Strings\n\n';
    report.hardcodedStrings.slice(0, 30).forEach(hs => {
      md += `- **${hs.file}:${hs.line}** - \`${hs.text}\`\n`;
    });
    if (report.hardcodedStrings.length > 30) {
      md += `\n_... and ${report.hardcodedStrings.length - 30} more_\n`;
    }
  }
  
  return md;
};

// Main execution
const srcDir = path.join(__dirname, '../src');
const usedKeys = extractUsedKeys(srcDir);
const { keys: definedKeysEN, duplicates: duplicatesEN } = extractDefinedKeys('en');
const { keys: definedKeysTR, duplicates: duplicatesTR } = extractDefinedKeys('tr');
const hardcodedStrings = findHardcodedStrings(srcDir);

const missingInEN = [...usedKeys].filter(k => !definedKeysEN.has(k));
const missingInTR = [...usedKeys].filter(k => !definedKeysTR.has(k));
const unusedKeysEN = [...definedKeysEN].filter(k => !usedKeys.has(k));
const unusedKeysTR = [...definedKeysTR].filter(k => !usedKeys.has(k));

const report: AuditReport = {
  missingInEN,
  missingInTR,
  unusedKeysEN,
  unusedKeysTR,
  duplicateKeysEN: duplicatesEN,
  duplicateKeysTR: duplicatesTR,
  hardcodedStrings,
  summary: {
    totalUsedKeys: usedKeys.size,
    totalDefinedKeysEN: definedKeysEN.size,
    totalDefinedKeysTR: definedKeysTR.size,
    totalMissing: Math.max(missingInEN.length, missingInTR.length),
    totalUnused: unusedKeysEN.length,
    totalDuplicates: duplicatesEN.length + duplicatesTR.length,
    totalHardcoded: hardcodedStrings.length
  }
};

// Output format based on CLI flag
const outputMarkdown = process.argv.includes('--md');

if (outputMarkdown) {
  console.log(generateMarkdownReport(report));
} else {
  console.log(JSON.stringify(report, null, 2));
}

// Exit with error if there are missing keys or duplicates
if (report.summary.totalMissing > 0 || report.summary.totalDuplicates > 0) {
  process.exit(1);
}
