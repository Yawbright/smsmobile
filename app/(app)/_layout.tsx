import { Redirect, Slot } from "expo-router";

import { AppShell } from "../../components/AppShell";
import { useAuth } from "../../providers/AuthProvider";

export default function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && !user) return <Redirect href="/login" />;
  return <AppShell><Slot /></AppShell>;
}
