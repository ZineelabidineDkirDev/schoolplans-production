import { describe, expect, it } from 'vitest';
import { countStudentsByMoroccanRegion, getMoroccanRegionId, MOROCCAN_REGIONS } from './moroccanRegions';

describe('Moroccan student regions', () => {
  it('maps common city spellings to the official region', () => {
    expect(getMoroccanRegionId('Casablanca')).toBe('casablanca-settat');
    expect(getMoroccanRegionId('FÈS')).toBe('fes-meknes');
    expect(getMoroccanRegionId('Laayoune')).toBe('laayoune-sakia-el-hamra');
    expect(getMoroccanRegionId('الدار البيضاء')).toBe('casablanca-settat');
    expect(getMoroccanRegionId('Ville inconnue')).toBeNull();
  });

  it('counts unique students and keeps unrecognized cities out of regional totals', () => {
    const result = countStudentsByMoroccanRegion([
      { studentId: 1, city: 'Casablanca' },
      { studentId: 1, city: 'Casablanca' },
      { studentId: 2, city: 'Rabat' },
      { studentId: 3, city: 'Ville inconnue' },
      { studentId: 4, city: null },
    ]);

    expect(result.total).toBe(4);
    expect(result.unassigned).toBe(2);
    expect(result.regions.find((region) => region.id === 'casablanca-settat')?.studentCount).toBe(1);
    expect(result.regions.find((region) => region.id === 'rabat-sale-kenitra')?.studentCount).toBe(1);
    expect(result.regions).toHaveLength(12);
    expect(result.regions).toHaveLength(MOROCCAN_REGIONS.length);
  });
});
