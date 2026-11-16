import { AuthUser, UserRole, AccountStatus, AuthAuditLog } from '../types';

const TOKEN_KEY = 'btr_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

const getAuthHeaders = (): HeadersInit => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export interface LoginResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  token: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  token: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  resetToken?: string;
  userEmail?: string;
}

export const authApi = {
  /**
   * Log in user with email & password
   */
  async login(email: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed. Please check your credentials.');
    }

    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  /**
   * Register a new user account (Passenger, Driver, or Dispatcher)
   */
  async register(
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole = 'passenger',
    driverId?: string
  ): Promise<RegisterResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, phone, password, role, driverId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed.');
    }

    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  /**
   * Sync Firebase authenticated user session with server
   */
  async syncFirebaseSession(params: {
    uid: string;
    email: string;
    name?: string;
    phone?: string;
    role?: UserRole;
    driverId?: string;
    rememberMe?: boolean;
  }): Promise<{ success: boolean; user: AuthUser; token: string }> {
    const res = await fetch('/api/auth/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sync Firebase session.');
    }
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  /**
   * Log out current session
   */
  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Logout network notice:', e);
    } finally {
      setStoredToken(null);
    }
  },

  /**
   * Get current authenticated user profile
   */
  async getMe(): Promise<AuthUser | null> {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setStoredToken(null);
        }
        return null;
      }

      const data = await res.json();
      return data.user || null;
    } catch (err) {
      console.warn('Failed to retrieve current user session', err);
      return null;
    }
  },

  /**
   * Request password reset token
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Password reset request failed.');
    }
    return data;
  },

  /**
   * Complete password reset with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset password.');
    }
    return data;
  },

  /**
   * Admin: fetch security audit logs
   */
  async getAuditLogs(limit: number = 100): Promise<AuthAuditLog[]> {
    const res = await fetch(`/api/auth/audit-logs?limit=${limit}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch audit logs.');
    }
    return data.logs || [];
  },

  /**
   * Admin: fetch all registered user accounts
   */
  async adminGetUsers(): Promise<AuthUser[]> {
    const res = await fetch('/api/admin/users', {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch user accounts.');
    }
    return data.users || [];
  },

  /**
   * Admin: create new staff/driver/passenger account
   */
  async adminCreateUser(params: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    password: string;
    driverId?: string;
  }): Promise<AuthUser> {
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create user account.');
    }
    return data.user;
  },

  /**
   * Admin: update user account status (active, suspended, inactive)
   */
  async adminUpdateUserStatus(userId: string, status: AccountStatus): Promise<AuthUser> {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update user status.');
    }
    return data.user;
  },
};
