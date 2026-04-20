import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import RBACGuard from "@/lib/RBACGuard";

// Layouts
import PublicLayout from "@/components/layout/PublicLayout";
import PortalLayout from "@/components/layout/PortalLayout";

// Public pages
import Home from "./pages/Home";
import Apply from "./pages/Apply";
import Unauthorized from "./pages/Unauthorized";
import Login from "./pages/Login";
import PublicHome from "./pages/public/Home";
import PublicAdmissions from "./pages/public/Admissions";
import PublicApplication from "./pages/public/Application";
import PublicContact from "./pages/public/Contact";
import PublicFAQ from "./pages/public/FAQ";
import PublicCancellationPolicy from "./pages/public/CancellationPolicy";
import PublicProgramPage from "./pages/public/ProgramPage";
import RegisterInvite from "./pages/RegisterInvite";

// Role dashboards
import StudentDashboard from "./pages/student/Dashboard";
import ParentDashboard from "./pages/parent/Dashboard";
import ParentCheckout from "./pages/parent/Checkout";
import AcademicCoachDashboard from "./pages/academic-coach/Dashboard";
import PerformanceCoachDashboard from "./pages/performance-coach/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import AccessLogs from "./pages/admin/AccessLogs";
import CmsEditor from "./pages/admin/CmsEditor";
import Admissions from "./pages/admin/Admissions";
import Enrollments from "./pages/admin/Enrollments";
import AdminRewards from "./pages/admin/Rewards";
import StudentRewards from "./pages/student/Rewards";
import AcademicCoachRewards from "./pages/academic-coach/Rewards";
import PerformanceCoachRewards from "./pages/performance-coach/Rewards";

// Shared module pages
import Schedule from "./pages/shared/Schedule";
import Progress from "./pages/shared/Progress";
import StudentProgress from "./pages/student/Progress";
import ParentStudentProgress from "./pages/parent/StudentProgress";
import Messages from "./pages/shared/Messages";
import Resources from "./pages/shared/Resources";
import Attendance from "./pages/shared/Attendance";
import ParentBilling from "./pages/parent/Billing";
import ParentPrograms from "./pages/parent/Programs";
import ProgramsEnroll from "./pages/parent/ProgramsEnroll";
import PaymentsBilling from "./pages/parent/PaymentsBilling";

// Admin extended pages
import AdminStudents from "./pages/admin/Students";
import AdminParents from "./pages/admin/Parents";
import UserManagement from "./pages/admin/UserManagement.jsx";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminPrograms from "./pages/admin/Programs";
import AdminSections from "./pages/admin/Sections";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    } else if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return (
    <RBACGuard>
      <Routes>
        {/* Public routes with shared nav/footer layout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<PublicHome />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/academics" element={<PublicProgramPage programType="academics" />} />
          <Route path="/athletics" element={<PublicProgramPage programType="athletics" />} />
          <Route path="/virtual-homeschool" element={<PublicProgramPage programType="virtual_homeschool" />} />
          <Route path="/college-nil" element={<PublicProgramPage programType="college_nil" />} />
          <Route path="/admissions" element={<PublicAdmissions />} />
          <Route path="/application" element={<PublicApplication />} />
          <Route path="/faq" element={<PublicFAQ />} />
          <Route path="/contact" element={<PublicContact />} />
          <Route path="/cancellation-policy" element={<PublicCancellationPolicy />} />
        </Route>

        {/* Standalone pages (no nav/footer) */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterInvite />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Student portal */}
        <Route element={<PortalLayout />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/schedule" element={<Schedule />} />
          <Route path="/student/progress" element={<StudentProgress />} />
          <Route path="/student/attendance" element={<Attendance />} />
          <Route path="/student/messages" element={<Messages />} />
          <Route path="/student/resources" element={<Resources />} />
          <Route path="/student/rewards" element={<StudentRewards />} />
        </Route>

        {/* Parent portal */}
        <Route element={<PortalLayout />}>
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/parent/checkout" element={<ParentCheckout />} />
          <Route path="/parent/schedule" element={<Schedule />} />
          <Route path="/parent/progress" element={<ParentStudentProgress />} />
          <Route path="/parent/attendance" element={<Attendance />} />
          <Route path="/parent/messages" element={<Messages />} />
          <Route path="/parent/resources" element={<Resources />} />
          <Route path="/parent/billing" element={<ParentBilling />} />
          <Route path="/parent/programs" element={<ProgramsEnroll />} />
          <Route path="/parent/payments" element={<PaymentsBilling />} />
        </Route>

        {/* Academic Coach portal */}
        <Route element={<PortalLayout />}>
          <Route path="/academic-coach/dashboard" element={<AcademicCoachDashboard />} />
          <Route path="/academic-coach/schedule" element={<Schedule />} />
          <Route path="/academic-coach/attendance" element={<Attendance />} />
          <Route path="/academic-coach/messages" element={<Messages />} />
          <Route path="/academic-coach/resources" element={<Resources />} />
          <Route path="/academic-coach/rewards" element={<AcademicCoachRewards />} />
        </Route>

        {/* Performance Coach portal */}
        <Route element={<PortalLayout />}>
          <Route path="/performance-coach/dashboard" element={<PerformanceCoachDashboard />} />
          <Route path="/performance-coach/schedule" element={<Schedule />} />
          <Route path="/performance-coach/attendance" element={<Attendance />} />
          <Route path="/performance-coach/messages" element={<Messages />} />
          <Route path="/performance-coach/resources" element={<Resources />} />
          <Route path="/performance-coach/rewards" element={<PerformanceCoachRewards />} />
        </Route>

        {/* Admin portal */}
        <Route element={<PortalLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/students" element={<AdminStudents />} />
          <Route path="/admin/access-logs" element={<AccessLogs />} />
          <Route path="/admin/cms" element={<CmsEditor />} />
          <Route path="/admin/admissions" element={<Admissions />} />
          <Route path="/admin/enrollments" element={<Enrollments />} />
          <Route path="/admin/rewards" element={<AdminRewards />} />
          <Route path="/admin/messages" element={<Messages />} />
          <Route path="/admin/resources" element={<Resources />} />
          <Route path="/admin/attendance" element={<Attendance />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/parents" element={<AdminParents />} />
          <Route path="/admin/programs" element={<AdminPrograms />} />
          <Route path="/admin/sections" element={<AdminSections />} />
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </RBACGuard>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;