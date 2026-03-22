const STATUS = {
  complete: { label: "Complete", cls: "bg-green-100 text-green-700" },
  incomplete: { label: "Incomplete", cls: "bg-yellow-100 text-yellow-700" },
};

export default function LessonStatusBadge({ status }) {
  const s = STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-500" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
  );
}