import React, { useState, useEffect } from 'react';
import { Trip, RouteStop, Language } from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { calculateTripFare } from '../../utils/fareCalculator';
import { holdSeats, releaseHeldSeats } from '../../utils/storage';
import { X, Clock, Armchair, ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react';

interface SeatSelectionModalProps {
  trip: Trip;
  pickupStop: RouteStop;
  dropoffStop: RouteStop;
  language: Language;
  sessionId: string;
  onClose: () => void;
  onProceed: (selectedSeatIds: string[], selectedSeatLabels: string[]) => void;
}

export const SeatSelectionModal: React.FC<SeatSelectionModalProps> = ({
  trip,
  pickupStop,
  dropoffStop,
  language,
  sessionId,
  onClose,
  onProceed,
}) => {
  const t = DICTIONARY[language];
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600); // 10 minutes

  // Seat hold countdown
  useEffect(() => {
    if (selectedSeats.length === 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Release held seats
          releaseHeldSeats(trip.id, selectedSeats, sessionId);
          setSelectedSeats([]);
          setErrorMsg('Seat hold expired. Please re-select your seats.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedSeats, trip.id, sessionId]);

  // Clean up holds on unmount if user doesn't proceed
  useEffect(() => {
    return () => {
      // Don't release if proceeding
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isSeatBooked = (seatId: string) => trip.bookedSeatIds.includes(seatId);
  const isSeatBlocked = (seatId: string) => trip.blockedSeatIds?.includes(seatId);
  const isSeatHeldByOther = (seatId: string) => {
    const now = Date.now();
    return (trip.heldSeats || []).some(
      (h) => h.seatId === seatId && h.expiresAt > now && h.sessionId !== sessionId
    );
  };

  const getSeatLabel = (seatId: string): string => {
    const num = seatId.replace('seat-', '');
    if (seatId === 'seat-1') return 'Seat 1 (Front)';
    if (seatId === 'seat-2') return 'Seat 2 (Front)';
    return `Seat ${num}`;
  };

  const handleSeatClick = (seatId: string) => {
    if (seatId === 'seat-D') return; // Driver seat
    if (isSeatBooked(seatId) || isSeatBlocked(seatId) || isSeatHeldByOther(seatId)) return;

    setErrorMsg(null);

    if (selectedSeats.includes(seatId)) {
      // Deselect
      const updated = selectedSeats.filter((s) => s !== seatId);
      releaseHeldSeats(trip.id, [seatId], sessionId);
      setSelectedSeats(updated);
      if (updated.length === 0) {
        setSecondsRemaining(600);
      }
    } else {
      // Max 6 seats per booking
      if (selectedSeats.length >= 6) {
        setErrorMsg('You can reserve a maximum of 6 seats per single transaction.');
        return;
      }

      // Try holding
      const res = holdSeats(trip.id, [...selectedSeats, seatId], sessionId, 10);
      if (!res.success) {
        setErrorMsg(res.error || 'Seat could not be held.');
        return;
      }
      setSelectedSeats([...selectedSeats, seatId]);
      setSecondsRemaining(600);
    }
  };

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      setErrorMsg('Please select at least 1 seat to continue.');
      return;
    }
    const labels = selectedSeats.map((s) => getSeatLabel(s));
    onProceed(selectedSeats, labels);
  };

  // Quick price preview
  const fareResult = calculateTripFare(
    pickupStop,
    dropoffStop,
    trip.direction,
    selectedSeats.map((_, i) => ({ fullName: `Passenger ${i + 1}`, passengerType: 'regular' }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
        {/* Header */}
        <div className="bg-teal-900 px-5 py-4 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold bg-teal-800 text-teal-200 px-2 py-0.5 rounded">
                {trip.tripNumber}
              </span>
              <h3 className="font-bold text-base sm:text-lg">{t.seatMapTitle}</h3>
            </div>
            <p className="text-xs text-teal-200 mt-0.5">
              {pickupStop.name} → {dropoffStop.name} · {trip.departureTime} Departure
            </p>
          </div>
          <button
            onClick={() => {
              if (selectedSeats.length > 0) {
                releaseHeldSeats(trip.id, selectedSeats, sessionId);
              }
              onClose();
            }}
            className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hold Countdown Bar */}
        {selectedSeats.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>{t.holdExpiresIn}:</span>
              <span className="font-mono font-bold text-amber-700">{formatTime(secondsRemaining)}</span>
            </div>
            <span className="text-amber-700/80">Seats held exclusively for you</span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[75vh] overflow-y-auto">
          {/* Seat Layout (Vehicle Visualization) */}
          <div className="md:col-span-7 flex flex-col items-center">
            {/* Van Shell */}
            <div className="w-full max-w-[320px] bg-slate-50 border-2 border-slate-300 rounded-3xl p-4 shadow-inner relative">
              {/* Windshield */}
              <div className="w-full h-8 bg-sky-100/80 rounded-t-2xl border border-sky-300/80 mb-4 flex items-center justify-center text-[10px] text-sky-800 font-semibold tracking-wider uppercase">
                Front Windshield
              </div>

              {/* Row 0: Driver & Front Seats */}
              <div className="grid grid-cols-3 gap-2 mb-4 pb-3 border-b border-dashed border-slate-300">
                {/* Driver */}
                <div className="h-12 rounded-xl bg-slate-300 border border-slate-400 flex flex-col items-center justify-center text-[10px] font-semibold text-slate-700 cursor-not-allowed">
                  <Armchair className="w-4 h-4 text-slate-600 mb-0.5" />
                  Driver
                </div>
                {/* Front Middle (Seat 1) */}
                <button
                  type="button"
                  onClick={() => handleSeatClick('seat-1')}
                  disabled={isSeatBooked('seat-1') || isSeatBlocked('seat-1') || isSeatHeldByOther('seat-1')}
                  className={`h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    selectedSeats.includes('seat-1')
                      ? 'bg-teal-700 border-teal-800 text-white shadow-md scale-102'
                      : isSeatBooked('seat-1')
                      ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                      : isSeatHeldByOther('seat-1')
                      ? 'bg-amber-100 border-amber-300 text-amber-700 cursor-not-allowed'
                      : 'bg-white hover:bg-teal-50 border-teal-600/40 text-teal-900 shadow-xs'
                  }`}
                >
                  <span className="text-[10px] font-normal opacity-80">Front</span>
                  Seat 1
                </button>
                {/* Front Window (Seat 2) */}
                <button
                  type="button"
                  onClick={() => handleSeatClick('seat-2')}
                  disabled={isSeatBooked('seat-2') || isSeatBlocked('seat-2') || isSeatHeldByOther('seat-2')}
                  className={`h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    selectedSeats.includes('seat-2')
                      ? 'bg-teal-700 border-teal-800 text-white shadow-md scale-102'
                      : isSeatBooked('seat-2')
                      ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                      : isSeatHeldByOther('seat-2')
                      ? 'bg-amber-100 border-amber-300 text-amber-700 cursor-not-allowed'
                      : 'bg-white hover:bg-teal-50 border-teal-600/40 text-teal-900 shadow-xs'
                  }`}
                >
                  <span className="text-[10px] font-normal opacity-80">Window</span>
                  Seat 2
                </button>
              </div>

              {/* Rows 1, 2, 3 */}
              {[
                { row: 1, seats: ['seat-3', 'seat-4', 'seat-5'], labels: ['Seat 3', 'Seat 4', 'Seat 5 (Aisle)'] },
                { row: 2, seats: ['seat-6', 'seat-7', 'seat-8'], labels: ['Seat 6', 'Seat 7', 'Seat 8 (Aisle)'] },
                { row: 3, seats: ['seat-9', 'seat-10', 'seat-11'], labels: ['Seat 9', 'Seat 10', 'Seat 11 (Aisle)'] },
              ].map((r) => (
                <div key={r.row} className="grid grid-cols-3 gap-2 mb-2.5">
                  {r.seats.map((sId, idx) => {
                    const booked = isSeatBooked(sId);
                    const blocked = isSeatBlocked(sId);
                    const held = isSeatHeldByOther(sId);
                    const isSelected = selectedSeats.includes(sId);

                    return (
                      <button
                        key={sId}
                        type="button"
                        onClick={() => handleSeatClick(sId)}
                        disabled={booked || blocked || held}
                        className={`h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-teal-700 border-teal-800 text-white shadow-md scale-102'
                            : booked
                            ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                            : held
                            ? 'bg-amber-100 border-amber-300 text-amber-700 cursor-not-allowed'
                            : 'bg-white hover:bg-teal-50 border-teal-600/40 text-teal-900 shadow-xs'
                        }`}
                      >
                        <span className="text-[10px] font-normal opacity-75">
                          {idx === 0 ? 'Window' : idx === 1 ? 'Middle' : 'Aisle'}
                        </span>
                        {sId.replace('seat-', 'Seat ')}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Row 4 (Back Row 4-seater) */}
              <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-200">
                {['seat-12', 'seat-13', 'seat-14', 'seat-15'].map((sId) => {
                  const booked = isSeatBooked(sId);
                  const blocked = isSeatBlocked(sId);
                  const held = isSeatHeldByOther(sId);
                  const isSelected = selectedSeats.includes(sId);

                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => handleSeatClick(sId)}
                      disabled={booked || blocked || held}
                      className={`h-11 rounded-lg border flex flex-col items-center justify-center text-[11px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-700 border-teal-800 text-white shadow-md'
                          : booked
                          ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                          : held
                          ? 'bg-amber-100 border-amber-300 text-amber-700 cursor-not-allowed'
                          : 'bg-white hover:bg-teal-50 border-teal-600/40 text-teal-900 shadow-xs'
                      }`}
                    >
                      <span className="text-[9px] font-normal opacity-75">Back</span>
                      {sId.replace('seat-', '#')}
                    </button>
                  );
                })}
              </div>

              {/* Rear Luggage Space */}
              <div className="w-full mt-3 py-1.5 bg-slate-200/80 rounded-xl border border-slate-300 text-center text-[10px] text-slate-600 font-medium">
                Luggage & Cargo Compartment
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-white border border-teal-600/50"></div>
                <span>{t.available}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-teal-700 border border-teal-800"></div>
                <span>{t.selected}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300"></div>
                <span>{t.reserved}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300"></div>
                <span>Held</span>
              </div>
            </div>
          </div>

          {/* Right Summary Column */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-semibold text-sm text-slate-900 mb-2">Trip Specifications</h4>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Route:</span>
                    <span className="font-medium text-slate-900">
                      {trip.direction === 'buliluyan_to_puerto'
                        ? 'Buliluyan → Puerto Princesa'
                        : 'Puerto Princesa → Buliluyan'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span className="font-medium text-slate-900">{trip.travelDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Departure:</span>
                    <span className="font-bold text-teal-800">{trip.departureTime} PST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle:</span>
                    <span className="font-medium text-slate-900">Toyota HiAce (Dual AC)</span>
                  </div>
                </div>
              </div>

              {/* Selected Seats Listing */}
              <div>
                <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-2">
                  {t.selectedSeatsCount} ({selectedSeats.length})
                </h4>
                {selectedSeats.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No seats selected yet. Click on the seats in the diagram.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeats.map((sId) => (
                      <span
                        key={sId}
                        className="text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-900 px-2.5 py-1 rounded-lg"
                      >
                        {getSeatLabel(sId)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Fare Preview */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-baseline text-xs text-slate-700">
                  <span>Fare per Passenger:</span>
                  <span className="font-semibold text-slate-900">₱{fareResult.baseSegmentFare}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs text-slate-700">
                  <span>Number of Passengers:</span>
                  <span className="font-semibold text-slate-900">{selectedSeats.length}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-sm">{t.estimatedTotal}:</span>
                  <span className="font-extrabold text-teal-900 text-lg">₱{fareResult.finalTotal}</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  * 20% discount for Senior Citizens, Students, and PWDs will be applied on the next step.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleContinue}
                disabled={selectedSeats.length === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedSeats.length > 0
                    ? 'bg-teal-800 hover:bg-teal-900 text-white shadow-md shadow-teal-900/10'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{t.proceedToPassengerDetails}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
