import React, { useEffect, useState } from 'react';
import { Booking, Driver, Language, RouteStop, Trip, Vehicle } from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { generateQRCodeDataUrl } from '../../utils/qrGenerator';
import {
  X,
  Printer,
  Download,
  Share2,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  Phone,
  Bus,
} from 'lucide-react';

interface BookingTicketModalProps {
  booking: Booking;
  trip?: Trip;
  pickupStop?: RouteStop;
  dropoffStop?: RouteStop;
  vehicle?: Vehicle;
  driver?: Driver;
  language: Language;
  onClose: () => void;
  onViewAllBookings?: () => void;
}

export const BookingTicketModal: React.FC<BookingTicketModalProps> = ({
  booking,
  trip,
  pickupStop,
  dropoffStop,
  vehicle,
  driver,
  language,
  onClose,
  onViewAllBookings,
}) => {
  const t = DICTIONARY[language];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    generateQRCodeDataUrl(booking.qrPayload).then((url) => {
      if (isMounted) setQrDataUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [booking.qrPayload]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `BTR Shuttle Ticket - ${booking.bookingReference}`,
          text: `BTR Shuttle Booking ${booking.bookingReference} for ${booking.contactName}. Route: ${pickupStop?.name} to ${dropoffStop?.name}.`,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `BTR Transport Ticket ${booking.bookingReference} | Date: ${trip?.travelDate || 'Today'} | Departure: ${trip?.departureTime || 'Scheduled'} | Pickup: ${pickupStop?.name} | Seats: ${booking.passengers.map((p) => p.seatLabel).join(', ')}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Ticket Header */}
        <div className="bg-teal-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-800 border border-teal-700 flex items-center justify-center shadow-inner">
              <Bus className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-wide">BTR Transport</span>
                <span className="text-[10px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded-full font-medium">
                  Palawan Express
                </span>
              </div>
              <p className="text-xs text-teal-200">{t.eTicketTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Ticket Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto space-y-5 print:p-0 print:max-h-none">
          {/* Status & Reference Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {t.bookingReference}
              </span>
              <span className="text-lg font-black font-mono text-teal-950 tracking-wider">
                {booking.bookingReference}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {booking.paymentStatus === 'paid' ? (
                <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>PAID · {booking.paymentMethod.toUpperCase()}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 font-bold text-xs px-3 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  <span>CASH ON DEPARTURE</span>
                </div>
              )}
            </div>
          </div>

          {/* QR Code and Boarding Instructions */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-teal-50/50 border border-teal-100 rounded-2xl">
            <div className="shrink-0 bg-white p-2.5 rounded-xl border border-teal-200 shadow-xs flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Boarding QR Code"
                  className="w-32 h-32 object-contain"
                />
              ) : (
                <div className="w-32 h-32 bg-slate-100 animate-pulse rounded-lg" />
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 text-center sm:text-left">
              <h4 className="font-bold text-sm text-slate-900">Boarding Pass & Manifest QR</h4>
              <p className="text-slate-600 leading-relaxed">
                {t.qrInstructions}
              </p>
              <div className="pt-1 text-[11px] text-teal-800 font-medium">
                Passengers: {booking.passengers.length} · Seats:{' '}
                {booking.passengers.map((p) => p.seatLabel).join(', ')}
              </div>
            </div>
          </div>

          {/* Route & Schedule Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t.travelDetails}
            </h4>
            <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">PICKUP POINT</span>
                    <span className="text-xs font-bold text-teal-900">
                      {trip?.departureTime || '06:00'} PST
                    </span>
                  </div>
                  <p className="font-bold text-sm text-slate-900">{pickupStop?.name}</p>
                  {booking.pickupSpecifics && (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      Note: {booking.pickupSpecifics}
                    </p>
                  )}
                </div>
              </div>

              <div className="ml-3 pl-3 border-l-2 border-dashed border-teal-300 py-1 text-xs text-slate-500">
                Scenic South Palawan Highway Route (~5.5 hours)
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">DROP-OFF POINT</span>
                    <span className="text-xs font-bold text-amber-900">
                      {trip?.estimatedArrivalTime || '11:30'} PST (Est.)
                    </span>
                  </div>
                  <p className="font-bold text-sm text-slate-900">{dropoffStop?.name}</p>
                  {booking.dropoffSpecifics && (
                    <p className="text-xs text-slate-500 italic mt-0.5">
                      Note: {booking.dropoffSpecifics}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Passenger Roster */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Manifest Passenger Details
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {booking.passengers.map((p, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between bg-white">
                  <div>
                    <span className="font-bold text-slate-900">{p.fullName}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      <span>{p.seatLabel}</span>
                      {p.passengerType !== 'regular' && (
                        <span className="ml-2 font-medium text-amber-700">
                          ({p.passengerType.toUpperCase()}{' '}
                          {p.idNumber ? `ID: ${p.idNumber}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-teal-900">₱{p.fare}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Driver & Shuttle Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Assigned Shuttle Vehicle:</span>
              <span className="font-bold text-slate-900">
                {vehicle?.model || 'Toyota HiAce Commuter'} (Plate: {vehicle?.plateNumber || 'VAR 8920'})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Driver & Contact:</span>
              <span className="font-bold text-teal-800 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {driver ? `${driver.name} (${driver.phone})` : 'Assigned at Terminal Dispatch'}
              </span>
            </div>
          </div>

          {/* Cash Notice if applicable */}
          {booking.paymentStatus === 'pending_cash' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Cash Payment Reminder:</strong> Please present this ticket at the BTR
                Terminal Counter or directly to your driver 30 minutes before departure. Exact amount:{' '}
                <strong>₱{booking.finalAmount}</strong>.
              </div>
            </div>
          )}

          {/* Financial Totals */}
          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline text-xs text-slate-600">
            <span>Total Fare Paid/Due:</span>
            <span className="text-lg font-extrabold text-teal-950">₱{booking.finalAmount} PHP</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>{t.printTicket}</span>
            </button>
            <button
              onClick={handleShare}
              className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Share2 className="w-4 h-4 text-slate-500" />
              <span>{copied ? 'Copied Link!' : t.shareTicket}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onViewAllBookings && (
              <button
                onClick={() => {
                  onClose();
                  onViewAllBookings();
                }}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                {t.viewMyBookings}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
