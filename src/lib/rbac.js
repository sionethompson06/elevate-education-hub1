// Role-Based Access Control configuration

export const ROLES = {
  STUDENT: "student",
  PARENT: "parent",
  ACADEMIC_COACH: "academic_coach",
  PERFORMANCE_COACH: "performance_coach",
  ADMIN: "admin",
};

// Route permission matrix — which roles can access which route prefixes
export const ROUTE_PERMISSIONS = {
  "/student": [ROLES.STUDENT, ROLES.ADMIN],
  "/parent": [ROLES.PARENT, ROLES.ADMIN],
  "/academic-coach": [ROLES.ACADEMIC_COACH, ROLES.ADMIN],
  "/performance-coach": [ROLES.PERFORMANCE_COACH, ROLES.ADMIN],
  "/admin": [ROLES.ADMIN],
};

// Default dashboard per role after login
export const ROLE_DASHBOARDS = {
  [ROLES.STUDENT]: "/student/dashboard",
  [ROLES.PARENT]: "/parent/dashboard",
  [ROLES.ACADEMIC_COACH]: "/academic-coach/dashboard",
  [ROLES.PERFORMANCE_COACH]: "/performance-coach/dashboard",
  [ROLES.ADMIN]: "/admin/dashboard",
};

// Public routes accessible without login
export const PUBLIC_ROUTES = [
  "/",
  "/academics",
  "/athletics",
  "/virtual-homeschool",
  "/college-nil",
  "/admissions",
  "/faq",
  "/contact",
  "/cancellation-policy",
  "/apply",
  "/login",
];

/**
 * Check if a user role is permitted to access a given route.
 * Returns { allowed: bool, reason: string }
 */
export function checkRouteAccess(role, pathname) {
  // Public routes are always allowed
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return { allowed: true, reason: "public_route" };
  }

  // Find which protected prefix this route falls under
  for (const [prefix, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(prefix)) {
      if (!role) {
        return { allowed: false, reason: "not_authenticated" };
      }
      if (allowedRoles.includes(role)) {
        return { allowed: true, reason: "role_permitted" };
      }
      return {
        allowed: false,
        reason: `role_${role}_not_permitted_for_${prefix.replace("/", "")}`,
      };
    }
  }

  // Unknown route — allow (404 will handle it)
  return { allowed: true, reason: "unmatched_route" };
}

/**
 * Get the home dashboard route for a given role.
 */
export function getDashboardForRole(role) {
  return ROLE_DASHBOARDS[role] || "/";
}

/**
 * Human-readable role labels
 */
export const ROLE_LABELS = {
  [ROLES.STUDENT]: "Student",
  [ROLES.PARENT]: "Parent",
  [ROLES.ACADEMIC_COACH]: "Academic Coach",
  [ROLES.PERFORMANCE_COACH]: "Performance Coach",
  [ROLES.ADMIN]: "Admin",
};