import { useAuth } from "../contexts/AuthContext";

export function usePermissions() {
  const { user } = useAuth();

  function hasPermission(permission: string): boolean {
    if (!user) return false;

    // Super Admin and Admin have unrestricted access
    if (user.role === "super_admin" || user.role === "admin") {
      return true;
    }

    if (Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }

    return false;
  }

  function hasAnyPermission(...permissions: string[]): boolean {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "admin") return true;
    return permissions.some((p) => hasPermission(p));
  }

  function hasAllPermissions(...permissions: string[]): boolean {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "admin") return true;
    return permissions.every((p) => hasPermission(p));
  }

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isSuperAdmin,
    isAdmin,
    permissions: user?.permissions ?? [],
  };
}
