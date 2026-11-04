import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  getMyFormationGroupStudents,
  saveMyFormationGroupStudents,
} from './formationGroupAssignmentRepository';

describe('formation group assignment repository', () => {
  it('loads only the students available for the selected formateur group', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: 21, prenom: 'Amina', nom: 'Benali', assigned: true },
        { id: 22, prenom: 'Noor', nom: 'Alaoui', assigned: false },
      ],
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient;

    await expect(getMyFormationGroupStudents(client, 4)).resolves.toEqual([
      { id: 21, firstName: 'Amina', lastName: 'Benali', assigned: true },
      { id: 22, firstName: 'Noor', lastName: 'Alaoui', assigned: false },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_my_formation_group_students', { p_group_id: '4' });
  });

  it('saves a unique student selection through the scoped group RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { rpc } as unknown as SupabaseClient;

    await saveMyFormationGroupStudents(client, '4', [21, '22', 21]);

    expect(rpc).toHaveBeenCalledWith('save_my_formation_group_students', {
      p_group_id: '4',
      p_student_ids: ['21', '22'],
    });
  });

  it('surfaces errors returned by Supabase', async () => {
    const error = new Error('RPC denied');
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error }) } as unknown as SupabaseClient;

    await expect(getMyFormationGroupStudents(client, 4)).rejects.toBe(error);
    await expect(saveMyFormationGroupStudents(client, 4, [])).rejects.toBe(error);
  });
});
