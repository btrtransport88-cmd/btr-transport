import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import {
  getAllUsers,
  getUserByEmail,
  getUserById,
  saveUser,
  updateUserStatus,
  createSession,
  getSessionByToken,
  revokeSession,
  revokeAllUserSessions,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  logAuthAudit,
  getAuthAuditLogs,
} from './db';
import { UserAccount, AuthUser, UserRole, AccountStatus } from '../types';

export const authRouter = Router();
export const adminUsersRouter = Router();

// Track failed login attempts by IP/Email to prevent brute force
interface LoginAttemptTracker {
  attempts: number;
  lastAttempt: number;
}
const failedAttemptsMap = new Map<string, LoginAttemptTracker>();

const isRateLimited = (key: string): boolean => {
  const record = failedAttemptsMap.get(key);
  if (!record) return false;
  // 5 attempts within 15 minutes triggers a 15-minute lockout
  const fifteenMinutes = 15 * 60 * 1000;
  if (record.attempts >= 5 && Date.now() - record.lastAttempt < fifteenMinutes) {
    return true;
  }
  if (Date.now() - record.lastAttempt >= fifteenMinutes) {
    failedAttemptsMap.delete(key);
  }
  return false;
};

const recordFailedAttempt = (key: string) => {
  const current = failedAttemptsMap.get(key) || { attempts: 0, lastAttempt: Date.now() };
  current.attempts += 1;
  current.lastAttempt = Date.now();
  failedAttemptsMap.set(key, current);
};

const clearFailedAttempts = (key: string) => {
  failedAttemptsMap.delete(key);
};

export const sanitizeUser = (user: UserAccount): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  driverId: user.driverId,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

/**
 * Extracts session token from cookie or Authorization header
 */
export const extractSessionToken = (req: Request): string | undefined => {
  if (req.cookies && req.cookies.btr_session) {
    return req.cookies.btr_session;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
};

/**
 * Middleware: Requires valid authentication session
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): any => {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to continue.',
      code: 'UNAUTHENTICATED',
    });
  }

  const session = getSessionByToken(token);
  if (!session) {
    return res.status(401).json({
      error: 'Your session has expired or is invalid. Please sign in again.',
      code: 'SESSION_EXPIRED',
    });
  }

  const user = getUserById(session.userId);
  if (!user) {
    return res.status(401).json({
      error: 'User account not found.',
      code: 'USER_NOT_FOUND',
    });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({
      error: 'Your account has been suspended. Please contact BTR Transport Dispatch.',
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({
      error: 'Your account is currently inactive.',
      code: 'ACCOUNT_INACTIVE',
    });
  }

  (req as any).user = user;
  (req as any).session = session;
  next();
};

/**
 * Middleware: Optional authentication (attaches user if present, doesn't reject if not)
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): any => {
  const token = extractSessionToken(req);
  if (token) {
    const session = getSessionByToken(token);
    if (session) {
      const user = getUserById(session.userId);
      if (user && user.status === 'active') {
        (req as any).user = user;
        (req as any).session = session;
      }
    }
  }
  next();
};

/**
 * Middleware: Role-Based Access Control (RBAC) guard
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    const user = (req as any).user as UserAccount | undefined;
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required before verifying role authorization.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      logAuthAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'unauthorized_access_attempt',
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: `Forbidden role access attempt: user is '${user.role}', required '${allowedRoles.join(' or ')}' for ${req.method} ${req.originalUrl}`,
      });

      return res.status(403).json({
        error: `Access Denied: You do not have permission to access this resource. Required role: ${allowedRoles.join(' or ')}.`,
        code: 'FORBIDDEN_ROLE',
        currentRole: user.role,
        requiredRole: allowedRoles,
      });
    }

    next();
  };
};

/* ==========================================================================
   AUTHENTICATION ROUTES (/api/auth)
   ========================================================================== */

/**
 * POST /api/auth/register
 * Self-service passenger registration
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, phone, password, role = 'passenger', driverId } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a valid full name (at least 2 characters).' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please log in instead.' });
    }

    const validRole: UserRole = (role === 'admin' || role === 'driver') ? role : 'passenger';
    const assignedDriverId = validRole === 'driver' ? (driverId || `drv-${Date.now().toString().slice(-4)}`) : undefined;

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser: UserAccount = {
      id: `usr-${validRole}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : undefined,
      role: validRole,
      driverId: assignedDriverId,
      passwordHash,
      status: validRole === 'driver' ? 'pending_verification' : 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      failedLoginAttempts: 0,
    };

    saveUser(newUser);

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    logAuthAudit({
      userId: newUser.id,
      userEmail: newUser.email,
      action: 'register',
      ip,
      userAgent,
      details: `New ${validRole} account registered: ${newUser.name} (${newUser.email})`,
    });

    // Auto-login registered user
    const session = createSession(newUser.id, newUser.role, ip, userAgent, false);

    res.cookie('btr_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      user: sanitizeUser(newUser),
      token: session.token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to complete registration. Please try again.' });
  }
});

/**
 * POST /api/auth/firebase-session
 * Synchronizes Firebase authenticated user session with server-side session
 */
authRouter.post('/firebase-session', async (req: Request, res: Response): Promise<any> => {
  try {
    const { uid, email, name, phone, role, driverId, rememberMe = true } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ error: 'Missing required uid or email from Firebase user' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Determine role: use provided role, project owner email, or default to passenger
    let assignedRole: UserRole = role || 'passenger';
    let assignedDriverId: string | undefined = driverId;

    if (role === 'admin' || cleanEmail === 'btrtransport88@gmail.com') {
      assignedRole = 'admin';
    } else if (role === 'driver') {
      assignedRole = 'driver';
      if (!assignedDriverId) {
        assignedDriverId = `drv-${uid.slice(0, 6)}`;
      }
    }

    // Lookup existing user in server DB by email or uid
    let user = getUserByEmail(cleanEmail) || getUserById(uid);
    if (!user) {
      user = {
        id: uid,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        phone,
        role: assignedRole,
        driverId: assignedDriverId,
        passwordHash: 'firebase_managed',
        status: assignedRole === 'driver' ? 'pending_verification' : 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        failedLoginAttempts: 0,
      };
      saveUser(user);
    } else {
      // Update with latest Firebase attributes
      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.role = assignedRole;
      if (assignedDriverId) user.driverId = assignedDriverId;
      user.lastLoginAt = new Date().toISOString();
      saveUser(user);
    }

    const session = createSession(user.id, user.role, ip, userAgent, rememberMe);
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('btr_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });

    logAuthAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'login_success',
      ip,
      userAgent,
      details: `Firebase authenticated session synced for role '${user.role}' (UID: ${uid})`,
    });

    return res.json({
      success: true,
      message: `Firebase session active for ${user.name}`,
      user: sanitizeUser(user),
      token: session.token,
    });
  } catch (err: any) {
    console.error('Firebase session sync error:', err);
    return res.status(500).json({ error: 'Failed to synchronize Firebase session' });
  }
});

