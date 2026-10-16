/** Attendance service — cible de migration progressive. */
export async function getCourseAttendance(sb, courseId) {
  const { data, error } = await sb.from('presences').select('*').eq('cours_id', courseId);
  if (error) throw error;
  return data || [];
}
