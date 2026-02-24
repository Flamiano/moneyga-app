import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function prepareNavigation() {
      if (Platform.OS === "android") {
        // 'await' both to ensure they finish before we show the app
        await NavigationBar.setBehaviorAsync('sticky-immersive' as any);
        await NavigationBar.setVisibilityAsync("hidden");
      }
      // Hide splash screen ONLY after the bar is hidden
      await SplashScreen.hideAsync();
    }

    prepareNavigation();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
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