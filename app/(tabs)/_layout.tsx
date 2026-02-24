import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function TabLayout() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [formattedTime, setFormattedTime] = useState("");
  const [profile, setProfile] = useState<{
    full_name: string;
    email: string;
    avatar_url?: string;
  } | null>(null);

  useEffect(() => {
    // 1. Logic to force hide the bar
    const hideNavBar = async () => {
      if (Platform.OS === "android") {
        await NavigationBar.setBehaviorAsync("sticky-immersive");
        await NavigationBar.setVisibilityAsync("hidden");
      }
    };

    hideNavBar();

    // 2. Add a listener: If the system bar becomes visible again (user swipe), 
    // this will force it back to hidden immediately.
    const visibilitySubscription = NavigationBar.addVisibilityListener(({ visibility }) => {
      if (visibility === "visible") {
        hideNavBar();
      }
    });

    // Clock update logic
    const updateTime = () => {
      const now = new Date();
      setFormattedTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);

    fetchProfile();

    return () => {
      clearInterval(timer);
      visibilitySubscription.remove(); // Clean up listener
    };
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        setProfile(data);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error.message);
    }
  }

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          setMenuVisible(false);
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: "#3A6B55",
          tabBarInactiveTintColor: "#999",
          headerShown: true,
          header: () => {
            const titles: Record<string, string> = {
              dashboard: "Dashboard",
              expenses: "Expenses",
              income: "Ipon Tracker",
              budget: "Budget Planner",
              reports: "MoneyGa Reports",
            };
            return (
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>{titles[route.name] || "MoneyGa"}</Text>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{formattedTime} PH 🇵🇭</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.profileButton} onPress={() => setMenuVisible(true)}>
                  <View style={styles.profileCircle}>
                    {profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} />
                    ) : (
                      <MaterialCommunityIcons name="account" size={26} color="#3A6B55" />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          },
          tabBarLabelStyle: { fontFamily: "Poppins-Medium", fontSize: 10, marginBottom: 8 },
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "#ffffff",
            borderTopWidth: 0,
            bottom: Platform.OS === "ios" ? 30 : 25,
            marginHorizontal: 20,
            height: 65,
            borderRadius: 35,
            elevation: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
          },
        })}
      >
        <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, focused }) => (<MaterialCommunityIcons name={focused ? "home-variant" : "home-variant-outline"} size={24} color={color} />) }} />
        <Tabs.Screen name="expenses" options={{ title: "Spend", tabBarIcon: ({ color, focused }) => (<MaterialCommunityIcons name={focused ? "arrow-down-bold-circle" : "arrow-down-bold-circle-outline"} size={24} color={color} />) }} />
        <Tabs.Screen name="income" options={{ title: "Earn", tabBarIcon: ({ color, focused }) => (<MaterialCommunityIcons name={focused ? "arrow-up-bold-circle" : "arrow-up-bold-circle-outline"} size={24} color={color} />) }} />
        <Tabs.Screen name="budget" options={{ title: "Plan", tabBarIcon: ({ color, focused }) => (<MaterialCommunityIcons name={focused ? "wallet" : "wallet-outline"} size={24} color={color} />) }} />
        <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color, focused }) => (<MaterialCommunityIcons name={focused ? "file-chart" : "file-chart-outline"} size={24} color={color} />) }} />
      </Tabs>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.floatingMenu}>
            <Text style={styles.menuName}>{profile?.full_name || "Loading..."}</Text>
            <Text style={styles.menuEmail}>{profile?.email || ""}</Text>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push("/settings"); }}>
              <MaterialCommunityIcons name="cog" size={20} color="#333" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={20} color="#C25450" />
              <Text style={[styles.menuItemText, { color: "#C25450" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#EFEBE4",
    paddingTop: Platform.OS === "ios" ? 60 : 50,
    paddingBottom: 15,
  },
  headerTitle: { fontSize: 28, fontFamily: "Poppins-Bold", color: "#3A6B55" },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: -5 },
  timeText: { fontSize: 12, fontFamily: "Poppins-Medium", color: "#888" },
  profileButton: { padding: 2 },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    overflow: "hidden",
  },
  profileImage: { width: "100%", height: "100%", borderRadius: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  floatingMenu: {
    marginTop: Platform.OS === "ios" ? 110 : 100,
    marginRight: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    width: 220,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  menuName: { fontSize: 13, fontFamily: "Poppins-Bold", color: "#333" },
  menuEmail: { fontSize: 12, color: "#888", marginBottom: 10 },
  menuDivider: { height: 1, backgroundColor: "#eee", marginVertical: 5 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  menuItemText: { marginLeft: 10, fontSize: 14, fontFamily: "Poppins-Medium", color: "#333" },
});