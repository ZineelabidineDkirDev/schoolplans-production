/**
 * Student service — cible de migration.
 * Aucun branchement automatique en v1.
 */
export async function getMyCentreStudents(sb, centreId) {
  if (!centreId) throw new Error("Centre introuvable.");
  const { data, error } = await sb
    .from('etudiants')
    .select('id,prenom,nom,email,telephone,ville,centre_id')
    .eq('centre_id', centreId)
    .order('nom');
  if (error) throw error;
  return data || [];
}
