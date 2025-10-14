import axios from "axios";
import apiService from "./apiService";
import { ENDPOINTS } from "../constant/api";

const API_URL = "https://rentify-server-ge0f.onrender.com/api/booking"; 

/**
 * Booking Service
 * Integrated with main API service
 */

export const createBooking = async (bookingData, token) => {
  return axios.post(API_URL, bookingData, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getBookings = async (token) => {
  return axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const getBookingById = async (id, token) => {
  return axios.get(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const updateBooking = async (id, bookingData, token) => {
  return axios.put(`${API_URL}/${id}`, bookingData, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const cancelBooking = async (id, token) => {
  return axios.put(`${API_URL}/${id}/cancel`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const deleteBooking = async (id, token) => {
  return axios.delete(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// Export integrated booking service using main API service
export const bookingService = {
  async create(bookingData) {
    try {
      const response = await apiService.api.post(ENDPOINTS.BOOKING.CREATE, bookingData);
      return { success: true, booking: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getAll() {
    try {
      const response = await apiService.api.get(ENDPOINTS.BOOKING.GET_ALL);
      return { success: true, bookings: response.data.bookings || [] };
    } catch (error) {
      return { success: false, error: error.message, bookings: [] };
    }
  },

  async getById(id) {
    try {
      const response = await apiService.api.get(ENDPOINTS.BOOKING.GET_BY_ID(id));
      return { success: true, booking: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async update(id, bookingData) {
    try {
      const response = await apiService.api.put(ENDPOINTS.BOOKING.UPDATE(id), bookingData);
      return { success: true, booking: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async cancel(id) {
    try {
      const response = await apiService.api.put(ENDPOINTS.BOOKING.CANCEL(id));
      return { success: true, booking: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async delete(id) {
    try {
      await apiService.api.delete(ENDPOINTS.BOOKING.DELETE(id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
