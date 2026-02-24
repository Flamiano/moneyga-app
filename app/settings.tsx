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

  // Loading states
  const [headerLoading, setHeaderLoading] = useState(true);
  const [infoLoading, setInfoLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(true);

  // Action states
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    avatar_url: "",
    email: "",
    created_at: "",
    birthdate: "",
    age: "",
  });

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // --- FIX FOR NETWORK REQUEST FAILED ---
      // We convert the file to an ArrayBuffer which is more stable in React Native
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const fileExt = asset.uri.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // 1. DELETE OLD IMAGE (Prevent storage clutter)
      // We look at the existing avatar_url and extract the path to remove it
      if (profile.avatar_url) {
        try {
          const pathParts = profile.avatar_url.split("user_profile/");
          if (pathParts.length > 1) {
            const oldPath = pathParts[1];
            // Only attempt delete if it's actually in our storage
            await supabase.storage.from("user_profile").remove([oldPath]);
          }
        } catch (e) {
          console.log("Cleanup of old photo skipped:", e);
        }
      }

      // 2. UPLOAD TO BUCKET
      const { error: uploadError } = await supabase.storage
        .from("user_profile")
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. GET PUBLIC URL
      const { data: { publicUrl } } = supabase.storage.from("user_profile").getPublicUrl(fileName);

      // 4. UPDATE PROFILES TABLE
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date() 
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      Alert.alert("Success", "Profile picture updated!");
    } catch (error: any) {
      // Common causes: RLS policies or Bucket is not set to 'Public'
      Alert.alert("Upload Error", error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          updated_at: new Date(),
        })
        .eq("id", user?.id);

      if (error) throw error;
      Alert.alert("Success", "Profile updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleChangePassword() {
    // Password validation regex
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return Alert.alert("Error", "Please fill in all password fields.");
    }

    // NEW REQUIREMENTS CHECK
    if (!passwordRegex.test(newPassword)) {
      return Alert.alert(
        "Weak Password",
        "Password must be at least 8 characters long and include an uppercase letter, a number, and a special character (@$!%*?&)."
      );
    }

    if (newPassword !== confirmPassword) {
      return Alert.alert("Error", "New passwords do not match.");
    }

    setPasswordUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email as string,
        password: currentPassword,
      });

      if (signInError) throw new Error("Current password is incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert("Success", "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Alert.alert("Security Check Failed", error.message);
    } finally {
      setPasswordUpdating(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      return Alert.alert("Required", "Please enter your password to confirm.");
    }

    Alert.alert(
      "Confirm Deletion",
      "This will permanently delete your account and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "DELETE ACCOUNT",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();

              // Verify identity before deletion
              const { error: authError } = await supabase.auth.signInWithPassword({
                email: user?.email as string,
                password: deletePassword,
              });

              if (authError) throw new Error("Incorrect password.");

              // Call RPC to delete from auth.users (cascade will handle profile table)
              const { error: rpcError } = await supabase.rpc('delete_user');
              if (rpcError) throw rpcError;

              await supabase.auth.signOut();
              router.replace("/(auth)/login");
              Alert.alert("Account Deleted", "We're sorry to see you go.");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Visual Header */}
      <View style={styles.avatarSection}>
        {headerLoading ? (
          <ActivityIndicator size="large" color="#3A6B55" style={{ height: 150 }} />
        ) : (
          <>
            <TouchableOpacity onPress={uploadAvatar} disabled={uploading}>
              <View style={styles.avatarWrapper}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.placeholderAvatar]}>
                    <MaterialCommunityIcons name="account" size={60} color="#3A6B55" />
                  </View>
                )}
                <View style={styles.editIcon}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialCommunityIcons name="camera" size={18} color="#fff" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.userName}>{profile.full_name || "User Name"}</Text>
            <View style={styles.statusBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.statusText}>Status: Active</Text>
            </View>
          </>
        )}
      </View>

      {/* Account Information Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardHeader}>Account Information</Text>
        {infoLoading ? (
          <ActivityIndicator color="#3A6B55" />
        ) : (
          <>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email-outline" size={18} color="#3A6B55" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="cake-variant" size={18} color="#3A6B55" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Birthdate & Age</Text>
                <Text style={styles.infoValue}>{formatDate(profile.birthdate)} ({profile.age || "??"})</Text>
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
              />
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={updating}>
              {updating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>

            {/* Password Management */}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Security & Password</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Required to change"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPass}
                  placeholder="8+ chars, Uppercase, Num, Symbol"
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <MaterialCommunityIcons name={showPass ? "eye-off" : "eye"} size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPass}
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#3A6B55" }]} onPress={handleChangePassword} disabled={passwordUpdating}>
              {passwordUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
            </TouchableOpacity>

            {/* Danger Zone */}
            <View style={[styles.divider, { backgroundColor: "#FFCDD2" }]} />
            <Text style={[styles.sectionTitle, { color: "#C62828" }]}>Danger Zone</Text>
            <View style={styles.dangerCard}>
              <Text style={styles.dangerText}>Enter password to delete all account data permanently.</Text>
              <TextInput
                style={[styles.input, { borderColor: "#FFCDD2", marginBottom: 10 }]}
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                placeholder="Confirm password"
              />
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete My Account</Text>}
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
  avatarWrapper: { position: "relative", elevation: 5, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: "#fff" },
  placeholderAvatar: { backgroundColor: "#E6EEEA", justifyContent: "center", alignItems: "center" },
  editIcon: { position: "absolute", bottom: 0, right: 5, backgroundColor: "#3A6B55", padding: 8, borderRadius: 20, borderWidth: 2, borderColor: "#fff" },
  userName: { fontSize: 22, fontFamily: "Poppins-Bold", color: "#333", marginTop: 15 },
  statusBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E8F5E9", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50", marginRight: 6 },
  statusText: { fontSize: 12, color: "#2E7D32", fontFamily: "Poppins-Medium" },
  infoCard: { backgroundColor: "#fff", margin: 20, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#EEE" },
  cardHeader: { fontSize: 13, fontFamily: "Poppins-Bold", color: "#3A6B55", marginBottom: 15, textTransform: "uppercase" },
  infoRow: { flexDirection: "row", marginBottom: 15 },
  infoTextContainer: { marginLeft: 12 },
  infoLabel: { fontSize: 11, color: "#888", fontFamily: "Poppins-Medium" },
  infoValue: { fontSize: 14, color: "#333", fontFamily: "Poppins-SemiBold" },
  form: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins-Bold", color: "#333", marginBottom: 15 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontFamily: "Poppins-Medium", color: "#666", marginBottom: 4 },
  input: { backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", fontFamily: "Poppins-Regular" },
  passwordInputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", paddingHorizontal: 15 },
  passwordInput: { flex: 1, paddingVertical: 12, fontFamily: "Poppins-Regular" },
  saveBtn: { backgroundColor: "#3A6B55", padding: 14, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontFamily: "Poppins-Bold" },
  divider: { height: 1, backgroundColor: "#E0E0E0", marginVertical: 25 },
  dangerCard: { backgroundColor: "#FFF5F5", padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#FFEBEE" },
  dangerText: { fontSize: 12, color: "#666", marginBottom: 10, fontFamily: "Poppins-Regular" },
  deleteBtn: { backgroundColor: "#C62828", padding: 14, borderRadius: 10, alignItems: "center" },
  deleteBtnText: { color: "#fff", fontFamily: "Poppins-Bold" },
});