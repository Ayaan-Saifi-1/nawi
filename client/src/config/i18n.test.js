import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from './i18n.js';

function jsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? jsxFiles(path) : entry.name.endsWith('.jsx') ? [path] : [];
  });
}

describe('translation dictionary', () => {
  it('provides a non-empty Hindi value for every English key', () => {
    Object.keys(TRANSLATIONS.EN).forEach((key) => {
      expect(typeof TRANSLATIONS.HI[key]).toBe('string');
      expect(TRANSLATIONS.HI[key].trim()).not.toBe('');
    });
  });

  it('defines every translation key used by JSX', () => {
    const srcRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..');
    const usedKeys = new Set();
    jsxFiles(srcRoot).forEach((file) => {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) usedKeys.add(match[1]);
    });
    const missing = [...usedKeys].filter((key) => !(key in TRANSLATIONS.EN) || !(key in TRANSLATIONS.HI));
    expect(missing, `Missing translation keys: ${missing.map((key) => relative(srcRoot, key)).join(', ')}`).toEqual([]);
  });
});
