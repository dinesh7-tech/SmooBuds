import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { updateCafeSettingsFn, regenerateAllTableTokensFn, getTablesFn, checkBucketExistsFn, uploadLogoFn } from "@/lib/adminActions";
import { AlertTriangle, Store, Phone, Mail, Clock, Instagram, Loader2, Check, 
  UploadCloud, QrCode, Download, RefreshCw, X, Palette, Settings as SettingsIcon, Link as LinkIcon, Save
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface Settings {
  cafe_name: string;
  about_section: string | null;
  address: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  email: string | null;
  opening_hours: string | null;
  closing_hours: string | null;
  instagram_link: string | null;
  facebook_link: string | null;
  ordering_enabled: boolean;
  accept_new_orders: boolean;
  auto_refresh_interval: number;
  qr_table_count: number;
  logo_url: string | null;
  theme_color: string;
}

const DEFAULT_SETTINGS: Settings = {
  cafe_name: "SMOOBUDS",
  opening_hours: "09:00",
  closing_hours: "23:00",
  ordering_enabled: true,
  accept_new_orders: true,
  auto_refresh_interval: 30,
  about_section: "",
  address: "",
  phone_number: "",
  whatsapp_number: "",
  email: "",
  instagram_link: "",
  facebook_link: "",
  qr_table_count: 10,
  logo_url: "",
  theme_color: "#4A5D23"
};

interface TableToken {
  table_number: number;
  token: string;
}

export const Route = createFileRoute("/admin/settings")({
  loader: async () => {
    let finalSettings = { ...DEFAULT_SETTINGS };
    let tablesData: TableToken[] = [];
    let hasBucket = false;
    let schemaError = false;

    try {
      // 1. Fetch settings
      const { data: settingsData, error } = await supabase
        .from("cafe_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.warn("Schema or table error for cafe_settings:", error);
        // Only flag schema error if it's explicitly a missing column/table error
        if (error.code === '42703' || error.code === '42P01') {
          schemaError = true;
        }
      } else if (settingsData) {
        finalSettings = { ...DEFAULT_SETTINGS, ...settingsData };
      } else {
        await supabase.from("cafe_settings").insert({ id: 1, cafe_name: "SMOOBUDS" }).select().maybeSingle();
      }

    } catch (err) {
      console.error("Critical error in settings loader:", err);
    }

    return { 
      settings: finalSettings,
      tables: tablesData,
      schemaError
    };
  },
  errorComponent: ({ error, reset }) => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-white/40 border border-red-200 rounded-3xl backdrop-blur-sm m-6">
      <AlertTriangle size={48} className="text-red-400 mb-4" />
      <h2 className="font-display font-extrabold text-2xl text-red-900 mb-2">Settings temporarily unavailable</h2>
      <p className="text-sm text-red-700/70 max-w-md mb-6">
        {error instanceof Error ? error.message : "An unexpected error crashed the settings module."}
      </p>
      <button 
        onClick={() => reset()} 
        className="bg-red-500 hover:bg-red-600 text-white font-display font-bold px-6 py-3 rounded-xl transition-colors shadow-soft"
      >
        Retry Reloading
      </button>
    </div>
  ),
  component: SettingsPage,
});

