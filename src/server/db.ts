import {
  Booking,
  PaymentRecord,
  PaymentTransaction,
  PaymentTransactionEvent,
  PaymentStatus,
  BookingStatus,
  UserAccount,
  UserSession,
  PasswordResetToken,
  AuthAuditLog,
  AuthAuditEvent,
  AccountStatus,
  UserRole,
} from '../types';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Server-side persistent storage for payments, transactions, users, sessions, and audit logs
const DB_FILE = path.join(process.cwd(), '.server_payments_db.json');

export interface ServerDB {
  payments: PaymentRecord[];
  transactions: PaymentTransaction[];
  bookings: Booking[];
  processedWebhookEvents: string[]; // for idempotency
  users: UserAccount[];
  sessions: UserSession[];
  passwordResetTokens: PasswordResetToken[];
  authAuditLogs: AuthAuditLog[];
}

// Real production accounts are created via Firebase Auth and registration
const SEED_USERS: UserAccount[] = [];

let inMemoryDb: ServerDB = {
  payments: [],
  transactions: [],
  bookings: [],
  processedWebhookEvents: [],
  users: [],
  sessions: [],
  passwordResetTokens: [],
  authAuditLogs: [],
};

// Demo emails to scrub
const DEMO_EMAILS = [
  'admin@btrtransport.ph',
  'jun.magbanua@btrtransport.ph',
  'manny.fernandez@btrtransport.ph',
  'passenger@gmail.com',
];

// Load initial database from file if exists
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const existingUsers = Array.isArray(parsed.users)
      ? parsed.users.filter((u: any) => !DEMO_EMAILS.includes((u.email || '').toLowerCase()))
      : [];

    inMemoryDb = {
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      processedWebhookEvents: Array.isArray(parsed.processedWebhookEvents) ? parsed.processedWebhookEvents : [],
      users: existingUsers,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      passwordResetTokens: Array.isArray(parsed.passwordResetTokens) ? parsed.passwordResetTokens : [],
      authAuditLogs: Array.isArray(parsed.authAuditLogs) ? parsed.authAuditLogs : [],
    };
    persistDb();
  } else {
    persistDb();
  }
} catch (err) {
  console.warn('Initializing fresh server database', err);
}

function persistDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist server database', err);
  }
}

/* ==========================================================================
   PAYMENT & BOOKING DATA HELPERS (Preserved)
   ========================================================================== */

export const getPayments = (): PaymentRecord[] => inMemoryDb.payments;

export const getPaymentById = (id: string): PaymentRecord | undefined =>
  inMemoryDb.payments.find((p) => p.id === id);

export const getPaymentBySessionId = (sessionId: string): PaymentRecord | undefined =>
  inMemoryDb.payments.find((p) => p.gatewaySessionId === sessionId);

export const getPaymentByBookingRef = (ref: string): PaymentRecord | undefined =>
  inMemoryDb.payments.find((p) => p.bookingReference === ref);

export const savePayment = (payment: PaymentRecord): PaymentRecord => {
  const idx = inMemoryDb.payments.findIndex((p) => p.id === payment.id);
  if (idx !== -1) {
    inMemoryDb.payments[idx] = { ...payment, updatedAt: new Date().toISOString() };
  } else {
    inMemoryDb.payments.unshift(payment);
  }
  persistDb();
  return payment;
};

export const getTransactions = (): PaymentTransaction[] => inMemoryDb.transactions;

