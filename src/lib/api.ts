const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('accessToken');

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const refreshResponse = await fetch(`${this.baseURL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              localStorage.setItem('accessToken', data.accessToken);
              localStorage.setItem('refreshToken', data.refreshToken);

              // Retry the original request with new token
              config.headers = {
                ...config.headers,
                Authorization: `Bearer ${data.accessToken}`,
              };
              const retryResponse = await fetch(url, config);
              return this.handleResponse(retryResponse);
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
          }
        }

        // If refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth';
        throw new Error('Authentication required');
      }

      return this.handleResponse(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Authentication methods
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await this.handleResponse(response);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  }

  async register(email: string, password: string, fullName: string) {
    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName }),
    });

    const data = await this.handleResponse(response);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // User methods
  async getProfile() {
    return this.request('/auth/profile');
  }

  async updateProfile(updates: any) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUsers(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/users?${queryString}`);
  }

  async updateUser(id: string, updates: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUserStats() {
    return this.request('/users/stats/overview');
  }

  // Ticket methods
  async getTickets(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/tickets?${queryString}`);
  }

  async getTicket(id: string) {
    return this.request(`/tickets/${id}`);
  }

  async createTicket(ticket: any) {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  }

  async updateTicket(id: string, updates: any) {
    return this.request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async addTicketComment(ticketId: string, comment: string, isInternal = false) {
    return this.request(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, isInternal }),
    });
  }

  async uploadTicketAttachment(ticketId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request(`/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: {}, // Let browser set content-type for FormData
      body: formData,
    });
  }

  async getTicketStats() {
    return this.request('/tickets/stats/overview');
  }

  // Asset methods
  async getAssets(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/assets?${queryString}`);
  }

  async createAsset(asset: any) {
    return this.request('/assets', {
      method: 'POST',
      body: JSON.stringify(asset),
    });
  }

  async updateAsset(id: string, updates: any) {
    return this.request(`/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getAssetStats() {
    return this.request('/assets/stats/overview');
  }

  // Expense methods
  async getExpenses(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/expenses?${queryString}`);
  }

  async createExpense(expense: any) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async getExpenseStats() {
    return this.request('/expenses/stats/overview');
  }

  // Diesel methods
  async getDieselLogs() {
    return this.request('/diesel');
  }

  async createDieselLog(log: any) {
    return this.request('/diesel', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }

  // Vendor methods
  async getVendors() {
    return this.request('/vendors');
  }

  async createVendor(vendor: any) {
    return this.request('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
  }

  // Calendar methods
  async getCalendarEvents(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/calendar?${queryString}`);
  }

  async createCalendarEvent(event: any) {
    return this.request('/calendar', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  // Knowledge Base methods
  async getKBArticles(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/knowledge-base?${queryString}`);
  }

  async createKBArticle(article: any) {
    return this.request('/knowledge-base', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  // Report methods
  async getReports() {
    return this.request('/reports');
  }

  async createReport(report: any) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  }

  // Automation methods
  async getAutomationRules() {
    return this.request('/automation');
  }

  async createAutomationRule(rule: any) {
    return this.request('/automation', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  // Notification methods
  async getNotifications(params?: any) {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/notifications?${queryString}`);
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  // System methods
  async getSystemHealth() {
    return this.request('/system/health');
  }

  async getSystemStats() {
    return this.request('/system/stats');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;