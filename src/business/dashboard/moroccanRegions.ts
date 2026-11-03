import type { StudentIdentifier } from '../../types/students';

export type MoroccanRegion = {
  id: string;
  name: string;
  capital: string;
  x: number;
  y: number;
};

export type StudentCity = {
  studentId: StudentIdentifier;
  city: string | null;
};

export const MOROCCAN_REGIONS: readonly MoroccanRegion[] = [
  { id: 'tanger-tetouan-al-hoceima', name: 'Tanger-Tétouan-Al Hoceïma', capital: 'Tanger', x: 113, y: 33 },
  { id: 'oriental', name: 'Oriental', capital: 'Oujda', x: 236, y: 65 },
  { id: 'fes-meknes', name: 'Fès-Meknès', capital: 'Fès', x: 158, y: 70 },
  { id: 'rabat-sale-kenitra', name: 'Rabat-Salé-Kénitra', capital: 'Rabat', x: 105, y: 76 },
  { id: 'beni-mellal-khenifra', name: 'Béni Mellal-Khénifra', capital: 'Béni Mellal', x: 143, y: 112 },
  { id: 'casablanca-settat', name: 'Casablanca-Settat', capital: 'Casablanca', x: 92, y: 101 },
  { id: 'marrakech-safi', name: 'Marrakech-Safi', capital: 'Marrakech', x: 109, y: 145 },
  { id: 'draa-tafilalet', name: 'Drâa-Tafilalet', capital: 'Errachidia', x: 197, y: 144 },
  { id: 'souss-massa', name: 'Souss-Massa', capital: 'Agadir', x: 93, y: 184 },
  { id: 'guelmim-oued-noun', name: 'Guelmim-Oued Noun', capital: 'Guelmim', x: 107, y: 222 },
  { id: 'laayoune-sakia-el-hamra', name: 'Laâyoune-Sakia El Hamra', capital: 'Laâyoune', x: 119, y: 264 },
  { id: 'dakhla-oued-ed-dahab', name: 'Dakhla-Oued Ed-Dahab', capital: 'Dakhla', x: 139, y: 304 },
];

const cityRegionEntries: [string, string][] = [
  ['Tanger-Tétouan-Al Hoceïma', 'Tanger,Tetouan,Al Hoceima,Chefchaouen,Larache,Fnideq,Martil,Mdiq,Ksar El Kebir,Ouazzane'],
  ['Oriental', 'Oujda,Nador,Berkane,Taourirt,Jerada,Guercif,Driouch,Figuig,Saidia'],
  ['Fès-Meknès', 'Fes,Meknes,Taza,Ifrane,Sefrou,El Hajeb,Taounate,Boulemane,Moulay Idriss Zerhoun'],
  ['Rabat-Salé-Kénitra', 'Rabat,Sale,Kenitra,Khemisset,Sidi Kacem,Sidi Slimane,Skhirat,Temara,Tiflet,Rommani'],
  ['Béni Mellal-Khénifra', 'Beni Mellal,Khouribga,Khenifra,Azilal,Fquih Ben Salah,Kasba Tadla,Oued Zem,Bejaad'],
  ['Casablanca-Settat', 'Casablanca,Mohammedia,Settat,El Jadida,Berrechid,Benslimane,Nouaceur,Sidi Bennour,Azemmour,Bouskoura'],
  ['Marrakech-Safi', 'Marrakech,Safi,Essaouira,El Kelaa des Sraghna,Chichaoua,Youssoufia,Ben Guerir'],
  ['Drâa-Tafilalet', 'Errachidia,Ouarzazate,Midelt,Tinghir,Zagora,Rissani,Erfoud'],
  ['Souss-Massa', 'Agadir,Inezgane,Taroudant,Tiznit,Tata,Chtouka,Ait Melloul,Biougra'],
  ['Guelmim-Oued Noun', 'Guelmim,Tan-Tan,Sidi Ifni,Assa-Zag'],
  ['Laâyoune-Sakia El Hamra', 'Laayoune,Boujdour,Tarfaya,Es-Semara'],
  ['Dakhla-Oued Ed-Dahab', 'Dakhla,Aousserd'],
];

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .trim();
}

const regionByCity = new Map<string, string>();
for (const [regionName, cities] of cityRegionEntries) {
  const region = MOROCCAN_REGIONS.find((item) => item.name === regionName);
  if (!region) throw new Error(`Région marocaine inconnue : ${regionName}`);
  for (const city of cities.split(',')) regionByCity.set(normalizeCity(city), region.id);
}

const arabicCityAliases: [string, string][] = [
  ['طنجة', 'tanger-tetouan-al-hoceima'],
  ['تطوان', 'tanger-tetouan-al-hoceima'],
  ['الدار البيضاء', 'casablanca-settat'],
  ['الرباط', 'rabat-sale-kenitra'],
  ['سلا', 'rabat-sale-kenitra'],
  ['فاس', 'fes-meknes'],
  ['مكناس', 'fes-meknes'],
  ['وجدة', 'oriental'],
  ['مراكش', 'marrakech-safi'],
  ['آسفي', 'marrakech-safi'],
  ['بني ملال', 'beni-mellal-khenifra'],
  ['أكادير', 'souss-massa'],
  ['كلميم', 'guelmim-oued-noun'],
  ['العيون', 'laayoune-sakia-el-hamra'],
  ['الداخلة', 'dakhla-oued-ed-dahab'],
];
for (const [city, regionId] of arabicCityAliases) regionByCity.set(normalizeCity(city), regionId);

export function getMoroccanRegionId(city: string | null): string | null {
  if (!city?.trim()) return null;
  return regionByCity.get(normalizeCity(city)) ?? null;
}

export function countStudentsByMoroccanRegion(students: StudentCity[]) {
  const uniqueStudents = new Map<string, string | null>();
  for (const student of students) {
    const id = String(student.studentId);
    if (!uniqueStudents.has(id)) uniqueStudents.set(id, student.city);
  }

  const counts = new Map(MOROCCAN_REGIONS.map((region) => [region.id, 0]));
  let unassigned = 0;
  for (const city of uniqueStudents.values()) {
    const regionId = getMoroccanRegionId(city);
    if (regionId) counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
    else unassigned += 1;
  }

  return {
    regions: MOROCCAN_REGIONS.map((region) => ({
      ...region,
      studentCount: counts.get(region.id) ?? 0,
    })),
    unassigned,
    total: uniqueStudents.size,
  };
}