export const logTransaction = (
  event: PaymentTransactionEvent,
  payment: PaymentRecord,
  details?: string,
  rawPayload?: any
): PaymentTransaction => {
  const transaction: PaymentTransaction = {
    id: `txn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    paymentId: payment.id,
    bookingReference: payment.bookingReference,
    event,
    status: payment.paymentStatus,
    amount: payment.amount,
    reference: payment.gatewayTransactionRef || payment.gatewaySessionId,
    gateway: payment.paymentGateway,
    timestamp: new Date().toISOString(),
    details: details || `Event: ${event} for ${payment.bookingReference}`,
    rawPayload,
  };

  inMemoryDb.transactions.unshift(transaction);
  persistDb();
  return transaction;
};

export const isWebhookProcessed = (eventId: string): boolean =>
  inMemoryDb.processedWebhookEvents.includes(eventId);

export const markWebhookProcessed = (eventId: string) => {
  if (!inMemoryDb.processedWebhookEvents.includes(eventId)) {
    inMemoryDb.processedWebhookEvents.push(eventId);
    persistDb();
  }
};

export const updateBookingAndPaymentStatus = (
  bookingReference: string,
  paymentStatus: PaymentStatus,
  bookingStatus: BookingStatus,
  gatewayTransactionRef?: string,
  details?: string
) => {
  const payment = inMemoryDb.payments.find((p) => p.bookingReference === bookingReference);
  if (payment) {
    payment.paymentStatus = paymentStatus;
    payment.updatedAt = new Date().toISOString();
    if (gatewayTransactionRef) {
      payment.gatewayTransactionRef = gatewayTransactionRef;
    }
    if (paymentStatus === 'paid') {
      payment.paidAt = new Date().toISOString();
    }
    logTransaction(
      paymentStatus === 'paid' ? 'payment_success' : paymentStatus === 'failed' ? 'payment_failed' : 'webhook_received',
      payment,
      details
    );
  }
  persistDb();
};

/* ==========================================================================
   USER & RBAC DATA HELPERS
   ========================================================================== */

export const getAllUsers = (): UserAccount[] => inMemoryDb.users;

export const getUserByEmail = (email: string): UserAccount | undefined => {
  const cleanEmail = email.trim().toLowerCase();
  return inMemoryDb.users.find((u) => u.email.toLowerCase() === cleanEmail);
};

export const getUserById = (id: string): UserAccount | undefined =>
  inMemoryDb.users.find((u) => u.id === id);

export const saveUser = (user: UserAccount): UserAccount => {
  const idx = inMemoryDb.users.findIndex((u) => u.id === user.id);
  if (idx !== -1) {
    inMemoryDb.users[idx] = user;
  } else {
    inMemoryDb.users.push(user);
  }
  persistDb();
  return user;
};

export const updateUserStatus = (userId: string, status: AccountStatus): UserAccount | null => {
  const user = inMemoryDb.users.find((u) => u.id === userId);
  if (!user) return null;
  user.status = status;
  persistDb();
  return user;
};

/* ==========================================================================
   SESSION DATA HELPERS
   ========================================================================== */

export const createSession = (
  userId: string,
  role: UserRole,
  ip?: string,
  userAgent?: string,
  rememberMe: boolean = false
): UserSession => {
  // Session duration: 7 days if rememberMe, otherwise 24 hours
  const durationMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const token = `btr_sec_${crypto.randomBytes(32).toString('hex')}`;
  const session: UserSession = {
    sessionId: `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    userId,
    token,
    role,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + durationMs).toISOString(),
    ip,
    userAgent,
    isValid: true,
  };

  inMemoryDb.sessions.push(session);
  persistDb();
  return session;
};

export const getSessionByToken = (token: string): UserSession | undefined => {
  if (!token) return undefined;
  const session = inMemoryDb.sessions.find((s) => s.token === token && s.isValid);
  if (!session) return undefined;

  // Check expiration
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    session.isValid = false;
    persistDb();
    return undefined;
  }

  return session;
};

export const revokeSession = (token: string): boolean => {
  const session = inMemoryDb.sessions.find((s) => s.token === token);
  if (session) {
    session.isValid = false;
    persistDb();
    return true;
  }
  return false;
};

export const revokeAllUserSessions = (userId: string): void => {
  inMemoryDb.sessions.forEach((s) => {
    if (s.userId === userId) {
      s.isValid = false;
    }
  });
  persistDb();
};

/* ==========================================================================
   PASSWORD RESET TOKENS
   ========================================================================== */

export const createPasswordResetToken = (userId: string): PasswordResetToken => {
  // Invalidate any previous unused tokens for this user
  inMemoryDb.passwordResetTokens.forEach((t) => {
    if (t.userId === userId && !t.used) {
      t.used = true;
    }
  });

  const token = crypto.randomBytes(24).toString('hex');
  const record: PasswordResetToken = {
    id: `prt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    used: false,
    createdAt: new Date().toISOString(),
  };

  inMemoryDb.passwordResetTokens.push(record);
  persistDb();
  return record;
};

export const getPasswordResetToken = (token: string): PasswordResetToken | undefined => {
  if (!token) return undefined;
  const record = inMemoryDb.passwordResetTokens.find((t) => t.token === token && !t.used);
  if (!record) return undefined;

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    record.used = true;
    persistDb();
    return undefined;
  }

  return record;
};

export const markPasswordResetTokenUsed = (token: string): void => {
  const record = inMemoryDb.passwordResetTokens.find((t) => t.token === token);
  if (record) {
    record.used = true;
    persistDb();
  }
};

/* ==========================================================================
   SECURITY & AUTH AUDIT LOGS
   ========================================================================== */

export const logAuthAudit = (
  event: Omit<AuthAuditLog, 'id' | 'timestamp'>
): AuthAuditLog => {
  const log: AuthAuditLog = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  inMemoryDb.authAuditLogs.unshift(log);
  // Keep last 500 audit entries
  if (inMemoryDb.authAuditLogs.length > 500) {
    inMemoryDb.authAuditLogs = inMemoryDb.authAuditLogs.slice(0, 500);
  }
  persistDb();
  return log;
};

export const getAuthAuditLogs = (limit: number = 100): AuthAuditLog[] =>
  inMemoryDb.authAuditLogs.slice(0, limit);
