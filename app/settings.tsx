import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function SettingsScreen() {
  const router = useRouter();

  // Loading states for staggered effect
  const [headerLoading, setHeaderLoading] = useState(true);
  const [infoLoading, setInfoLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(true);

  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    avatar_url: "",
    email: "",
    created_at: "",
    birthdate: "",
    age: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (data) {
          setProfile({
            ...data,
            email: data.email || user.email,
            created_at: data.created_at || user.created_at,
          });
        }
      }
    } catch (error: any) {
      console.error("Fetch error:", error.message);
    } finally {
      // Staggered loading sequence
      setTimeout(() => setHeaderLoading(false), 400);
      setTimeout(() => setInfoLoading(false), 800);
      setTimeout(() => setFormLoading(false), 1200);
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not Set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  async function uploadAvatar() {
    try {
      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets) return;
      const asset = result.assets[0];
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fileExt = asset.uri.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `private/${fileName}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("user_profile")
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("user_profile").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user?.id);

      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
      Alert.alert("Success", "Profile picture updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        updated_at: new Date(),
      })
      .eq("id", user?.id);

    setUpdating(false);
    if (!error) Alert.alert("Success", "Profile updated!");
    else Alert.alert("Error", error.message);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Visual Header Section */}
      <View style={styles.avatarSection}>
        {headerLoading ? (
          <ActivityIndicator
            size="large"
            color="#3A6B55"
            style={{ height: 150 }}
          />
        ) : (
          <>
            <TouchableOpacity onPress={uploadAvatar} disabled={uploading}>
              <View style={styles.avatarWrapper}>
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.placeholderAvatar]}>
                    <MaterialCommunityIcons
                      name="account"
                      size={60}
                      color="#3A6B55"
                    />
                  </View>
                )}
                {uploading ? (
                  <ActivityIndicator style={styles.editIcon} color="#fff" />
                ) : (
                  <View style={styles.editIcon}>
                    <MaterialCommunityIcons
                      name="camera"
                      size={18}
                      color="#fff"
                    />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>
              {profile.full_name || "User Name"}
            </Text>
            <View style={styles.statusBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText}>Status: Active</Text>
            </View>
          </>
        )}
      </View>

      {/* Account Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>Account Information</Text>
        {infoLoading ? (
          <ActivityIndicator color="#3A6B55" />
        ) : (
          <>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="email-outline"
                size={18}
                color="#3A6B55"
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="cake-variant"
                size={18}
                color="#3A6B55"
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Birthdate & Age</Text>
                <Text style={styles.infoValue}>
                  {formatDate(profile.birthdate)} ({profile.age || "??"} years
                  old)
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={18}
                color="#3A6B55"
              />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {formatDate(profile.created_at)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Form Section */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        {formLoading ? (
          <ActivityIndicator color="#3A6B55" />
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={profile.full_name}
                onChangeText={(t) => setProfile({ ...profile, full_name: t })}
                placeholder="Juan Dela Cruz"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={(t) => setProfile({ ...profile, phone: t })}
                keyboardType="phone-pad"
                placeholder="09123456789"
              />
            </View>
            <View style={styles.btnContainer}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUpdate}
                disabled={updating || uploading}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9F8" },
  avatarSection: { alignItems: "center", marginTop: 20, minHeight: 180 },
  avatarWrapper: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#fff",
  },
  placeholderAvatar: {
    backgroundColor: "#E6EEEA",
    justifyContent: "center",
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: 5,
    backgroundColor: "#3A6B55",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
    minWidth: 34,
    alignItems: "center",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Poppins-Bold",
    color: "#333",
    marginTop: 15,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#2E7D32",
    fontFamily: "Poppins-Medium",
  },
  infoCard: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEE",
    elevation: 2,
    minHeight: 150,
    justifyContent: "center",
  },
  cardHeader: {
    fontSize: 14,
    fontFamily: "Poppins-Bold",
    color: "#3A6B55",
    marginBottom: 15,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  infoTextContainer: { marginLeft: 12 },
  infoLabel: {
    fontSize: 11,
    color: "#888",
    fontFamily: "Poppins-Medium",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    fontFamily: "Poppins-SemiBold",
  },
  form: { paddingHorizontal: 20, marginTop: 10 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Poppins-Bold",
    color: "#333",
    marginBottom: 10,
  },
  inputGroup: { marginBottom: 12 },
  label: {
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    color: "#666",
    marginBottom: 4,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    color: "#333",
    fontFamily: "Poppins-Regular",
  },
  btnContainer: { alignItems: "center", marginTop: 10 },
  saveBtn: {
    backgroundColor: "#3A6B55",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 150,
    alignItems: "center",
    elevation: 2,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins-Bold",
  },
});
