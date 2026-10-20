import { describe, expect, it } from 'vitest';
import { canAccessSection, getRoleLabel, getVisibleSections } from './permissions';
import type { CentrePermissions } from '../../types/auth';

describe('centralized section permissions', () => {
  it('preserves source roles while presenting the shared admin label', () => {
    expect(getRoleLabel('director')).toBe('Admin');
    expect(getRoleLabel('super_admin')).toBe('Admin');
    expect(getRoleLabel('formateur')).toBe('Formateur');
  });

  it('fails closed for missing and disabled centre rights', () => {
    expect(canAccessSection('admin', 'vcal', {})).toBe(false);
    expect(canAccessSection('admin', 'vcal', { planning: false })).toBe(false);
    expect(canAccessSection('admin', 'vk', { supports: true, documents: true })).toBe(false);
    expect(canAccessSection('admin', 'vk', { cours_en_ligne: true })).toBe(true);
  });

  it('does not grant a section outside a role menu or without the required right', () => {
    const permissions: CentrePermissions = {
      planning: true,
      salles: true,
      cours_en_ligne: true,
      gestion_financiere: true,
    };
    expect(canAccessSection('formateur', 'vk', permissions)).toBe(true);
    expect(canAccessSection('etudiant', 'vp', permissions)).toBe(false);
    expect(canAccessSection('etudiant', 'vk', {})).toBe(false);
    expect(canAccessSection('etudiant', 'vk', { cours_en_ligne: true })).toBe(true);
    expect(canAccessSection('admin', 'vc', { certificats: true })).toBe(true);
    expect(canAccessSection('admin', 'vc', {})).toBe(false);
  });

  it('reserves the Mes étudiants section for formateurs', () => {
    expect(canAccessSection('formateur', 'vn', {})).toBe(true);
    expect(canAccessSection('admin', 'vn', {})).toBe(false);
    expect(canAccessSection('director', 'vn', {})).toBe(false);
    expect(canAccessSection('etudiant', 'vn', {})).toBe(false);
  });

  it('reserves enrollment requests for centre administrators and directors', () => {
    expect(getVisibleSections('admin', {}).includes('vi')).toBe(true);
    expect(getVisibleSections('director', {}).includes('vi')).toBe(true);
    expect(getVisibleSections('super_admin', {}).includes('vi')).toBe(false);
    expect(getVisibleSections('formateur', {}).includes('vi')).toBe(false);
    expect(getVisibleSections('etudiant', {}).includes('vi')).toBe(false);
  });

  it('reserves the centre profile for centre administrators and directors', () => {
    expect(canAccessSection('admin', 'vpcentre', {})).toBe(true);
    expect(canAccessSection('director', 'vpcentre', {})).toBe(true);
    expect(canAccessSection('super_admin', 'vpcentre', {})).toBe(false);
    expect(canAccessSection('formateur', 'vpcentre', {})).toBe(false);
  });

  it('reserves financial management for centre administrators and directors with the finance module enabled', () => {
    expect(canAccessSection('admin', 'vfinance', {})).toBe(false);
    expect(canAccessSection('director', 'vfinance', {})).toBe(false);
    expect(canAccessSection('admin', 'vfinance', { gestion_financiere: true })).toBe(true);
    expect(canAccessSection('director', 'vfinance', { gestion_financiere: true })).toBe(true);
    expect(canAccessSection('super_admin', 'vfinance', {})).toBe(false);
    expect(canAccessSection('formateur', 'vfinance', {})).toBe(false);
    expect(canAccessSection('etudiant', 'vfinance', {})).toBe(false);
  });


  it('shows online courses only once in the admin navigation', () => {
    const visible = getVisibleSections('director', {
      cours_en_ligne: true,
      planning: true,
      salles: true,
      gestion_financiere: true,
      formations: true,
      groupes: true,
      formateurs: true,
      statistiques: true,
      cours: true,
      seances: true,
      presences: true,
      certificats: true,
      etudiants: true,
    });
    expect(visible.filter((section) => section === 'vk')).toHaveLength(1);
  });

  it('allows super-admin sections without centre feature flags', () => {
    expect(getVisibleSections('super_admin', {})).toEqual(['vcal', 'vr', 'vz', 'vd']);
  });

  it('enables migrated centre modules only when their central permission is true', () => {
    expect(canAccessSection('director', 'vfg', { formations: true })).toBe(false);
    expect(canAccessSection('director', 'vfg', { formations: true, groupes: true })).toBe(true);
    expect(canAccessSection('director', 'vfg', { formations: false, groupes: true })).toBe(false);
    expect(canAccessSection('admin', 'vr', { salles: true })).toBe(true);
    expect(canAccessSection('admin', 'vp', { presences: true })).toBe(true);
  });
});
