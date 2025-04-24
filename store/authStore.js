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
  profileProfile: null,
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

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userJson = await AsyncStorage.getItem("user");
      const user = userJson ? JSON.parse(userJson) : null;

      set({ token, user });
    } catch (error) {
      console.log("Auth check failed", error);
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove([
      "token",
      "user",
      "username",
      "name",
      "profilePicture",
    ]);

    set({ token: null, user: null, profilePicture: null });
  },
}));
