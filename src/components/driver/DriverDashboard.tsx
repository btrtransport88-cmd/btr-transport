import React, { useState } from 'react';
import {
  BoardingStatus,
  Booking,
  Driver,
  Language,
  RouteStop,
  Trip,
  TripStatus,
  Vehicle,
} from '../../types';
import { DICTIONARY } from '../../utils/translations';
import {
  markDriverCashCollected,
  updatePassengerBoarding,
  updateTripStatus,
  verifyDriver,
} from '../../utils/storage';
import { useAuth } from '../../context/AuthContext';
import {
  Bus,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  ShieldAlert,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
  Banknote,
  Calendar,
  Send,
  Radio,
  ShieldCheck,
  Lock,
  RefreshCw,
  FileText,
  BadgeAlert,
  XCircle,
} from 'lucide-react';

interface DriverDashboardProps {
  trips: Trip[];
  bookings: Booking[];
  stops: RouteStop[];
  vehicles: Vehicle[];
  drivers: Driver[];
  language: Language;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  trips,
  bookings,
  stops,
  vehicles,
  drivers,
  language,
}) => {
  const t = DICTIONARY[language];
  const { user } = useAuth();

  // If logged in as driver with assigned driverId, use it; otherwise fallback
  const initialDriverId =
    user?.role === 'driver' && user.driverId
      ? user.driverId
      : drivers[0]?.id || 'drv-01';

  const [selectedDriverId, setSelectedDriverId] = useState<string>(initialDriverId);

  // Sync if auth user changes
  React.useEffect(() => {
    if (user?.role === 'driver' && user.driverId) {
      setSelectedDriverId(user.driverId);
    }
  }, [user]);

  const activeDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

  // Driver verification status check
  const isRejected =
    activeDriver?.verificationStatus === 'rejected' ||
    (user?.role === 'driver' && user.status === 'rejected');
  const isPendingVerification =
    !isRejected &&
    (activeDriver?.verificationStatus === 'pending_verification' ||
      (user?.role === 'driver' && user.status === 'pending_verification'));
  const isRouteLocked = isPendingVerification || isRejected;

  // Assigned trips for this driver
  const assignedTrips = trips.filter((tr) => tr.driverId === selectedDriverId);
  const [selectedTripId, setSelectedTripId] = useState<string>(assignedTrips[0]?.id || trips[0]?.id);

  const activeTrip = trips.find((t) => t.id === selectedTripId) || assignedTrips[0] || trips[0];
  const assignedVehicle = vehicles.find((v) => v.id === activeTrip?.vehicleId);

  // Filter bookings for this trip
  const tripBookings = bookings.filter(
    (b) => b.tripId === activeTrip?.id && b.bookingStatus === 'confirmed'
  );

  // Flatten manifest
  interface ManifestItem {
    bookingId: string;
    bookingRef: string;
    seatId: string;
    seatLabel: string;
    fullName: string;
    passengerType: string;
    idNumber?: string;
    fare: number;
    boardingStatus: BoardingStatus;
    contactPhone: string;
    pickupStopId: string;
    pickupSpecifics?: string;
    dropoffStopId: string;
    dropoffSpecifics?: string;
    paymentStatus: string;
    paymentMethod: string;
    cashCollectedByDriver?: boolean;
  }

  const manifestItems: ManifestItem[] = [];
  tripBookings.forEach((b) => {
    b.passengers.forEach((p) => {
      manifestItems.push({
        bookingId: b.id,
        bookingRef: b.bookingReference,
        seatId: p.seatId,
        seatLabel: p.seatLabel,
        fullName: p.fullName,
        passengerType: p.passengerType,
        idNumber: p.idNumber,
        fare: p.fare,
        boardingStatus: p.boardingStatus,
        contactPhone: b.contactPhone,
        pickupStopId: b.pickupStopId,
        pickupSpecifics: b.pickupSpecifics,
        dropoffStopId: b.dropoffStopId,
        dropoffSpecifics: b.dropoffSpecifics,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        cashCollectedByDriver: b.cashCollectedByDriver,
      });
    });
  });

  const getStopName = (id: string) => stops.find((s) => s.id === id)?.name || id;

  // Boarding metrics
  const totalPassengers = manifestItems.length;
  const boardedCount = manifestItems.filter((m) => m.boardingStatus === 'boarded').length;
  const checkedInCount = manifestItems.filter((m) => m.boardingStatus === 'checked_in').length;
  const noShowCount = manifestItems.filter((m) => m.boardingStatus === 'no_show').length;

  // Cash metrics
  const cashItems = manifestItems.filter((m) => m.paymentMethod === 'cash');
  const cashCollectedTotal = cashItems
    .filter((m) => m.cashCollectedByDriver)
    .reduce((sum, m) => sum + m.fare, 0);
  const cashPendingTotal = cashItems
    .filter((m) => !m.cashCollectedByDriver)
    .reduce((sum, m) => sum + m.fare, 0);

  const handleUpdateTripStatus = (newStatus: TripStatus) => {
    if (!activeTrip) return;
    updateTripStatus(activeTrip.id, newStatus);
  };

  const handleUpdateBoarding = (bookingId: string, seatId: string, status: BoardingStatus) => {
    updatePassengerBoarding(bookingId, seatId, status);
  };

  const handleToggleCash = (bookingId: string, current: boolean) => {
    markDriverCashCollected(bookingId, !current);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Driver Header Card */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-800 border-2 border-amber-400/80 flex items-center justify-center font-black text-amber-300 text-xl shadow-inner">
            {activeDriver ? activeDriver.name.slice(0, 2).toUpperCase() : 'BTR'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isRejected ? (
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-rose-500 text-white flex items-center gap-1.5 shadow-sm">
                  <XCircle className="w-3.5 h-3.5 text-white" />
                  <span>Verification Rejected</span>
                </span>
              ) : isPendingVerification ? (
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm shadow-amber-400/20 animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-slate-950" />
                  <span>Pending Verification</span>
                </span>
              ) : (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${activeDriver ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-300'} flex items-center gap-1`}>
                  <CheckCircle className="w-3.5 h-3.5 text-slate-950" />
                  <span>{activeDriver ? 'Active Duty' : 'Fleet Standby'}</span>
                </span>
              )}
              <span className="text-xs text-teal-200">
                License: <strong className="font-mono text-amber-300">{activeDriver?.licenseNumber || 'Unassigned'}</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold mt-1">{activeDriver?.name || 'Unassigned Shuttle Fleet'}</h2>
            <p className="text-xs text-teal-100/80 flex items-center gap-2 mt-0.5">
              <span>Shuttle: {assignedVehicle?.model || 'Toyota HiAce'}</span>
              <span>·</span>
              <span className="font-mono font-bold text-amber-300">
                Plate: {assignedVehicle?.plateNumber || 'VAR 8920'}
              </span>
            </p>
          </div>
        </div>

        {/* Driver Selector or Verified Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'driver' ? (
            isRejected ? (
              <div className="bg-rose-950/90 border border-rose-500/60 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shadow-sm">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-rose-300 font-extrabold uppercase tracking-wider">
                    <span>Verification Rejected</span>
                  </div>
                  <div className="text-xs font-semibold text-rose-100">
                    Contact Dispatch Supervisor
                  </div>
                </div>
              </div>
            ) : isPendingVerification ? (
              <div className="bg-amber-950/80 border border-amber-500/60 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                <div>
                  <div className="text-[10px] text-amber-300 font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <span>Pending Verification</span>
                  </div>
                  <div className="text-xs font-semibold text-amber-100">
                    Awaiting Admin Approval
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-teal-950/80 border border-teal-700/80 px-3.5 py-2 rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-[10px] text-teal-300 font-bold uppercase tracking-wider">
                    Verified Shuttle Captain
                  </div>
                  <div className="text-xs font-mono text-white">
                    {user.email}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div>
              <label className="block text-[10px] text-teal-200 uppercase font-semibold mb-1">
                Dispatch View: Switch Driver
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  const firstTrip = trips.find((t) => t.driverId === e.target.value);
                  if (firstTrip) setSelectedTripId(firstTrip.id);
                }}
                className="text-xs font-semibold px-3 py-1.5 bg-teal-800 border border-teal-700 text-white rounded-xl focus:outline-none cursor-pointer"
              >
                {drivers.length === 0 ? (
                  <option value="">No Active Drivers Onboarded</option>
                ) : (
                  drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.verificationStatus === 'pending_verification' ? '⚠️ [Pending Verification]' : ''} ({d.tripsCompleted} trips)
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Pending Verification Detailed Notification Card */}
      {isPendingVerification && (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/80 border-2 border-amber-500/60 rounded-3xl p-6 text-white shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-950" />
                    Pending Verification
                  </span>
                  <span className="text-xs text-amber-200/90 font-mono">
                    Driver ID: {activeDriver?.id || 'Pending'}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  Shuttle Route Operations Locked
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  Your Shuttle Captain profile with Professional License{' '}
                  <strong className="text-amber-300 font-mono">{activeDriver?.licenseNumber || 'Under Review'}</strong> has been registered and is pending verification. Per LTFRB safety standards and BTR Transport policy, an authorized Dispatch Administrator must approve your credentials before live Southern Palawan shuttle routes, boarding manifests, and trip dispatches are unlocked.
                </p>
              </div>
            </div>

            {/* Review Status & Hotline */}
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 text-xs text-slate-300 shrink-0 md:min-w-[220px] space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Review Status</div>
              <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-spin text-amber-400" />
                <span>Awaiting Admin Approval</span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div>Central Dispatch Hotline:</div>
                <div className="font-mono text-teal-300 font-bold">0917-888-2878</div>
                <div className="text-[10px] text-slate-500">Bataraza & Puerto Princesa Terminals</div>
              </div>
            </div>
          </div>

          {/* Verification Pipeline Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-amber-500/20">
            <div className="bg-slate-950/60 border border-teal-800/40 rounded-xl p-3 space-y-1">
              <span className="text-[10px] text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-teal-400" /> Step 1: Registered
              </span>
              <span className="font-bold text-white block">Driver Account Created</span>
              <span className="text-[11px] text-slate-400 block">
                License: {activeDriver?.licenseNumber}
              </span>
            </div>

            <div className="bg-amber-950/50 border border-amber-500/60 rounded-xl p-3 space-y-1">
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400 animate-pulse" /> Step 2: In Review
              </span>
              <span className="font-bold text-amber-200 block">Admin Route Approval</span>
              <span className="text-[11px] text-amber-200/70 block">
                Dispatch supervisor verifies credentials
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1 opacity-70">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" /> Step 3: Unlocked
              </span>
              <span className="font-bold text-slate-300 block">Route & Manifest Access</span>
              <span className="text-[11px] text-slate-500 block">
                Live QR boarding & cash collections
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Locked Route Access Gate or Active Trip Section */}
      {isRejected ? (
        <div className="bg-white border-2 border-rose-200 rounded-3xl p-6 sm:p-8 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
            <XCircle className="w-8 h-8 text-rose-600" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-100 text-rose-900 text-xs font-black uppercase tracking-wider">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Application Rejected</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Route Access Not Authorized
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your Shuttle Captain verification application was rejected by the Dispatch Administrator. Please contact BTR Central Dispatch at <strong className="font-mono text-teal-800">0917-888-2878</strong> to review your LTO license credentials.
            </p>
          </div>
        </div>
      ) : isRouteLocked ? (
        <div className="bg-white border-2 border-amber-200/90 rounded-3xl p-6 sm:p-8 text-center shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-600 mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Route Operations Locked</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Awaiting Dispatch Administrator Approval
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              New Shuttle Captain accounts require manual verification by the Dispatch Supervisor before accessing Southern Palawan routes (Buliluyan Port ⇄ Puerto Princesa City), live passenger manifests, and QR boarding verifications.
            </p>
          </div>

          {/* Pending Application Summary Card */}
          <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-left grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Driver Name</span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block">{activeDriver?.name || 'Driver'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">License Number</span>
              <span className="font-mono font-bold text-teal-800 text-xs mt-0.5 block">{activeDriver?.licenseNumber || 'Under Review'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Registered Phone</span>
              <span className="text-slate-700 font-medium text-xs mt-0.5 block">{activeDriver?.phone || 'On File'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Shuttle</span>
              <span className="text-slate-700 font-medium text-xs mt-0.5 block">{assignedVehicle?.plateNumber || 'Pending Dispatch Assignment'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Check Approval Status</span>
            </button>

            {/* Quick Admin Approval Button if currentUser is admin */}
            {user?.role === 'admin' && activeDriver && (
              <button
                onClick={() => {
                  verifyDriver(activeDriver.id);
                }}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-700/20"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Admin Quick-Approve Driver</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {activeTrip && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Active Assigned Trip
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-black font-mono text-teal-950">
                  {activeTrip.tripNumber}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-bold text-sm text-slate-900">
                  {activeTrip.direction === 'buliluyan_to_puerto'
                    ? 'Buliluyan Port → Puerto Princesa City'
                    : 'Puerto Princesa City → Buliluyan Port'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {activeTrip.travelDate}
                </span>
                <span className="flex items-center gap-1 font-bold text-teal-900">
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  Departure: {activeTrip.departureTime} PST
                </span>
              </div>
            </div>

            {/* Trip Selector Dropdown if multiple trips assigned */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Assigned Trip
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="text-xs font-medium px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
              >
                {trips.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.tripNumber} · {tr.departureTime} ({tr.travelDate})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Trip Lifecycle Buttons */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-teal-600 animate-pulse" />
              <span>Update Dispatch Trip Status</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleUpdateTripStatus('scheduled')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTrip.status === 'scheduled'
                    ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Scheduled</span>
                <span className="text-[10px] font-normal opacity-80">Pre-trip standby</span>
              </button>

              <button
                onClick={() => handleUpdateTripStatus('boarding')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTrip.status === 'boarding'
                    ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-300'
                    : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200'
                }`}
              >
                <span>Now Boarding</span>
                <span className="text-[10px] font-normal opacity-80">Check passenger QR</span>
              </button>

              <button
                onClick={() => handleUpdateTripStatus('departed')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTrip.status === 'departed'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 border-slate-200'
                }`}
              >
                <span>Departed / En Route</span>
                <span className="text-[10px] font-normal opacity-80">On Palawan highway</span>
              </button>

              <button
                onClick={() => handleUpdateTripStatus('arrived')}
                className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTrip.status === 'arrived'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                    : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                }`}
              >
                <span>Arrived at Terminal</span>
                <span className="text-[10px] font-normal opacity-80">Trip completed</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-teal-800 uppercase block">
                Passengers Booked
              </span>
              <span className="text-xl font-black text-teal-950">
                {totalPassengers} / {activeTrip.seatCapacity}
              </span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase block">
                Boarded
              </span>
              <span className="text-xl font-black text-emerald-950">
                {boardedCount} <span className="text-xs font-normal text-slate-500">passengers</span>
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-amber-800 uppercase block">
                Cash to Collect
              </span>
              <span className="text-xl font-black text-amber-950">
                ₱{cashPendingTotal} PHP
              </span>
            </div>

            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">
                Cash Remitted
              </span>
              <span className="text-xl font-black text-slate-900">
                ₱{cashCollectedTotal} PHP
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Passenger Manifest Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-700" />
              <span>{t.passengerManifest}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark passengers as checked in, boarded, or no-show. Collect cash fares for unpaid reservations.
            </p>
          </div>

          <div className="text-xs font-mono font-semibold text-teal-900 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
            {manifestItems.length} Manifest Entries
          </div>
        </div>

        {manifestItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
            No passengers booked on this departure yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Seat</th>
                  <th className="py-3 px-3">Passenger & ID</th>
                  <th className="py-3 px-3">Pickup Landmark</th>
                  <th className="py-3 px-3">Drop-off Point</th>
                  <th className="py-3 px-3">Fare & Payment</th>
                  <th className="py-3 px-3">Boarding Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manifestItems.map((item, idx) => {
                  const isPaid = item.paymentStatus === 'paid';
                  const isCash = item.paymentMethod === 'cash';

                  return (
                    <tr
                      key={`${item.bookingId}-${item.seatId}`}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.boardingStatus === 'boarded' ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Seat */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-xs bg-slate-100 text-slate-900 px-2 py-1 rounded-lg border border-slate-200">
                          {item.seatLabel}
                        </span>
                      </td>

                      {/* Passenger */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 text-sm">{item.fullName}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <a
                            href={`tel:${item.contactPhone}`}
                            className="text-teal-700 hover:underline flex items-center gap-1 font-medium"
                          >
                            <Phone className="w-3 h-3" />
                            {item.contactPhone}
                          </a>
                          {item.passengerType !== 'regular' && (
                            <span className="font-semibold text-amber-700">
                              · {item.passengerType.toUpperCase()}{' '}
                              {item.idNumber ? `(${item.idNumber})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pickup */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {getStopName(item.pickupStopId)}
                        </div>
                        {item.pickupSpecifics && (
                          <div className="text-[11px] text-slate-500 italic">
                            {item.pickupSpecifics}
                          </div>
                        )}
                      </td>

                      {/* Drop-off */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">
                          {getStopName(item.dropoffStopId)}
                        </div>
                        {item.dropoffSpecifics && (
                          <div className="text-[11px] text-slate-500 italic">
                            {item.dropoffSpecifics}
                          </div>
                        )}
                      </td>

                      {/* Fare & Payment */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-slate-900">₱{item.fare}</div>
                        {isPaid ? (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            PAID ({item.paymentMethod.toUpperCase()})
                          </span>
                        ) : (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                              CASH TO COLLECT
                            </span>
                            <button
                              onClick={() =>
                                handleToggleCash(item.bookingId, !!item.cashCollectedByDriver)
                              }
                              className={`text-[10px] px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                item.cashCollectedByDriver
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                              }`}
                            >
                              {item.cashCollectedByDriver ? 'Collected' : 'Collect ₱' + item.fare}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Boarding Status Switcher */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            onClick={() =>
                              handleUpdateBoarding(item.bookingId, item.seatId, 'boarded')
                            }
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                              item.boardingStatus === 'boarded'
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-emerald-100 text-slate-600'
                            }`}
                          >
                            Boarded
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateBoarding(item.bookingId, item.seatId, 'checked_in')
                            }
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                              item.boardingStatus === 'checked_in'
                                ? 'bg-sky-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-sky-100 text-slate-600'
                            }`}
                          >
                            Check-in
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateBoarding(item.bookingId, item.seatId, 'no_show')
                            }
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                              item.boardingStatus === 'no_show'
                                ? 'bg-rose-700 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-rose-100 text-slate-600'
                            }`}
                          >
                            No-Show
                          </button>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <a
                          href={`tel:${item.contactPhone}`}
                          className="inline-flex items-center gap-1 text-[11px] text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg font-bold transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Driver Emergency & Dispatch Contact Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Emergency Hotlines & Central Dispatch</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Southern Palawan Highway Patrol & Emergency Response
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-slate-800 px-3.5 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px]">BTR Central Dispatch</span>
            <span className="font-bold font-mono text-teal-300">0917-888-2878</span>
          </div>
          <div className="bg-slate-800 px-3.5 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px]">Palawan Rescue (PDRRMO)</span>
            <span className="font-bold font-mono text-rose-300">0917-578-2328</span>
          </div>
          <div className="bg-slate-800 px-3.5 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px]">PNP Bataraza Station</span>
            <span className="font-bold font-mono text-amber-300">0998-598-5819</span>
          </div>
        </div>
      </div>
    </div>
  );
};
