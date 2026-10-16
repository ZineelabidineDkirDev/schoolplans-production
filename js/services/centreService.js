/** Centre service — cible de migration progressive. */
export async function getCentre(sb, centreId) {
  const { data, error } = await sb.from('centres').select('*').eq('id', centreId).maybeSingle();
  if (error) throw error;
  return data;
}
