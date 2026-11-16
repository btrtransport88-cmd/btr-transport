import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Car,
  Phone,
  Mail,
  FileText,
  UserCheck,
  Database,
  Loader2,
} from 'lucide-react';
import { AuthUser, Driver, Vehicle } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../utils/firebase';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../utils/authApi';
import { verifyDriver, rejectDriver } from '../../utils/storage';

export interface PendingDriverRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  driverId?: string;
  licenseNumber?: string;
  assignedVehicleId?: string;
  createdAt?: string;
  source: 'firestore' | 'server';
}

interface AdminApprovalViewProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  userAccounts: AuthUser[];
  onRefreshUsers?: () => void;
}

export const AdminApprovalView: React.FC<AdminApprovalViewProps> = ({
  drivers,
  vehicles,
  userAccounts,
  onRefreshUsers,
}) => {
  const { user, firebaseUser } = useAuth();

  const [firestorePending, setFirestorePending] = useState<PendingDriverRecord[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState<boolean>(false);
  const [firestoreNotice, setFirestoreNotice] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Real-time Firestore listener for all pending_verification driver accounts
  useEffect(() => {
    if (!firebaseUser) {
      setFirestorePending([]);
      return;
    }

    setIsLoadingFirestore(true);
    setFirestoreNotice(null);

    const usersRef = collection(db, 'users');
    const pendingQuery = query(
      usersRef,
      where('role', '==', 'driver'),
      where('status', '==', 'pending_verification')
    );

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const records: PendingDriverRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: (data.name as string) || 'Unnamed Driver',
            email: (data.email as string) || '',
            phone: (data.phone as string) || undefined,
            driverId: (data.driverId as string) || undefined,
            licenseNumber: (data.licenseNumber as string) || undefined,
            assignedVehicleId: (data.assignedVehicleId as string) || undefined,
            createdAt: (data.createdAt as string) || undefined,
            source: 'firestore',
          };
        });
        setFirestorePending(records);
        setIsLoadingFirestore(false);
        setFirestoreNotice(null);
      },
      (error) => {
        setIsLoadingFirestore(false);
        setFirestoreNotice(
          'Firestore live listener could not read /users. Ensure you are signed in with the authorized Firebase Admin account.'
        );
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch (err) {
          console.warn('Handled Firestore list error in AdminApprovalView:', err);
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const handleManualRefresh = useCallback(async () => {
    onRefreshUsers?.();
    if (!firebaseUser) return;

    setIsLoadingFirestore(true);
    setFirestoreNotice(null);
    try {
      const pendingQuery = query(
        collection(db, 'users'),
        where('role', '==', 'driver'),
        where('status', '==', 'pending_verification')
      );
      const snapshot = await getDocs(pendingQuery);
      const records: PendingDriverRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: (data.name as string) || 'Unnamed Driver',
          email: (data.email as string) || '',
          phone: (data.phone as string) || undefined,
          driverId: (data.driverId as string) || undefined,
          licenseNumber: (data.licenseNumber as string) || undefined,
          assignedVehicleId: (data.assignedVehicleId as string) || undefined,
          createdAt: (data.createdAt as string) || undefined,
          source: 'firestore',
        };
      });
      setFirestorePending(records);
    } catch (error) {
      setFirestoreNotice(
        'Could not fetch pending drivers from Firestore. Falling back to synced operational records.'
      );
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch {
        // Error already logged in structured JSON format by handleFirestoreError
      }
    } finally {
      setIsLoadingFirestore(false);
    }
  }, [firebaseUser, onRefreshUsers]);

  // Merge Firestore pending records with any server-synced pending driver accounts
  const pendingDrivers: PendingDriverRecord[] = React.useMemo(() => {
    const mergedMap = new Map<string, PendingDriverRecord>();

    // Primary: Firestore records
    for (const rec of firestorePending) {
      const key = (rec.email || rec.id).toLowerCase();
      mergedMap.set(key, rec);
    }

    // Secondary: Server userAccounts with role === 'driver' and status === 'pending_verification'
    for (const acc of userAccounts) {
      if (acc.role === 'driver' && acc.status === 'pending_verification') {
        const key = (acc.email || acc.id).toLowerCase();
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            id: acc.id,
            name: acc.name,
            email: acc.email,
            phone: acc.phone,
            driverId: acc.driverId,
            licenseNumber: acc.licenseNumber,
            assignedVehicleId: acc.assignedVehicleId,
            createdAt: acc.createdAt,
            source: 'server',
          });
        }
      }
    }

    // Tertiary: Local fleet drivers still marked pending_verification without a matching user entry
    for (const drv of drivers) {
      if (drv.verificationStatus === 'pending_verification') {
        const alreadyIncluded = Array.from(mergedMap.values()).some(
          (item) => item.driverId === drv.id
        );
        if (!alreadyIncluded) {
          mergedMap.set(drv.id, {
            id: drv.id,
            name: drv.name,
            email: `${drv.id}@fleet.local`,
            phone: drv.phone,
            driverId: drv.id,
            licenseNumber: drv.licenseNumber,
            assignedVehicleId: drv.assignedVehicleId,
            source: 'server',
          });
        }
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [firestorePending, userAccounts, drivers]);

  const handleDecision = async (
    account: PendingDriverRecord,
    decision: 'active' | 'rejected'
  ) => {
    setProcessingId(account.id);
    setActionFeedback(null);
    setConfirmRejectId(null);

    const nowIso = new Date().toISOString();

    try {
      // 1. Update Firestore `/users/{uid}` document when present in Firestore or authenticated in Firebase
      if (firebaseUser && account.source === 'firestore') {
        const userDocRef = doc(db, 'users', account.id);
        try {
          await updateDoc(userDocRef, {
            status: decision,
            updatedAt: nowIso,
            reviewedBy: user?.email || firebaseUser.email || 'admin',
            reviewedAt: nowIso,
          });
        } catch (fsError) {
          handleFirestoreError(fsError, OperationType.UPDATE, `users/${account.id}`);
        }
      }

      // 2. Sync Express backend user status if matching record exists
      const serverMatch = userAccounts.find(
        (u) =>
          u.id === account.id ||
          (account.email && u.email.toLowerCase() === account.email.toLowerCase()) ||
          (account.driverId && u.driverId === account.driverId)
      );
      if (serverMatch) {
        try {
          await authApi.adminUpdateUserStatus(serverMatch.id, decision);
        } catch (apiErr) {
          console.warn('Backend status sync notice:', apiErr);
        }
      }

      // 3. Sync local fleet driver roster (`btr_drivers_v2`)
      if (account.driverId) {
        if (decision === 'active') {
          verifyDriver(account.driverId);
        } else {
          rejectDriver(account.driverId);
        }
      }

      // 4. Optimistically remove from Firestore state if handled
      setFirestorePending((prev) => prev.filter((item) => item.id !== account.id));
      onRefreshUsers?.();

      setActionFeedback({
        type: 'success',
        message:
          decision === 'active'
            ? `Approved ${account.name} — driver account is now Active and route access is unlocked.`
            : `Rejected ${account.name} — driver application status updated to Rejected.`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message:
          err?.message ||
          `Failed to ${decision === 'active' ? 'approve' : 'reject'} ${account.name} in Firestore.`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
              <Clock className="w-3 h-3 text-amber-700" />
              <span>Pending Verification Queue</span>
            </span>
            {firebaseUser && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                <Database className="w-3 h-3 text-teal-700" />
                <span>Firestore Synced</span>
              </span>
            )}
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
            Driver Verification Approvals
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Review newly registered Shuttle Captains and approve or reject their Firestore account status to grant or deny route access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
            {pendingDrivers.length} Pending
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoadingFirestore}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFirestore ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Firestore Notice (if applicable) */}
      {firestoreNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{firestoreNotice}</span>
        </div>
      )}

      {/* Pending Driver List or Empty State */}
      {isLoadingFirestore && pendingDrivers.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
          <span>Loading pending driver accounts from Firestore...</span>
        </div>
      ) : pendingDrivers.length === 0 ? (
        <div className="py-10 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-slate-900">
            No Driver Accounts Pending Verification
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            All registered Shuttle Captains have been reviewed. New driver registrations automatically enter this queue with <span className="font-semibold text-amber-700">Pending Verification</span> status.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {pendingDrivers.map((account) => {
            const rosterDriver = drivers.find((d) => d.id === account.driverId);
            const license = account.licenseNumber || rosterDriver?.licenseNumber || 'Not Provided';
            const vehicleId = account.assignedVehicleId || rosterDriver?.assignedVehicleId;
            const vehicle = vehicles.find((v) => v.id === vehicleId);
            const isProcessing = processingId === account.id;
            const isConfirmingReject = confirmRejectId === account.id;

            return (
              <div
                key={account.id}
                className="p-4 sm:p-5 border border-amber-200 bg-amber-50/30 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
              >
                {/* Driver Info */}
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-teal-900 text-amber-300 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {account.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {account.name}
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-amber-700" />
                        <span>Pending Verification</span>
                      </span>
                      {account.driverId && (
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          {account.driverId}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[11px]">{account.email}</span>
                      </span>
                      {account.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{account.phone}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-700" />
                        <span>
                          License:{' '}
                          <strong className="font-mono text-slate-900">{license}</strong>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {vehicle
                            ? `${vehicle.plateNumber} (${vehicle.model})`
                            : 'Dynamic Dispatch Assignment'}
                        </span>
                      </span>
                    </div>

                    {account.createdAt && (
                      <div className="text-[11px] text-slate-400">
                        Applied: {new Date(account.createdAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Approve / Reject Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
                  {isConfirmingReject ? (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-rose-800">
                        Reject driver?
                      </span>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleDecision(account, 'rejected')}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? 'Updating...' : 'Confirm Reject'}
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setConfirmRejectId(null)}
                        className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setConfirmRejectId(account.id)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleDecision(account, 'active')}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{isProcessing ? 'Updating...' : 'Approve'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
