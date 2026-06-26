import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Search, MoreVertical, Edit2, Ban, CheckCircle, Unlock, RefreshCcw, UserPlus, LogOut, ShieldAlert, X } from "lucide-react";
import { getUsersFn, updateUserStatusFn, toggleUserDeleteFn, unlockUserFn, saveUserFn } from "@/lib/userManagementActions";
import { useAdmin } from "@/lib/adminContext";
import { hasPermission } from "@/lib/permissions";

export const Route = createFileRoute("/admin/users")({
  component: UsersManagementRoute,
});

function UsersManagementRoute() {
  const { sessionToken, role, userId } = useAdmin();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterRole, setFilterRole] = useState<string>("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => getUsersFn({ data: { token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => updateUserStatusFn({ data: { id, status: status as any, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("User status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleDelete = useMutation({
    mutationFn: ({ id, isDeleted }: { id: string, isDeleted: boolean }) => toggleUserDeleteFn({ data: { id, isDeleted, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("Action completed successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unlockAccount = useMutation({
    mutationFn: (id: string) => unlockUserFn({ data: { id, token: sessionToken! } }),
    onSuccess: () => {
      toast.success("Account unlocked");
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const matchesSearch = (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                            (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "All" || 
                            (filterStatus === "Deleted" ? !!u.deleted_at : (u.status === filterStatus && !u.deleted_at));
      const matchesRole = filterRole === "All" || u.role === filterRole;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, filterStatus, filterRole]);

  const stats = {
    total: users.length,
    active: users.filter((u: any) => u.status === "Active" && !u.deleted_at).length,
    pending: users.filter((u: any) => u.status === "Pending" && !u.deleted_at).length,
    locked: users.filter((u: any) => u.status === "Locked" && !u.deleted_at).length,
    suspended: users.filter((u: any) => u.status === "Suspended" && !u.deleted_at).length,
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-sage-deep tracking-tight">Staff & Crew Management</h1>
          <p className="text-sage font-medium mt-1">Manage admin access and cafe staff roles.</p>
        </div>
        {hasPermission(role, "Users.Create") && (
          <button
            onClick={handleAddNew}
            className="bg-sage hover:bg-sage-deep text-cream px-5 py-2.5 rounded-xl font-display font-semibold tracking-wider text-sm shadow-soft transition-all flex items-center gap-2"
          >
            <UserPlus size={16} />
            Add New User
          </button>
        )}
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={stats.total} icon={<Shield size={20} />} />
        <StatCard title="Active" value={stats.active} icon={<CheckCircle size={20} className="text-emerald-500" />} />
        <StatCard title="Pending" value={stats.pending} icon={<RefreshCcw size={20} className="text-amber-500" />} />
        <StatCard title="Locked" value={stats.locked} icon={<Unlock size={20} className="text-rose-500" />} />
        <StatCard title="Suspended" value={stats.suspended} icon={<Ban size={20} className="text-rose-700" />} />
      </div>

      {/* Filters and Search */}
      <div className="bg-white/60 border border-sage/10 rounded-2xl p-4 shadow-soft flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-sage/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-white border border-sage/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sage flex-1 md:flex-none cursor-pointer"
          >
            <option value="All">All Roles</option>
            <option value="Owner">Owner</option>
            <option value="Manager">Manager</option>
            <option value="Staff">Staff</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-sage/10 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-sage flex-1 md:flex-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
            <option value="Locked">Locked</option>
            <option value="Suspended">Suspended</option>
            <option value="Deleted">Deleted</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-sage/10 rounded-3xl overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sage/5 border-b border-sage/10 text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold">
                <th className="p-4 pl-6">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Login</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage animate-pulse">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sage">No users found matching your criteria.</td>
                </tr>
              ) : (
                filteredUsers.map((u: any) => (
                  <tr key={u.id} className={`hover:bg-sage/5 transition-colors ${u.deleted_at ? 'opacity-50' : ''}`}>
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sage/10 text-sage flex items-center justify-center font-display font-bold text-lg">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sage-deep">{u.name || "Unnamed User"}</p>
                          <p className="text-xs text-sage font-medium">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'Owner' ? 'bg-gold/20 text-gold-deep' : 
                        u.role === 'Manager' ? 'bg-emerald-500/10 text-emerald-700' : 
                        'bg-sage/10 text-sage'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.deleted_at ? (
                        <span className="text-xs font-bold text-rose-500 flex items-center gap-1"><Ban size={12}/> Deleted</span>
                      ) : (
                        <span className={`text-xs font-bold flex items-center gap-1 ${
                          u.status === 'Active' ? 'text-emerald-500' :
                          u.status === 'Pending' ? 'text-amber-500' :
                          u.status === 'Locked' ? 'text-rose-500' :
                          'text-sage/50'
                        }`}>
                          {u.status}
                          {u.locked_until && new Date(u.locked_until) > new Date() && " (Locked)"}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-sage font-medium">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {hasPermission(role, "Users.Update") && !u.deleted_at && (
                          <>
                            <button onClick={() => handleEdit(u)} className="p-1.5 text-sage hover:bg-sage/10 rounded-md transition-colors" title="Edit User">
                              <Edit2 size={16} />
                            </button>
                            {u.status === 'Locked' && (
                              <button onClick={() => unlockAccount.mutate(u.id)} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors" title="Unlock Account">
                                <Unlock size={16} />
                              </button>
                            )}
                            {u.status !== 'Suspended' && u.role !== 'Owner' && (
                              <button onClick={() => updateStatus.mutate({ id: u.id, status: 'Suspended' })} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors" title="Suspend User">
                                <ShieldAlert size={16} />
                              </button>
                            )}
                            {u.status === 'Suspended' && (
                              <button onClick={() => updateStatus.mutate({ id: u.id, status: 'Active' })} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors" title="Activate User">
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </>
                        )}
                        {hasPermission(role, "Users.Delete") && (
                          u.deleted_at ? (
                            <button onClick={() => toggleDelete.mutate({ id: u.id, isDeleted: false })} className="text-[10px] uppercase font-bold text-emerald-500 hover:underline">
                              Restore
                            </button>
                          ) : (
                            u.role !== 'Owner' && (
                              <button onClick={() => { if(confirm("Soft delete this user?")) toggleDelete.mutate({ id: u.id, isDeleted: true }) }} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors" title="Soft Delete">
                                <Ban size={16} />
                              </button>
                            )
                          )
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

      {isModalOpen && (
        <UserModal 
          user={editingUser} 
          onClose={() => setIsModalOpen(false)} 
          sessionToken={sessionToken!} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin_users"] })}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: any }) {
  return (
    <div className="bg-white border border-sage/10 rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-3 text-sage/70 mb-2">
        {icon}
        <h3 className="text-xs uppercase tracking-wider font-display font-semibold">{title}</h3>
      </div>
      <p className="text-3xl font-display font-bold text-sage-deep">{value}</p>
    </div>
  );
}

function UserModal({ user, onClose, sessionToken, onSuccess }: { user: any, onClose: () => void, sessionToken: string, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "Staff",
    status: user?.status || "Pending",
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => saveUserFn({ data: { payload, token: sessionToken } }),
    onSuccess: () => {
      toast.success(user ? "User updated successfully" : "User created successfully");
      onSuccess();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: user?.id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-deep/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-luxe overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-sage/10 flex justify-between items-center bg-cream/50">
          <h2 className="font-display font-bold text-lg text-sage-deep">{user ? "Edit User" : "Add New User"}</h2>
          <button onClick={onClose} className="text-sage hover:text-sage-deep transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-sage block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-sage/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-sage block mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white border border-sage/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
              placeholder="user@smoobuds.com"
            />
            {user && formData.email !== user.email && (
              <p className="text-[10px] text-amber-600 mt-1 font-medium">Warning: Changing the email will require the user to re-register.</p>
            )}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-sage block mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full bg-white border border-sage/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
            >
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
              <option value="Owner">Owner</option>
            </select>
          </div>
          {user && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-sage block mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-white border border-sage/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sage transition-all"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
                <option value="Locked">Locked</option>
              </select>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sage border border-sage/20 font-display font-semibold uppercase tracking-wider text-xs hover:bg-sage/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-sage text-cream font-display font-semibold uppercase tracking-wider text-xs hover:bg-sage-deep transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
