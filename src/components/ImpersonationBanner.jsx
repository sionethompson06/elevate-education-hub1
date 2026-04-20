import { useAuth } from "@/lib/AuthContext";
import { Eye, ArrowLeft } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";

export default function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const displayName = user.full_name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  return (
    <div className="sticky top-0 z-[100] w-full bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Eye className="w-4 h-4 shrink-0" />
        <span>
          Viewing as <strong>{displayName}</strong> &middot; {roleLabel}
        </span>
      </div>
      <button
        onClick={stopImpersonating}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors border border-white/30"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Return to Admin
      </button>
    </div>
  );
}
