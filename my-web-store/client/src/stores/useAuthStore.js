import { create } from 'zustand';
import { apiFetch } from '../lib/api';

export const useAuthStore = create((set) => ({
  admin: null,
  loading: false,

  async login(username, password) {
    set({ loading: true });
    try {
      const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      set({ admin: data, loading: false });
      return data;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async logout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    set({ admin: null });
  },

  async checkSession() {
    try {
      const data = await apiFetch('/api/admin/me');
      set({ admin: data });
    } catch {
      set({ admin: null });
    }
  },
}));
