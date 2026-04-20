import { pgTable, serial, varchar, text, integer, timestamp, boolean, jsonb, date, numeric } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('parent'),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  inviteToken: varchar('invite_token', { length: 64 }),
  inviteTokenExpiry: timestamp('invite_token_expiry'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  dateOfBirth: date('date_of_birth'),
  grade: varchar('grade', { length: 20 }),
  status: varchar('status', { length: 20 }).notNull().default('intake'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guardianStudents = pgTable('guardian_students', {
  id: serial('id').primaryKey(),
  guardianUserId: integer('guardian_user_id').notNull().references(() => users.id),
  studentId: integer('student_id').notNull().references(() => students.id),
  relationship: varchar('relationship', { length: 50 }).notNull().default('parent'),
  isPrimary: boolean('is_primary').notNull().default(true),
});

export const staffProfiles = pgTable('staff_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id).unique(),
  title: varchar('title', { length: 100 }),
  bio: text('bio'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
});

export const staffAssignments = pgTable('staff_assignments', {
  id: serial('id').primaryKey(),
  staffUserId: integer('staff_user_id').notNull().references(() => users.id),
  assignmentType: varchar('assignment_type', { length: 50 }).notNull(),
  assignmentId: integer('assignment_id'),
  roleInAssignment: varchar('role_in_assignment', { length: 50 }).notNull(),
  schoolYearId: integer('school_year_id').references(() => schoolYears.id),
  startDate: date('start_date'),
  endDate: date('end_date'),
});

export const emergencyContacts = pgTable('emergency_contacts', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  name: varchar('name', { length: 200 }).notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  isAuthorizedPickup: boolean('is_authorized_pickup').notNull().default(false),
  priorityOrder: integer('priority_order').notNull().default(1),
});

export const studentMedicalInfo = pgTable('student_medical_info', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().unique().references(() => students.id),
  allergies: text('allergies'),
  medications: text('medications'),
  medicalConditions: text('medical_conditions'),
  doctorName: varchar('doctor_name', { length: 200 }),
  doctorPhone: varchar('doctor_phone', { length: 30 }),
  insuranceCarrier: varchar('insurance_carrier', { length: 200 }),
  insurancePolicyNumber: varchar('insurance_policy_number', { length: 100 }),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const schoolYears = pgTable('school_years', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
});

export const terms = pgTable('terms', {
  id: serial('id').primaryKey(),
  schoolYearId: integer('school_year_id').notNull().references(() => schoolYears.id),
  name: varchar('name', { length: 100 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
});

export const applications = pgTable('applications', {
  id: serial('id').primaryKey(),
  parentFirstName: varchar('parent_first_name', { length: 100 }).notNull(),
  parentLastName: varchar('parent_last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  studentFirstName: varchar('student_first_name', { length: 100 }).notNull(),
  studentLastName: varchar('student_last_name', { length: 100 }).notNull(),
  studentAge: varchar('student_age', { length: 10 }),
  studentBirthDate: varchar('student_birth_date', { length: 20 }),
  studentGrade: varchar('student_grade', { length: 20 }),
  programInterest: varchar('program_interest', { length: 50 }),
  sportsPlayed: text('sports_played'),
  competitionLevel: varchar('competition_level', { length: 30 }),
  essay: text('essay'),
  referralSource: varchar('referral_source', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull().default('submitted'),
  reviewerNotes: text('reviewer_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const programs = pgTable('programs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  tuitionAmount: numeric('tuition_amount', { precision: 10, scale: 2 }).notNull().default('0'),
  billingCycle: varchar('billing_cycle', { length: 30 }).notNull().default('monthly'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  schoolYearId: integer('school_year_id').references(() => schoolYears.id),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sections = pgTable('sections', {
  id: serial('id').primaryKey(),
  programId: integer('program_id').notNull().references(() => programs.id),
  termId: integer('term_id').references(() => terms.id),
  name: varchar('name', { length: 200 }).notNull(),
  schedule: jsonb('schedule'),
  capacity: integer('capacity').notNull().default(20),
  room: varchar('room', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  programId: integer('program_id').notNull().references(() => programs.id),
  sectionId: integer('section_id').references(() => sections.id),
  schoolYearId: integer('school_year_id').notNull().references(() => schoolYears.id),
  status: varchar('status', { length: 20 }).notNull().default('pending_payment'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  enrolledBy: integer('enrolled_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billingAccounts = pgTable('billing_accounts', {
  id: serial('id').primaryKey(),
  parentUserId: integer('parent_user_id').notNull().references(() => users.id),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  billingAccountId: integer('billing_account_id').notNull().references(() => billingAccounts.id),
  enrollmentId: integer('enrollment_id').references(() => enrollments.id),
  description: varchar('description', { length: 500 }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  dueDate: date('due_date'),
  paidDate: date('paid_date'),
  stripePaymentId: varchar('stripe_payment_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  billingAccountId: integer('billing_account_id').notNull().references(() => billingAccounts.id),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method: varchar('method', { length: 30 }).notNull().default('manual'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  processedAt: timestamp('processed_at'),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sectionStudents = pgTable('section_students', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  studentId: integer('student_id').notNull().references(() => students.id),
  enrolledDate: date('enrolled_date').defaultNow(),
});

export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  maxScore: integer('max_score').notNull().default(100),
  dueDate: date('due_date'),
  category: varchar('category', { length: 50 }).default('general'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assignmentSubmissions = pgTable('assignment_submissions', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id').notNull().references(() => assignments.id),
  studentId: integer('student_id').notNull().references(() => students.id),
  score: integer('score'),
  isMissing: boolean('is_missing').notNull().default(false),
  isLate: boolean('is_late').notNull().default(false),
  feedback: text('feedback'),
  gradedBy: integer('graded_by').references(() => users.id),
  gradedAt: timestamp('graded_at'),
  submissionContent: text('submission_content'),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const attendanceRecords = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  sectionId: integer('section_id').notNull().references(() => sections.id),
  date: date('date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('present'),
  notes: text('notes'),
  markedBy: integer('marked_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trainingLogs = pgTable('training_logs', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  coachUserId: integer('coach_user_id').notNull().references(() => users.id),
  date: date('date').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('general'),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const coachNotes = pgTable('coach_notes', {
  id: serial('id').primaryKey(),
  coachUserId: integer('coach_user_id').notNull().references(() => users.id),
  studentId: integer('student_id').notNull().references(() => students.id),
  sectionId: integer('section_id').references(() => sections.id),
  content: text('content').notNull(),
  visibility: varchar('visibility', { length: 20 }).notNull().default('staff_only'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  fromUserId: integer('from_user_id').notNull().references(() => users.id),
  toUserId: integer('to_user_id').notNull().references(() => users.id),
  subject: varchar('subject', { length: 300 }).notNull(),
  body: text('body').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  parentMessageId: integer('parent_message_id'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const announcements = pgTable('announcements', {
  id: serial('id').primaryKey(),
  authorUserId: integer('author_user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 300 }).notNull(),
  body: text('body').notNull(),
  targetRole: varchar('target_role', { length: 50 }).notNull().default('all'),
  targetProgramId: integer('target_program_id').references(() => programs.id),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  body: text('body'),
  isRead: boolean('is_read').notNull().default(false),
  link: varchar('link', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resources = pgTable('resources', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().default('document'),
  filePath: varchar('file_path', { length: 500 }),
  externalUrl: varchar('external_url', { length: 500 }),
  subjectArea: varchar('subject_area', { length: 100 }),
  tags: text('tags'),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resourceAssignments = pgTable('resource_assignments', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id').notNull().references(() => resources.id),
  targetType: varchar('target_type', { length: 50 }).notNull(),
  targetId: integer('target_id').notNull(),
  assignedBy: integer('assigned_by').notNull().references(() => users.id),
  isRequired: boolean('is_required').notNull().default(false),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  category: varchar('category', { length: 100 }),
  fileName: varchar('file_name', { length: 300 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: varchar('action', { length: 30 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 50 }),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 50 }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const rewardCatalog = pgTable('reward_catalog', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  pointCost: integer('point_cost').notNull().default(100),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentPoints = pgTable('student_points', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  points: integer('points').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pointTransactions = pgTable('point_transactions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  delta: integer('delta').notNull(),
  reason: varchar('reason', { length: 255 }),
  awardedBy: integer('awarded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cmsContent = pgTable('cms_content', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 255 }),
  body: text('body'),
  section: varchar('section', { length: 100 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const lessonAssignments = pgTable('lesson_assignments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  academicCoachUserId: integer('academic_coach_user_id').references(() => users.id),
  subject: varchar('subject', { length: 100 }).notNull().default('General'),
  title: varchar('title', { length: 255 }).notNull(),
  instructions: text('instructions'),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  dueAt: timestamp('due_at'),
  status: varchar('status', { length: 30 }).notNull().default('incomplete'),
  completedAt: timestamp('completed_at'),
  pointsPossible: integer('points_possible').notNull().default(10),
  pointsEarned: integer('points_earned'),
  rewardPointsAwarded: integer('reward_points_awarded').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const coachAssignments = pgTable('coach_assignments', {
  id: serial('id').primaryKey(),
  coachUserId: integer('coach_user_id').notNull().references(() => users.id),
  coachType: varchar('coach_type', { length: 30 }).notNull(),
  studentId: integer('student_id').notNull().references(() => students.id),
  isActive: boolean('is_active').notNull().default(true),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentRewardBalances = pgTable('student_reward_balances', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id).unique(),
  academicPoints: integer('academic_points').notNull().default(0),
  performancePoints: integer('performance_points').notNull().default(0),
  totalPoints: integer('total_points').notNull().default(0),
  totalEarned: integer('total_earned').notNull().default(0),
  totalRedeemed: integer('total_redeemed').notNull().default(0),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

export const rewardTransactions = pgTable('reward_transactions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  track: varchar('track', { length: 20 }).notNull(),
  points: integer('points').notNull(),
  reason: text('reason'),
  sourceType: varchar('source_type', { length: 50 }),
  sourceId: varchar('source_id', { length: 100 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
  awardedBy: integer('awarded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentGoals = pgTable('student_goals', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  track: varchar('track', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  targetPoints: integer('target_points').notNull(),
  currentPoints: integer('current_points').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const enrollmentOverrides = pgTable('enrollment_overrides', {
  id: serial('id').primaryKey(),
  enrollmentId: integer('enrollment_id').notNull().references(() => enrollments.id),
  overrideType: varchar('override_type', { length: 50 }).notNull(),
  reason: text('reason').notNull(),
  amountWaivedCents: integer('amount_waived_cents').notNull().default(0),
  amountDeferredCents: integer('amount_deferred_cents').notNull().default(0),
  amountDueNowCents: integer('amount_due_now_cents').notNull().default(0),
  effectiveStartAt: date('effective_start_at'),
  effectiveEndAt: date('effective_end_at'),
  isActive: boolean('is_active').notNull().default(true),
  approvedByUserId: integer('approved_by_user_id').references(() => users.id),
  approvedByName: varchar('approved_by_name', { length: 200 }),
  approvedAt: timestamp('approved_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  revokeReason: text('revoke_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rewardRedemptions = pgTable('reward_redemptions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').notNull().references(() => students.id),
  catalogItemId: integer('catalog_item_id').references(() => rewardCatalog.id),
  pointsCost: integer('points_cost').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reviewNotes: text('review_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
