/** Certificates service — cible de migration progressive. */
export async function getStudentCertificates(sb, studentId) {
  const { data, error } = await sb.from('certificats').select('*').eq('etudiant_id', studentId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
