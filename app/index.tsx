import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "../constants/theme";
import { useAuth } from "../providers/AuthProvider";
import { useSupabase } from "../providers/SupabaseProvider";

export default function Index() {
  const { user, isLoading } = useAuth();
  const { isLoadingConfig } = useSupabase();

  if (isLoading || isLoadingConfig) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? "/(app)/home" : "/login"} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
  },
});
