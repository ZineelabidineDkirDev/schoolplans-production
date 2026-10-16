import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createCentreCertificate } from './certificateRepository';

describe('certificate repository', () => {
  it('validates required centre, module, duration and date range before writing', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    const input = {
      studentId: 10,
      module: 'Formation',
      startsOn: '2026-05-20',
      endsOn: '2026-05-10',
      hours: 12,
      mention: null,
    };
    await expect(createCentreCertificate(client, '', input)).rejects.toThrow('n’est pas rattaché');
    await expect(
      createCentreCertificate(client, 'centre-a', { ...input, module: '  ' }),
    ).rejects.toThrow('formation est obligatoire');
    await expect(
      createCentreCertificate(client, 'centre-a', { ...input, hours: Number.NaN }),
    ).rejects.toThrow('nombre d’heures');
    await expect(createCentreCertificate(client, 'centre-a', input)).rejects.toThrow(
      'date de fin doit être postérieure',
    );
    expect(from).not.toHaveBeenCalled();
  });
});
