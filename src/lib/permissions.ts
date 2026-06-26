export const PERMISSIONS = {
  // Orders
  "Orders.View": "Orders.View",
  "Orders.Update": "Orders.Update",
  
  // Kitchen
  "Kitchen.View": "Kitchen.View",
  "Kitchen.Update": "Kitchen.Update",
  
  // Menu
  "Menu.View": "Menu.View",
  "Menu.Create": "Menu.Create",
  "Menu.Update": "Menu.Update",
  "Menu.Delete": "Menu.Delete",
  
  // Tables (QR)
  "Tables.View": "Tables.View",
  "Tables.Update": "Tables.Update",
  
  // Analytics
  "Analytics.View": "Analytics.View",
  
  // Promotions
  "Promotions.View": "Promotions.View",
  "Promotions.Create": "Promotions.Create",
  "Promotions.Update": "Promotions.Update",
  "Promotions.Delete": "Promotions.Delete",
  
  // Settings
  "Settings.View": "Settings.View",
  "Settings.Update": "Settings.Update",
  
  // Users (Owner strictly)
  "Users.View": "Users.View",
  "Users.Create": "Users.Create",
  "Users.Update": "Users.Update",
  "Users.Delete": "Users.Delete",
  
  // System / Reports
  "Reports.View": "Reports.View",
  "Audit.View": "Audit.View",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Owner: [
    "Orders.View", "Orders.Update",
    "Kitchen.View", "Kitchen.Update",
    "Menu.View", "Menu.Create", "Menu.Update", "Menu.Delete",
    "Tables.View", "Tables.Update",
    "Analytics.View",
    "Promotions.View", "Promotions.Create", "Promotions.Update", "Promotions.Delete",
    "Settings.View", "Settings.Update",
    "Users.View", "Users.Create", "Users.Update", "Users.Delete",
    "Reports.View", "Audit.View"
  ],
  Manager: [
    "Orders.View", "Orders.Update",
    "Kitchen.View", "Kitchen.Update",
    "Menu.View", "Menu.Create", "Menu.Update", "Menu.Delete",
    "Analytics.View",
    "Promotions.View", "Promotions.Create", "Promotions.Update", "Promotions.Delete",
    "Settings.View", "Settings.Update",
    "Reports.View"
  ],
  Staff: [
    "Orders.View", "Orders.Update",
    "Kitchen.View", "Kitchen.Update"
  ]
};

/**
 * Validates if a role has the required permission.
 */
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}
