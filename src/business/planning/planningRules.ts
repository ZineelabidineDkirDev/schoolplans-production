import type { PlanningCourseInput, PlanningData, PlanningGroup } from '../../types/planning';
import type { StudentIdentifier } from '../../types/students';
import { parseTimeMinutes } from './planningSchedule';

export type PlanningActor = {
  role: 'admin' | 'director' | 'super_admin' | 'formateur';
  teacherId: string | null;
  centreId: string | null;
};

export type ValidatedPlanningCourse = {
  input: PlanningCourseInput;
  group: PlanningGroup;
  teacherId: StudentIdentifier;
  roomId: StudentIdentifier;
  startsOn: string;
  endsOn: string;
};

function getWeekday(date: string): number {
  const value = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw new Error('La date choisie est invalide.');
  }
  return (value.getDay() + 6) % 7;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && startB <= endA;
}

function timesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function validatePlanningCourse(
  input: PlanningCourseInput,
  data: PlanningData,
  actor: PlanningActor,
): ValidatedPlanningCourse {
  if (!actor.centreId) {
    throw new Error(
      actor.role === 'super_admin'
        ? 'Sélectionnez un centre avant de gérer une séance.'
        : 'Votre profil n’est rattaché à aucun centre.',
    );
  }
  if (!input.date) throw new Error('Choisissez une date.');
  const weekday = getWeekday(input.date);
  if (weekday > 5) throw new Error('Le centre est fermé le dimanche. Choisissez un autre jour.');
  if (data.closedDates[input.date]) {
    throw new Error(`Le centre est fermé le ${input.date}. Choisissez un autre jour.`);
  }

  const startsAtMinutes = parseTimeMinutes(input.startsAt);
  const endsAtMinutes = parseTimeMinutes(input.endsAt);
  if (startsAtMinutes < 8 * 60 || endsAtMinutes > 19 * 60) {
    throw new Error('Les séances doivent être programmées entre 08:00 et 19:00.');
  }
  if (endsAtMinutes <= startsAtMinutes) {
    throw new Error("L'heure de fin doit être après l'heure de début.");
  }

  const group = data.filters.groups.find(
    (candidate) => String(candidate.id) === String(input.groupId),
  );
  if (
    !group ||
    (!group.active &&
      String(group.id) !==
        String(
          data.courses.find((course) => String(course.id) === String(input.courseId))?.groupId,
        ))
  ) {
    throw new Error('Choisissez un groupe actif.');
  }
  if (!group.formationId) throw new Error('Ce groupe n’est associé à aucune formation.');
  if (group.startsOn && input.date < group.startsOn) {
    throw new Error(`La séance ne peut pas commencer avant le ${group.startsOn}.`);
  }
  if (group.endsOn && input.date > group.endsOn) {
    throw new Error(
      `Impossible d'enregistrer cette séance : la formation se termine le ${group.endsOn}. Aucune séance n'est autorisée après cette date.`,
    );
  }

  const allowedSubjects = data.subjectIdsByFormation[String(group.formationId)] ?? [];
  if (!allowedSubjects.some((subjectId) => String(subjectId) === String(input.subjectId))) {
    throw new Error('Ce module ne fait pas partie de la formation du groupe sélectionné.');
  }

  const currentCourse = data.courses.find((course) => String(course.id) === String(input.courseId));
  if (input.courseId && !currentCourse) throw new Error('La séance à modifier est introuvable.');
  if (actor.role === 'formateur') {
    if (!actor.teacherId) {
      throw new Error(
        "Votre compte n'est pas encore relié à une fiche formateur. Contactez l'administration.",
      );
    }
    if (group.teacherId && String(group.teacherId) !== actor.teacherId) {
      throw new Error('Vous ne pouvez pas créer une séance pour le groupe d’un autre formateur.');
    }
    if (currentCourse && String(currentCourse.teacherId) !== actor.teacherId) {
      throw new Error('Vous ne pouvez modifier que vos propres séances.');
    }
  }

  if (group.teacherId) {
    const groupTeacherSubjects = data.subjectIdsByTeacher[String(group.teacherId)] ?? [];
    if (!groupTeacherSubjects.some((subjectId) => String(subjectId) === String(input.subjectId))) {
      throw new Error('Le formateur associé à ce groupe ne maîtrise pas ce module.');
    }
    if (!data.filters.teachers.some((teacher) => String(teacher.id) === String(group.teacherId))) {
      throw new Error('Le formateur associé à ce groupe est introuvable.');
    }
  }

  let teacherId = group.teacherId ?? input.teacherId;
  let roomId = input.roomId;
  const endsOn = input.recurring ? (group.endsOn ?? '2999-12-31') : input.date;
  const candidateStart = input.date;
  const candidateEnd = endsOn;
  const candidateDurationStart = startsAtMinutes;
  const candidateDurationEnd = endsAtMinutes;

  const getConflict = (teacher: string, room: string) =>
    data.courses.find((course) => {
      if (String(course.id) === String(input.courseId)) return false;
      if (course.weekday !== weekday) return false;
      if (
        !rangesOverlap(
          candidateStart,
          candidateEnd,
          course.startsOn ?? '0000-01-01',
          course.endsOn ?? '9999-12-31',
        )
      ) {
        return false;
      }
      const courseStart = parseTimeMinutes(course.startsAt);
      const courseEnd = parseTimeMinutes(course.endsAt);
      if (!timesOverlap(candidateDurationStart, candidateDurationEnd, courseStart, courseEnd)) {
        return false;
      }
      return (
        (room !== '' && String(course.roomId) === room) ||
        (teacher !== '' && String(course.teacherId) === teacher)
      );
    });

  if (!teacherId) {
    teacherId =
      data.filters.teachers.find((teacher) => {
        const skills = data.subjectIdsByTeacher[String(teacher.id)] ?? [];
        return (
          skills.some((subjectId) => String(subjectId) === String(input.subjectId)) &&
          !getConflict(String(teacher.id), '')
        );
      })?.id ?? null;
  }
  if (
    teacherId === null ||
    !data.filters.teachers.some((teacher) => String(teacher.id) === String(teacherId))
  ) {
    throw new Error('Aucun formateur disponible pour cette matière sur ce créneau.');
  }
  if (roomId === null) {
    roomId =
      data.filters.rooms.find((room) => !getConflict(String(teacherId), String(room.id)))?.id ??
      null;
  }
  if (roomId === null || !data.filters.rooms.some((room) => String(room.id) === String(roomId))) {
    throw new Error('Aucune salle libre sur ce créneau.');
  }

  const conflict = getConflict(String(teacherId), String(roomId));
  if (conflict) {
    if (String(conflict.roomId) === String(roomId)) {
      const room = data.filters.rooms.find((candidate) => String(candidate.id) === String(roomId));
      throw new Error(
        `Conflit : la salle ${room?.name ?? roomId} est déjà occupée entre ${input.startsAt} et ${input.endsAt}.`,
      );
    }
    const teacher = data.filters.teachers.find(
      (candidate) => String(candidate.id) === String(teacherId),
    );
    throw new Error(`Conflit : ${teacher?.name ?? 'Le formateur'} a déjà un cours sur ce créneau.`);
  }

  return {
    input,
    group,
    teacherId,
    roomId,
    startsOn: input.date,
    endsOn,
  };
}
