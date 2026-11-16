import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { AuthUser, UserRole, Driver, AccountStatus } from '../types';
import { app, db, googleAuthProvider, testFirestoreConnection } from '../utils/firebase';
import { authApi } from '../utils/authApi';
import { getStoredDrivers, saveDrivers, verifyDriver, rejectDriver } from '../utils/storage';

// Initialize the Firebase Authentication SDK instance for AuthContext
export const auth = getAuth(app);

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  role: UserRole;
  activeRoleView: UserRole;
  isLoading: boolean;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  register: (
    name: string,
    email: string,
    phone: string,
    pass: string,
    role?: UserRole,
    driverDetails?: { licenseNumber?: string; assignedVehicleId?: string }
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchRoleView: (targetRole: UserRole) => boolean;
  // Modal controllers
  isLoginModalOpen: boolean;
  isRegisterModalOpen: boolean;
  isForgotModalOpen: boolean;
  intendedRoleForLogin?: UserRole;
  openLoginModal: (targetRole?: UserRole) => void;
  closeLoginModal: () => void;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  openForgotModal: () => void;
  closeForgotModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Maps email, existing attributes, and Firebase identity to strict system role
 */
export const resolveRoleAndProfile = (
  email: string | null | undefined,
  existingRole?: UserRole
): { role: UserRole; name?: string; driverId?: string } => {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (existingRole) {
    return {
      role: existingRole,
    };
  }

  // Admin mapping: project owner email from metadata
  if (
    cleanEmail === 'btrtransport88@gmail.com' ||
    cleanEmail.startsWith('admin@')
  ) {
    return {
      role: 'admin',
      name: cleanEmail === 'btrtransport88@gmail.com' ? 'BTR Transport Admin' : 'Chief Dispatcher',
    };
  }

  // Default passenger mapping
  return {
    role: 'passenger',
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRoleView, setActiveRoleView] = useState<UserRole>('passenger');

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [intendedRoleForLogin, setIntendedRoleForLogin] = useState<UserRole | undefined>(undefined);

  /**
   * Synchronizes Firebase User to Firestore `/users/{uid}` and server-side session
   */
  const syncFirebaseUserToFirestore = useCallback(
    async (
      fbUser: FirebaseUser,
      customAttributes?: {
        name?: string;
        phone?: string;
        role?: UserRole;
        driverId?: string;
        status?: AccountStatus;
        licenseNumber?: string;
        assignedVehicleId?: string;
      }
    ): Promise<AuthUser> => {
      const uid = fbUser.uid;
      const email = (fbUser.email || '').toLowerCase();
      const userDocRef = doc(db, 'users', uid);

      let existingData: any = null;
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          existingData = snap.data();
        }
      } catch (err) {
        console.warn('Firestore user fetch notice:', err);
      }

      const roleMeta = resolveRoleAndProfile(
        email,
        customAttributes?.role || (existingData?.role as UserRole)
      );

      const computedStatus: AccountStatus =
        customAttributes?.status ||
        existingData?.status ||
        (roleMeta.role === 'driver' ? 'pending_verification' : 'active');

      const authUser: AuthUser = {
        id: uid,
        name:
          customAttributes?.name ||
          existingData?.name ||
          fbUser.displayName ||
          roleMeta.name ||
          email.split('@')[0] ||
          'Passenger',
        email,
        phone: customAttributes?.phone || existingData?.phone || fbUser.phoneNumber || undefined,
        role: roleMeta.role,
        status: computedStatus,
        driverId: customAttributes?.driverId || existingData?.driverId || roleMeta.driverId,
        licenseNumber: customAttributes?.licenseNumber || existingData?.licenseNumber || undefined,
        assignedVehicleId: customAttributes?.assignedVehicleId || existingData?.assignedVehicleId || undefined,
        createdAt: existingData?.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      // Upsert user profile to Firestore
      try {
        await setDoc(
          userDocRef,
          {
            id: uid,
            name: authUser.name,
            email: authUser.email,
            phone: authUser.phone || '',
            role: authUser.role,
            status: authUser.status,
            driverId: authUser.driverId || null,
            licenseNumber: authUser.licenseNumber || null,
            assignedVehicleId: authUser.assignedVehicleId || null,
            createdAt: authUser.createdAt,
            lastLoginAt: authUser.lastLoginAt,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Firestore setDoc user document notice:', err);
      }

      // Sync backend session so Express routes accept authorized requests
      try {
        await authApi.syncFirebaseSession({
          uid: authUser.id,
          email: authUser.email,
          name: authUser.name,
          phone: authUser.phone,
          role: authUser.role,
          driverId: authUser.driverId,
          rememberMe: true,
        });
      } catch (err) {
        console.warn('Backend session synchronization notice:', err);
      }

      return authUser;
    },
    []
  );

  /**
   * Listen for Firebase Authentication state changes
   */
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const authUser = await syncFirebaseUserToFirestore(fbUser);
          setUser(authUser);
          setActiveRoleView((prev) => {
            if (authUser.role === 'admin') return prev;
            if (authUser.role === 'driver' && (prev === 'driver' || prev === 'passenger')) return prev;
            return authUser.role;
          });
        } catch (err) {
          console.error('Error hydrating Firebase user profile:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Fallback: check backend session if Firebase Auth state is null
        try {
          const me = await authApi.getMe();
          if (me) {
            setUser(me);
            setActiveRoleView(me.role);
          } else {
            setUser(null);
            setActiveRoleView('passenger');
          }
        } catch {
          setUser(null);
          setActiveRoleView('passenger');
        } finally {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [syncFirebaseUserToFirestore]);

  /**
   * Real-time Firestore listener for current user's account status updates (e.g. driver approval/rejection)
   */
  useEffect(() => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(
      userDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const latestStatus = data.status as AccountStatus | undefined;
        const latestDriverId = (data.driverId as string | undefined) || undefined;

        setUser((prev) => {
          if (!prev || prev.id !== firebaseUser.uid) return prev;
          if (prev.status === latestStatus && prev.role === data.role) return prev;
          return {
            ...prev,
            status: latestStatus || prev.status,
            role: (data.role as UserRole) || prev.role,
            driverId: latestDriverId || prev.driverId,
            licenseNumber: data.licenseNumber || prev.licenseNumber,
            assignedVehicleId: data.assignedVehicleId || prev.assignedVehicleId,
          };
        });

        if (latestDriverId && latestStatus === 'active') {
          verifyDriver(latestDriverId);
        } else if (latestDriverId && latestStatus === 'rejected') {
          rejectDriver(latestDriverId);
        }
      },
      (err) => {
        console.warn('Firestore user profile snapshot notice:', err);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  // Refresh current user session
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      const authUser = await syncFirebaseUserToFirestore(auth.currentUser);
      setUser(authUser);
      setActiveRoleView(authUser.role);
    } else {
      const me = await authApi.getMe();
      setUser(me);
      if (me) {
        setActiveRoleView(me.role);
      }
    }
  }, [syncFirebaseUserToFirestore]);

  /**
   * Unified Login via Firebase Authentication SDK with graceful backend bridge
   */
  const login = async (email: string, pass: string, rememberMe: boolean = false): Promise<AuthUser> => {
    const cleanEmail = email.trim().toLowerCase();

    // Set persistence in Firebase Auth
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
    } catch (e) {
      console.warn('Set persistence error:', e);
    }

    let authUser: AuthUser | null = null;

    try {
      // 1. Attempt Firebase Authentication
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      authUser = await syncFirebaseUserToFirestore(cred.user);
    } catch (fbErr: any) {
      console.warn('Firebase signInWithEmailAndPassword attempt:', fbErr?.code || fbErr?.message);

      // If user does not exist in Firebase yet, attempt to register them with these credentials
      if (fbErr?.code === 'auth/user-not-found' || fbErr?.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          authUser = await syncFirebaseUserToFirestore(cred.user);
        } catch (createErr) {
          console.warn('Firebase auto-create attempt notice:', createErr);
        }
      }

      // If Firebase still hasn't authenticated (e.g. email provider not enabled in console or custom account), use backend auth
      if (!authUser) {
        const res = await authApi.login(cleanEmail, pass, rememberMe);
        authUser = res.user;

        // Try to create or authenticate in Firebase in the background
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
          await syncFirebaseUserToFirestore(cred.user, {
            name: authUser.name,
            phone: authUser.phone,
            role: authUser.role,
          });
        } catch {
          // If already created, try sign in
          try {
            await signInWithEmailAndPassword(auth, cleanEmail, pass);
          } catch {}
        }
      }
    }

    if (!authUser) {
      throw new Error('Invalid email address or password.');
    }

    setUser(authUser);

    // Switch to user's assigned role or intended role
    if (authUser.role === 'admin') {
      setActiveRoleView(intendedRoleForLogin || 'admin');
    } else if (authUser.role === 'driver') {
      setActiveRoleView('driver');
    } else {
      setActiveRoleView('passenger');
    }

    setIsLoginModalOpen(false);
    setIntendedRoleForLogin(undefined);
    return authUser;
  };

  /**
   * One-Click Google Login via Firebase Authentication SDK
   */
  const loginWithGoogle = async (): Promise<AuthUser> => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const authUser = await syncFirebaseUserToFirestore(cred.user);

    setUser(authUser);
    if (authUser.role === 'admin') {
      setActiveRoleView(intendedRoleForLogin || 'admin');
    } else if (authUser.role === 'driver') {
      setActiveRoleView('driver');
    } else {
      setActiveRoleView('passenger');
    }

    setIsLoginModalOpen(false);
    setIntendedRoleForLogin(undefined);
    return authUser;
  };

  /**
   * Multi-role Registration via Firebase Authentication SDK with Driver/Admin provisioning
   */
  const register = async (
    name: string,
    email: string,
    phone: string,
    pass: string,
    role: UserRole = 'passenger',
    driverDetails?: { licenseNumber?: string; assignedVehicleId?: string }
  ): Promise<AuthUser> => {
    const cleanEmail = email.trim().toLowerCase();
    let authUser: AuthUser | null = null;
    let generatedDriverId: string | undefined = undefined;

    // For driver accounts, provision the fleet driver record in localStorage
    let normalizedLicense: string | undefined = undefined;
    if (role === 'driver') {
      generatedDriverId = `drv-${Date.now().toString().slice(-4)}`;
      normalizedLicense =
        driverDetails?.licenseNumber?.trim() ||
        `N01-${Math.floor(10 + Math.random() * 89)}-${Math.floor(100000 + Math.random() * 900000)}`;
      const existingDrivers = getStoredDrivers();
      const newDriver: Driver = {
        id: generatedDriverId,
        name: name.trim(),
        phone: phone.trim(),
        licenseNumber: normalizedLicense,
        assignedVehicleId: driverDetails?.assignedVehicleId || undefined,
        rating: 5.0,
        tripsCompleted: 0,
        verificationStatus: 'pending_verification',
      };
      saveDrivers([newDriver, ...existingDrivers.filter((d) => d.id !== generatedDriverId)]);
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      await updateProfile(cred.user, { displayName: name.trim() });
      authUser = await syncFirebaseUserToFirestore(cred.user, {
        name: name.trim(),
        phone: phone.trim(),
        role,
        driverId: generatedDriverId,
        status: role === 'driver' ? 'pending_verification' : 'active',
        licenseNumber: normalizedLicense,
        assignedVehicleId: driverDetails?.assignedVehicleId || undefined,
      });
    } catch (fbErr: any) {
      console.warn('Firebase registration error, falling back to server register:', fbErr);
      // Fallback to server registration
      const res = await authApi.register(name, cleanEmail, phone, pass, role, generatedDriverId);
      authUser = res.user;
    }

    if (!authUser) {
      throw new Error('Registration could not be completed.');
    }

    setUser(authUser);
    setActiveRoleView(role);
    setIsRegisterModalOpen(false);
    return authUser;
  };

  /**
   * Logout from both Firebase Authentication SDK and server session
   */
  const logout = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signOut notice:', e);
    }
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('Server logout notice:', e);
    }
    setUser(null);
    setFirebaseUser(null);
    setActiveRoleView('passenger');
  };

  /**
   * RBAC View switcher guard
   * - Admins can view any portal (Admin, Driver, Passenger) for dispatch management
   * - Drivers can view Driver Portal or Passenger View
   * - Passengers can only view Passenger Portal
   */
  const switchRoleView = (targetRole: UserRole): boolean => {
    if (targetRole === 'passenger') {
      setActiveRoleView('passenger');
      return true;
    }

    if (!user) {
      setIntendedRoleForLogin(targetRole);
      setIsLoginModalOpen(true);
      return false;
    }

    if (user.role === 'admin') {
      setActiveRoleView(targetRole);
      return true;
    }

    if (user.role === 'driver') {
      if (targetRole === 'driver') {
        setActiveRoleView('driver');
        return true;
      }
      return false;
    }

    return false;
  };

  const openLoginModal = (targetRole?: UserRole) => {
    setIntendedRoleForLogin(targetRole);
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
    setIsForgotModalOpen(false);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setIntendedRoleForLogin(undefined);
  };

  const openRegisterModal = () => {
    setIsRegisterModalOpen(true);
    setIsLoginModalOpen(false);
    setIsForgotModalOpen(false);
  };

  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const openForgotModal = () => {
    setIsForgotModalOpen(true);
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
  };

  const closeForgotModal = () => setIsForgotModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isAuthenticated: Boolean(user),
        role: user ? user.role : 'passenger',
        activeRoleView,
        isLoading,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
        switchRoleView,
        isLoginModalOpen,
        isRegisterModalOpen,
        isForgotModalOpen,
        intendedRoleForLogin,
        openLoginModal,
        closeLoginModal,
        openRegisterModal,
        closeRegisterModal,
        openForgotModal,
        closeForgotModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