function SettingsPage() {
  const router = useRouter();
  const { settings, schemaError } = Route.useLoaderData();
  const { sessionToken, role } = useAdmin();

  // Securely fetched state
  const [tables, setTables] = useState<TableToken[]>([]);

  // Form fields
  const [cafeName, setCafeName] = useState(settings?.cafe_name || "SmooBuds Cafe");
  const [aboutSection, setAboutSection] = useState(settings?.about_section || "");
  const [address, setAddress] = useState(settings?.address || "");
  const [phoneNumber, setPhoneNumber] = useState(settings?.phone_number || "");
  const [whatsappNumber, setWhatsappNumber] = useState(settings?.whatsapp_number || "");
  const [email, setEmail] = useState(settings?.email || "");
  const [openingHours, setOpeningHours] = useState(settings?.opening_hours || "11:00 AM");
  const [closingHours, setClosingHours] = useState(settings?.closing_hours || "11:00 PM");
  const [instagramLink, setInstagramLink] = useState(settings?.instagram_link || "");
  const [facebookLink, setFacebookLink] = useState(settings?.facebook_link || "");
  const [orderingEnabled, setOrderingEnabled] = useState(settings?.ordering_enabled ?? true);
  const [acceptNewOrders, setAcceptNewOrders] = useState(settings?.accept_new_orders ?? true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(settings?.auto_refresh_interval || 30);
  const [qrTableCount, setQrTableCount] = useState(settings?.qr_table_count || 10);
  const [themeColor, setThemeColor] = useState(settings?.theme_color || "#4A5D23");
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url || "");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState((settings as any)?.session_timeout_minutes || 180);
  const [qrEmergencyDisabled, setQrEmergencyDisabled] = useState((settings as any)?.qr_emergency_disabled || false);
  const [lockdownLevel, setLockdownLevel] = useState((settings as any)?.lockdown_level || 0);
  const [qrRotationSchedule, setQrRotationSchedule] = useState((settings as any)?.qr_rotation_schedule || "Manual only");
  const [qrRotationGracePeriodMins, setQrRotationGracePeriodMins] = useState((settings as any)?.qr_rotation_grace_period_mins || 15);
  const [disableLegacyQr, setDisableLegacyQr] = useState((settings as any)?.disable_legacy_qr || false);
  const [threatLogRetentionDays, setThreatLogRetentionDays] = useState((settings as any)?.threat_log_retention_days || 90);

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let mounted = true;
    const fetchData = async () => {
      try {
        // Run bucket check strictly for diagnostic logging
        checkBucketExistsFn({ data: { token: sessionToken } }).catch(e => console.error(e));
        
        const tablesResponse = await getTablesFn({ data: { token: sessionToken } });
        if (mounted) {
          setTables(tablesResponse);
        }
      } catch (err) {
        console.error("Failed to fetch secure data:", err);
      }
    };
    fetchData();
    return () => { mounted = false };
  }, [sessionToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;

    setIsSaving(true);
    const toastId = toast.loading("Saving settings changes...");
    try {
      const response = await updateCafeSettingsFn({
        data: {
          payload: {
            cafeName,
            aboutSection,
            address,
            phoneNumber,
            whatsappNumber,
            email,
            openingHours,
            closingHours,
            instagramLink,
            facebookLink,
            orderingEnabled,
            acceptNewOrders,
            autoRefreshInterval,
            qrTableCount,
            logoUrl,
            themeColor,
            sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
            qrEmergencyDisabled,
            lockdownLevel: Number(lockdownLevel),
            qrRotationSchedule,
            qrRotationGracePeriodMins: Number(qrRotationGracePeriodMins),
            disableLegacyQr,
            threatLogRetentionDays: Number(threatLogRetentionDays)
          },
          token: sessionToken,
        },
      });

      if (response.success) {
        toast.dismiss(toastId);
        toast.success("Cafe settings updated successfully!");
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          router.invalidate(); // Background refresh
        }, 1500);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      const errMsg = err?.message || "Failed to save settings.";
      if (errMsg.toLowerCase().includes("invalid email")) {
        toast.error("Please enter a valid email address.");
      } else if (errMsg.toLowerCase().includes("invalid url")) {
        toast.error("Please upload a logo or enter a valid URL.");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionToken) return;

    setIsUploading(true);
    const toastId = toast.loading("Uploading logo securely...");
    try {
      // Read file as Data URL (Base64)
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64File = await base64Promise;

      const response = await uploadLogoFn({
        data: {
          payload: {
            base64File,
            fileName: file.name,
            contentType: file.type
          },
          token: sessionToken
        }
      });

      if (response.success && response.url) {
        console.log("UPLOAD_SUCCESS", response.url);
        setLogoUrl(response.url);
        toast.dismiss(toastId);
        toast.success("Logo uploaded successfully. Don't forget to save!");
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to upload logo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRegenerateTokens = async () => {
    if (!sessionToken) return;
    if (!confirm("Are you sure? This will invalidate all existing QR codes. You will need to print new ones.")) return;

    setIsRegenerating(true);
    const toastId = toast.loading("Regenerating all table QR codes...");
    try {
      const response = await regenerateAllTableTokensFn({
        data: {
          tableCount: qrTableCount,
          token: sessionToken
        }
      });
      if (response.success) {
        toast.dismiss(toastId);
        toast.success("All QR codes regenerated!");
        // Refresh tables immediately
        const newTables = await getTablesFn({ data: { token: sessionToken } });
        setTables(newTables);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to regenerate tokens.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const downloadQR = async (tableNumber: number, token: string) => {
    const origin = window.location.origin;
    const orderUrl = `${origin}/menu?table=${tableNumber}&token=${token}`;
    
    try {
      const dataUrl = await QRCode.toDataURL(orderUrl, {
        width: 500,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.download = `Table_${tableNumber}_QRCode.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded QR Code for Table ${tableNumber}`);
    } catch (err) {
      toast.error("Failed to download QR Code");
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-sage-deep">Cafe Profile & Settings</h2>
          <p className="text-xs text-sage/75 mt-1">
            Owners and Managers can customize contact links, locations, ordering configurations, and QR codes.
          </p>
        </div>
        
        {/* Sticky Save Button (Desktop) */}
        {role && ["Owner", "Manager"].includes(role) && (
          <div className="hidden sm:block">
            {saveSuccess ? (
              <button disabled className="bg-green-500 text-white font-display font-bold tracking-widest text-xs uppercase px-6 py-3 rounded-xl shadow-soft flex items-center gap-2">
                <Check size={16} className="animate-in zoom-in duration-300" /> Saved
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 font-display font-semibold tracking-widest text-xs uppercase px-6 py-3 rounded-xl border border-white/10 transition-colors shadow-soft flex items-center gap-2 cursor-pointer"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            )}
          </div>
        )}
      </div>

      {schemaError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex gap-3 text-sm font-semibold">
          <AlertTriangle size={20} className="shrink-0 text-amber-500" />
          <p>Some settings columns may be missing from the database schema. The page is using safe fallback defaults. Saving may fail until migrations are applied.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <form id="settings-form" onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          
          {/* Cafe Settings */}
          <div className="bg-white border border-sage/10 rounded-3xl p-6 shadow-soft space-y-6 text-xs">
            <h3 className="font-display font-extrabold text-lg text-sage-deep border-b border-sage/5 pb-2 flex items-center gap-2">
              <Store size={18} className="text-sage" /> Cafe Details
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Cafe Name</label>
                <input
                  type="text"
                  required
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">About / Subtitle</label>
                <textarea
                  value={aboutSection}
                  onChange={(e) => setAboutSection(e.target.value)}
                  rows={2}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Opening Time</label>
                <input
                  type="time"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Closing Time</label>
                <input
                  type="time"
                  value={closingHours}
                  onChange={(e) => setClosingHours(e.target.value)}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Ordering & Appearance */}
          <div className="bg-white border border-sage/10 rounded-3xl p-6 shadow-soft space-y-6 text-xs">
            <h3 className="font-display font-extrabold text-lg text-sage-deep border-b border-sage/5 pb-2 flex items-center gap-2">
              <SettingsIcon size={18} className="text-sage" /> Ordering & Appearance
            </h3>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4 sm:col-span-2">
                <div className="flex items-center justify-between p-4 border border-sage/10 rounded-xl bg-sage/5">
                  <div>
                    <h4 className="font-display font-bold text-sage-deep text-sm">Enable Digital Ordering</h4>
                    <p className="text-[10px] text-sage/70 mt-1">Allow customers to view menu and place orders.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={orderingEnabled} onChange={(e) => setOrderingEnabled(e.target.checked)} />
                    <div className="w-11 h-6 bg-sage/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-sage/10 rounded-xl bg-sage/5">
                  <div>
                    <h4 className="font-display font-bold text-sage-deep text-sm">Accept New Orders</h4>
                    <p className="text-[10px] text-sage/70 mt-1">If disabled, menu is view-only.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={acceptNewOrders} onChange={(e) => setAcceptNewOrders(e.target.checked)} />
                    <div className="w-11 h-6 bg-sage/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 rounded-xl bg-red-50/50">
                  <div>
                    <h4 className="font-display font-bold text-red-800 text-sm">QR Emergency Disable</h4>
                    <p className="text-[10px] text-red-700/70 mt-1">Instantly disable all QR codes and block scanning/ordering.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={qrEmergencyDisabled} onChange={(e) => setQrEmergencyDisabled(e.target.checked)} />
                    <div className="w-11 h-6 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-red-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                  </label>
                </div>
              </div>

              {/* Enterprise Security Section */}
              <div className="border-t border-sage/10 pt-6 mt-6">
                <h3 className="font-display font-bold text-sage text-base mb-4 flex items-center gap-2">
                  <svg className="h-5 w-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Enterprise Security & Lockdowns
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Lockdown Level Selector */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Emergency Lockdown Level</label>
                    <select
                      value={lockdownLevel}
                      onChange={(e) => setLockdownLevel(Number(e.target.value))}
                      className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                    >
                      <option value={0}>Level 0 — Normal Mode</option>
                      <option value={1}>Level 1 — Block Customer Ordering</option>
                      <option value={2}>Level 2 — Block Orders + Waiter Calls</option>
                      <option value={3}>Level 3 — Complete Customer Lockdown</option>
                    </select>
                    <p className="text-[10px] text-sage/60 mt-1">Staff and admin portals remain fully active under all levels.</p>
                  </div>


                  {/* QR Rotation Schedule */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Auto Token Rotation Schedule</label>
                    <select
                      value={qrRotationSchedule}
                      onChange={(e) => setQrRotationSchedule(e.target.value)}
                      className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                    >
                      <option value="Manual only">Manual only</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>

                  {/* Grace Period Duration */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Rotation Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      required
                      value={qrRotationGracePeriodMins}
                      onChange={(e) => setQrRotationGracePeriodMins(Number(e.target.value))}
                      className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                    />
                    <p className="text-[10px] text-sage/60 mt-1">Allows active tables to transition safely during token rotation.</p>
                  </div>

                  {/* Threat Log Retention Days */}
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Threat Logs Retention (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={threatLogRetentionDays}
                      onChange={(e) => setThreatLogRetentionDays(Number(e.target.value))}
                      className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                    />
                  </div>

                  {/* Disable Legacy QR codes */}
                  <div className="flex items-center justify-between p-4 border border-sage/10 rounded-xl bg-sage/5">
                    <div>
                      <h4 className="font-display font-bold text-sage text-sm">Force Signed QR Payloads</h4>
                      <p className="text-[10px] text-sage/70 mt-1">Disable legacy plain URL parameters to block older stickers completely.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={disableLegacyQr} onChange={(e) => setDisableLegacyQr(e.target.checked)} />
                      <div className="w-11 h-6 bg-sage/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Customer Session Timeout (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  required
                  value={sessionTimeoutMinutes}
                  onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                  className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Theme Color</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer border-0 p-0"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="flex-1 bg-cream/20 border border-sage/10 rounded-xl px-4 py-2 focus:outline-none focus:border-sage focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Logo Upload</label>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 bg-white border border-sage/20 hover:border-sage text-sage-deep font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {isUploading ? "Uploading..." : "Upload File"}
                  </button>
                </div>
                {logoUrl && (
                  <div className="mt-2 p-2 border border-sage/10 rounded-lg flex items-center gap-3 bg-white">
                    <img src={logoUrl} alt="Logo Preview" className="h-8 w-8 object-contain rounded" />
                    <span className="text-[10px] text-sage truncate">{logoUrl.substring(0, 30)}...</span>
                    <button type="button" onClick={() => setLogoUrl("")} className="ml-auto text-destructive hover:bg-destructive/10 p-1 rounded cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* QR Management Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-sage/10 rounded-3xl p-6 shadow-soft space-y-6 text-xs sticky top-6">
            <h3 className="font-display font-extrabold text-lg text-sage-deep border-b border-sage/5 pb-2 flex items-center gap-2">
              <QrCode size={18} className="text-sage" /> QR Management
            </h3>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Total Active Tables</label>
              <input
                type="number"
                min="1"
                max="100"
                value={qrTableCount}
                onChange={(e) => setQrTableCount(parseInt(e.target.value) || 10)}
                className="w-full bg-cream/20 border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all text-sm font-semibold"
              />
              <p className="text-[9px] text-sage/70 mt-1">Save settings then click regenerate below to apply changes.</p>
            </div>

            <button
              onClick={handleRegenerateTokens}
              disabled={isRegenerating || role !== "Owner"}
              className="w-full bg-white hover:bg-sage/5 border border-sage/20 text-sage-deep font-display font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Regenerate All QRs
            </button>

            {role !== "Owner" && (
              <p className="text-[9px] text-amber-600 text-center bg-amber-50 p-2 rounded border border-amber-200">Only Owners can regenerate tokens.</p>
            )}

            <div className="pt-4 border-t border-sage/10 max-h-[300px] overflow-y-auto no-scrollbar space-y-2">
              <h4 className="font-display font-bold text-sage-deep text-[10px] uppercase tracking-wider mb-2">Active Table Links</h4>
              {tables.map(table => {
                const orderUrl = `${window.location.origin}?table=${table.table_number}&token=${table.token}`;
                return (
                  <div key={table.table_number} className="p-3 border border-sage/10 rounded-xl flex items-center justify-between group hover:bg-sage/5 transition-colors">
                    <div>
                      <p className="font-bold text-sage-deep">Table {table.table_number}</p>
                      <p className="text-[9px] text-sage/60 font-mono truncate max-w-[100px]">{table.token}</p>
                    </div>
                    <div className="flex gap-1">
                      <a href={orderUrl} target="_blank" rel="noreferrer" className="p-1.5 text-sage hover:bg-sage/10 rounded-lg transition-colors">
                        <LinkIcon size={14} />
                      </a>
                      <button onClick={() => downloadQR(table.table_number, table.token)} className="p-1.5 text-sage hover:bg-sage/10 rounded-lg transition-colors cursor-pointer">
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {tables.length === 0 && <p className="text-center text-sage/50 text-[10px]">No tables generated yet.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Save Footer */}
      {role && ["Owner", "Manager"].includes(role) && (
        <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-white/80 backdrop-blur-md border-t border-sage/10 p-4 z-40">
          {saveSuccess ? (
            <button disabled className="w-full bg-green-500 text-white font-display font-bold tracking-widest text-xs uppercase px-6 py-4 rounded-xl shadow-luxe flex items-center justify-center gap-2">
              <Check size={16} className="animate-in zoom-in duration-300" /> Saved
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="w-full bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 font-display font-semibold tracking-widest text-xs uppercase px-6 py-4 rounded-xl shadow-luxe flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
