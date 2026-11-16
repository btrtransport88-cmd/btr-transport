import { PaymentRecord, PaymentTransaction } from '../types';

export interface PaymentConfigResponse {
  provider: string;
  publicKey: string;
  hasValidCredentials: boolean;
  isLive: boolean;
  supportedMethods: string[];
  webhookConfigured: boolean;
}

export interface CreateCheckoutResult {
  success: boolean;
  checkoutUrl: string;
  sessionId: string;
  bookingReference: string;
  amount: number;
  isSandboxFallback?: boolean;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: string;
  payment?: PaymentRecord;
  error?: string;
}

export interface AdminTransactionsResponse {
  payments: PaymentRecord[];
  auditLogs: PaymentTransaction[];
  totalCount: number;
  totalCollected: number;
}

export const fetchPaymentConfig = async (): Promise<PaymentConfigResponse> => {
  try {
    const res = await fetch('/api/payments/config');
    if (!res.ok) throw new Error('Failed to fetch payment config');
    return await res.json();
  } catch (err) {
    return {
      provider: 'paymongo',
      publicKey: '',
      hasValidCredentials: false,
      isLive: false,
      supportedMethods: ['gcash', 'maya', 'card', 'cash'],
      webhookConfigured: false,
    };
  }
};

export const requestCheckoutSession = async (payload: {
  tripId: string;
  bookingReference: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  pickupStopName: string;
  dropoffStopName: string;
  seats: string[];
  finalAmount: number;
  paymentMethod: string;
  returnUrl?: string;
}): Promise<CreateCheckoutResult> => {
  const res = await fetch('/api/payments/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create checkout session');
  }

  return data;
};

export const verifyPaymentWithServer = async (
  sessionId: string,
  bookingReference: string
): Promise<VerifyPaymentResult> => {
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, bookingReference }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Payment verification failed');
  }

  return data;
};

export const fetchAdminPaymentTransactions = async (filters?: {
  search?: string;
  status?: string;
  method?: string;
}): Promise<AdminTransactionsResponse> => {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.method) params.set('method', filters.method);

  const res = await fetch(`/api/payments/transactions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payment transactions');
  return await res.json();
};

export const requestServerRefund = async (
  paymentId: string,
  reason: string,
  amount?: number
): Promise<{ success: boolean; payment: PaymentRecord; refundAmount: number }> => {
  const res = await fetch('/api/payments/refund', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId, reason, amount }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to process refund');
  }

  return data;
};
