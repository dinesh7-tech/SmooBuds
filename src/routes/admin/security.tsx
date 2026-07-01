import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  fetchSecurityStatsFn, 
  revokeSessionFn, 
  revokeTableSessionsFn, 
  revokeAllCustomerSessionsFn 
} from "@/lib/adminActions";
import { useAdmin } from "@/lib/adminContext";
import { 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Ban, 
  WifiOff, 
  AlertTriangle,
  Fingerprint, 
  Key, 
  Activity, 
  Users 
} from "lucide-react";

export const Route = createFileRoute("/admin/security")({
  component: SecurityRoute,
});

function SecurityRoute() {
  const { sessionToken } = useAdmin();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>("All");

  // Fetch security stats and logs
  const { data: secData, isLoading, refetch } = useQuery({
    queryKey: ["admin_security_stats"],
    queryFn: () => fetchSecurityStatsFn({ data: { token: sessionToken! } }),
    enabled: !!sessionToken,
    refetchInterval: 15000, // Auto refresh every 15s
  });

  // Revoke single session
  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => revokeSessionFn({ data: { sessionId, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("Dining session successfully revoked.");
      queryClient.invalidateQueries({ queryKey: ["admin_security_stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Revoke all sessions for a specific table
  const revokeTableSessions = useMutation({
    mutationFn: (tableId: string) => revokeTableSessionsFn({ data: { tableId, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("All sessions for this table successfully revoked.");
      queryClient.invalidateQueries({ queryKey: ["admin_security_stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Global customer session revocation
  const revokeAllCustomerSessions = useMutation({
    mutationFn: () => revokeAllCustomerSessionsFn({ data: { token: sessionToken! } }),
    onSuccess: () => {
      toast.success("All active customer dining sessions have been terminated.");
      queryClient.invalidateQueries({ queryKey: ["admin_security_stats"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Filter logs by severity
  const filteredLogs = useMemo(() => {
    if (!secData?.threatLogs) return [];
    if (severityFilter === "All") return secData.threatLogs;
    return secData.threatLogs.filter((log: any) => log.severity === severityFilter);
  }, [secData, severityFilter]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sage animate-pulse">
        <Activity className="animate-spin mr-2" /> Loading Security Telemetry...
      </div>
    );
  }

  const stats = secData?.stats || { replayBlocked: 0, invalidSignatures: 0, rateLimitViolations: 0, fingerprintMismatches: 0, tableSwitches: 0 };
  const healthScore = secData?.healthScore ?? 100;
  const activeSessions = secData?.activeSessions || [];
  const lockdownLevel = secData?.lockdownLevel ?? 0;

  // Health Score Style
  const healthColor = healthScore > 85 ? "text-emerald-600 border-emerald-200 bg-emerald-50/50" : healthScore > 60 ? "text-amber-600 border-amber-200 bg-amber-50/50" : "text-rose-600 border-rose-200 bg-rose-50/50";

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-sage-deep tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-sage-deep" />
            Security & Threat Intelligence
          </h1>
          <p className="text-sage font-medium mt-1">Real-time enterprise threat logging and access control.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => refetch()} 
            className="flex items-center gap-1.5 px-4 py-2 border border-sage/10 rounded-xl bg-white text-sage text-sm font-semibold hover:bg-sage/5 transition-all shadow-soft"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to evict ALL dining sessions? This will force all active customers to re-scan their table QR codes.")) {
                revokeAllCustomerSessions.mutate();
              }
            }}
            disabled={revokeAllCustomerSessions.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all rounded-xl shadow-soft"
          >
            <Ban size={14} /> Revoke All Sessions
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className={`border p-6 rounded-2xl flex flex-col justify-between ${healthColor}`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider font-display font-semibold">Security Health Status</span>
            {healthScore > 85 ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div className="my-4">
            <h2 className="text-5xl font-display font-black tracking-tight">{healthScore}%</h2>
            <p className="text-xs font-semibold mt-1">
              {healthScore > 85 ? "Excellent System Defense" : healthScore > 60 ? "Elevated Threat Signatures" : "System Lockdown Recommended"}
            </p>
          </div>
          <span className="text-[10px] opacity-75">Calculated from recent intrusion attempts</span>
        </div>

        {/* Lockdown Level State */}
        <div className="bg-white border border-sage/10 p-6 rounded-2xl flex flex-col justify-between shadow-soft">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold">Lockdown Mode</span>
            <WifiOff size={20} className={lockdownLevel > 0 ? "text-red-500" : "text-sage/40"} />
          </div>
          <div className="my-4">
            <h2 className="text-3xl font-display font-black text-sage-deep">Level {lockdownLevel}</h2>
            <p className="text-xs text-sage font-medium mt-1">
              {lockdownLevel === 0 ? "All client functions operational" :
               lockdownLevel === 1 ? "Ordering is locked" :
               lockdownLevel === 2 ? "Orders and waiter requests blocked" :
               "Full customer portal maintenance"}
            </p>
          </div>
          <span className="text-[10px] text-sage/40">Adjust this in Cafe Settings</span>
        </div>

        {/* Live Counters */}
        <div className="bg-white border border-sage/10 p-6 rounded-2xl flex flex-col justify-between shadow-soft">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold">Active Dining Sessions</span>
            <Users size={20} className="text-sage/40" />
          </div>
          <div className="my-4">
            <h2 className="text-5xl font-display font-black text-sage-deep">{activeSessions.length}</h2>
            <p className="text-xs text-sage font-medium mt-1">Customers dynamically verified on server</p>
          </div>
          <span className="text-[10px] text-sage/40">Locked to unique device fingerprints</span>
        </div>
      </div>

      {/* Intrusions and Blocks Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-sage/10 p-4 rounded-xl shadow-soft">
          <div className="flex items-center gap-2 text-sage mb-2">
            <RefreshCw size={14} className="text-red-500" />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Replays Blocked</span>
          </div>
          <span className="text-2xl font-bold text-sage-deep font-display">{stats.replayBlocked}</span>
        </div>
        <div className="bg-white border border-sage/10 p-4 rounded-xl shadow-soft">
          <div className="flex items-center gap-2 text-sage mb-2">
            <Key size={14} className="text-orange-500" />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Bad Signatures</span>
          </div>
          <span className="text-2xl font-bold text-sage-deep font-display">{stats.invalidSignatures}</span>
        </div>
        <div className="bg-white border border-sage/10 p-4 rounded-xl shadow-soft">
          <div className="flex items-center gap-2 text-sage mb-2">
            <Activity size={14} className="text-amber-500" />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Rate Violations</span>
          </div>
          <span className="text-2xl font-bold text-sage-deep font-display">{stats.rateLimitViolations}</span>
        </div>
        <div className="bg-white border border-sage/10 p-4 rounded-xl shadow-soft">
          <div className="flex items-center gap-2 text-sage mb-2">
            <Fingerprint size={14} className="text-blue-500" />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Device Mismatch</span>
          </div>
          <span className="text-2xl font-bold text-sage-deep font-display">{stats.fingerprintMismatches}</span>
        </div>
        <div className="bg-white border border-sage/10 p-4 rounded-xl shadow-soft">
          <div className="flex items-center gap-2 text-sage mb-2">
            <AlertTriangle size={14} className="text-purple-500" />
            <span className="text-[10px] font-display font-semibold uppercase tracking-wider">Table Switches</span>
          </div>
          <span className="text-2xl font-bold text-sage-deep font-display">{stats.tableSwitches}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Dining Sessions Table */}
        <div className="bg-white border border-sage/10 rounded-3xl p-6 shadow-soft lg:col-span-2 space-y-4">
          <div>
            <h3 className="font-display font-bold text-lg text-sage-deep">Active Sessions ({activeSessions.length})</h3>
            <p className="text-xs text-sage mt-0.5">Sessions locked by device, subnet and rotating QR token.</p>
          </div>

          <div className="overflow-x-auto border border-sage/5 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sage/5 border-b border-sage/10 font-display font-semibold uppercase text-sage text-[10px]">
                  <th className="p-3 pl-4">Table</th>
                  <th className="p-3">Started At</th>
                  <th className="p-3">Trust Score</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage/5 font-medium">
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-sage">No active dining sessions at tables.</td>
                  </tr>
                ) : (
                  activeSessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-sage/5 transition-colors">
                      <td className="p-3 pl-4 font-bold text-sage-deep">Table {s.tableNumber}</td>
                      <td className="p-3 text-sage/70">{new Date(s.createdAt).toLocaleTimeString()}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                          s.trustScore > 80 ? "bg-emerald-50 text-emerald-700" :
                          s.trustScore > 55 ? "bg-amber-50 text-amber-700" :
                          "bg-red-50 text-red-700 animate-pulse"
                        }`}>
                          {s.trustScore}/100
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              if (confirm("Terminate this device session? The customer will be prompted to rescan.")) {
                                revokeSession.mutate(s.id);
                              }
                            }}
                            disabled={revokeSession.isPending}
                            className="p-1.5 text-sage/60 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                            title="Evict Device Session"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Evict all sessions currently connected to Table ${s.tableNumber}?`)) {
                                revokeTableSessions.mutate(s.tableId);
                              }
                            }}
                            disabled={revokeTableSessions.isPending}
                            className="p-1.5 text-sage/60 hover:text-red-800 rounded-lg hover:bg-red-100 transition-all"
                            title="Evict Table Sessions"
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Threat Timeline */}
        <div className="bg-white border border-sage/10 rounded-3xl p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-sage-deep">Threat Intelligence</h3>
              <p className="text-xs text-sage mt-0.5">Chronological security and bypass log.</p>
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-cream/20 border border-sage/10 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
            >
              <option value="All">All Levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-sage text-xs">
                No threat logs logged matching criteria.
              </div>
            ) : (
              filteredLogs.map((log: any) => {
                const badgeColor = 
                  log.severity === "Critical" ? "bg-red-50 text-red-700 border-red-100" :
                  log.severity === "High" ? "bg-orange-50 text-orange-700 border-orange-100" :
                  log.severity === "Medium" ? "bg-amber-50 text-amber-700 border-amber-100" :
                  "bg-gray-50 text-gray-600 border-gray-100";
                
                return (
                  <div key={log.id} className="p-3 border border-sage/10 rounded-xl hover:bg-sage/5 transition-all text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sage-deep">{log.event_category}</span>
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase ${badgeColor}`}>
                        {log.severity}
                      </span>
                    </div>
                    <p className="text-sage/80 leading-relaxed font-semibold text-[11px]">
                      {log.details?.message || log.details?.action || "Suspicious traffic flagged"}
                    </p>
                    <div className="flex justify-between text-[10px] text-sage/50 font-medium">
                      <span>IP: {log.hashed_client_ip?.substring(0, 8)}...</span>
                      <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
