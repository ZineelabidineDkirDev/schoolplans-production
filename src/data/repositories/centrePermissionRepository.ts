import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LOADED_CENTRE_PERMISSION_KEYS,
  type CentrePermissions,
  type LoadedCentrePermissionKey,
} from '../../types/auth';

export type CentrePermissionLoad = {
  permissions: CentrePermissions;
  failedKeys: LoadedCentrePermissionKey[];
};

export async function getCentrePermissions(
  client: SupabaseClient,
  isSuperAdmin: boolean,
): Promise<CentrePermissionLoad> {
  if (isSuperAdmin) {
    return {
      permissions: Object.fromEntries(LOADED_CENTRE_PERMISSION_KEYS.map((key) => [key, true])),
      failedKeys: [],
    };
  }

  const results = await Promise.all(
    LOADED_CENTRE_PERMISSION_KEYS.map(async (key) => {
      const { data, error } = await client.rpc('mc_droit', {
        p_droit: key,
      });
      return {
        key,
        allowed: !error && data === true,
        failed: Boolean(error),
      };
    }),
  );

  const permissions: CentrePermissions = {};
  const failedKeys: LoadedCentrePermissionKey[] = [];

  for (const result of results) {
    permissions[result.key] = result.allowed;
    if (result.failed) failedKeys.push(result.key);
  }

  return { permissions, failedKeys };
}
