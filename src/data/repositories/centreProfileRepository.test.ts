import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getCentreProfile, saveCentreProfile, uploadCentreLogo } from './centreProfileRepository';

function createClient(result: unknown = null) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const query: Record<string, (...args: never[]) => unknown> = {};
  for (const method of ['select', 'eq', 'update']) {
    query[method] = ((...args: unknown[]) => {
      calls.push({ table: 'centres', method, args });
      return query;
    }) as (...args: never[]) => unknown;
  }
  query.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

const centreRow = {
  id: 'centre-a',
  nom: 'Centre Atlas',
  telephone: '0600000000',
  email: 'contact@example.test',
  ville: 'Rabat',
  adresse: 'Centre-ville',
  logo_url: null,
};

describe('centre profile repository', () => {
  it('loads an existing centre profile by id', async () => {
    const { client, calls } = createClient(centreRow);
    await expect(getCentreProfile(client, 'centre-a')).resolves.toEqual({
      id: 'centre-a',
      name: 'Centre Atlas',
      telephone: '0600000000',
      email: 'contact@example.test',
      city: 'Rabat',
      address: 'Centre-ville',
      logoUrl: null,
    });
    expect(calls).toContainEqual({ table: 'centres', method: 'eq', args: ['id', 'centre-a'] });
  });

  it('updates only the observed profile fields for the scoped centre', async () => {
    const { client, calls } = createClient(centreRow);
    await saveCentreProfile(
      client,
      'centre-a',
      {
        name: ' Centre Atlas ',
        telephone: ' 0600000000 ',
        email: '',
        city: ' Rabat ',
        address: '',
      },
      'https://example.test/logo.png',
    );
    expect(calls).toContainEqual({
      table: 'centres',
      method: 'update',
      args: [
        {
          nom: 'Centre Atlas',
          telephone: '0600000000',
          email: null,
          ville: 'Rabat',
          adresse: null,
          logo_url: 'https://example.test/logo.png',
        },
      ],
    });
    expect(calls).toContainEqual({ table: 'centres', method: 'eq', args: ['id', 'centre-a'] });
  });

  it('rejects a missing centre or empty name without issuing a write', async () => {
    const { client, from } = createClient();
    await expect(getCentreProfile(client, '')).rejects.toThrow('n’est pas rattaché');
    await expect(
      saveCentreProfile(client, 'centre-a', {
        name: ' ',
        telephone: '',
        email: '',
        city: '',
        address: '',
      }),
    ).rejects.toThrow('nom du centre est obligatoire');
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects non-image uploads', async () => {
    const { client } = createClient();
    const file = new File(['not an image'], 'document.txt', { type: 'text/plain' });
    await expect(uploadCentreLogo(client, 'centre-a', file)).rejects.toThrow(
      'Sélectionnez un fichier image',
    );
  });
});
