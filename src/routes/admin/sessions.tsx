import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getLoginHistoryFn, forceLogoutSessionFn } from "@/lib/userManagementActions";
import { useAdmin } from "@/lib/adminContext";
import { hasPermission } from "@/lib/permissions";
import { Search, LogOut, Laptop, Monitor, Smartphone, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/sessions")({
  component: SessionsRoute,
});

function SessionsRoute() {
  const { sessionToken, role, userId } = useAdmin();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["admin_login_history"],
    queryFn: () => getLoginHistoryFn({ data: { token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const forceLogout = useMutation({
    mutationFn: (historyId: string) => forceLogoutSessionFn({ data: { historyId, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("Session forcefully terminated");
      queryClient.invalidateQueries({ queryKey: ["admin_login_history"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activeSessions = useMemo(() => {
    // A session is active if it's a Success login, hasn't logged out, hasn't been forced out, and has a session_id.
    // In a real app we might verify if the token is actually expired, but here we show any recent session without a logout_time.
    return history.filter((h: any) => {
      const isActive = h.status === "Success" && !h.logout_time && !h.is_forced_logout && h.session_id;
      if (!isActive) return false;
      const matchesSearch = (h.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                            (h.ip_address?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                            (h.user?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [history, searchTerm]);

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
        <h1 className="font-display font-extrabold text-3xl text-sage-deep tracking-tight">Active Sessions</h1>
        <p className="text-sage font-medium mt-1">Monitor and manage currently active user sessions.</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white/60 border border-sage/10 rounded-2xl p-4 shadow-soft flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
          <input
            type="text"
            placeholder="Search by name, email or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-sage/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white border border-sage/10 rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/5 border-b border-sage/10 text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold">
                <th className="p-4 pl-6">Started At</th>
                <th className="p-4">User</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Device Info</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage animate-pulse">Loading active sessions...</td>
                </tr>
              ) : activeSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage">No active sessions found.</td>
                </tr>
              ) : (
                activeSessions.map((h: any) => (
                  <tr key={h.id} className="hover:bg-sage/5 transition-colors">
                    <td className="p-4 pl-6 text-xs text-sage-deep font-medium flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500 animate-pulse" />
                      {new Date(h.login_time).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-sage-deep text-sm">
                            {h.user?.name || "Unknown User"}
                            {h.user_id === userId && " (You)"}
                          </p>
                          <p className="text-xs text-sage font-medium">{h.email}</p>
                        </div>
                      </div>
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
                    <td className="p-4 text-center">
                      {hasPermission(role, "Users.Update") && h.user_id !== userId ? (
                        <button
                          onClick={() => { if(confirm("Forcefully terminate this session?")) forceLogout.mutate(h.id); }}
                          disabled={forceLogout.isPending}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 mx-auto disabled:opacity-50"
                        >
                          <LogOut size={12} />
                          Force Logout
                        </button>
                      ) : (
                        <span className="text-xs text-sage/40 font-medium">N/A</span>
                      )}
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
