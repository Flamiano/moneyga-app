import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after layout mounts
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The main entry point */}
      <Stack.Screen name="index" />

      {/* Authentication Group */}
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />

      {/* Main App Group */}
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />

      {/* Individual Screens */}
      <Stack.Screen
        name="settings"
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Settings",
        }}
      />
    </Stack>
  );
}
