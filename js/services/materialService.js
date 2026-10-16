/** Materials service — cible de migration progressive. */
export async function getCourseMaterials(sb, courseId) {
  const { data, error } = await sb.from('supports').select('*').eq('cours_id', courseId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
