import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../providers/AuthProvider";
import { DataProvider } from "../providers/DataProvider";
import { NotificationProvider } from "../providers/NotificationProvider";
import { SupabaseProvider } from "../providers/SupabaseProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SupabaseProvider>
        <NotificationProvider>
          <AuthProvider>
            <DataProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }} />
            </DataProvider>
          </AuthProvider>
        </NotificationProvider>
      </SupabaseProvider>
    </SafeAreaProvider>
  );
}
