import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export const useAuthStore = create((set) => ({
    user: null,
    token: null,
    isLoading: false,

    setUser: (user) => set({ user }),

    register: async (username, email, password) => {
        set({ isLoading: true });

        try {
            const response = await fetch("https://rentify-server-ge0f.onrender.com/api/auth/signup", { // Replace with your actual local IP
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Something went wrong");

            await AsyncStorage.setItem("user", JSON.stringify(data.user));
            await AsyncStorage.setItem("token", data.token);

            set({ token: data.token, user: data.user, isLoading: false });

            return { success: true };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
        }
    },

    login: async(email , password) => {
        set({ isLoading: true});

        try {
           const response = await fetch("https://rentify-server-ge0f.onrender.com/api/auth/login", {
            method:"POST",
            headers:{
                "Content-Type": "application/json"
            },
            body:JSON.stringify({
                email,
                password
            }),
           });

           const data = await response.json();
           if(!response.ok) throw new Error(data.message || "Something went wrong");

           await AsyncStorage.setItem("user", JSON.stringify(data.user))
           await AsyncStorage.setItem("token", data.token);

           set({token:data.token , user:data.user, isLoading:false});
           return{success: true}
            
        } catch (error) {
            return{success:false, error:error.message};
            
        }
    },

    checkAuth: async()=>{
        try {
            const token = await AsyncStorage.getItem("token");
            const userJson = await AsyncStorage.getItem("user")
            const user = userJson ? JSON.parse(userJson) : null;

            set({token , user})
        } catch (error) {
            console.log("Auth check failed" , error)
            
        }
    },

    logout: async()=> {
       
            await AsyncStorage.removeItem("token")
            await AsyncStorage.removeItem("user");
            set({token:null,user: null})
            
        
    },
}));
