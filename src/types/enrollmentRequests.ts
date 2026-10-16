import type { StudentIdentifier } from './students';

export const ENROLLMENT_REQUEST_STATUSES = ['en_attente', 'approuvee', 'refusee'] as const;
export const ENROLLMENT_EDUCATION_LEVELS = [
  'Maternelle',
  'Primaire',
  'Collège',
  'Lycée',
  'Supérieur',
  'Cadre / Salarié',
  'Autre',
] as const;

export type EnrollmentRequestStatus = (typeof ENROLLMENT_REQUEST_STATUSES)[number];
export type EnrollmentRequestFilter = EnrollmentRequestStatus | 'all';
export type EnrollmentEducationLevel = (typeof ENROLLMENT_EDUCATION_LEVELS)[number];

export type ActiveEnrollmentCentre = {
  id: string;
  name: string;
};

export type EnrollmentRequestSubmission = {
  firstName: string;
  lastName: string;
  telephone: string;
  address: string;
  city: string;
  educationLevel: EnrollmentEducationLevel | '';
  centreId: string;
};

export type EnrollmentRequest = {
  id: StudentIdentifier;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string | null;
  address: string | null;
  city: string;
  educationLevel: string;
  status: EnrollmentRequestStatus;
  refusalReason: string | null;
  createdAt: string;
};
