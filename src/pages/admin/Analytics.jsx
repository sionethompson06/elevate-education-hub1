import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/api/apiClient";
import { TrendingUp, Users, BookOpen, Star, DollarSign, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#1a3c5e", "#f59e0b", "#10b981", "#f97316", "#ec4899"];

function fmt(n) { return `$${parseFloat(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}` }

// ── Financial Reports ─────────────────────────────────────────────────────────

function IncomeStatementPanel() {
  const thisYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${thisYear}-01-01`);
  const [to, setTo]     = useState(new Date().toISOString().split('T')[0]);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-income', from, to],
    queryFn: () => apiGet(`/accounting/reports/income-statement?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs bg-[#1a3c5e] text-white px-3 py-2 rounded font-semibold hover:bg-[#15304d] disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Revenue', value: data.totalRevenue, color: 'text-green-700' },
              { label: 'Total Expense', value: data.totalExpense, color: 'text-red-600' },
              { label: 'Net Income',    value: data.netIncome,    color: parseFloat(data.netIncome) >= 0 ? 'text-green-700' : 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg px-4 py-3 text-center border border-slate-100">
                <p className={`text-xl font-bold ${s.color}`}>{fmt(s.value)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left py-2 font-semibold">Account</th>
              <th className="text-left py-2 font-semibold">Code</th>
              <th className="text-right py-2 font-semibold">Net</th>
            </tr></thead>
            <tbody>
              {(data.revenue || []).map(a => (
                <tr key={a.code} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{a.name}</td>
                  <td className="py-2 text-slate-400">{a.code}</td>
                  <td className={`py-2 text-right font-semibold ${a.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(a.net)}</td>
                </tr>
              ))}
              {(data.expense || []).map(a => (
                <tr key={a.code} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700">{a.name}</td>
                  <td className="py-2 text-slate-400">{a.code}</td>
                  <td className="py-2 text-right font-semibold text-red-600">({fmt(a.net)})</td>
                </tr>
              ))}
              {!data.revenue?.length && !data.expense?.length && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-xs italic">No journal entries in this period yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BalanceSheetPanel() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-balance-sheet', asOf],
    queryFn: () => apiGet(`/accounting/reports/balance-sheet?as-of=${asOf}`),
  });

  const Section = ({ title, items, total, colorClass }) => (
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      {(items || []).map(a => (
        <div key={a.code} className="flex justify-between text-sm py-1 border-b border-slate-50">
          <span className="text-slate-700">{a.name}</span>
          <span className={`font-medium ${colorClass}`}>{fmt(a.balance)}</span>
        </div>
      ))}
      {(!items || items.length === 0) && <p className="text-xs text-slate-300 italic">None</p>}
      <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200 mt-1">
        <span>Total {title}</span>
        <span className={colorClass}>{fmt(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">As Of</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs bg-[#1a3c5e] text-white px-3 py-2 rounded font-semibold hover:bg-[#15304d] disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {data && (
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Assets"      items={data.assets}      total={data.totalAssets}      colorClass="text-blue-700" />
          <div className="space-y-6">
            <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} colorClass="text-red-600" />
            <Section title="Equity"      items={data.equity}      total={data.totalEquity}      colorClass="text-purple-600" />
            <div className="flex justify-between text-sm font-bold border-t-2 border-slate-300 pt-2">
              <span>Total Liabilities + Equity</span>
              <span className="text-slate-700">{fmt(data.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ARAgingPanel() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['accounting-ar-aging'],
    queryFn: () => apiGet('/accounting/reports/ar-aging'),
  });

  const bucketLabels = { current: 'Current', days1_30: '1–30 Days', days31_60: '31–60 Days', days61plus: '61+ Days' };
  const bucketColors = { current: 'bg-green-100 text-green-800', days1_30: 'bg-yellow-100 text-yellow-800', days31_60: 'bg-orange-100 text-orange-800', days61plus: 'bg-red-100 text-red-800' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">As of {data?.asOf || '—'}</p>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-1.5 text-xs bg-[#1a3c5e] text-white px-3 py-2 rounded font-semibold hover:bg-[#15304d] disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(bucketLabels).map(([key, label]) => (
              <div key={key} className={`rounded-lg px-4 py-3 text-center ${bucketColors[key]}`}>
                <p className="text-lg font-bold">{fmt(data.buckets?.[key])}</p>
                <p className="text-xs font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-3">
            <span>Total Open AR</span>
            <span className="text-slate-800">{fmt(data.total)}</span>
          </div>
          {data.rows?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-slate-400 uppercase tracking-wide">
                  <th className="text-left py-2">Invoice</th>
                  <th className="text-right py-2">Amount</th>
                  <th className="text-left py-2 pl-3">Due Date</th>
                  <th className="text-right py-2">Days Past</th>
                  <th className="text-left py-2 pl-3">Bucket</th>
                </tr></thead>
                <tbody>
                  {data.rows.map(r => (
                    <tr key={r.invoiceId} className="border-b border-slate-50">
                      <td className="py-1.5 text-slate-600 truncate max-w-[160px]">{r.description}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-800">{fmt(r.amount)}</td>
                      <td className="py-1.5 pl-3 text-slate-500">{r.dueDate || '—'}</td>
                      <td className="py-1.5 text-right text-slate-500">{r.daysPast}</td>
                      <td className="py-1.5 pl-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bucketColors[r.bucket === 'current' ? 'current' : r.bucket === '1-30 days' ? 'days1_30' : r.bucket === '31-60 days' ? 'days31_60' : 'days61plus']}`}>
                          {r.bucket}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.rows?.length === 0 && <p className="text-sm text-slate-400 text-center py-6 italic">No open invoices.</p>}
        </>
      )}
    </div>
  );
}

function RevenueRecognitionPanel() {
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth(); // 0-indexed
  const prevMonth = thisMonth === 0 ? 12 : thisMonth;
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const [period, setPeriod] = useState(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await apiPost('/accounting/recognize-revenue', { period });
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Manually trigger monthly revenue recognition. The cron job runs this automatically on the 1st of each month at 2:00 AM.</p>
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Period (YYYY-MM)</label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1.5 text-sm" />
        </div>
        <button onClick={run} disabled={running}
          className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-4 py-2 rounded font-semibold hover:bg-emerald-700 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running…' : 'Run Recognition'}
        </button>
      </div>
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <p className="font-semibold text-green-800">Recognition complete — {result.period}</p>
          <p className="text-green-700 mt-0.5">{result.recognized} entr{result.recognized === 1 ? 'y' : 'ies'} created &middot; {result.skipped} skipped (already posted or no service dates)</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2 items-start text-sm">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Income Statement', 'Balance Sheet', 'AR Aging', 'Revenue Recognition'];

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('Overview');

  const { data: studentsData = { students: [] } } = useQuery({
    queryKey: ["analytics-students"],
    queryFn: () => apiGet('/students'),
    enabled: activeTab === 'Overview',
  });
  const { data: enrollmentsData = { enrollments: [] } } = useQuery({
    queryKey: ["analytics-enrollments"],
    queryFn: () => apiGet('/enrollments'),
    enabled: activeTab === 'Overview',
  });
  const { data: lessonsData = { lessons: [] } } = useQuery({
    queryKey: ["analytics-lessons"],
    queryFn: () => apiGet('/gradebook/lessons'),
    enabled: activeTab === 'Overview',
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["analytics-transactions"],
    queryFn: () => apiGet('/rewards/transactions'),
    enabled: activeTab === 'Overview',
  });

  const students    = studentsData.students || [];
  const enrollments = enrollmentsData.enrollments || [];
  const lessons     = lessonsData.lessons || [];

  const enrollByStatus = Object.entries(
    enrollments.reduce((acc, e) => { acc[e.status] = (acc[e.status] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const completedLessons  = lessons.filter(l => l.status === "complete").length;
  const incompleteLessons = lessons.filter(l => l.status === "incomplete").length;
  const completionRate    = lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0;

  const lessonsBySubject = Object.entries(
    lessons.reduce((acc, l) => { acc[l.subject || "General"] = (acc[l.subject || "General"] || 0) + 1; return acc; }, {})
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const totalPoints = transactions.filter(t => t.delta > 0).reduce((s, t) => s + t.delta, 0);

  const overviewStats = [
    { icon: Users,       label: "Total Students",       value: students.length, color: "text-blue-600",    bg: "bg-blue-50" },
    { icon: DollarSign,  label: "Active Enrollments",   value: enrollments.filter(e => ["active","active_override"].includes(e.status)).length, color: "text-green-600", bg: "bg-green-50" },
    { icon: BookOpen,    label: "Lessons Assigned",     value: lessons.length, color: "text-purple-600",  bg: "bg-purple-50" },
    { icon: Star,        label: "Reward Points Earned", value: totalPoints.toLocaleString(), color: "text-yellow-600", bg: "bg-yellow-50" },
    { icon: Activity,    label: "Transactions",         value: transactions.length, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: TrendingUp,  label: "Lesson Completion",    value: `${completionRate}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-slate-500 mb-1">Admin</p>
        <h1 className="text-3xl font-bold text-[#1a3c5e]">Analytics & Reports</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-[#1a3c5e] text-[#1a3c5e]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {overviewStats.map(({ icon: Icon, label, value, color, bg }) => (
              <Card key={label}>
                <CardContent className="py-4 px-4 text-center">
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base text-slate-700">Enrollment by Status</CardTitle></CardHeader>
              <CardContent>
                {enrollByStatus.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No enrollment data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={enrollByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                        {enrollByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-slate-700">Lessons by Subject</CardTitle></CardHeader>
              <CardContent>
                {lessonsBySubject.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No lesson data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={lessonsBySubject} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1a3c5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-slate-700">Lesson Completion</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[{ name: "Completed", value: completedLessons || 0 }, { name: "Incomplete", value: incompleteLessons || 0 }]}
                      dataKey="value" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}>
                      <Cell fill="#10b981" /><Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base text-slate-700">Recent Point Awards</CardTitle></CardHeader>
              <CardContent>
                {transactions.filter(t => t.delta > 0).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No transactions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {transactions.filter(t => t.delta > 0).slice(0, 8).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 truncate">{tx.student_name || `Student #${tx.studentId}`}</span>
                        <span className="font-bold text-green-600 shrink-0 ml-2">+{tx.delta} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'Income Statement' && (
        <Card><CardHeader><CardTitle className="text-base text-slate-700">Income Statement</CardTitle></CardHeader>
          <CardContent><IncomeStatementPanel /></CardContent>
        </Card>
      )}

      {activeTab === 'Balance Sheet' && (
        <Card><CardHeader><CardTitle className="text-base text-slate-700">Balance Sheet</CardTitle></CardHeader>
          <CardContent><BalanceSheetPanel /></CardContent>
        </Card>
      )}

      {activeTab === 'AR Aging' && (
        <Card><CardHeader><CardTitle className="text-base text-slate-700">Accounts Receivable Aging</CardTitle></CardHeader>
          <CardContent><ARAgingPanel /></CardContent>
        </Card>
      )}

      {activeTab === 'Revenue Recognition' && (
        <Card><CardHeader><CardTitle className="text-base text-slate-700">Revenue Recognition</CardTitle></CardHeader>
          <CardContent><RevenueRecognitionPanel /></CardContent>
        </Card>
      )}
    </div>
  );
}
