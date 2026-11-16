import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, Vehicle } from '../../types';
import { getStoredVehicles } from '../../utils/storage';
import {
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  X,
  Bus,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  FileText,
  BadgeAlert,
  Car,
} from 'lucide-react';

const DISPATCH_AUTH_CODE = 'BTR-DISPATCH-2026';

export const RegisterModal: React.FC = () => {
  const {
    isRegisterModalOpen,
    closeRegisterModal,
    openLoginModal,
    register,
    intendedRoleForLogin,
  } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('passenger');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Driver-specific fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [assignedVehicleId, setAssignedVehicleId] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);

  // Dispatch Admin-specific fields
  const [dispatchPasscode, setDispatchPasscode] = useState('');

  // Synchronize initial role if user clicked login for a specific role earlier
  useEffect(() => {
    if (intendedRoleForLogin) {
      setSelectedRole(intendedRoleForLogin);
    }
  }, [intendedRoleForLogin, isRegisterModalOpen]);

  // Load available vehicles when driver is selected
  useEffect(() => {
    if (isRegisterModalOpen) {
      setAvailableVehicles(getStoredVehicles());
    }
  }, [isRegisterModalOpen]);

  if (!isRegisterModalOpen) return null;

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const isPasswordValid = hasMinLength && hasNumber && hasLetter;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 letters).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('Please provide a valid Philippine contact number.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    // Role-specific validation
    if (selectedRole === 'driver') {
      if (!licenseNumber.trim() || licenseNumber.trim().length < 5) {
        setErrorMessage('Please enter a valid Professional Driver License Number (e.g. N01-19-123456).');
        return;
      }
    }

    if (selectedRole === 'admin') {
      if (dispatchPasscode.trim() !== DISPATCH_AUTH_CODE) {
        setErrorMessage('Invalid Dispatch Authorization Passcode. Enter the authorized BTR dispatch passcode.');
        return;
      }
    }

    if (!agreeToPrivacy) {
      setErrorMessage('You must agree to the Republic Act No. 10173 (Data Privacy Act) and BTR policies.');
      return;
    }

    setIsLoading(true);
    try {
      await register(
        name.trim(),
        email.trim(),
        phone.trim(),
        password,
        selectedRole,
        selectedRole === 'driver'
          ? {
              licenseNumber: licenseNumber.trim(),
              assignedVehicleId: assignedVehicleId.trim() || undefined,
            }
          : undefined
      );
      // Success will close modal and switch active role view
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-teal-800/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-white relative animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-950 to-slate-900 p-5 border-b border-teal-800/60 relative shrink-0">
          <button
            onClick={closeRegisterModal}
            className="absolute top-4 right-4 p-2 text-teal-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-teal-950 flex items-center justify-center shadow-lg shadow-amber-400/20 font-black shrink-0">
              {selectedRole === 'driver' ? (
                <Car className="w-6 h-6" />
              ) : selectedRole === 'admin' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Bus className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                {selectedRole === 'driver'
                  ? 'Register Shuttle Captain'
                  : selectedRole === 'admin'
                  ? 'Register Dispatch Admin'
                  : 'Create Passenger Account'}
              </h2>
              <p className="text-xs text-teal-200">
                {selectedRole === 'driver'
                  ? 'Access Driver Portal, verify passenger QR boarding, & view manifests'
                  : selectedRole === 'admin'
                  ? 'Access Dispatch Dashboard, assign fleet, and monitor live manifests'
                  : 'Book seats, manage e-tickets, and view Southern Palawan schedules'}
              </p>
            </div>
          </div>
        </div>

        {/* Role Selection Tabs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 shrink-0">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
            Choose Account Type:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedRole('passenger');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'passenger'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Passenger</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole('driver');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'driver'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Shuttle Captain</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRole('admin');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dispatch Admin</span>
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {selectedRole === 'driver'
                  ? 'Driver Full Name (as on LTO License)'
                  : 'Full Name (as shown on Government ID)'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    selectedRole === 'driver'
                      ? 'e.g. Manny Fernandez'
                      : 'e.g. Maria Theresa Santos'
                  }
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'driver'
                      ? 'e.g. captain.manny@btrtransport.ph'
                      : selectedRole === 'admin'
                      ? 'e.g. dispatch@btrtransport.ph'
                      : 'e.g. maria.santos@gmail.com'
                  }
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Philippine Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Philippine Mobile Number (SMS Alerts & Trip Updates) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917-123-4567"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Driver Role Specific Fields */}
            {selectedRole === 'driver' && (
              <div className="p-4 bg-teal-950/40 border border-teal-800/60 rounded-xl space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <FileText className="w-4 h-4" />
                  <span>Driver Accreditation & Fleet Assignment</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Professional Driver's License Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. N01-19-123456"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none uppercase font-mono"
                    required
                  />
                  <p className="text-[11px] text-teal-300/80 mt-1">
                    Required for LTFRB passenger insurance and automated dispatch trip logs.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Assigned Shuttle Van (Optional)
                  </label>
                  <select
                    value={assignedVehicleId}
                    onChange={(e) => setAssignedVehicleId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3 py-2 text-sm text-white outline-none cursor-pointer"
                  >
                    <option value="">Will be assigned dynamically by Terminal Dispatch</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} — {v.model} ({v.capacity} Pax)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Dispatch Admin Passcode Field */}
            {selectedRole === 'admin' && (
              <div className="p-4 bg-amber-950/30 border border-amber-600/40 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <KeyRound className="w-4 h-4" />
                  <span>Dispatch Authorization Passcode</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  To register as a Dispatch Administrator with operations oversight, enter the Terminal Master Code (authorized dispatch key: <code className="bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">BTR-DISPATCH-2026</code>).
                </p>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={dispatchPasscode}
                    onChange={(e) => setDispatchPasscode(e.target.value)}
                    placeholder="Enter BTR-DISPATCH-2026"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Create Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters with letters & numbers"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength checklist */}
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-3 h-3" /> 8+ Characters
                </span>
                <span className={`inline-flex items-center gap-1 ${hasLetter ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-3 h-3" /> Letters
                </span>
                <span className={`inline-flex items-center gap-1 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <CheckCircle className="w-3 h-3" /> Numbers
                </span>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Compliance & Privacy Consent */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeToPrivacy}
                  onChange={(e) => setAgreeToPrivacy(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-amber-400 focus:ring-offset-slate-900 bg-slate-950 w-4 h-4 mt-0.5 cursor-pointer"
                />
                <span className="leading-relaxed text-[11px] text-slate-400">
                  I agree to BTR Transport terms and consent to account verification and manifest processing in compliance with the{' '}
                  <strong className="text-teal-300">Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and LTFRB Southern Palawan route regulations.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {selectedRole === 'driver'
                      ? 'Register Shuttle Captain & Enter Portal'
                      : selectedRole === 'admin'
                      ? 'Authorize & Open Dispatch Portal'
                      : 'Create Passenger Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="pt-3 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => openLoginModal(selectedRole)}
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
