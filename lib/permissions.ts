import { MobileUser, PermissionKey } from "../types";

export function can(user: MobileUser | null, permission: PermissionKey) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(user.permissions?.[permission]);
}

export function roleLabel(role?: string) {
  switch (role) {
    case "admin":
      return "Admin";
    case "head_teacher":
      return "Head Teacher";
    case "class_teacher":
      return "Class Teacher";
    case "subject_teacher":
      return "Subject Teacher";
    default:
      return "User";
  }
}
