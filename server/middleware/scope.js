import { eq, and } from 'drizzle-orm';
import db from '../db-postgres.js';
import { staffAssignments, guardianStudents, students, sections, sectionStudents } from '../schema.js';

export async function getGuardianStudentIds(userId) {
  const links = await db.select().from(guardianStudents)
    .where(eq(guardianStudents.guardianUserId, userId));
  return links.map(l => l.studentId);
}

export async function getStudentIdForUser(userId) {
  const [student] = await db.select().from(students).where(eq(students.userId, userId));
  return student?.id || null;
}

export async function getCoachSectionIds(userId) {
  const direct = await db.select().from(staffAssignments)
    .where(and(eq(staffAssignments.staffUserId, userId), eq(staffAssignments.assignmentType, 'section')));
  const sectionIds = direct.map(sa => sa.assignmentId);
  const programAssignments = await db.select().from(staffAssignments)
    .where(and(eq(staffAssignments.staffUserId, userId), eq(staffAssignments.assignmentType, 'program')));
  for (const pa of programAssignments) {
    const progSections = await db.select().from(sections).where(eq(sections.programId, pa.assignmentId));
    sectionIds.push(...progSections.map(s => s.id));
  }
  return [...new Set(sectionIds)];
}

export async function getCoachStudentIds(userId) {
  const studentAssignments = await db.select().from(staffAssignments)
    .where(and(eq(staffAssignments.staffUserId, userId), eq(staffAssignments.assignmentType, 'student')));
  const studentIds = studentAssignments.map(sa => sa.assignmentId);

  const coachSectionIds = await getCoachSectionIds(userId);
  for (const secId of coachSectionIds) {
    const roster = await db.select().from(sectionStudents).where(eq(sectionStudents.sectionId, secId));
    studentIds.push(...roster.map(r => r.studentId));
  }

  return [...new Set(studentIds)];
}

export async function canAccessStudent(user, studentId) {
  if (user.role === 'admin') return true;

  if (user.role === 'parent') {
    const guardianIds = await getGuardianStudentIds(user.id);
    return guardianIds.includes(studentId);
  }

  if (user.role === 'student') {
    const myStudentId = await getStudentIdForUser(user.id);
    return myStudentId === studentId;
  }

  if (user.role === 'academic_coach' || user.role === 'performance_coach') {
    const studentIds = await getCoachStudentIds(user.id);
    return studentIds.includes(studentId);
  }

  return false;
}

export async function isStudentInSection(studentId, sectionId) {
  const [entry] = await db.select().from(sectionStudents)
    .where(and(eq(sectionStudents.studentId, studentId), eq(sectionStudents.sectionId, sectionId)));
  return !!entry;
}
