import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import db from './db-postgres.js';
import {
  users, students, guardianStudents, staffProfiles, staffAssignments,
  schoolYears, terms, applications, programs, sections, enrollments,
  billingAccounts, invoices, payments, sectionStudents,
  assignments, assignmentSubmissions, attendanceRecords, trainingLogs, coachNotes,
  messages, announcements, notifications, resources, resourceAssignments, documents,
  auditLogs, coachAssignments, lessonAssignments, rewardCatalog, studentPoints,
  pointTransactions, rewardRedemptions,
} from './schema.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function clearAll() {
  console.log('Clearing existing data...');
  await db.delete(rewardRedemptions);
  await db.delete(pointTransactions);
  await db.delete(studentPoints);
  await db.delete(lessonAssignments);
  await db.delete(coachAssignments);
  await db.delete(rewardCatalog);
  await db.delete(resourceAssignments);
  await db.delete(documents);
  await db.delete(notifications);
  await db.delete(messages);
  await db.delete(announcements);
  await db.delete(resources);
  await db.delete(coachNotes);
  await db.delete(trainingLogs);
  await db.delete(attendanceRecords);
  await db.delete(assignmentSubmissions);
  await db.delete(assignments);
  await db.delete(sectionStudents);
  await db.delete(payments);
  await db.delete(invoices);
  await db.delete(billingAccounts);
  await db.delete(enrollments);
  await db.delete(sections);
  await db.delete(programs);
  await db.delete(terms);
  await db.delete(schoolYears);
  await db.delete(staffAssignments);
  await db.delete(staffProfiles);
  await db.delete(guardianStudents);
  await db.delete(applications);
  await db.delete(students);
  await db.delete(auditLogs);
  await db.delete(users);
  console.log('All data cleared.');
}

