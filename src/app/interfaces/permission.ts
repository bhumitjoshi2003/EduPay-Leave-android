export interface Permission {
  permissionKey: string;
  displayName: string;
  category: string;
  description: string;
}

export interface RolePermissionMatrix {
  role: string;
  permissionKeys: string[];
}
