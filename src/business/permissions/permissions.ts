import {
  APP_SECTIONS,
  type AppSection,
  type AuthProfile,
  type CentrePermissionKey,
  type CentrePermissions,
  type SourceRole,
} from '../../types/auth';

const COMMON_SECTIONS: readonly AppSection[] = ['vcal', 'vr'];

const ROLE_SECTIONS: Record<SourceRole, readonly AppSection[]> = {
  admin: [
    ...COMMON_SECTIONS,
    'vf',
    'vd',
    'vh',
    'vl',
    'vk',
    'vpcentre',
    'vp',
    'vi',
    'vs',
    'vfg',
    'vc',
    'vfinance',
    'vnotes',
    'vhelp',
  ],
  director: [
    ...COMMON_SECTIONS,
    'vf',
    'vd',
    'vh',
    'vl',
    'vk',
    'vpcentre',
    'vp',
    'vi',
    'vs',
    'vfg',
    'vc',
    'vfinance',
    'vnotes',
    'vhelp',
  ],
  // Le super administrateur gère la plateforme et les centres, pas les fonctions pédagogiques d'un centre.
  super_admin: ['vz', 'vsub', 'vd'],
  formateur: [...COMMON_SECTIONS, 'vl', 'vn', 'vp', 'vk', 'vnotes', 'vhelp', 'vrapport'],
  etudiant: ['vcal', 'vr', 'vm', 'vq', 'vk', 'vnotes', 'vrapport'],
};

const SECTION_REQUIREMENTS: Partial<Record<AppSection, readonly CentrePermissionKey[]>> = {
  vcal: ['planning'],
  vd: ['statistiques'],
  vl: ['cours', 'seances'],
  vr: ['salles'],
  vk: ['cours_en_ligne'],
  vf: ['formateurs'],
  vp: ['presences'],
  vs: ['etudiants'],
  vfg: ['formations', 'groupes'],
  vc: ['certificats'],
  vfinance: ['gestion_financiere'],
  vnotes: ['notes_bulletins'],
  vhelp: ['supports'],
};

export const SECTION_LABELS: Record<AppSection, string> = {
  vcal: 'Planning',
  vd: 'Tableau de bord',
  vrapport: 'Mon rapport',
  vfinance: 'Tableau de bord financier',
  vnotes: 'Notes & Bulletins',
  vhelp: 'Support',
  vl: 'Séances',
  vr: 'Salles',
  vk: 'Cours en ligne',
  vm: 'Mes cours',
  vq: 'Mes présences',
  vf: 'Formateurs',
  vp: 'Présences',
  vn: 'Mes étudiants',
  vi: 'Inscriptions',
  vs: 'Étudiants',
  vfg: 'Formations & Groupes',
  vc: 'Certificats',
  vh: 'Historique',
  vpcentre: 'Profil du centre',
  vz: 'Gérer les centres',
  vsub: 'Demandes d’abonnement',
};

export function getRoleLabel(role: SourceRole): string {
  if (role === 'admin' || role === 'director' || role === 'super_admin') {
    return 'Admin';
  }
  return role === 'formateur' ? 'Formateur' : 'Étudiant';
}

export function getVisibleSections(role: SourceRole, permissions: CentrePermissions): AppSection[] {
  return ROLE_SECTIONS[role].filter((section) => canAccessSection(role, section, permissions));
}

export function canAccessSection(
  role: SourceRole,
  section: string,
  permissions: CentrePermissions,
): section is AppSection {
  if (!APP_SECTIONS.includes(section as AppSection)) return false;
  const appSection = section as AppSection;
  if (appSection === 'vfinance') return (role === 'admin' || role === 'director') && permissions.gestion_financiere === true;
  if (appSection === 'vnotes') {
    if (role === 'super_admin') return false;
    return ['admin', 'director', 'formateur', 'etudiant'].includes(role) && permissions.notes_bulletins === true;
  }
  if (role === 'super_admin') return ROLE_SECTIONS.super_admin.includes(appSection);

  // Les étudiants peuvent toujours consulter leur planning et leurs salles.
  // Ces deux rubriques restent en lecture seule et ne dépendent pas des droits administratifs du centre.
  if (role === 'etudiant' && (appSection === 'vcal' || appSection === 'vr')) return true;

  if (!ROLE_SECTIONS[role].includes(appSection)) return false;
  // L’accès aux cours en ligne dépend du droit centre cours_en_ligne.
  if (role === 'formateur' && appSection === 'vp') return true;

  return (SECTION_REQUIREMENTS[appSection] ?? []).every((key) => permissions[key] === true);
}

export function isPendingStudent(profile: AuthProfile): boolean {
  return profile.role === 'etudiant' && profile.status === 'en_attente';
}