async function seed() {
  console.log('Seeding demo data...\n');

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const [admin] = await db.insert(users).values({
    email: 'admin@elevateperformance-academy.com',
    passwordHash: hash(ADMIN_PASSWORD),
    role: 'admin',
    firstName: 'Admin',
    lastName: 'EPA',
  }).returning();
  console.log(`✓ Admin user: ${admin.email}`);

  const [parent1] = await db.insert(users).values({
    email: 'sarah.johnson@example.com',
    passwordHash: hash('Welcome2025!'),
    role: 'parent',
    firstName: 'Sarah',
    lastName: 'Johnson',
  }).returning();

  const [parent2] = await db.insert(users).values({
    email: 'mike.chen@example.com',
    passwordHash: hash('Welcome2025!'),
    role: 'parent',
    firstName: 'Mike',
    lastName: 'Chen',
  }).returning();
  console.log(`✓ Parents: ${parent1.email}, ${parent2.email}`);

  const [academicCoachUser] = await db.insert(users).values({
    email: 'coach.martinez@elevateperformance-academy.com',
    passwordHash: hash('Welcome2025!'),
    role: 'academic_coach',
    firstName: 'Elena',
    lastName: 'Martinez',
  }).returning();

  const [perfCoachUser] = await db.insert(users).values({
    email: 'coach.williams@elevateperformance-academy.com',
    passwordHash: hash('Welcome2025!'),
    role: 'performance_coach',
    firstName: 'Marcus',
    lastName: 'Williams',
  }).returning();
  console.log(`✓ Coaches: ${academicCoachUser.email}, ${perfCoachUser.email}`);

  const [studentUser1] = await db.insert(users).values({
    email: 'ethan.johnson@example.com',
    passwordHash: hash('Welcome2025!'),
    role: 'student',
    firstName: 'Ethan',
    lastName: 'Johnson',
  }).returning();

  const [studentUser2] = await db.insert(users).values({
    email: 'lily.chen@example.com',
    passwordHash: hash('Welcome2025!'),
    role: 'student',
    firstName: 'Lily',
    lastName: 'Chen',
  }).returning();
  console.log(`✓ Student users: ${studentUser1.email}, ${studentUser2.email}`);

  const [student1] = await db.insert(students).values({
    userId: studentUser1.id,
    firstName: 'Ethan',
    lastName: 'Johnson',
    grade: '10th',
    dateOfBirth: '2010-03-15',
    status: 'active',
  }).returning();

  const [student2] = await db.insert(students).values({
    userId: studentUser2.id,
    firstName: 'Lily',
    lastName: 'Chen',
    grade: '9th',
    dateOfBirth: '2011-07-22',
    status: 'active',
  }).returning();
  console.log(`✓ Students: ${student1.firstName} ${student1.lastName}, ${student2.firstName} ${student2.lastName}`);

  await db.insert(guardianStudents).values([
    { guardianUserId: parent1.id, studentId: student1.id, relationship: 'parent', isPrimary: true },
    { guardianUserId: parent2.id, studentId: student2.id, relationship: 'parent', isPrimary: true },
  ]);
  console.log('✓ Guardian-student links');

  await db.insert(staffProfiles).values([
    { userId: academicCoachUser.id, title: 'Academic Coach', bio: 'Experienced educator specializing in STEM.' },
    { userId: perfCoachUser.id, title: 'Performance Coach', bio: 'Former D1 athlete, certified strength and conditioning specialist.' },
  ]);
  console.log('✓ Staff profiles');

  const [schoolYear] = await db.insert(schoolYears).values({
    name: '2025-2026',
    startDate: '2025-08-15',
    endDate: '2026-06-15',
    isCurrent: true,
  }).returning();

  const [term1] = await db.insert(terms).values({
    schoolYearId: schoolYear.id,
    name: 'Fall 2025',
    startDate: '2025-08-15',
    endDate: '2025-12-20',
  }).returning();

  await db.insert(terms).values({
    schoolYearId: schoolYear.id,
    name: 'Spring 2026',
    startDate: '2026-01-10',
    endDate: '2026-06-15',
  });
  console.log('✓ School year 2025-2026 with terms');

  const [appAccepted] = await db.insert(applications).values({
    parentFirstName: 'Sarah', parentLastName: 'Johnson',
    email: 'sarah.johnson@example.com', phone: '503-555-0101',
    studentFirstName: 'Ethan', studentLastName: 'Johnson',
    studentGrade: '10th', studentBirthDate: '2010-03-15',
    programInterest: 'Hybrid Microschool + Athletic Training',
    status: 'accepted',
  }).returning();

  await db.insert(applications).values({
    parentFirstName: 'David', parentLastName: 'Park',
    email: 'david.park@example.com', phone: '702-555-0202',
    studentFirstName: 'Emma', studentLastName: 'Park',
    studentGrade: '8th', studentBirthDate: '2012-11-08',
    programInterest: 'Hybrid Microschool',
    status: 'pending',
  });
  console.log('✓ Applications (1 accepted, 1 pending)');

  const [progAcademic] = await db.insert(programs).values({
    name: 'Hybrid Microschool',
    description: 'Full academic curriculum with small class sizes and personalized instruction.',
    type: 'academic',
    tuitionAmount: '15000',
    billingCycle: 'annual',
    schoolYearId: schoolYear.id,
  }).returning();

  const [progAthletic] = await db.insert(programs).values({
    name: 'Elite Athletic Training',
    description: 'Year-round athletic development with sport-specific training and college prep.',
    type: 'athletic',
    tuitionAmount: '8500',
    billingCycle: 'semester',
    schoolYearId: schoolYear.id,
  }).returning();
  console.log('✓ Programs: Hybrid Microschool, Elite Athletic Training');

  const [section1] = await db.insert(sections).values({
    programId: progAcademic.id,
    name: 'Math & Science - Section A',
    capacity: 15,
    room: 'Room 201',
    schedule: JSON.stringify({ days: ['Mon', 'Wed', 'Fri'], time: '9:00-10:30 AM' }),
  }).returning();

  const [section2] = await db.insert(sections).values({
    programId: progAthletic.id,
    name: 'Strength & Conditioning',
    capacity: 20,
    room: 'Athletic Center',
    schedule: JSON.stringify({ days: ['Tue', 'Thu'], time: '2:00-4:00 PM' }),
  }).returning();
  console.log('✓ Sections: Math & Science, Strength & Conditioning');

  const [enrollment1] = await db.insert(enrollments).values({
    studentId: student1.id,
    programId: progAcademic.id,
    schoolYearId: schoolYear.id,
    status: 'active',
    enrolledBy: parent1.id,
  }).returning();

  const [enrollment2] = await db.insert(enrollments).values({
    studentId: student1.id,
    programId: progAthletic.id,
    schoolYearId: schoolYear.id,
    status: 'active',
    enrolledBy: parent1.id,
  }).returning();

  const [enrollment3] = await db.insert(enrollments).values({
    studentId: student2.id,
    programId: progAcademic.id,
    schoolYearId: schoolYear.id,
    status: 'active',
    enrolledBy: parent2.id,
  }).returning();
  console.log('✓ Enrollments: 3 active');

  const [billingAcct1] = await db.insert(billingAccounts).values({
    parentUserId: parent1.id,
  }).returning();

  const [billingAcct2] = await db.insert(billingAccounts).values({
    parentUserId: parent2.id,
  }).returning();

  const [invoice1] = await db.insert(invoices).values({
    billingAccountId: billingAcct1.id,
    enrollmentId: enrollment1.id,
    description: 'Tuition - Hybrid Microschool',
    amount: '15000',
    dueDate: '2025-09-15',
    status: 'paid',
    paidDate: '2025-09-01',
  }).returning();

  await db.insert(invoices).values({
    billingAccountId: billingAcct1.id,
    enrollmentId: enrollment2.id,
    description: 'Tuition - Elite Athletic Training',
    amount: '8500',
    dueDate: '2025-09-15',
    status: 'paid',
    paidDate: '2025-09-05',
  });

  const [invoice3] = await db.insert(invoices).values({
    billingAccountId: billingAcct2.id,
    enrollmentId: enrollment3.id,
    description: 'Tuition - Hybrid Microschool',
    amount: '15000',
    dueDate: '2025-09-15',
    status: 'pending',
  }).returning();

  await db.insert(payments).values({
    billingAccountId: billingAcct1.id,
    invoiceId: invoice1.id,
    amount: '15000',
    method: 'manual',
    status: 'completed',
    processedAt: new Date('2025-09-01'),
  });
  console.log('✓ Billing: 2 paid invoices, 1 pending');

  await db.insert(sectionStudents).values([
    { sectionId: section1.id, studentId: student1.id },
    { sectionId: section2.id, studentId: student1.id },
    { sectionId: section1.id, studentId: student2.id },
  ]);
  console.log('✓ Section placements');

  await db.insert(staffAssignments).values([
    { staffUserId: academicCoachUser.id, assignmentType: 'section', assignmentId: section1.id, roleInAssignment: 'lead_instructor' },
    { staffUserId: perfCoachUser.id, assignmentType: 'section', assignmentId: section2.id, roleInAssignment: 'lead_instructor' },
  ]);
  console.log('✓ Staff assignments (coaches to sections)');

  const [assign1] = await db.insert(assignments).values({
    sectionId: section1.id,
    title: 'Algebra Fundamentals Quiz',
    description: 'Chapters 1-3 covering linear equations and inequalities.',
    maxScore: 100,
    dueDate: '2025-10-01',
    category: 'quiz',
    createdBy: academicCoachUser.id,
  }).returning();

  const [assign2] = await db.insert(assignments).values({
    sectionId: section1.id,
    title: 'Science Lab Report: Chemical Reactions',
    description: 'Write a formal lab report on the chemical reactions experiment.',
    maxScore: 50,
    dueDate: '2025-10-15',
    category: 'homework',
    createdBy: academicCoachUser.id,
  }).returning();
  console.log('✓ Assignments: 2 created');

  await db.insert(assignmentSubmissions).values([
    {
      assignmentId: assign1.id,
      studentId: student1.id,
      score: 92,
      feedback: 'Excellent work on the linear equations section!',
      gradedBy: academicCoachUser.id,
      gradedAt: new Date('2025-10-02'),
    },
    {
      assignmentId: assign1.id,
      studentId: student2.id,
      score: 85,
      feedback: 'Good effort. Review the inequalities section.',
      gradedBy: academicCoachUser.id,
      gradedAt: new Date('2025-10-02'),
    },
  ]);
  console.log('✓ Graded submissions: 2');

  await db.insert(attendanceRecords).values([
    { studentId: student1.id, sectionId: section1.id, date: '2025-09-15', status: 'present', markedBy: academicCoachUser.id },
    { studentId: student1.id, sectionId: section1.id, date: '2025-09-17', status: 'present', markedBy: academicCoachUser.id },
    { studentId: student1.id, sectionId: section1.id, date: '2025-09-19', status: 'tardy', markedBy: academicCoachUser.id },
    { studentId: student2.id, sectionId: section1.id, date: '2025-09-15', status: 'present', markedBy: academicCoachUser.id },
    { studentId: student2.id, sectionId: section1.id, date: '2025-09-17', status: 'absent', markedBy: academicCoachUser.id },
    { studentId: student1.id, sectionId: section2.id, date: '2025-09-16', status: 'present', markedBy: perfCoachUser.id },
  ]);
  console.log('✓ Attendance records: 6');

  await db.insert(trainingLogs).values([
    {
      studentId: student1.id,
      coachUserId: perfCoachUser.id,
      type: 'strength',
      durationMinutes: 90,
      notes: 'Squat PR: 225 lbs. Great session overall. Focus on form for next session.',
      date: '2025-09-16',
    },
    {
      studentId: student1.id,
      coachUserId: perfCoachUser.id,
      type: 'conditioning',
      durationMinutes: 60,
      notes: '400m intervals x6. Good pacing throughout.',
      date: '2025-09-18',
    },
  ]);
  console.log('✓ Training logs: 2');

  await db.insert(coachNotes).values([
    {
      studentId: student1.id,
      coachUserId: academicCoachUser.id,
      content: 'Ethan is excelling in math but could use more support in science writing. Recommend extra lab report review sessions.',
      visibility: 'parent_visible',
    },
    {
      studentId: student1.id,
      coachUserId: perfCoachUser.id,
      content: 'Strong work ethic in training. Natural athletic ability. Should consider track & field in spring.',
      visibility: 'staff_only',
    },
    {
      studentId: student2.id,
      coachUserId: academicCoachUser.id,
      content: 'Lily shows strong analytical skills. Encourage participation in science fair.',
      visibility: 'student_visible',
    },
  ]);
  console.log('✓ Coach notes: 3');

  await db.insert(messages).values([
    {
      fromUserId: parent1.id,
      toUserId: academicCoachUser.id,
      subject: 'Question about Ethan\'s progress',
      body: 'Hi Coach Martinez, I wanted to check in on how Ethan is doing in Math & Science. Are there any areas he should focus on at home?',
      isRead: true,
    },
    {
      fromUserId: academicCoachUser.id,
      toUserId: parent1.id,
      subject: 'Re: Question about Ethan\'s progress',
      body: 'Hi Sarah, Ethan is doing very well in math. I\'d recommend he spend extra time on his science writing skills. Happy to discuss further!',
      isRead: false,
    },
  ]);
  console.log('✓ Messages: 2 (parent↔coach conversation)');

  await db.insert(announcements).values([
    {
      authorUserId: admin.id,
      title: 'Welcome to the 2025-2026 School Year!',
      body: 'We are excited to welcome all families to Elevate Performance Academy. Please review your student\'s schedule and reach out if you have any questions.',
      targetRole: 'all',
      status: 'published',
      publishedAt: new Date('2025-08-15'),
    },
    {
      authorUserId: admin.id,
      title: 'Fall Break Schedule',
      body: 'Fall break will be October 20-24. No classes or training sessions during this period. Enjoy the break!',
      targetRole: 'all',
      status: 'published',
      publishedAt: new Date('2025-10-01'),
    },
    {
      authorUserId: admin.id,
      title: 'Staff Meeting - October 25',
      body: 'Mandatory staff meeting for all coaches on October 25 at 9 AM in Room 101.',
      targetRole: 'coach',
      status: 'draft',
    },
  ]);
  console.log('✓ Announcements: 3 (2 published, 1 draft)');

  await db.insert(notifications).values([
    {
      userId: parent1.id,
      type: 'application_accepted',
      title: 'Application accepted',
      body: 'Ethan\'s application has been accepted! You can now log in and enroll.',
      isRead: true,
    },
    {
      userId: parent1.id,
      type: 'payment_success',
      title: 'Payment received',
      body: 'Your payment of $15,000.00 for Hybrid Microschool has been processed.',
      isRead: true,
    },
    {
      userId: studentUser1.id,
      type: 'assignment_graded',
      title: 'Assignment Graded',
      body: 'Your assignment "Algebra Fundamentals Quiz" has been graded — Score: 92.',
      isRead: false,
    },
    {
      userId: parent2.id,
      type: 'application_accepted',
      title: 'Application accepted',
      body: 'Lily\'s application has been accepted!',
      isRead: false,
    },
  ]);
  console.log('✓ Notifications: 4');

  const [resource1] = await db.insert(resources).values({
    title: 'Study Skills Guide',
    description: 'A comprehensive guide to effective study habits and time management.',
    type: 'document',
    subjectArea: 'General',
    externalUrl: 'https://example.com/study-guide.pdf',
    uploadedBy: admin.id,
  }).returning();

  const [resource2] = await db.insert(resources).values({
    title: 'Pre-Season Training Plan',
    description: 'Off-season conditioning program for fall athletes.',
    type: 'document',
    subjectArea: 'Athletics',
    externalUrl: 'https://example.com/training-plan.pdf',
    uploadedBy: perfCoachUser.id,
  }).returning();
  console.log('✓ Resources: 2');

  await db.insert(resourceAssignments).values([
    { resourceId: resource1.id, targetType: 'student', targetId: student1.id, assignedBy: admin.id, isRequired: true },
    { resourceId: resource1.id, targetType: 'student', targetId: student2.id, assignedBy: admin.id, isRequired: false },
    { resourceId: resource2.id, targetType: 'section', targetId: section2.id, assignedBy: perfCoachUser.id, isRequired: true },
  ]);
  console.log('✓ Resource assignments: 3');

  await db.insert(documents).values([
    {
      entityType: 'student',
      entityId: student1.id,
      category: 'enrollment',
      fileName: 'Enrollment_Agreement_Ethan_Johnson.pdf',
      filePath: '/documents/enrollment/ethan_johnson_agreement.pdf',
      uploadedBy: admin.id,
    },
    {
      entityType: 'student',
      entityId: student1.id,
      category: 'medical',
      fileName: 'Sports_Physical_2025.pdf',
      filePath: '/documents/medical/ethan_johnson_physical.pdf',
      uploadedBy: admin.id,
    },
  ]);
  console.log('✓ Documents: 2');

  // ── Coach assignments (gradebook system) ─────────────────────────────────────
  await db.insert(coachAssignments).values([
    { coachUserId: academicCoachUser.id, coachType: 'academic_coach', studentId: student1.id, isActive: true, startDate: '2025-08-15' },
    { coachUserId: academicCoachUser.id, coachType: 'academic_coach', studentId: student2.id, isActive: true, startDate: '2025-08-15' },
    { coachUserId: perfCoachUser.id, coachType: 'performance_coach', studentId: student1.id, isActive: true, startDate: '2025-08-15' },
  ]);
  console.log('✓ Coach assignments: 3');

  // ── Lesson assignments ────────────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
  const daysAhead = (n) => new Date(now.getTime() + n * 86400000);

  await db.insert(lessonAssignments).values([
    {
      studentId: student1.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'Math',
      title: 'Linear Equations Practice',
      instructions: 'Complete problems 1–20 from Chapter 3. Show all work.',
      dueAt: daysAgo(5),
      status: 'complete',
      completedAt: daysAgo(6),
      pointsPossible: 20,
      pointsEarned: 18,
    },
    {
      studentId: student1.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'Science',
      title: 'Chemical Reactions Lab Write-Up',
      instructions: 'Write a formal lab report following the template provided.',
      dueAt: daysAgo(2),
      status: 'complete',
      completedAt: daysAgo(3),
      pointsPossible: 30,
      pointsEarned: 26,
    },
    {
      studentId: student1.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'English',
      title: 'Persuasive Essay Draft',
      instructions: 'Write a 3–5 paragraph persuasive essay on a topic of your choice.',
      dueAt: daysAhead(3),
      status: 'incomplete',
      pointsPossible: 25,
    },
    {
      studentId: student1.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'History',
      title: 'WWII Timeline Research',
      instructions: 'Create a detailed timeline of major WWII events from 1939–1945.',
      dueAt: daysAhead(7),
      status: 'incomplete',
      pointsPossible: 15,
    },
    {
      studentId: student1.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'Math',
      title: 'Quadratic Equations Quiz Prep',
      instructions: 'Review chapters 4–5 and complete the practice quiz.',
      dueAt: daysAgo(15),
      status: 'incomplete',
      pointsPossible: 20,
    },
    {
      studentId: student2.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'Science',
      title: 'Ecosystems Research Project',
      instructions: 'Research a specific ecosystem and present findings in a 2-page report.',
      dueAt: daysAhead(5),
      status: 'incomplete',
      pointsPossible: 40,
    },
    {
      studentId: student2.id,
      academicCoachUserId: academicCoachUser.id,
      subject: 'Math',
      title: 'Geometry Proofs',
      instructions: 'Complete proofs 1–10 from the worksheet.',
      dueAt: daysAgo(3),
      status: 'complete',
      completedAt: daysAgo(4),
      pointsPossible: 20,
      pointsEarned: 20,
    },
  ]);
  console.log('✓ Lesson assignments: 7');

  // ── Reward catalog ────────────────────────────────────────────────────────────
  const [catalog1] = await db.insert(rewardCatalog).values({
    name: 'Free Homework Pass',
    description: 'Skip one homework assignment of your choice.',
    pointCost: 100,
    isActive: true,
  }).returning();

  const [catalog2] = await db.insert(rewardCatalog).values({
    name: 'Extra Credit Opportunity',
    description: 'Unlock a special extra credit project to boost your grade.',
    pointCost: 150,
    isActive: true,
  }).returning();

  await db.insert(rewardCatalog).values([
    { name: 'Choose Your Study Music', description: 'Play music during one solo study session.', pointCost: 50, isActive: true },
    { name: 'Lunch with Your Coach', description: 'One-on-one lunch session with your academic coach.', pointCost: 200, isActive: true },
    { name: 'Early Dismissal (30 min)', description: 'Leave 30 minutes early on a school day.', pointCost: 300, isActive: true },
  ]);
  console.log('✓ Reward catalog: 5 items');

  // ── Student points and transaction history ────────────────────────────────────
  await db.insert(studentPoints).values([
    { studentId: student1.id, points: 185 },
    { studentId: student2.id, points: 75 },
  ]);

  await db.insert(pointTransactions).values([
    { studentId: student1.id, delta: 50, reason: 'Completed Linear Equations Practice on time', awardedBy: academicCoachUser.id },
    { studentId: student1.id, delta: 75, reason: 'Excellent lab write-up — above and beyond', awardedBy: academicCoachUser.id },
    { studentId: student1.id, delta: 25, reason: 'Great effort in training session', awardedBy: perfCoachUser.id },
    { studentId: student1.id, delta: 50, reason: 'Perfect attendance this week', awardedBy: admin.id },
    { studentId: student1.id, delta: -15, reason: 'Redeemed: Choose Your Study Music', awardedBy: null },
    { studentId: student2.id, delta: 50, reason: 'Perfect score on Geometry Proofs', awardedBy: academicCoachUser.id },
    { studentId: student2.id, delta: 25, reason: 'Excellent class participation', awardedBy: academicCoachUser.id },
  ]);
  console.log('✓ Student points: Ethan=185, Lily=75 with transaction history');

  console.log('\n========================================');
  console.log('Demo data seeded successfully!');
  console.log('========================================');
  console.log('\nDemo Accounts:');
  console.log(`  Admin:             admin@elevateperformance-academy.com / [ADMIN_PASSWORD env]`);
  console.log(`  Parent (Sarah):    sarah.johnson@example.com / Welcome2025!`);
  console.log(`  Parent (Mike):     mike.chen@example.com / Welcome2025!`);
  console.log(`  Academic Coach:    coach.martinez@elevateperformance-academy.com / Welcome2025!`);
  console.log(`  Perf Coach:        coach.williams@elevateperformance-academy.com / Welcome2025!`);
  console.log(`  Student (Ethan):   ethan.johnson@example.com / Welcome2025!`);
  console.log(`  Student (Lily):    lily.chen@example.com / Welcome2025!`);
  console.log('');
}

async function main() {
  try {
    await clearAll();
    await seed();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
