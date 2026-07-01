export function inferRoleFromDoc(doc) {
  if (!doc) return null;
  if (doc.role) return String(doc.role).toLowerCase();
  if (doc.rol) {
    const r = String(doc.rol).toLowerCase();
    if (r.includes('admin') || r.includes('administr') || r.includes('direccion')) return 'admin';
    if (r.includes('prof')) return 'profesor';
    if (r.includes('alum')) return 'alumno';
  }
  if (doc.tipoPerfil) {
    const t = String(doc.tipoPerfil).toLowerCase();
    if (t === 'alumno') return 'alumno';
    if (t === 'personal') return 'admin';
  }
  return null;
}
