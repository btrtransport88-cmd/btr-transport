import React, { useState } from 'react';
import { Language, PassengerType, RouteStop, Trip } from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { calculateTripFare } from '../../utils/fareCalculator';
import { ChevronLeft, ChevronRight, User, Phone, Mail, MapPin, Tag, ShieldAlert } from 'lucide-react';

interface PassengerInput {
  seatId: string;
  seatLabel: string;
  fullName: string;
  passengerType: PassengerType;
  idNumber: string;
}

interface PassengerInfoFormProps {
  trip: Trip;
  pickupStop: RouteStop;
  dropoffStop: RouteStop;
  selectedSeats: { id: string; label: string }[];
  language: Language;
  onBack: () => void;
  onProceed: (data: {
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    pickupSpecifics: string;
    dropoffSpecifics: string;
    passengers: PassengerInput[];
  }) => void;
}

export const PassengerInfoForm: React.FC<PassengerInfoFormProps> = ({
  trip,
  pickupStop,
  dropoffStop,
  selectedSeats,
  language,
  onBack,
  onProceed,
}) => {
  const t = DICTIONARY[language];

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [pickupSpecifics, setPickupSpecifics] = useState('');
  const [dropoffSpecifics, setDropoffSpecifics] = useState('');

  const [passengers, setPassengers] = useState<PassengerInput[]>(
    selectedSeats.map((s, idx) => ({
      seatId: s.id,
      seatLabel: s.label,
      fullName: idx === 0 ? '' : '',
      passengerType: 'regular',
      idNumber: '',
    }))
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePassengerChange = (
    index: number,
    field: keyof PassengerInput,
    val: string | PassengerType
  ) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: val };
    setPassengers(updated);
  };

  const handleAutofillFirstPassenger = () => {
    if (contactName && passengers.length > 0 && !passengers[0].fullName) {
      handlePassengerChange(0, 'fullName', contactName);
    }
  };

  const fareResult = calculateTripFare(
    pickupStop,
    dropoffStop,
    trip.direction,
    passengers.map((p) => ({ fullName: p.fullName, passengerType: p.passengerType }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!contactName.trim()) {
      setErrorMsg('Please enter the primary contact name.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.length < 10) {
      setErrorMsg('Please enter a valid Philippine mobile number (e.g. 0917 123 4567).');
      return;
    }

    // Check all passenger names
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.fullName.trim()) {
        setErrorMsg(`Please enter the full legal name for Passenger ${i + 1} (${p.seatLabel}).`);
        return;
      }
      if (
        (p.passengerType === 'senior' || p.passengerType === 'pwd' || p.passengerType === 'student') &&
        !p.idNumber.trim()
      ) {
        setErrorMsg(
          `Please provide the ID number for ${p.fullName} to avail of the 20% statutory discount.`
        );
        return;
      }
    }

    onProceed({
      contactName,
      contactPhone,
      contactEmail,
      pickupSpecifics,
      dropoffSpecifics,
      passengers,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-100">
        {/* Header */}
        <div className="bg-teal-900 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <span className="text-xs text-teal-300 font-medium">Step 2 of 3</span>
            <h3 className="font-bold text-lg">{t.passengerDetails}</h3>
          </div>
          <button
            onClick={onBack}
            className="text-teal-200 hover:text-white text-xs flex items-center gap-1 cursor-pointer bg-teal-800/60 px-3 py-1.5 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t.backToSeats}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Primary Contact */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <User className="w-4 h-4 text-teal-700" />
              <span>{t.primaryContact}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onBlur={handleAutofillFirstPassenger}
                  placeholder="e.g. Maria Theresa Santos"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="0917-123-4567"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address (e-ticket)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="passenger@gmail.com"
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>
            </div>

            {/* Specific Landmark Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-600" />
                  <span>Pickup Spot Detail at {pickupStop.name}:</span>
                </label>
                <input
                  type="text"
                  value={pickupSpecifics}
                  onChange={(e) => setPickupSpecifics(e.target.value)}
                  placeholder="e.g. In front of Petron / San Jose Terminal Gate 3"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-600" />
                  <span>Drop-off Destination at {dropoffStop.name}:</span>
                </label>
                <input
                  type="text"
                  value={dropoffSpecifics}
                  onChange={(e) => setDropoffSpecifics(e.target.value)}
                  placeholder="e.g. Balabac Ferry Gate / PPS Airport Departure"
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>

          {/* Section: Passenger List by Seat */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center justify-between">
              <span>Passenger Manifest by Seat</span>
              <span className="text-xs font-normal text-slate-500">
                {passengers.length} passenger{passengers.length > 1 ? 's' : ''}
              </span>
            </h4>

            {passengers.map((p, idx) => (
              <div
                key={p.seatId}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-900 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-xs text-slate-900">{p.seatLabel}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-800">
                    ₱{fareResult.items[idx]?.finalPassengerFare || fareResult.baseSegmentFare}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Full Legal Name (ID Verified) *
                    </label>
                    <input
                      type="text"
                      required
                      value={p.fullName}
                      onChange={(e) => handlePassengerChange(idx, 'fullName', e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Passenger Category / Discount
                    </label>
                    <select
                      value={p.passengerType}
                      onChange={(e) =>
                        handlePassengerChange(idx, 'passengerType', e.target.value as PassengerType)
                      }
                      className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="regular">Regular Adult</option>
                      <option value="senior">Senior Citizen (20% Off)</option>
                      <option value="student">Student (20% Off)</option>
                      <option value="pwd">Person with Disability - PWD (20% Off)</option>
                      <option value="child">Child / Toddler (50% Off)</option>
                    </select>
                  </div>

                  {p.passengerType !== 'regular' && (
                    <div className="sm:col-span-12 bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-[11px] text-amber-900">
                        <span className="font-semibold">Discount Verification ID:</span> Must present
                        valid OSCA, School, or PWD ID upon boarding.
                      </div>
                      <input
                        type="text"
                        required
                        value={p.idNumber}
                        onChange={(e) => handlePassengerChange(idx, 'idNumber', e.target.value)}
                        placeholder="Enter ID Number (e.g. OSCA-9921)"
                        className="text-xs px-2.5 py-1.5 bg-white border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-60"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Fare Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Base Fare ({passengers.length} passenger(s)):</span>
              <span>₱{fareResult.subtotal}</span>
            </div>
            {fareResult.totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-700 font-medium">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  Statutory Discounts:
                </span>
                <span>-₱{fareResult.totalDiscount}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-bold text-sm text-slate-900">Total Payable:</span>
              <span className="font-extrabold text-xl text-teal-900">₱{fareResult.finalTotal}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
            >
              {t.backToSeats}
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md shadow-teal-900/10 cursor-pointer"
            >
              <span>{t.continueToPayment}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