/**
 * POST /api/auth/login
 * Unified role-based login
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password, rememberMe = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email address and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const rateLimitKey = `${req.ip}_${cleanEmail}`;

    if (isRateLimited(rateLimitKey)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. For security, please wait 15 minutes before trying again.',
        code: 'RATE_LIMITED',
      });
    }

    const user = getUserByEmail(cleanEmail);
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!user) {
      recordFailedAttempt(rateLimitKey);
      logAuthAudit({
        userEmail: cleanEmail,
        action: 'login_failed',
        ip,
        userAgent,
        details: 'Failed login: Email not registered',
      });
      return res.status(401).json({ error: 'Invalid email address or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      saveUser(user);

      logAuthAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'login_failed',
        ip,
        userAgent,
        details: `Failed login: Incorrect password (attempt ${user.failedLoginAttempts})`,
      });
      return res.status(401).json({ error: 'Invalid email address or password.' });
    }

    // Check account status
    if (user.status === 'suspended') {
      logAuthAudit({
        userId: user.id,
        userEmail: user.email,
        action: 'unauthorized_access_attempt',
        ip,
        userAgent,
        details: 'Login rejected: Account is suspended',
      });
      return res.status(403).json({
        error: 'Your account has been suspended by administration. Please contact BTR Transport Dispatch at 0917-888-2871.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        error: 'Your account has been deactivated. Please contact dispatch support.',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Successful login: reset failed counters & update login time
    clearFailedAttempts(rateLimitKey);
    user.failedLoginAttempts = 0;
    user.lastLoginAt = new Date().toISOString();
    saveUser(user);

    const session = createSession(user.id, user.role, ip, userAgent, rememberMe);

    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    res.cookie('btr_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
    });

    logAuthAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'login_success',
      ip,
      userAgent,
      details: `Successful login as role '${user.role}'${rememberMe ? ' (Remember Me active)' : ''}`,
    });

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: sanitizeUser(user),
      token: session.token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server authentication error.' });
  }
});

/**
 * POST /api/auth/logout
 * Secure session revocation and cookie clearing
 */
authRouter.post('/logout', (req: Request, res: Response): any => {
  const token = extractSessionToken(req);
  const ip = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (token) {
    const session = getSessionByToken(token);
    if (session) {
      revokeSession(token);
      logAuthAudit({
        userId: session.userId,
        action: 'logout',
        ip,
        userAgent,
        details: `User session logged out successfully: ${session.sessionId}`,
      });
    }
  }

  res.clearCookie('btr_session');
  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/auth/me
 * Retrieves profile of currently authenticated user session
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as UserAccount;
  res.json({
    success: true,
    user: sanitizeUser(user),
  });
});

/**
 * POST /api/auth/forgot-password
 * Initiates single-use password reset token
 */
