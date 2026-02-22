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

  // 1. Added loading state
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

    // 2. Start loading and set a 3-second delay
    setIsLoading(true);

    // Create a promise that resolves after 3 seconds
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      // Execute both the 3-second wait and the Supabase call
      // We use Promise.all if you want them to finish together,
      // or just await the delay first to guarantee the 3 seconds.
      await delay(3000);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setIsLoading(false); // Stop loading on error
          return Alert.alert(
            "Email Not Verified",
            "Please check your inbox and verify your email before logging in."
          );
        }
        throw error;
      }

      if (data.session) {
        console.log("Login successful!");
        // We don't necessarily need to set isLoading(false) here
        // because router.replace will unmount the screen
        router.replace("/(tabs)/dashboard");
      }
    } catch (error: any) {
      setIsLoading(false); // 3. Stop loading if login fails
      Alert.alert("Login Failed", error.message);
    }
  };

  // Loader if fonts aren't ready yet
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
              editable={!isLoading} // Disable input while loading
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
              editable={!isLoading} // Disable input while loading
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

          <TouchableOpacity style={styles.forgotPassword} disabled={isLoading}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* 4. Dynamic Button Content */}
          <TouchableOpacity
            style={[styles.button, isLoading && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={isLoading} // Prevent double-clicks
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
  forgotPassword: { alignSelf: "flex-end", marginBottom: 10 },
  forgotPasswordText: {
    color: "#3A6B55",
    fontFamily: "Poppins-Medium",
    fontSize: 14,
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
  }, // Layout for loader + text
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
