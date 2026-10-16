import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  approveEnrollmentRequest,
  createEnrollmentRequest,
  getActiveEnrollmentCentres,
  getEnrollmentRequestForUser,
  getEnrollmentRequests,
  rejectEnrollmentRequest,
} from './enrollmentRequestRepository';

function createClient(resultData: unknown[] = []) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const tableRows: Record<string, unknown> = {};
  let currentTable = '';
  const query: Record<string, (...args: never[]) => unknown> = {};

  const chainMethods = ['select', 'order', 'limit', 'insert'];
  for (const method of chainMethods) {
    query[method] = (...args: never[]) => {
      calls.push({ table: currentTable, method, args });
      return query;
    };
  }
  query.eq = ((column: string, value: unknown) => {
    calls.push({ table: currentTable, method: 'eq', args: [column, value] });
    filters.push({ table: currentTable, column, value });
    return query;
  }) as (...args: never[]) => unknown;
  query.then = ((resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: tableRows[currentTable] ?? resultData, error: null }).then(
      resolve,
    )) as (...args: never[]) => unknown;
  query.maybeSingle = (() =>
    Promise.resolve({ data: tableRows[currentTable] ?? resultData[0] ?? null, error: null })) as (
    ...args: never[]
  ) => unknown;
  const from = vi.fn((table: string) => {
    currentTable = table;
    return query;
  });
  const rpc = vi.fn(async (): Promise<{ data: unknown; error: Error | null }> => ({
    data: null,
    error: null,
  }));
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, calls, filters, from, rpc, tableRows };
}

const requestRow = {
  id: 42,
  user_id: 'user-a',
  prenom: 'Amina',
  nom: 'Benali',
  email: 'amina@example.test',
  telephone: '0600000000',
  adresse: '10 rue des écoles',
  ville: 'Rabat',
  niveau_etudes: 'Supérieur',
  statut: 'en_attente',
  motif: null,
  created_at: '2026-10-15T09:30:00.000Z',
};

describe('enrollment request repository', () => {
  it('requires a centre and retrieves up to 200 newest requests within the chosen status', async () => {
    const { client, calls, filters, from } = createClient([requestRow]);

    const result = await getEnrollmentRequests(client, 'centre-a', 'en_attente');

    expect(from).toHaveBeenCalledWith('demandes_inscription');
    expect(filters).toContainEqual({
      table: 'demandes_inscription',
      column: 'centre_id',
      value: 'centre-a',
    });
    expect(filters).toContainEqual({
      table: 'demandes_inscription',
      column: 'statut',
      value: 'en_attente',
    });
    expect(calls).toContainEqual({
      table: 'demandes_inscription',
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
    expect(calls).toContainEqual({
      table: 'demandes_inscription',
      method: 'limit',
      args: [200],
    });
    expect(result).toEqual([
      {
        id: 42,
        userId: 'user-a',
        firstName: 'Amina',
        lastName: 'Benali',
        email: 'amina@example.test',
        telephone: '0600000000',
        address: '10 rue des écoles',
        city: 'Rabat',
        educationLevel: 'Supérieur',
        status: 'en_attente',
        refusalReason: null,
        createdAt: '2026-10-15T09:30:00.000Z',
      },
    ]);
  });

  it('does not add a status predicate for the all filter', async () => {
    const { client, filters } = createClient([]);

    await getEnrollmentRequests(client, 'centre-a', 'all');

    expect(filters).toEqual([
      { table: 'demandes_inscription', column: 'centre_id', value: 'centre-a' },
    ]);
  });

  it('loads active centres and retrieves the authenticated user request', async () => {
    const { client, calls, filters, from, tableRows } = createClient([
      { id: 'centre-a', nom: 'Centre A' },
    ]);

    await expect(getActiveEnrollmentCentres(client)).resolves.toEqual([
      { id: 'centre-a', name: 'Centre A' },
    ]);
    expect(from).toHaveBeenCalledWith('centres');
    expect(filters).toContainEqual({ table: 'centres', column: 'actif', value: true });
    expect(calls).toContainEqual({
      table: 'centres',
      method: 'order',
      args: ['nom'],
    });

    tableRows.demandes_inscription = requestRow;
    await expect(getEnrollmentRequestForUser(client, 'user-a')).resolves.toMatchObject({
      id: 42,
      userId: 'user-a',
      status: 'en_attente',
    });
    expect(filters).toContainEqual({
      table: 'demandes_inscription',
      column: 'user_id',
      value: 'user-a',
    });
  });

  it('inserts the historical public request fields and rejects missing required values', async () => {
    const { client, calls } = createClient();

    await createEnrollmentRequest(client, 'user-a', 'amina@example.test', {
      firstName: ' Amina ',
      lastName: ' Benali ',
      telephone: ' ',
      address: ' 10 rue des écoles ',
      city: ' Rabat ',
      educationLevel: 'Supérieur',
      centreId: 'centre-a',
    });

    expect(calls).toContainEqual({
      table: 'demandes_inscription',
      method: 'insert',
      args: [
        {
          user_id: 'user-a',
          email: 'amina@example.test',
          prenom: 'Amina',
          nom: 'Benali',
          telephone: null,
          adresse: '10 rue des écoles',
          ville: 'Rabat',
          niveau_etudes: 'Supérieur',
          centre_id: 'centre-a',
        },
      ],
    });
    await expect(
      createEnrollmentRequest(client, 'user-a', 'amina@example.test', {
        firstName: '',
        lastName: 'Benali',
        telephone: '',
        address: '',
        city: 'Rabat',
        educationLevel: 'Supérieur',
        centreId: 'centre-a',
      }),
    ).rejects.toThrow('Complétez tous les champs obligatoires');
  });

  it('fails closed when the centre is missing or response records are invalid', async () => {
    const { client, from } = createClient([{ ...requestRow, statut: 'unknown' }]);

    await expect(getEnrollmentRequests(client, '', 'all')).rejects.toThrow(
      'Sélectionnez un centre',
    );
    expect(from).not.toHaveBeenCalled();
    await expect(getEnrollmentRequests(client, 'centre-a', 'all')).rejects.toThrow(
      'statut de demande invalide',
    );
  });

  it('calls the existing approval and rejection RPC contracts', async () => {
    const { client, rpc } = createClient();

    await approveEnrollmentRequest(client, 42);
    await rejectEnrollmentRequest(client, 43, 'Dossier incomplet');

    expect(rpc).toHaveBeenNthCalledWith(1, 'approuver_demande', { did: 42 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'refuser_demande', {
      did: 43,
      motif: 'Dossier incomplet',
    });
  });

  it('surfaces RPC errors and requires a numeric source-compatible request id', async () => {
    const { client, rpc } = createClient();

    await expect(approveEnrollmentRequest(client, '42')).rejects.toThrow('identifiant numérique');
    rpc.mockImplementationOnce(async () => ({
      data: null,
      error: new Error('Permission denied'),
    }));
    await expect(approveEnrollmentRequest(client, 42)).rejects.toThrow('Permission denied');
  });
});
