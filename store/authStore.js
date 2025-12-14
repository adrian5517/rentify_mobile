import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import normalizeAvatar from '../utils/normalizeAvatar';
import apiService from '../services/apiService';

// Utility to safely store values
const safeSetItem = async (key, value) => {
  if (value !== null && value !== undefined) {
    await AsyncStorage.setItem(key, value.toString());
  } else {
    await AsyncStorage.removeItem(key);
  }
};

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  profilePicture: null,
  isLoading: false,

  setUser: (user) => {
    try {
      const normalized = user ? { ...user, profilePicture: normalizeAvatar(user.profilePicture || user.profile_picture || user.avatar || user) } : null;
      set({ user: normalized, profilePicture: normalized?.profilePicture || null });
    } catch (err) {
      set({ user, profilePicture: user?.profilePicture || null });
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });

    try {
      const response = await fetch("https://rentify-server-ge0f.onrender.com/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Something went wrong");

      // Normalize profilePicture and save user and token safely
      const normalizedUser = { ...data.user, profilePicture: normalizeAvatar(data.user.profilePicture || data.user.profile_picture || data.user.avatar || data.user) };
      await safeSetItem("user", JSON.stringify(normalizedUser));
      await safeSetItem("token", data.token);
      await safeSetItem("username", normalizedUser.username);
      await safeSetItem("name", normalizedUser.name);
      await safeSetItem("profilePicture", normalizedUser.profilePicture);

      set({ token: data.token, user: normalizedUser, profilePicture: normalizedUser.profilePicture, isLoading: false });
      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });

    try {
      const response = await fetch("https://rentify-server-ge0f.onrender.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Something went wrong");

      const normalizedUser = { ...data.user, profilePicture: normalizeAvatar(data.user.profilePicture || data.user.profile_picture || data.user.avatar || data.user) };
      await safeSetItem("user", JSON.stringify(normalizedUser));
      await safeSetItem("token", data.token);
      await safeSetItem("username", normalizedUser.username);
      await safeSetItem("name", normalizedUser.name);
      await safeSetItem("profilePicture", normalizedUser.profilePicture);

      set({
        token: data.token,
        user: normalizedUser,
        profilePicture: normalizedUser.profilePicture,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Added checkAuth function
  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userStr = await AsyncStorage.getItem("user");

      if (token && userStr) {
        try {
          const parsed = JSON.parse(userStr);
          const normalized = parsed
            ? { ...parsed, profilePicture: normalizeAvatar(parsed.profilePicture || parsed.profile_picture || parsed.avatar || parsed) }
            : null;

          // Let apiService know about token so API requests include it
          try { apiService.setToken(token); } catch (e) { /* ignore if service not ready */ }

          set({ token, user: normalized, profilePicture: normalized?.profilePicture || null });
          return true;
        } catch (e) {
          // If parsing fails, remove bad data
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('token');
          console.error('Error parsing stored user, cleared auth:', e);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking authentication:", error);
      return false;
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      await AsyncStorage.removeItem("username");
      await AsyncStorage.removeItem("name");
      await AsyncStorage.removeItem("profilePicture");

      set({ user: null, token: null });
    } catch (error) {
      console.error("Error during logout:", error);
    }
  },
}));