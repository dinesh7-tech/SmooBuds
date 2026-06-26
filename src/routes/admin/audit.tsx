import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogsFn } from "@/lib/userManagementActions";
import { useAdmin } from "@/lib/adminContext";
import { Search, Info, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  component: AuditLogsRoute,
});

function AuditLogsRoute() {
  const { sessionToken } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState<string>("All");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: () => getAuditLogsFn({ data: { token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const matchesSearch = (log.action?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                            (log.user?.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (log.user?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (log.target_user?.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesAction = filterAction === "All" || log.action === filterAction;
      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, filterAction]);

  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach((l: any) => actions.add(l.action));
    return Array.from(actions).sort();
  }, [logs]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-3xl text-sage-deep tracking-tight">System Audit Logs</h1>
        <p className="text-sage font-medium mt-1">Review critical system modifications and security events.</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/60 border border-sage/10 rounded-2xl p-4 shadow-soft flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
          <input
            type="text"
            placeholder="Search by action, user, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-sage/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-white border border-sage/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sage flex-1 md:flex-none cursor-pointer"
          >
            <option value="All">All Actions</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-sage/10 rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/5 border-b border-sage/10 text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">Performed By</th>
                <th className="p-4">Target / Entity</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage animate-pulse">Loading audit logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage">No audit logs found.</td>
                </tr>
              ) : (
                filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-sage/5 transition-colors">
                    <td className="p-4 pl-6 text-xs text-sage-deep font-medium whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="inline-block px-3 py-1 bg-sage/10 text-sage-deep rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-sage-deep text-sm whitespace-nowrap">{log.user?.name || "System"}</p>
                      {log.user?.email && <p className="text-xs text-sage font-medium">{log.user.email}</p>}
                    </td>
                    <td className="p-4">
                      {log.target_user ? (
                        <div>
                          <p className="font-bold text-sage-deep text-sm whitespace-nowrap">{log.target_user.name}</p>
                          <p className="text-xs text-sage font-medium">{log.target_user.email}</p>
                        </div>
                      ) : (
                        <p className="text-xs font-mono text-sage/80 whitespace-nowrap">
                          {log.table_name ? `${log.table_name} (${log.record_id?.substring(0,8) || 'N/A'})` : "N/A"}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="max-w-xs md:max-w-md lg:max-w-xl max-h-24 overflow-y-auto bg-sage/5 p-2 rounded-lg border border-sage/10 font-mono text-[10px] text-sage/80">
                        {log.new_data || log.metadata ? (
                          <pre>{JSON.stringify(log.new_data || log.metadata, null, 2)}</pre>
                        ) : (
                          "No additional details"
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
