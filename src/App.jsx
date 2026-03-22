import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import RBACGuard from "@/lib/RBACGuard";

// Public pages
import Home from "./pages/Home";
import Apply from "./pages/Apply";
import Unauthorized from "./pages/Unauthorized";

// Role dashboards
import StudentDashboard from "./pages/student/Dashboard";
import ParentDashboard from "./pages/parent/Dashboard";
import AcademicCoachDashboard from "./pages/academic-coach/Dashboard";
import PerformanceCoachDashboard from "./pages/performance-coach/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import AccessLogs from "./pages/admin/AccessLogs";

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
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/unauthorized" element={<Unauthorized />} />



        {/* Student portal */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />

        {/* Parent portal */}
        <Route path="/parent/dashboard" element={<ParentDashboard />} />

        {/* Academic Coach portal */}
        <Route path="/academic-coach/dashboard" element={<AcademicCoachDashboard />} />

        {/* Performance Coach portal */}
        <Route path="/performance-coach/dashboard" element={<PerformanceCoachDashboard />} />

        {/* Admin portal */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/access-logs" element={<AccessLogs />} />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </RBACGuard>
  );
};

// Temporary placeholder for Phase 3 public pages
function PlaceholderPage({ title }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#1a3c5e] mb-2">{title}</h1>
        <p className="text-slate-400">Full page content coming in Phase 3 (Public Pages + CMS).</p>
      </div>
    </div>
  );
}

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