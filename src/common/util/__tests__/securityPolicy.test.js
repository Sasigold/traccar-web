import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  contentSecurityPolicy,
  inlineScripts,
  scriptHash,
  securityHeaders,
} from '../securityPolicy';

describe('security policy (SEC-10)', () => {
  it('hashes inline scripts the way browsers do', () => {
    // echo -n "alert(1)" | openssl dgst -sha256 -binary | base64
    expect(scriptHash('alert(1)')).toBe("'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='");
  });

  it('finds only inline scripts', () => {
    const html =
      '<script>a()</script><script type="module" src="x.js"></script><script id="b">b()</script>';
    expect(inlineScripts(html)).toEqual(['a()', 'b()']);
  });

  it('index.html has no inline event handlers, which a hash cannot allow', () => {
    const html = readFileSync(new URL('../../../../index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(/\son[a-z]+=["']/i);
    expect(inlineScripts(html)).toHaveLength(1);
  });

  it('allows scripts only from the app and the listed hashes', () => {
    const policy = contentSecurityPolicy({ scriptHashes: ["'sha256-x'"] });
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval' 'sha256-x'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    // frame-ancestors only works as a header.
    expect(policy).not.toContain('frame-ancestors');
    expect(contentSecurityPolicy({ header: true })).toContain("frame-ancestors 'none'");
  });

  it('lists every header for the reverse proxy', () => {
    const headers = securityHeaders({ scriptHashes: ["'sha256-x'"] });
    expect(Object.keys(headers)).toEqual([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ]);
    expect(headers['Content-Security-Policy']).toContain("'sha256-x'");
    expect(headers['Permissions-Policy']).toContain('camera=(self)');
  });
});
