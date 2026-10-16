/** Course service — cible de migration progressive. */
export async function getCentreCourses(sb, centreId) {
  if (!centreId) throw new Error("Centre introuvable.");
  const { data, error } = await sb.from('cours').select('*').eq('centre_id', centreId);
  if (error) throw error;
  return data || [];
}
