#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Extract all t('...') calls from source files
const extractUsedKeys = (dir) => {
  const usedKeys = new Set();
  const walk = (currentPath) => {
    const files = fs.readdirSync(currentPath);
    
    files.forEach(file => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
          walk(filePath);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
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

// Extract defined keys from LanguageContext
const extractDefinedKeys = () => {
  const contextPath = path.join(__dirname, '../src/contexts/LanguageContext.tsx');
  const content = fs.readFileSync(contextPath, 'utf8');
  
  // Extract en keys (they should match tr keys)
  const enMatch = content.match(/en:\s*{([^}]+(?:}[^}]+)*?)}\s*,\s*tr:/s);
  if (!enMatch) {
    console.error('Could not parse LanguageContext.tsx en section');
    return new Set();
  }
  
  const keys = enMatch[1].matchAll(/(\w+):/g);
  return new Set([...keys].map(m => m[1]));
};

// Main verification
console.log('🔍 Checking translation keys...\n');

const usedKeys = extractUsedKeys(path.join(__dirname, '../src'));
const definedKeys = extractDefinedKeys();

const missingKeys = [...usedKeys].filter(k => !definedKeys.has(k));
const unusedKeys = [...definedKeys].filter(k => !usedKeys.has(k));

let exitCode = 0;

if (missingKeys.length > 0) {
  console.error('❌ Missing translation keys (used in code but not defined):');
  missingKeys.forEach(k => console.error(`  - ${k}`));
  console.error('');
  exitCode = 1;
}

if (unusedKeys.length > 0) {
  console.warn('⚠️  Unused translation keys (defined but not used):');
  unusedKeys.forEach(k => console.warn(`  - ${k}`));
  console.warn('');
}

if (exitCode === 0 && unusedKeys.length === 0) {
  console.log('✅ All translation keys are valid and used!');
} else if (exitCode === 0) {
  console.log('✅ All used translation keys are defined (but some unused keys exist)');
}

process.exit(exitCode);