authRouter.post('/forgot-password', (req: Request, res: Response): any => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Please enter your account email address.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = getUserByEmail(cleanEmail);
  const ip = req.ip || req.socket.remoteAddress;

  if (!user) {
    // Return friendly generic response to prevent email enumeration
    return res.json({
      success: true,
      message: 'If an account exists for this email, password reset instructions have been generated.',
    });
  }

  const resetRecord = createPasswordResetToken(user.id);

  logAuthAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'password_reset_request',
    ip,
    details: `Password reset token generated: ${resetRecord.token.substring(0, 8)}...`,
  });

  return res.json({
    success: true,
    message: 'A password reset token has been issued. Use it to update your password.',
    // In our development sandbox, return token to make verification instantaneous
    resetToken: resetRecord.token,
    userEmail: user.email,
  });
});

/**
 * POST /api/auth/reset-password
 * Validates token and updates user password
 */
authRouter.post('/reset-password', async (req: Request, res: Response): Promise<any> => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Missing required token or new password.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const resetRecord = getPasswordResetToken(token);
  if (!resetRecord) {
    return res.status(400).json({ error: 'This password reset link is invalid or has expired. Please request a new one.' });
  }

  const user = getUserById(resetRecord.userId);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const saltRounds = 10;
  user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
  user.failedLoginAttempts = 0;
  saveUser(user);

  markPasswordResetTokenUsed(token);
  // Revoke all prior sessions for security
  revokeAllUserSessions(user.id);

  const ip = req.ip || req.socket.remoteAddress;
  logAuthAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'password_reset_success',
    ip,
    details: 'Password was successfully reset. All active sessions invalidated.',
  });

  return res.json({
    success: true,
    message: 'Your password has been reset successfully. Please log in with your new credentials.',
  });
});

/**
 * GET /api/auth/audit-logs
 * Security Audit Log inspection (Admin-Only)
 */
authRouter.get('/audit-logs', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '100'), 10);
  const logs = getAuthAuditLogs(limit);
  res.json({
    success: true,
    logs,
    count: logs.length,
  });
});

/* ==========================================================================
   ADMIN USER MANAGEMENT ROUTES (/api/admin/users)
   ========================================================================== */

/**
 * GET /api/admin/users
 * Returns list of all user accounts for admin review
 */
adminUsersRouter.get('/', requireAuth, requireRole('admin'), (_req: Request, res: Response) => {
  const users = getAllUsers().map(sanitizeUser);
  res.json({
    success: true,
    users,
    total: users.length,
  });
});

/**
 * POST /api/admin/users/create
 * Admin creates new driver, staff, or passenger accounts
 */
adminUsersRouter.post('/create', requireAuth, requireRole('admin'), async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, phone, role, password, driverId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Please provide name, email, password, and role.' });
    }

    if (!['passenger', 'driver', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (getUserByEmail(cleanEmail)) {
      return res.status(409).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const idPrefix = role === 'admin' ? 'usr-admin' : role === 'driver' ? 'usr-drv' : 'usr-pass';

    const newUser: UserAccount = {
      id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: name.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : undefined,
      role: role as UserRole,
      passwordHash,
      status: 'active',
      driverId: role === 'driver' ? driverId : undefined,
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0,
    };

    saveUser(newUser);

    const admin = (req as any).user as UserAccount;
    logAuthAudit({
      userId: admin.id,
      userEmail: admin.email,
      action: 'register',
      ip: req.ip,
      details: `Admin created user '${newUser.name}' (${newUser.email}) with role '${newUser.role}'`,
    });

    return res.status(201).json({
      success: true,
      message: 'User account created successfully.',
      user: sanitizeUser(newUser),
    });
  } catch (err: any) {
    console.error('Admin create user error:', err);
    return res.status(500).json({ error: 'Failed to create user account.' });
  }
});

/**
 * PATCH /api/admin/users/:id/status
 * Admin toggles user account status (active, suspended, inactive)
 */
adminUsersRouter.patch('/:id/status', requireAuth, requireRole('admin'), (req: Request, res: Response): any => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'suspended', 'inactive', 'pending_verification', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status provided.' });
  }

  const admin = (req as any).user as UserAccount;
  if (admin.id === id && (status === 'suspended' || status === 'rejected')) {
    return res.status(400).json({ error: 'Administrators cannot suspend or reject their own active account.' });
  }

  const updated = updateUserStatus(id, status as AccountStatus);
  if (!updated) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  if (status === 'suspended' || status === 'rejected') {
    revokeAllUserSessions(id);
  }

  logAuthAudit({
    userId: admin.id,
    userEmail: admin.email,
    action: status === 'suspended' || status === 'rejected' ? 'account_suspended' : 'account_activated',
    ip: req.ip,
    details: `Admin changed account status of '${updated.email}' to '${status}'`,
  });

  return res.json({
    success: true,
    message: `Account status updated to ${status}.`,
    user: sanitizeUser(updated),
  });
});
