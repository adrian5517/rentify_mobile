import axios from "axios";

const API_URL = "https://rentify-server-ge0f.onrender.com/api/booking"; 

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
