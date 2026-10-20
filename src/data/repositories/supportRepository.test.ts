import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createLinkCourseSupport, deleteCourseSupport, getCourseSupports, uploadCourseSupport } from './supportRepository';

describe('support repository', () => {

  it('rejects unsafe external resource URLs before database access', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(
      createLinkCourseSupport(client, {
        centreId: 'centre-a',
        courseId: 5,
        title: 'Vidéo',
        description: '',
        url: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('https://');
    expect(from).not.toHaveBeenCalled();
  });

  it('skips a query when the student has no enrolled courses', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;
    await expect(getCourseSupports(client, 'centre-a', [])).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects files larger than the reference 20 MiB limit', async () => {
    const client = {} as SupabaseClient;
    const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'cours.pdf', {
      type: 'application/pdf',
    });
    await expect(
      uploadCourseSupport(client, {
        centreId: 'centre-a',
        courseId: 5,
        title: 'Support',
        description: '',
        file,
      }),
    ).rejects.toThrow('20 Mo maximum');
  });

  it('prevents a teacher from deleting another course support before storage access', async () => {
    const from = vi.fn();
    const client = { from, storage: { from: vi.fn() } } as unknown as SupabaseClient;
    await expect(
      deleteCourseSupport(
        client,
        'centre-a',
        {
          id: 1,
          courseId: 12,
          title: 'Support',
          description: null,
          resourceType: 'file',
          filePath: '12/support.pdf',
          fileName: 'support.pdf',
          size: 10,
          mimeType: 'application/pdf',
          externalUrl: null,
          sortOrder: 1,
          createdAt: '2026-01-01',
        },
        [13],
      ),
    ).rejects.toThrow('vos propres cours');
    expect(from).not.toHaveBeenCalled();
  });

  it('deletes support metadata before removing its storage object', async () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: { id: 1 }, error: null })),
    };
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const remove = vi.fn(async () => ({ error: null }));
    const client = {
      from: vi.fn(() => query),
      storage: { from: vi.fn(() => ({ remove })) },
    } as unknown as SupabaseClient;

    await expect(
      deleteCourseSupport(
        client,
        'centre-a',
        {
          id: 1,
          courseId: 12,
          title: 'Support',
          description: null,
          resourceType: 'file',
          filePath: '12/support.pdf',
          fileName: 'support.pdf',
          size: 10,
          mimeType: 'application/pdf',
          externalUrl: null,
          sortOrder: 1,
          createdAt: '2026-01-01',
        },
        [12],
      ),
    ).resolves.toBeUndefined();

    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', 1);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'centre_id', 'centre-a');
    expect(remove).toHaveBeenCalledWith(['12/support.pdf']);
  });

  it('reports when the database row was not deleted and does not touch storage', async () => {
    const query = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const remove = vi.fn();
    const client = {
      from: vi.fn(() => query),
      storage: { from: vi.fn(() => ({ remove })) },
    } as unknown as SupabaseClient;

    await expect(
      deleteCourseSupport(
        client,
        'centre-a',
        {
          id: 1,
          courseId: 12,
          title: 'Support',
          description: null,
          resourceType: 'file',
          filePath: '12/support.pdf',
          fileName: 'support.pdf',
          size: 10,
          mimeType: 'application/pdf',
          externalUrl: null,
          sortOrder: 1,
          createdAt: '2026-01-01',
        },
        [12],
      ),
    ).rejects.toThrow('Support introuvable');
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes the uploaded object when saving its metadata fails', async () => {
    const query = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(async () => ({ data: null, error: new Error('metadata rejected') })),
    };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    const remove = vi.fn(async () => ({ error: null }));
    const upload = vi.fn(async () => ({ error: null }));
    const storageFrom = vi.fn(() => ({ upload, remove }));
    const client = {
      from: vi.fn(() => query),
      storage: { from: storageFrom },
    } as unknown as SupabaseClient;
    const file = new File(['lesson'], 'cours.pdf', { type: 'application/pdf' });

    await expect(
      uploadCourseSupport(client, {
        centreId: 'centre-a',
        courseId: 5,
        title: 'Cours',
        description: '',
        file,
      }),
    ).rejects.toThrow('metadata rejected');
    expect(upload).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(expect.any(Array));
  });
});
