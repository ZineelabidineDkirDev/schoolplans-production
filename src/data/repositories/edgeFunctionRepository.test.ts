import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  EdgeFunctionError,
  invokeAdminUsers,
  invokeCentreDirectorAccess,
} from './edgeFunctionRepository';

function clientWithInvoke(invoke: ReturnType<typeof vi.fn>) {
  return { functions: { invoke } } as unknown as SupabaseClient;
}

describe('Edge Function repository', () => {
  it('invokes admin-users to create accounts and validates its credential response', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { email: 'teacher@example.test', password: 'temporary-secret' },
      error: null,
    });

    const result = await invokeAdminUsers(clientWithInvoke(invoke), {
      action: 'create_user',
      email: 'teacher@example.test',
      full_name: 'Amina Teacher',
      role: 'formateur',
      centre_id: 'centre-id',
    });

    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: {
        action: 'create_user',
        email: 'teacher@example.test',
        full_name: 'Amina Teacher',
        role: 'formateur',
        centre_id: 'centre-id',
      },
    });
    expect(result).toEqual({ email: 'teacher@example.test', password: 'temporary-secret' });
  });

  it('surfaces an Edge Function error response without converting it into success', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'Centre suspendu.' },
      error: null,
    });

    await expect(
      invokeAdminUsers(clientWithInvoke(invoke), {
        action: 'reset_password',
        email: 'teacher@example.test',
      }),
    ).rejects.toThrow('Centre suspendu.');
  });

  it('preserves the already-exists marker for account-creation workflows', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { error: 'Un compte existe déjà.', exists: true },
      error: null,
    });

    const result = invokeAdminUsers(clientWithInvoke(invoke), {
      action: 'create_user',
      email: 'teacher@example.test',
      full_name: 'Amina Teacher',
      role: 'formateur',
    });

    await expect(result).rejects.toMatchObject({
      name: 'EdgeFunctionError',
      message: 'Un compte existe déjà.',
      exists: true,
    } satisfies Partial<EdgeFunctionError>);
  });

  it('reads the already-exists marker from an HTTP Edge Function error response', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Function returned an error'), {
        context: new Response(JSON.stringify({ error: 'E-mail déjà utilisé.', exists: true }), {
          status: 409,
        }),
      }),
    });

    await expect(
      invokeAdminUsers(clientWithInvoke(invoke), {
        action: 'create_user',
        email: 'teacher@example.test',
        full_name: 'Amina Teacher',
        role: 'formateur',
      }),
    ).rejects.toMatchObject({
      name: 'EdgeFunctionError',
      message: 'E-mail déjà utilisé.',
      exists: true,
    } satisfies Partial<EdgeFunctionError>);
  });

  it('invokes centre-director-access and validates director records', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        directors: [{ user_id: 'user-1', full_name: 'Samira Director', email: 's@example.test' }],
      },
      error: null,
    });

    const result = await invokeCentreDirectorAccess(clientWithInvoke(invoke), {
      action: 'list',
      centre_id: 'centre-id',
    });

    expect(invoke).toHaveBeenCalledWith('centre-director-access', {
      body: { action: 'list', centre_id: 'centre-id' },
    });
    expect(result).toEqual({
      directors: [{ user_id: 'user-1', full_name: 'Samira Director', email: 's@example.test' }],
    });
  });
});
