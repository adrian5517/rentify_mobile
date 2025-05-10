import React, { useState, useCallback } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
  Pressable,
} from "react-native";
import styles from "../../assets/styles/login.styles";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constant/colors";
import { Link } from "expo-router";
import { useAuthStore } from "../../store/authStore";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { isLoading, login } = useAuthStore();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    const result = await login(email, password);

    if (!result.success) {
      Alert.alert("Error", result.error);
      return;
    }

    // Show success modal with animation
    setShowSuccessModal(true);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    // Auto close modal after 2 seconds
    setTimeout(() => {
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start(() => {
        setShowSuccessModal(false);
      });
    }, 2000);
  }, [email, password, login, scaleAnim]);

  const SuccessModal = () => (
    <Modal
      transparent
      visible={showSuccessModal}
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.successModal,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              Animated.spring(scaleAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
              }).start(() => {
                setShowSuccessModal(false);
              });
            }}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={70} color={COLORS.primary} />
          </View>
          
          <Text style={styles.successTitle}>Login Successful!</Text>
          <Text style={styles.successMessage}>
            Welcome back to Rentify!{'\n'}
            You're now logged in and ready to explore.
          </Text>

          <TouchableOpacity 
            style={styles.successButton}
            onPress={() => {
              Animated.spring(scaleAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
              }).start(() => {
                setShowSuccessModal(false);
              });
            }}
          >
            <Text style={styles.successButtonText}>Continue to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={{flex:1}}
      behavior={Platform.OS === 'ios' ? "padding" : "height"}
    >
      <View style={styles.container}>
        {/* Illustration */}
        <View style={styles.topIllustration}>
          <Image
            source={require('../../assets/images/rentify-img.png')}
            style={styles.illustrationImage}
          />
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.formContainer}>
            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name='mail-outline'
                  size={20}
                  color={COLORS.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder='Enter your email'
                  placeholderTextColor={COLORS.placeholderText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  selectionColor={COLORS.primary}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder='Enter your password'
                  placeholderTextColor={COLORS.placeholderText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  selectionColor={COLORS.primary}
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity 
                  onPress={()=> setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Pressable
              style={[
                styles.button,
                isPressed && styles.buttonPressed,
                isLoading && { backgroundColor: COLORS.accent + '99' }
              ]}
              onPress={handleLogin}
              onPressIn={() => setIsPressed(true)}
              onPressOut={() => setIsPressed(false)}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={styles.loaderText}>Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Link href="/signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>Signup</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </View>
      <SuccessModal />
    </KeyboardAvoidingView>
  );
}

