/** Licence service — cible de migration progressive. */
export async function getLicenceHistory(sb, centreId) {
  const { data, error } = await sb.from('licences_historique').select('*').eq('centre_id', centreId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
