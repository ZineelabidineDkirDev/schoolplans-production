/** Registration service — cible de migration progressive. */
export async function getRegistrationRequests(sb, centreId) {
  let q = sb.from('demandes_inscription').select('*').order('created_at', { ascending: false });
  if (centreId) q = q.eq('centre_id', centreId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
