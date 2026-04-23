import { MoreVertical, Mail, ExternalLink, UserX } from "lucide-react";
import { useState } from "react";

const TYPE_COLORS = {
  academic_coach: "bg-emerald-100 text-emerald-800",
  performance_coach: "bg-orange-100 text-orange-800",
};

const TYPE_LABELS = {
  academic_coach: "Academic Coach",
  performance_coach: "Performance Coach",
};

const STATUS_DOTS = {
  active: "bg-green-500",
  invited: "bg-amber-400",
  expired: "bg-slate-400",
  inactive: "bg-slate-300",
};

const STATUS_LABELS = {
  active: "Active",
  invited: "Invited",
  expired: "Invite Expired",
  inactive: "Inactive",
};

export default function CoachCard({ coach, onOpen, onResendInvite }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = `${coach.firstName?.[0] || ""}${coach.lastName?.[0] || ""}`.toUpperCase();
  const typeColor = TYPE_COLORS[coach.role] || "bg-slate-100 text-slate-700";
  const dotColor = STATUS_DOTS[coach.coachStatus] || "bg-slate-300";
  const statusLabel = STATUS_LABELS[coach.coachStatus] || coach.coachStatus;

  const portalPath = coach.role === "academic_coach"
    ? "/academic-coach/dashboard"
    : "/performance-coach/dashboard";

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={() => onOpen(coach)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0 ${
              coach.role === "academic_coach" ? "bg-emerald-600" : "bg-orange-500"
            }`}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm leading-tight">
              {coach.firstName} {coach.lastName}
            </p>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${typeColor}`}>
              {TYPE_LABELS[coach.role] || coach.role}
            </span>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="p-1 rounded hover:bg-slate-100 text-slate-400"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-4 top-10 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 w-44"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setMenuOpen(false); onOpen(coach); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              View Details
            </button>
            <button
              onClick={() => { setMenuOpen(false); onResendInvite(coach); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" /> Resend Invite
            </button>
            <a
              href={portalPath}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Portal
            </a>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <div className="flex gap-3">
          <span><span className="font-semibold text-slate-700">{coach.studentCount}</span> student{coach.studentCount !== 1 ? "s" : ""}</span>
          <span><span className="font-semibold text-slate-700">{coach.sectionCount}</span> section{coach.sectionCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span>{statusLabel}</span>
        </div>
      </div>

      {coach.profile?.title && (
        <p className="mt-2 text-xs text-slate-400 truncate">{coach.profile.title}</p>
      )}
    </div>
  );
}
