import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

export default function RegisterScreen() {
  const router = useRouter();

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(new Date());
  const [birthDateText, setBirthDateText] = useState("");
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 1. Loading State
  const [isLoading, setIsLoading] = useState(false);

  // Fonts
  let [fontsLoaded] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-Bold": Poppins_700Bold,
  });

  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith("63")) {
      cleaned = cleaned.substring(2);
    }
    if (cleaned.length <= 10) {
      setPhone(cleaned);
    }
  };

  const calculateAge = (selectedDate: Date) => {
    const today = new Date();
    let calculatedAge = today.getFullYear() - selectedDate.getFullYear();
    const m = today.getMonth() - selectedDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < selectedDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge > 0 ? calculatedAge.toString() : "0";
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS !== "ios") {
      setShowIosPicker(false);
    }

    if (selectedDate) {
      setDate(selectedDate);
      const formattedDate = `${
        selectedDate.getMonth() + 1
      }/${selectedDate.getDate()}/${selectedDate.getFullYear()}`;
      setBirthDateText(formattedDate);
      setAge(calculateAge(selectedDate));
    }
  };

  const showPicker = () => {
    if (isLoading) return; // Prevent picker while loading
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        onChange: onDateChange,
        mode: "date",
        maximumDate: new Date(),
      });
    } else {
      setShowIosPicker(true);
    }
  };

  const handleRegister = async () => {
    const emailRegex = /\S+@\S+\.\S+/;
    const passwordRegex =
      /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;

    // 1. Validations First (Check these BEFORE starting the 3-second timer)
    if (!name || !email || !phone || !birthDateText || !password) {
      return Alert.alert("Error", "Please fill in all fields.");
    }
    if (!emailRegex.test(email)) {
      return Alert.alert("Error", "Enter a valid email.");
    }
    if (parseInt(age) < 16) {
      return Alert.alert("Error", "You must be 16+.");
    }
    if (password !== confirmPassword) {
      return Alert.alert("Error", "Passwords don't match.");
    }

    // 2. Start loading
    setIsLoading(true);

    try {
      // 3. Wait for 3 seconds BEFORE calling Supabase
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 4. Now execute the Supabase Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: phone,
            birthdate: birthDateText,
            age: parseInt(age),
          },
        },
      });

      if (error) throw error;

      // 5. Success! Stop loading before showing Alert
      setIsLoading(false);

      if (data) {
        Alert.alert(
          "Verify your Email",
          "A verification link has been sent to your email. Please confirm it before logging in.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
      }
    } catch (error: any) {
      // 6. Stop loading if it fails so the user can try again
      setIsLoading(false);
      Alert.alert("Registration Failed", error.message);
    }
  };

  if (!fontsLoaded)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#EFEBE4",
        }}
      >
        <ActivityIndicator size="large" color="#3A6B55" />
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoImage}
        />
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your financial journey.</Text>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="account-outline"
              size={22}
              color="#555"
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />
          </View>

          {/* Email */}
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="email-outline"
              size={22}
              color="#555"
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Phone */}
          <View style={styles.inputWrapper}>
            <View style={styles.prefixContainer}>
              <Image
                source={{ uri: "https://flagcdn.com/w40/ph.png" }}
                style={styles.flagIcon}
              />
              <Text style={styles.prefixText}>+63</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="912 345 6789"
              placeholderTextColor="#999"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!isLoading}
            />
          </View>

          {/* Birthdate & Age */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.inputWrapper,
                { flex: 2, marginRight: 10 },
                isLoading && { opacity: 0.7 },
              ]}
              onPress={showPicker}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#555" />
              <Text
                style={[
                  styles.input,
                  { color: birthDateText ? "#333" : "#999", marginTop: 15 },
                ]}
              >
                {birthDateText || "Birthdate"}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.inputWrapper,
                {
                  flex: 1,
                  backgroundColor: "#E0E0E0",
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                style={[
                  styles.input,
                  { textAlign: "center", marginLeft: 0, marginTop: 15 },
                ]}
              >
                {age || "Age"}
              </Text>
            </View>
          </View>

          {/* iOS Picker Modal */}
          {Platform.OS === "ios" && showIosPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          {/* Password */}
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={22}
              color="#555"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              disabled={isLoading}
            >
              <MaterialCommunityIcons
                name={isPasswordVisible ? "eye" : "eye-off"}
                size={22}
                color="#555"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons
              name="lock-check-outline"
              size={22}
              color="#555"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!isPasswordVisible}
              editable={!isLoading}
            />
          </View>

          {/* 4. Dynamic SIGN UP Button */}
          <TouchableOpacity
            style={[styles.button, isLoading && { opacity: 0.8 }]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator
                  size="small"
                  color="#fff"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.buttonText}>SIGNING UP...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>SIGN UP</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity disabled={isLoading}>
              <Text style={styles.linkText}>Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EFEBE4" },
  scrollContainer: { padding: 25, alignItems: "center", paddingBottom: 50 },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 40,
    marginBottom: 15,
  },
  title: { fontSize: 24, fontFamily: "Poppins-Bold", color: "#3A6B55" },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    fontFamily: "Poppins-Regular",
  },
  form: { width: "100%", gap: 12 },
  row: { flexDirection: "row" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D3D3D3",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: "#333",
    marginLeft: 10,
  },
  button: {
    backgroundColor: "#3A6B55",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    height: 55,
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  prefixContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#bbb",
    paddingRight: 10,
    marginRight: 5,
  },
  flagIcon: {
    width: 24,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  prefixText: {
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    color: "#333",
  },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Poppins-Bold" },
  footer: { flexDirection: "row", marginTop: 20, marginBottom: 20 },
  footerText: { color: "#666", fontFamily: "Poppins-Regular" },
  linkText: { color: "#3A6B55", fontFamily: "Poppins-Bold" },
});
