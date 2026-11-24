import { NotificationItem } from '../types';
import { httpClient } from './httpClient';

export const notificationService = {
  async getNotifications(): Promise<{ count: number; results: NotificationItem[] }> {
    try {
      const res = await httpClient.request<any>('/notifications/', { silent401: true });
      const results = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
      return { count: results.length, results };
    } catch {
      return { count: 0, results: [] };
    }
  },

  markNotificationRead(id: string): Promise<{ success: boolean }> {
    return httpClient.patch(`/notifications/${id}/read/`, {}, { silent401: true });
  },

  markAllNotificationsRead(): Promise<{ success: boolean }> {
    return httpClient.patch('/notifications/read-all/', {}, { silent401: true });
  },
};
