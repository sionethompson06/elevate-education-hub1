/**
 * Lesson Plan types
 *
 * Shape of the standard object passed into the generator and of the structured
 * plan the generator returns. The plan is editable in the UI and ultimately
 * serialized to `lesson_assignments.instructions` when saved.
 */

export interface StandardInput {
  standard_code: string;
  standard_text: string;
  subject: string;
  grade: string;
  domain: string;
  cluster: string;
  short_code?: string;
  level?: string;
  course?: string | null;
}

export interface LessonPlan {
  title: string;
  standardCode: string;
  standardText: string;
  subject: string;
  grade: string;
  domain: string;
  cluster: string;
  objective: string;
  successCriteria: string[];
  vocabulary: string[];
  materials: string[];
  warmUp: string;
  directInstruction: string;
  guidedPractice: string;
  independentPractice: string;
  differentiation: string;
  checksForUnderstanding: string[];
  assessment: string;
  exitTicket: string;
  teacherNotes: string;
}
