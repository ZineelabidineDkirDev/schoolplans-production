import { describe, expect, it } from 'vitest';
import { hasPasswordAuthMethod } from './authSession';

function sessionWithClaims(claims: object) {
  const encoded = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return { access_token: `header.${encoded}.signature` };
}

describe('hasPasswordAuthMethod', () => {
  it('recognizes a password authentication method', () => {
    expect(hasPasswordAuthMethod(sessionWithClaims({ amr: [{ method: 'password' }] }))).toBe(true);
  });

  it('does not treat OAuth or malformed tokens as password sessions', () => {
    expect(hasPasswordAuthMethod(sessionWithClaims({ amr: [{ method: 'oauth' }] }))).toBe(false);
    expect(hasPasswordAuthMethod({ access_token: 'not-a-jwt' })).toBe(false);
  });
});
