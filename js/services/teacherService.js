/** Teacher service — cible de migration progressive. */
export async function getCentreTeachers(sb, centreId) {
  if (!centreId) throw new Error("Centre introuvable.");
  const { data, error } = await sb.from('formateurs').select('*').eq('centre_id', centreId).order('nom');
  if (error) throw error;
  return data || [];
}
