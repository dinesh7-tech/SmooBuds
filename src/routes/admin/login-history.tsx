import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLoginHistoryFn } from "@/lib/userManagementActions";
import { useAdmin } from "@/lib/adminContext";
import { Search, Shield, Laptop, Monitor, Smartphone, Globe, Info } from "lucide-react";

export const Route = createFileRoute("/admin/login-history")({
  component: LoginHistoryRoute,
});

function LoginHistoryRoute() {
  const { sessionToken, role } = useAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["admin_login_history"],
    queryFn: () => getLoginHistoryFn({ data: { token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const filteredHistory = useMemo(() => {
    return history.filter((h: any) => {
      const matchesSearch = (h.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                            (h.ip_address?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "All" || h.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchTerm, filterStatus]);

  const getDeviceIcon = (device: string) => {
    const d = device?.toLowerCase() || "";
    if (d.includes("mobile") || d.includes("iphone") || d.includes("android")) return <Smartphone size={16} />;
    if (d.includes("mac") || d.includes("windows") || d.includes("linux")) return <Laptop size={16} />;
    return <Monitor size={16} />;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="font-display font-extrabold text-3xl text-sage-deep tracking-tight">Login History</h1>
        <p className="text-sage font-medium mt-1">Review system access logs and login attempts.</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/60 border border-sage/10 rounded-2xl p-4 shadow-soft flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
          <input
            type="text"
            placeholder="Search by email or IP address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-sage/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-sage/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sage flex-1 md:flex-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
            <option value="Locked">Locked</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-sage/10 rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/5 border-b border-sage/10 text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Status</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Device Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage animate-pulse">Loading login history...</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage">No records found matching your criteria.</td>
                </tr>
              ) : (
                filteredHistory.map((h: any) => (
                  <tr key={h.id} className="hover:bg-sage/5 transition-colors">
                    <td className="p-4 pl-6 text-xs text-sage-deep font-medium">
                      {new Date(h.login_time).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-sage-deep text-sm">{h.user?.name || "Unknown User"}</p>
                      <p className="text-xs text-sage font-medium">{h.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        h.status === 'Success' ? 'bg-emerald-500/10 text-emerald-700' : 
                        h.status === 'Failed' ? 'bg-rose-500/10 text-rose-700' : 
                        'bg-amber-500/10 text-amber-700'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono text-sage/80">
                      {h.ip_address || "Unknown"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sage/80 text-xs">
                        {getDeviceIcon(h.device)}
                        <span className="truncate max-w-[150px]" title={h.device}>{h.device || "Unknown Device"}</span>
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
