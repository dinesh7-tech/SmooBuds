import { createContext, useContext } from "react";

export interface AdminContextType {
  userId: string | null;
  role: "Owner" | "Manager" | "Staff" | null;
  sessionToken: string | null;
  authLoading: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  pendingRequestsCount: number;
}

export const AdminContext = createContext<AdminContextType | null>(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    console.error("[useAdmin] CRITICAL ERROR: context is null! Provider is missing.");
    return {
      userId: null,
      role: null,
      sessionToken: null,
      authLoading: true,
      soundEnabled: false,
      setSoundEnabled: () => {},
      pendingRequestsCount: 0,
    } as AdminContextType;
  }
  return context;
};
