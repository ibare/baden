import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'yaml';
import type { ParsedRule, IndexYaml, IndexYamlEntry, RuleCategory } from '../types.js';

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function idFromFilename(filePath: string): string {
  return path.basename(filePath, '.md').replace(/\s+/g, '-').toLowerCase();
}

function parseEntry(
  entry: IndexYamlEntry,
  category: RuleCategory,
  rulesPath: string,
): ParsedRule | null {
  const fullPath = path.resolve(rulesPath, entry.file);

  if (!fs.existsSync(fullPath)) {
    console.warn(`[RuleParser] File not found: ${fullPath}`);
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const contentHash = computeHash(content);
  const id = entry.id || idFromFilename(entry.file);

  return {
    id,
    category,
    filePath: entry.file,
    description: entry.description || null,
    triggers: entry.triggers || null,
    contentHash,
  };
}

export function parseRules(rulesPath: string): ParsedRule[] {
  const indexPath = path.resolve(rulesPath, 'INDEX.yaml');

  if (!fs.existsSync(indexPath)) {
    throw new Error(`INDEX.yaml not found at ${indexPath}`);
  }

  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const index: IndexYaml = yaml.parse(indexContent);
  const rules: ParsedRule[] = [];

  const sections: { key: keyof IndexYaml; category: RuleCategory }[] = [
    { key: 'always', category: 'always' },
    { key: 'concerns', category: 'concerns' },
    { key: 'specifics', category: 'specifics' },
  ];

  for (const { key, category } of sections) {
    const entries = index[key];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      const rule = parseEntry(entry, category, rulesPath);
      if (rule) {
        rules.push(rule);
      }
    }
  }

  return rules;
}
