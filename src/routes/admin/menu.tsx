import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { saveMenuItemFn, deleteMenuItemFn } from "@/lib/adminActions";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  Search, 
  FolderOpen,
  DollarSign,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: "Coffee" | "Mocktails" | "Shakes" | "Starters" | "Main Course" | "Desserts";
  image_url: string | null;
  is_available: boolean;
}

export const Route = createFileRoute("/admin/menu")({
  loader: async () => {
    // Load all items (including unavailable ones)
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to load menu items:", error);
      return { menuList: [] as MenuItem[] };
    }
    return { menuList: data as MenuItem[] };
  },
  component: MenuManagementPage,
});

const CATEGORIES = ["Coffee", "Mocktails", "Shakes", "Starters", "Main Course", "Desserts"];

function MenuManagementPage() {
  const router = useRouter();
  const { menuList } = Route.useLoaderData();
  const { sessionToken, role } = useAdmin();

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Form Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  // Input fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [category, setCategory] = useState<MenuItem["category"]>("Coffee");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleSuccessId, setToggleSuccessId] = useState<string | null>(null);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategory("Coffee");
    setImageUrl("");
    setIsAvailable(true);
    setIsOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    setPrice(item.price);
    setCategory(item.category);
    setImageUrl(item.image_url || "");
    setIsAvailable(item.is_available);
    setIsOpen(true);
  };

  // Save Item
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("ACTION_CLICKED", "Save Product");
    
    if (!name || price === "" || price < 0) {
      console.error("Validation Error: Missing name or price");
      toast.error("Please provide a valid name and price.");
      return;
    }

    if (!sessionToken) {
      console.error("Auth Error: Missing sessionToken in handleSave");
      toast.error("Authentication error: No session token");
      return;
    }

    console.log("SAVE_HANDLER_STARTED");
    setIsSaving(true);
    const toastId = toast.loading("Saving menu item...");
    try {
      console.log("SERVER_ACTION_CALLED");
      const response = await saveMenuItemFn({
        data: {
          payload: {
            id: editingItem?.id,
            name,
            description: description || null,
            price: Number(price),
            category,
            imageUrl: imageUrl || null,
            isAvailable,
          },
          token: sessionToken,
        },
      });

      console.log("SERVER_ACTION_SUCCESS", response);
      if (response.success) {
        toast.dismiss(toastId);
        toast.success(editingItem ? "Product Updated" : "Product Added");
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          setIsOpen(false);
          router.invalidate();
        }, 1500);
      }
    } catch (err: any) {
      console.error("SERVER_ACTION_ERROR", err);
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Item
  const handleDelete = async (id: string) => {
    console.log("ACTION_CLICKED", "Delete Product");
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    if (!sessionToken) return;

    setDeletingId(id);
    try {
      const response = await deleteMenuItemFn({
        data: {
          id,
          token: sessionToken,
        },
      });

      if (response.success) {
        toast.success("Menu item deleted.");
        router.invalidate();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete item.");
    } finally {
      setDeletingId(null);
    }
  };

  // Toggle Availability directly
  const toggleAvailability = async (item: MenuItem) => {
    console.log("ACTION_CLICKED", "Toggle Availability");
    if (!sessionToken) return;

    setTogglingId(item.id);
    try {
      const response = await saveMenuItemFn({
        data: {
          payload: {
            ...item,
            id: item.id,
            imageUrl: item.image_url,
            isAvailable: !item.is_available,
          },
          token: sessionToken,
        },
      });
      if (response.success) {
        setToggleSuccessId(item.id);
        toast.success("Product Availability Updated");
        setTimeout(() => {
          setToggleSuccessId(null);
          router.invalidate();
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to toggle status.");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredItems = menuList.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-sage-deep">Menu Management Catalog</h2>
          <p className="text-xs text-sage/75 mt-1">
            Create, modify details, delete, or toggle availability of cafe recipes instantly.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-sage hover:bg-sage-deep text-cream font-display font-semibold tracking-wider text-xs uppercase px-5 py-3 rounded-full border border-white/10 transition-colors shadow-soft flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> Add New Item
        </button>
      </div>

      {/* Catalog Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/50" size={16} />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/50 border border-sage/15 rounded-full pl-10 pr-6 py-2.5 text-sm placeholder-sage/40 focus:outline-none focus:border-sage focus:bg-white transition-all duration-300"
          />
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-display font-semibold tracking-wider transition-all duration-300 cursor-pointer ${
              selectedCategory === "All"
                ? "bg-sage text-cream shadow-soft"
                : "bg-white/50 border border-sage/10 text-sage-deep hover:bg-white"
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-display font-semibold tracking-wider transition-all duration-300 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-sage text-cream shadow-soft"
                  : "bg-white/50 border border-sage/10 text-sage-deep hover:bg-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`bg-white border rounded-2xl p-5 shadow-soft hover:shadow-luxe transition-shadow flex gap-4 ${
              item.is_available ? "border-sage/10" : "border-gray-200 opacity-75"
            }`}
          >
            {/* Image Placeholder */}
            <div className="h-20 w-20 rounded-xl bg-sage-deep/5 flex-shrink-0 overflow-hidden relative flex items-center justify-center border border-sage/10">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <FolderOpen className="text-gold-gradient opacity-60" size={24} />
              )}
            </div>

            {/* details */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-extrabold text-sage-deep tracking-tight truncate">
                    {item.name}
                  </h3>
                  <span className="font-display font-bold text-sage text-sm whitespace-nowrap">
                    ₹{item.price}
                  </span>
                </div>
                <p className="text-xs text-sage-deep/65 mt-1 line-clamp-2 leading-relaxed">
                  {item.description || "No description provided."}
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex items-center justify-between border-t border-sage/5 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-gold font-display font-semibold">
                  {item.category}
                </span>

                <div className="flex items-center gap-2">
                  {/* Availability toggle */}
                  {toggleSuccessId === item.id ? (
                    <button
                      disabled
                      className="px-3 py-1 rounded-full text-[10px] font-display font-extrabold uppercase tracking-wider bg-green-500 text-white flex items-center justify-center gap-1"
                    >
                      <Check size={12} className="animate-in zoom-in duration-300" /> Done
                    </button>
                  ) : (
                    <button
                      disabled={togglingId === item.id}
                      onClick={() => toggleAvailability(item)}
                      className={`px-3 py-1 rounded-full text-[10px] font-display font-extrabold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        item.is_available 
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" 
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      {togglingId === item.id && <Loader2 size={12} className="animate-spin" />}
                      {togglingId === item.id ? "Updating..." : item.is_available ? "In Stock" : "Out of Stock"}
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-sage hover:text-sage-deep hover:bg-sage/5 rounded-lg transition-colors cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit3 size={14} />
                  </button>

                  <button
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-sage-deep/40 hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white/40 border border-dashed border-sage/20 rounded-3xl text-sm font-display text-sage-deep/50">
            No creations found in catalog.
          </div>
        )}
      </div>

      {/* 5. Add / Edit Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          
          {/* Form Card */}
          <div className="bg-cream rounded-3xl border border-sage/15 shadow-luxe max-w-md w-full p-6 relative z-10 space-y-4">
            <div className="flex justify-between items-center border-b border-sage/10 pb-3">
              <h3 className="font-display font-extrabold text-lg text-sage-deep">
                {editingItem ? "Edit Menu Item" : "Add Menu Item"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-sage hover:text-sage-deep">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pistachio Gelato"
                  className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Price (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 250"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details and ingredient notes..."
                  rows={3}
                  className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-semibold block mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://imagehost.com/dessert.jpg"
                  className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="availableCheck"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="rounded border-sage/20 text-sage focus:ring-sage"
                />
                <label htmlFor="availableCheck" className="text-xs text-sage-deep font-semibold select-none cursor-pointer">
                  Mark as Available in stock
                </label>
              </div>

              <div className="flex gap-3 border-t border-sage/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSaving || saveSuccess}
                  className="flex-1 bg-white hover:bg-sage/5 text-sage border border-sage/15 py-3 rounded-xl font-display font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                {saveSuccess ? (
                  <button
                    disabled
                    className="flex-1 bg-green-500 text-white py-3 rounded-xl font-display font-bold uppercase tracking-wider shadow-soft flex items-center justify-center gap-2"
                  >
                    <Check size={16} className="animate-in zoom-in duration-300" /> Done
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 py-3 rounded-xl font-display font-bold uppercase tracking-wider transition-colors shadow-soft cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    {isSaving ? "Saving..." : "Save Product"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
