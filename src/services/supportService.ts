import { SupportTicket } from '../types';
import { httpClient } from './httpClient';

export const supportService = {
  getSupportTickets(): Promise<{ count: number; results: SupportTicket[] }> {
    return httpClient.request('/support/tickets/');
  },

  createSupportTicket(payload: {
    category: string;
    subject: string;
    message: string;
    order_id?: number;
  }): Promise<{ success: boolean; ticket: SupportTicket }> {
    return httpClient.request('/support/tickets/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  replySupportTicket(ticketId: number, message: string): Promise<{ success: boolean; message: unknown }> {
    return httpClient.request(`/support/tickets/${ticketId}/reply/`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};
