import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { saveTableFn, regenerateTableTokenFn } from "@/lib/adminActions";
import { QRCodeCanvas } from "qrcode.react";
import { 
  Plus, 
  QrCode, 
  RefreshCw, 
  Download, 
  X, 
  Check, 
  AlertTriangle,
  ExternalLink,
  Ban,
  Unlock
} from "lucide-react";
import { toast } from "sonner";

interface Table {
  id: string;
  table_number: number;
  token: string;
  is_active: boolean;
  created_at: string;
}

export const Route = createFileRoute("/admin/tables")({
  component: TablesManagementPage,
});

function TablesManagementPage() {
  const router = useRouter();
  const { sessionToken, role } = useAdmin();
  const [tables, setTables] = useState<Table[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch tables client-side using authenticated session
  const fetchTables = async () => {
    if (!sessionToken) return;
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .order("table_number", { ascending: true });

      if (error) {
        console.error("Failed to load tables:", error);
        toast.error(`Failed to load tables: ${error.message}`);
      } else {
        setTables((data as Table[]) || []);
      }
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch once auth token is ready
  useEffect(() => {
    if (sessionToken) {
      fetchTables();
    }
  }, [sessionToken]);

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);

  // QR Modal States
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Warning Modal States (Regeneration warning)
  const [isWarnOpen, setIsWarnOpen] = useState(false);
  const [warnTable, setWarnTable] = useState<Table | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [origin, setOrigin] = useState("https://smoobuds.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Create Table
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber || newTableNumber <= 0) {
      toast.error("Provide a valid table number.");
      return;
    }

    if (!sessionToken) return;

    setIsSaving(true);
    try {
      const response = await saveTableFn({
        data: {
          payload: {
            tableNumber: Number(newTableNumber),
            isActive: true,
          },
          token: sessionToken,
        },
      });

      if (response.success) {
        toast.success(`Table ${newTableNumber} created successfully!`);
        setIsAddOpen(false);
        setNewTableNumber("");
        fetchTables();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create table.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Table Active
  const handleToggleActive = async (table: Table) => {
    if (!sessionToken) return;

    try {
      const response = await saveTableFn({
        data: {
          payload: {
            tableNumber: table.table_number,
            isActive: !table.is_active,
          },
          token: sessionToken,
        },
      });

      if (response.success) {
        toast.success(`Table ${table.table_number} is now ${!table.is_active ? "Enabled" : "Disabled"}`);
        fetchTables();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to modify table state.");
    }
  };

  // Trigger Token Regeneration (Open warning)
  const triggerRegenerate = (table: Table) => {
    setWarnTable(table);
    setIsWarnOpen(true);
  };

  // Confirm Token Regeneration
  const confirmRegenerate = async () => {
    if (!warnTable || !sessionToken) return;

    setIsRegenerating(true);
    try {
      const response = await regenerateTableTokenFn({
        data: {
          tableNumber: warnTable.table_number,
          token: sessionToken,
        },
      });

      if (response.success) {
        toast.success(`Token for Table ${warnTable.table_number} regenerated!`);
        setIsWarnOpen(false);
        setWarnTable(null);
        fetchTables();
        
        // If current table QR modal is open, update details
        if (selectedTable && selectedTable.table_number === warnTable.table_number) {
          setSelectedTable({
            ...selectedTable,
            token: response.newToken,
          });
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to regenerate token.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const qrRef = useRef<HTMLCanvasElement>(null);

  // Get QR URL
  const getTableUrl = (table: Table) => {
    return `${origin}/menu?table=${table.table_number}&token=${table.token}`;
  };

  // Download QR Code PNG
  const downloadQr = (table: Table) => {
    if (!qrRef.current) {
      toast.error("QR Code not ready for download.");
      return;
    }
    try {
      const dataUrl = qrRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `smoobuds_table_${table.table_number}_qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloaded QR Code for Table ${table.table_number}`);
    } catch (err) {
      toast.error("Failed to download QR code image.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-sage-deep">Table & QR Code Center</h2>
          <p className="text-xs text-sage/75 mt-1">
            Owners can register dine-in tables, generate active tokens, and download table QR codes.
          </p>
        </div>
        
        {role === "Owner" && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-sage hover:bg-sage-deep text-cream font-display font-semibold tracking-wider text-xs uppercase px-5 py-3 rounded-full border border-white/10 transition-colors shadow-soft flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} /> Register Table
          </button>
        )}
      </div>

      {/* Tables Grid */}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((table) => {
          const qrUrl = getTableUrl(table);

          return (
            <div
              key={table.id}
              className={`bg-white border rounded-2xl p-5 shadow-soft hover:shadow-luxe transition-all flex flex-col justify-between ${
                table.is_active ? "border-sage/10" : "border-gray-200 opacity-60 bg-gray-50/5"
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-display font-extrabold text-3xl text-sage-deep">
                    Table {table.table_number}
                  </h3>
                  <span className={`text-[9px] font-display uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-full ${
                    table.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {table.is_active ? "Active" : "Disabled"}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-cream/20 border border-sage/5 rounded-xl space-y-1.5 text-xs">
                  <p className="text-[9px] uppercase tracking-wider text-sage/60 font-semibold font-display">Token ID</p>
                  <p className="font-mono text-sage-deep break-all">{table.token}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 border-t border-sage/5 pt-4 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedTable(table);
                      setIsQrOpen(true);
                    }}
                    className="flex-1 bg-sage hover:bg-sage-deep text-cream text-[10px] tracking-wider uppercase font-display font-bold py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <QrCode size={12} /> QR Code
                  </button>
                  <button
                    onClick={() => triggerRegenerate(table)}
                    className="bg-white border border-sage/15 hover:bg-sage/5 text-sage p-2 rounded-lg cursor-pointer"
                    title="Regenerate Token"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                <button
                  onClick={() => handleToggleActive(table)}
                  className={`w-full text-[9px] tracking-widest uppercase font-display font-bold py-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    table.is_active 
                      ? "bg-white border-destructive/20 hover:bg-destructive/5 text-destructive" 
                      : "bg-white border-emerald-25 hover:bg-emerald-5/5 text-emerald-800"
                  }`}
                >
                  {table.is_active ? (
                    <>
                      <Ban size={12} /> Disable Table
                    </>
                  ) : (
                    <>
                      <Unlock size={12} /> Enable Table
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {tables.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white/40 border border-dashed border-sage/20 rounded-3xl text-sm font-display text-sage-deep/50">
            No tables registered. Click "Register Table" to add one.
          </div>
        )}
      </div>

      {/* Register Table Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setIsAddOpen(false)} />
          <div className="bg-cream rounded-3xl border border-sage/15 shadow-luxe max-w-sm w-full p-6 relative z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-sage/10 pb-3">
              <h3 className="font-display font-extrabold text-lg text-sage-deep">Register Dine-In Table</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-sage hover:text-sage-deep">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTable} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">
                  Table Number
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 5"
                  className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-display font-bold"
                />
              </div>
              <p className="text-[10px] text-sage/70 leading-relaxed">
                Creating a table registers it in our system and instantly generates a unique secure token for URL QR generation.
              </p>
              <div className="flex gap-3 border-t border-sage/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 bg-white hover:bg-sage/5 text-sage border border-sage/15 py-3 rounded-xl font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 py-3 rounded-xl font-display font-bold uppercase tracking-wider transition-colors shadow-soft cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Add Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal Drawer */}
      {isQrOpen && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setIsQrOpen(false)} />
          <div className="bg-cream rounded-3xl border border-sage/15 shadow-luxe max-w-sm w-full p-6 relative z-10 text-center space-y-4">
            <div className="flex justify-between items-center border-b border-sage/10 pb-3">
              <h3 className="font-display font-extrabold text-lg text-sage-deep text-left">
                Table {selectedTable.table_number} QR Code
              </h3>
              <button onClick={() => setIsQrOpen(false)} className="text-sage hover:text-sage-deep">
                <X size={20} />
              </button>
            </div>
            
            {/* QR Image */}
            <div className="mx-auto w-60 h-60 bg-white border border-sage/10 rounded-2xl overflow-hidden flex items-center justify-center p-2">
              <QRCodeCanvas 
                id="qr-canvas-table"
                value={getTableUrl(selectedTable)} 
                size={220}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
                includeMargin={false}
                ref={qrRef}
              />
            </div>

            <div className="text-left space-y-2 text-xs">
              <p className="text-[10px] uppercase tracking-wider text-sage/60 font-semibold font-display">Target URL</p>
              <a 
                href={getTableUrl(selectedTable)} 
                target="_blank" 
                rel="noreferrer" 
                className="font-mono text-sage-deep hover:underline break-all flex items-center gap-1"
              >
                {getTableUrl(selectedTable)} <ExternalLink size={12} />
              </a>
            </div>

            <div className="flex gap-3 border-t border-sage/10 pt-4">
              <button
                onClick={() => downloadQr(selectedTable)}
                className="w-full bg-sage hover:bg-sage-deep text-cream font-display font-semibold tracking-wider text-xs uppercase py-3.5 rounded-xl border border-white/10 transition-colors shadow-soft flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regeneration Warning Modal */}
      {isWarnOpen && warnTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setIsWarnOpen(false)} />
          <div className="bg-white rounded-3xl border border-destructive/20 shadow-luxe max-w-sm w-full p-6 relative z-10 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-2">
              <AlertTriangle size={24} />
            </div>
            <h3 className="font-display font-extrabold text-lg text-sage-deep">
              Regenerate Table {warnTable.table_number} Token?
            </h3>
            <p className="text-xs text-sage/75 leading-relaxed">
              WARNING: Regenerating the table token immediately invalidates any old QR codes. Existing printouts for Table {warnTable.table_number} will fail to load ordering mode.
            </p>
            <div className="flex gap-3 border-t border-sage/5 pt-4 text-xs">
              <button
                type="button"
                onClick={() => setIsWarnOpen(false)}
                className="flex-1 bg-white hover:bg-sage/5 text-sage border border-sage/15 py-3 rounded-xl font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRegenerating}
                onClick={confirmRegenerate}
                className="flex-1 bg-destructive hover:bg-destructive-deep text-white py-3 rounded-xl font-display font-bold uppercase tracking-wider transition-colors shadow-soft cursor-pointer"
              >
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
