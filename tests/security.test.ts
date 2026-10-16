import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

export function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

describe('Web Security Architecture & Vercel Verification', () => {
  it('strictly validates external URL protocols (only http: and https: permitted)', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
    expect(isValidExternalUrl('http://localhost:3000')).toBe(true);
    expect(isValidExternalUrl('file:///C:/secrets.txt')).toBe(false);
    expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isValidExternalUrl('data:text/html,<script>evil()</script>')).toBe(false);
    expect(isValidExternalUrl('custom-proto://execute')).toBe(false);
    expect(isValidExternalUrl('not-a-url')).toBe(false);
  });

  it('contains zero hardcoded secrets or JWT credentials in web source files', () => {
    const scanDir = (dir: string): string[] => {
      let results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const files = scanDir(path.join(__dirname, '../src'));
    const jwtPattern = /eyJ[a-zA-Z0-9_-]{20,}/;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(jwtPattern);
    }
  });

  it('enforces strict security headers in vercel.json configuration', () => {
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf-8'));
    expect(vercelConfig.headers).toBeDefined();

    const headersList = vercelConfig.headers[0].headers;
    const headerMap = Object.fromEntries(headersList.map((h: any) => [h.key, h.value]));

    expect(headerMap['X-Content-Type-Options']).toBe('nosniff');
    expect(headerMap['X-Frame-Options']).toBe('DENY');
    expect(headerMap['X-XSS-Protection']).toBe('1; mode=block');
    expect(headerMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
