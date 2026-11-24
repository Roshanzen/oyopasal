import { httpClient } from './httpClient';

export interface SellerApplicationPayload {
  full_name: string;
  email: string;
  phone: string;
  alt_phone?: string;
  business_name: string;
  business_category: string;
  business_description?: string;
  business_contact_phone?: string;
  business_contact_email?: string;
  registration_number?: string;
  pan_vat_number?: string;
  province: string;
  district: string;
  municipality: string;
  ward_number?: string;
  complete_address: string;
  postal_code?: string;
  registration_doc_url?: string;
  pan_vat_doc_url?: string;
  logo_url?: string;
  supporting_docs?: Array<{ name: string; url: string }>;
  declaration_confirmed: boolean;
}

export interface SellerApplicationAuditItem {
  id: number;
  action: string;
  actor_name: string;
  notes: string;
  previous_status: string;
  new_status: string;
  created_at: string;
}

export interface SellerApplicationItem {
  id: string;
  application_number: string;
  full_name: string;
  email: string;
  phone: string;
  alt_phone?: string;
  business_name: string;
  business_category: string;
  business_description?: string;
  business_contact_phone?: string;
  business_contact_email?: string;
  registration_number?: string;
  pan_vat_number?: string;
  province: string;
  district: string;
  municipality: string;
  ward_number?: string;
  complete_address: string;
  postal_code?: string;
  registration_doc_url?: string;
  pan_vat_doc_url?: string;
  logo_url?: string;
  supporting_docs?: Array<{ name: string; url: string }>;
  declaration_confirmed: boolean;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'INVITATION_SENT' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
  admin_notes?: string;
  rejection_reason?: string;
  additional_info_requested?: string;
  reviewed_by_email?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at?: string;
  audit_logs?: SellerApplicationAuditItem[];
}

export interface SellerApplicationSummary {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  invitation_sent: number;
  active: number;
  rejected: number;
}

export interface TrackApplicationResponse {
  application_number: string;
  business_name: string;
  business_category: string;
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
  additional_info_requested?: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  email: string;
  business_name: string;
  application_number: string;
  full_name: string;
  expires_at: string;
}

export const sellerOnboardingService = {
  /**
   * Submit a public seller application form.
   */
  async submitApplication(data: SellerApplicationPayload) {
    return httpClient.post<{ success: boolean; application_number: string; message: string; status: string }>(
      '/seller/applications/apply/',
      data
    );
  },

  /**
   * Securely track an application status by reference number and email.
   */
  async trackApplication(application_number: string, email: string) {
    return httpClient.post<{ success: boolean; data: TrackApplicationResponse }>(
      '/seller/applications/track/',
      { application_number, email }
    );
  },

  /**
   * Admin: List seller applications with filters, search, and overview summary.
   */
  async getAdminApplications(params?: { status?: string; search?: string; category?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.page) query.append('page', String(params.page));

    const qs = query.toString();
    const endpoint = `/seller/admin/applications/${qs ? `?${qs}` : ''}`;
    return httpClient.get<{
      count: number;
      results: {
        summary: SellerApplicationSummary;
        applications: SellerApplicationItem[];
      };
    }>(endpoint);
  },

  /**
   * Admin: Retrieve detailed application record with audit history.
   */
  async getAdminApplicationDetail(idOrNumber: string) {
    return httpClient.get<{ success: boolean; application: SellerApplicationItem }>(
      `/seller/admin/applications/${idOrNumber}/`
    );
  },

  /**
   * Admin: Move application to Under Review, Request Additional Info, or add internal notes.
   */
  async updateApplicationStatus(
    idOrNumber: string,
    payload: { status?: string; notes?: string; rejection_reason?: string; additional_info?: string }
  ) {
    return httpClient.post<{ success: boolean; message: string; status: string }>(
      `/seller/admin/applications/${idOrNumber}/status/`,
      payload
    );
  },

  /**
   * Admin: Approve application, prepare vendor/store, generate single-use invitation token, and send email.
   */
  async approveApplication(idOrNumber: string, frontendUrl?: string) {
    return httpClient.post<{
      success: boolean;
      message: string;
      invitation_token: string;
      activation_url: string;
      expires_at: string;
    }>(`/seller/admin/applications/${idOrNumber}/approve/`, { frontend_url: frontendUrl });
  },

  /**
   * Admin: Reject application with reason and send rejection email.
   */
  async rejectApplication(idOrNumber: string, rejectionReason: string, notes?: string) {
    return httpClient.post<{ success: boolean; message: string; status: string }>(
      `/seller/admin/applications/${idOrNumber}/reject/`,
      { rejection_reason: rejectionReason, notes }
    );
  },

  /**
   * Admin: Resend a fresh single-use activation invitation token.
   */
  async resendInvitation(idOrNumber: string, frontendUrl?: string) {
    return httpClient.post<{
      success: boolean;
      message: string;
      invitation_token: string;
      activation_url: string;
      expires_at: string;
    }>(`/seller/admin/applications/${idOrNumber}/resend-invitation/`, { frontend_url: frontendUrl });
  },

  /**
   * Public: Validate an invitation token before showing password setup form.
   */
  async verifyActivationToken(token: string) {
    return httpClient.get<{ success: boolean; data: VerifyTokenResponse }>(
      `/seller/activation/verify/?token=${encodeURIComponent(token)}`
    );
  },

  /**
   * Public: Consume invitation token, set merchant password, activate account, and get login tokens.
   */
  async activateVendor(payload: { token: string; password: string; confirm_password?: string }) {
    return httpClient.post<{
      success: boolean;
      message: string;
      access: string;
      token: string;
      refresh: string;
      user: any;
      vendor: any;
    }>('/seller/activation/activate/', payload);
  },
};
