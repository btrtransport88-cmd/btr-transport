import React, { useState } from 'react';
import { Booking, Driver, Language, RouteStop, Trip, Vehicle } from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { cancelBooking } from '../../utils/storage';
import {
  Ticket,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface MyBookingsViewProps {
  bookings: Booking[];
  trips: Trip[];
  stops: RouteStop[];
  vehicles: Vehicle[];
  drivers: Driver[];
  language: Language;
  onOpenTicket: (booking: Booking) => void;
  onBookNew: () => void;
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  bookings,
  trips,
  stops,
  vehicles,
  drivers,
  language,
  onOpenTicket,
  onBookNew,
}) => {
  const t = DICTIONARY[language];
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('active');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Change of travel plans');
  const [cancelResult, setCancelResult] = useState<{
    success: boolean;
    refundAmount: number;
  } | null>(null);

  const getStopName = (id: string) => stops.find((s) => s.id === id)?.name || id;

  const activeBookings = bookings.filter((b) => b.bookingStatus === 'confirmed');
  const pastBookings = bookings.filter((b) => b.bookingStatus !== 'confirmed');

  const displayed =
    filter === 'active'
      ? activeBookings
      : filter === 'past'
      ? pastBookings
      : bookings;

  const handleConfirmCancel = () => {
    if (!cancellingBooking) return;
    const res = cancelBooking(cancellingBooking.id, cancelReason);
    setCancelResult(res);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{t.myBookingsTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your Palawan shuttle tickets, view QR codes, or cancel reservations.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'active'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.activeTrips} ({activeBookings.length})
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'past'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.pastTrips} ({pastBookings.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({bookings.length})
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {displayed.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-3 stroke-1" />
          <h3 className="font-bold text-base text-slate-700">{t.noBookingsFound}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You don't have any bookings in this view. Check scheduled trips between Buliluyan and Puerto Princesa.
          </p>
          <button
            onClick={onBookNew}
            className="mt-4 px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>{t.searchTrips}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((b) => {
            const trip = trips.find((t) => t.id === b.tripId);
            const pickup = stops.find((s) => s.id === b.pickupStopId);
            const dropoff = stops.find((s) => s.id === b.dropoffStopId);
            const isConfirmed = b.bookingStatus === 'confirmed';

            return (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-md space-y-4"
              >
                {/* Card Top */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-teal-950">
                      {b.bookingReference}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Booked {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConfirmed ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Confirmed · {b.paymentStatus === 'paid' ? 'Paid' : 'Cash on Pickup'}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        Cancelled {b.refundAmount ? `· Refunded ₱${b.refundAmount}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Middle: Route & Times */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-8 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <span>{getStopName(b.pickupStopId)}</span>
                      <ArrowRight className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{getStopName(b.dropoffStopId)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {trip?.travelDate || 'Scheduled date'}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-teal-800">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        {trip?.departureTime || '06:00'} PST
                      </span>
                      <span className="text-slate-500">
                        Seats: {b.passengers.map((p) => p.seatLabel).join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="sm:col-span-4 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    <span className="font-extrabold text-base text-slate-900 sm:text-right">
                      ₱{b.finalAmount} PHP
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenTicket(b)}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{t.viewTicket}</span>
                      </button>

                      {isConfirmed && (
                        <button
                          onClick={() => {
                            setCancellingBooking(b);
                            setCancelResult(null);
                          }}
                          className="px-2.5 py-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation & Refund Policy Modal */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Cancel Reservation</span>
              </div>
              <button
                onClick={() => setCancellingBooking(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {cancelResult ? (
              <div className="space-y-4 text-center py-3">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-base text-slate-900">Reservation Cancelled</h4>
                <p className="text-xs text-slate-600">
                  {cancelResult.refundAmount > 0
                    ? `Per operator policy, a refund of ₱${cancelResult.refundAmount} has been processed back to your payment account.`
                    : 'The reservation has been cancelled. As the departure is within 12 hours, no monetary refund is applicable per policy.'}
                </p>
                <button
                  onClick={() => setCancellingBooking(null)}
                  className="w-full py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to cancel booking{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {cancellingBooking.bookingReference}
                  </span>
                  ? This will immediately release your reserved seats back to other passengers.
                </p>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
                  <span className="font-bold block">Palawan Shuttle Cancellation Rules:</span>
                  <div>• &gt; 24h prior: 100% refund</div>
                  <div>• 12 - 24h prior: 80% refund</div>
                  <div>• &lt; 12h: Non-refundable</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason for Cancellation
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    <option value="Change of travel plans">Change of travel plans</option>
                    <option value="Ferry / Balabac boat rescheduling">Ferry / Balabac boat rescheduling</option>
                    <option value="Booked wrong date or time">Booked wrong date or time</option>
                    <option value="Emergency or personal matters">Emergency or personal matters</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCancellingBooking(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
