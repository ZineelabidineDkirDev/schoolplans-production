import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getMyCentreStudents, parseCentreStudentRows } from './studentRepository';

describe('student repository contract', () => {
  it('maps the RPC fields and preserves nullable contact details', () => {
    expect(
      parseCentreStudentRows(
        [
          {
            id: 12,
            prenom: 'Nezha',
            nom: 'Alaoui',
            email: null,
            telephone: '0600000000',
            ville: 'Rabat',
            centre_id: 'centre-a',
          },
        ],
        'centre-a',
      ),
    ).toEqual([
      {
        id: 12,
        firstName: 'Nezha',
        lastName: 'Alaoui',
        email: null,
        telephone: '0600000000',
        centreId: 'centre-a',
      },
    ]);
  });

  it('rejects students returned for another centre', () => {
    expect(() =>
      parseCentreStudentRows(
        [
          {
            id: 12,
            prenom: 'Nezha',
            nom: 'Alaoui',
            centre_id: 'centre-b',
          },
        ],
        'centre-a',
      ),
    ).toThrow('hors du centre actif');
  });

  it('requires a centre before issuing any Supabase query', async () => {
    const rpc = vi.fn();
    const from = vi.fn();
    const client = { rpc, from } as unknown as SupabaseClient;

    await expect(getMyCentreStudents(client, '')).rejects.toThrow('n’est rattaché à aucun centre');
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
