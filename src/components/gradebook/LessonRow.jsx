import { format, isPast } from "date-fns";
import LessonStatusBadge from "./LessonStatusBadge";

export default function LessonRow({ lesson, onClick }) {
  const isOverdue = lesson.due_at && isPast(new Date(lesson.due_at)) && lesson.status !== 'complete';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b last:border-0 gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-medium text-slate-800 truncate ${lesson.status === 'complete' ? 'line-through text-slate-400' : ''}`}>
            {lesson.title}
          </p>
          <LessonStatusBadge status={lesson.status} />
          {isOverdue && <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 font-semibold">Overdue</span>}
          {lesson.standards_codes?.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
              {lesson.standards_codes.length} std
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {lesson.subject}
          {lesson.due_at && ` · Due ${format(new Date(lesson.due_at), "MMM d, h:mm a")}`}
          {lesson.points_possible ? ` · ${lesson.points_earned ?? "?"} / ${lesson.points_possible} pts` : ""}
        </p>
      </div>
    </button>
  );
}