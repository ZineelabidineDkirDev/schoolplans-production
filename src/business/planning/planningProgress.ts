import type { PlanningData, PlanningGroup } from '../../types/planning';

export type FormationProgress = {
  plannedHours: number;
  completedHours: number;
  remainingHours: number;
  percentage: number;
};

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? date : null;
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getDurationHours(startsAt: string, endsAt: string): number {
  const starts = parseTime(startsAt);
  const ends = parseTime(endsAt);
  return starts !== null && ends !== null && ends > starts ? (ends - starts) / 60 : 0;
}

function clampToGroupDates(
  startsOn: string,
  endsOn: string,
  group: PlanningGroup,
): { startsOn: string; endsOn: string } | null {
  const start = group.startsOn && startsOn < group.startsOn ? group.startsOn : startsOn;
  const end = group.endsOn && endsOn > group.endsOn ? group.endsOn : endsOn;
  if (end < start || !parseDate(start) || !parseDate(end)) return null;
  return { startsOn: start, endsOn: end };
}

function firstOccurrenceOnOrAfter(start: Date, weekday: number): Date {
  const result = new Date(start);
  const offset = (weekday - ((result.getDay() + 6) % 7) + 7) % 7;
  result.setDate(result.getDate() + offset);
  return result;
}

export function calculateFormationProgress(
  data: PlanningData,
  formationId: string,
  today = new Date(),
): FormationProgress | null {
  const formation = data.filters.formations.find(
    (candidate) => String(candidate.id) === formationId,
  );
  if (!formation) return null;

  const groups = data.filters.groups.filter((group) => String(group.formationId) === formationId);
  const groupsById = new Map(groups.map((group) => [String(group.id), group]));
  const todayKey = dateKey(today);
  let scheduledHours = 0;
  let completedHours = 0;

  for (const course of data.courses) {
    if (course.groupId === null) continue;
    const group = groupsById.get(String(course.groupId));
    if (!group) continue;

    const duration = getDurationHours(course.startsAt, course.endsAt);
    if (
      duration === 0 ||
      !Number.isInteger(course.weekday) ||
      course.weekday < 0 ||
      course.weekday > 5
    ) {
      continue;
    }

    const rawStart = course.startsOn || group.startsOn || todayKey;
    const rawEnd = course.endsOn || group.endsOn || rawStart;
    const range = clampToGroupDates(rawStart, rawEnd, group);
    if (!range) continue;
    const start = parseDate(range.startsOn);
    if (!start) continue;

    for (
      let occurrence = firstOccurrenceOnOrAfter(start, course.weekday);
      dateKey(occurrence) <= range.endsOn;
      occurrence.setDate(occurrence.getDate() + 7)
    ) {
      const date = dateKey(occurrence);
      const key = `${course.id}|${date}`;
      if (data.cancelledOccurrences.has(key) || data.closedDates[date]) continue;

      scheduledHours += duration;
      if (data.completedOccurrences.has(key)) completedHours += duration;
    }
  }

  const totalHours =
    formation.totalHours !== null &&
    formation.totalHours !== '' &&
    Number.isFinite(Number(formation.totalHours))
      ? Math.max(0, Number(formation.totalHours))
      : scheduledHours;
  const percentage =
    totalHours > 0 ? Math.min(100, Math.round((completedHours / totalHours) * 100)) : 0;

  return {
    plannedHours: totalHours,
    completedHours,
    remainingHours: Math.max(0, totalHours - completedHours),
    percentage,
  };
}

export function calculateAllFormationProgress(data: PlanningData): Array<{
  formation: PlanningData['filters']['formations'][number];
  progress: FormationProgress;
}> {
  return data.filters.formations.flatMap((formation) => {
    const progress = calculateFormationProgress(data, String(formation.id));
    return progress ? [{ formation, progress }] : [];
  });
}
