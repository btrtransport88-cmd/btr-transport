import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { ShieldAlert, ArrowLeft, LogIn, Lock } from 'lucide-react';

interface AccessDenied403Props {
  requiredRole: UserRole;
  onBackToAllowed: () => void;
}

export const AccessDenied403: React.FC<AccessDenied403Props> = ({
  requiredRole,
  onBackToAllowed,
}) => {
  const { user, openLoginModal } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-amber-500" />

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-300 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" /> 403 Forbidden
          </div>
          <h2 className="text-2xl font-extrabold text-white">Access Restricted</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            This module requires verified{' '}
            <strong className="text-amber-400 uppercase font-bold">{requiredRole}</strong> role permissions.
            {user ? (
              <>
                {' '}You are currently signed in as{' '}
                <strong className="text-white">{user.name}</strong> with role{' '}
                <span className="inline-block px-2 py-0.5 bg-slate-800 text-teal-300 font-mono text-xs rounded border border-slate-700">
                  {user.role}
                </span>.
              </>
            ) : (
              ' You are currently browsing as a guest passenger.'
            )}
          </p>
        </div>

        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2">
          <div className="font-bold text-slate-300">Authorized Personnel:</div>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            {requiredRole === 'admin' ? (
              <>
                <li>BTR Transport Dispatch Supervisors</li>
                <li>Fleet Operations Managers</li>
                <li>Finance & Revenue Auditors</li>
              </>
            ) : (
              <>
                <li>Licensed BTR Shuttle HiAce Commuter Drivers</li>
                <li>Assigned Trip Manifest Officers</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onBackToAllowed}
            className="flex-1 py-2.5 px-4 bg-teal-900/60 hover:bg-teal-900 border border-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Passenger View</span>
          </button>

          <button
            onClick={() => openLoginModal(requiredRole)}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In as {requiredRole.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
