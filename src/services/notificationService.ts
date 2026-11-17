import { NotificationItem } from '../types';
import { httpClient } from './httpClient';

export const notificationService = {
  getNotifications(): Promise<{ count: number; results: NotificationItem[] }> {
    return httpClient.request('/notifications/');
  },

  markNotificationRead(id: string): Promise<{ success: boolean }> {
    return httpClient.request(`/notifications/${id}/read/`, { method: 'PATCH' });
  },

  markAllNotificationsRead(): Promise<{ success: boolean }> {
    return httpClient.request('/notifications/read-all/', { method: 'PATCH' });
  },
};
