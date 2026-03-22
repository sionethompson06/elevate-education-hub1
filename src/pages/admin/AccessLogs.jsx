import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Shield, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AccessLogs() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["access-logs"],
    queryFn: () => base44.entities.AccessLog.list("-timestamp", 100),
  });

  const actionColor = {
    denied: "bg-red-100 text-red-700",
    allowed: "bg-green-100 text-green-700",
    redirected: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="w-7 h-7 text-[#1a3c5e]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1a3c5e]">Access Logs</h1>
            <p className="text-slate-500 text-sm">Denied and redirected access attempts</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Recent Access Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-slate-200 border-t-[#1a3c5e] rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No access log entries found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-semibold text-slate-600">User</th>
                      <th className="pb-3 font-semibold text-slate-600">Role</th>
                      <th className="pb-3 font-semibold text-slate-600">Attempted Route</th>
                      <th className="pb-3 font-semibold text-slate-600">Action</th>
                      <th className="pb-3 font-semibold text-slate-600">Reason</th>
                      <th className="pb-3 font-semibold text-slate-600">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="py-3 text-slate-700">{log.user_email}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                            {log.user_role || "—"}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-xs text-slate-600">
                          {log.attempted_route}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${actionColor[log.action] || ""}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 text-xs">{log.reason}</td>
                        <td className="py-3 text-slate-400 text-xs whitespace-nowrap">
                          {log.timestamp
                            ? format(new Date(log.timestamp), "MMM d, h:mm a")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}