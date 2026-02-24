import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fonts
  let [fontsLoaded] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-Bold": Poppins_700Bold,
  });

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Error", "Please fill in all fields.");
    }

    setIsLoading(true);

    // Artificial delay to show loading state (as per your original logic)
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      await delay(3000);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setIsLoading(false);
          return Alert.alert(
            "Email Not Verified",
            "Please check your inbox and verify your email before logging in."
          );
        }
        throw error;
      }

      if (data.session) {
        console.log("Login successful!");
        router.replace("/(tabs)/dashboard");
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Login Failed", error.message);
    }
  };

  if (!fontsLoaded) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#3A6B55" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.title}>Login</Text>

        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="account"
              size={24}
              color="#555"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="lock"
              size={24}
              color="#555"
              style={styles.icon}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            >
              <MaterialCommunityIcons
                name={isPasswordVisible ? "eye" : "eye-off"}
                size={24}
                color="#555"
              />
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.button, isLoading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator
                  size="small"
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.buttonText}>LOGGING IN...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>LOGIN</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity disabled={isLoading}>
              <Text style={styles.linkText}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEBE4" },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logoContainer: { alignItems: "center", marginBottom: 30 },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#3A6B55",
  },
  title: {
    fontSize: 28,
    fontFamily: "Poppins-Bold",
    color: "#3A6B55",
    textAlign: "center",
    marginBottom: 30,
  },
  form: { width: "100%", gap: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D3D3D3",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  icon: { marginRight: 12 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Poppins-Regular",
    color: "#333",
  },
  button: {
    backgroundColor: "#3A6B55",
    padding: 18,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Poppins-Bold",
    letterSpacing: 1,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 30 },
  footerText: { color: "#666", fontSize: 14, fontFamily: "Poppins-Regular" },
  linkText: { color: "#3A6B55", fontFamily: "Poppins-Bold", fontSize: 14 },
});