import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

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

  setUser: (user) => set({ user }),

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

      // Save user and token safely
      await safeSetItem("user", JSON.stringify(data.user));
      await safeSetItem("token", data.token);
      await safeSetItem("username", data.user.username);
      await safeSetItem("name", data.user.name);
      await safeSetItem("profilePicture", data.user.profilePicture);

      set({ token: data.token, user: data.user, isLoading: false });
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

      await safeSetItem("user", JSON.stringify(data.user));
      await safeSetItem("token", data.token);
      await safeSetItem("username", data.user.username);
      await safeSetItem("name", data.user.name);
      await safeSetItem("profilePicture", data.user.profilePicture);

      set({
        token: data.token,
        user: data.user,
        profilePicture: data.user.profilePicture,
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
      return !!token; // Return true if token exists, otherwise false
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