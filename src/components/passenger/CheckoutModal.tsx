import React, { useState, useEffect } from 'react';
import {
  Booking,
  Language,
  OperatingPolicy,
  PaymentMethod,
  PaymentStatus,
  RouteStop,
  Trip,
} from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { calculateTripFare } from '../../utils/fareCalculator';
import {
  createBooking,
  confirmPendingBooking,
  cancelPendingBooking,
} from '../../utils/storage';
import {
  fetchPaymentConfig,
  requestCheckoutSession,
  verifyPaymentWithServer,
  PaymentConfigResponse,
} from '../../utils/paymentApi';
import confetti from 'canvas-confetti';
import {
  X,
  CreditCard,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronLeft,
  Smartphone,
  QrCode,
  AlertCircle,
  Loader2,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface PassengerInput {
  seatId: string;
  seatLabel: string;
  fullName: string;
  passengerType: any;
  idNumber: string;
}

interface CheckoutModalProps {
  trip: Trip;
  pickupStop: RouteStop;
  dropoffStop: RouteStop;
  bookingData: {
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    pickupSpecifics: string;
    dropoffSpecifics: string;
    passengers: PassengerInput[];
  };
  policy: OperatingPolicy;
  language: Language;
  onBack: () => void;
  onSuccess: (booking: Booking) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  trip,
  pickupStop,
  dropoffStop,
  bookingData,
  policy,
  language,
  onBack,
  onSuccess,
}) => {
  const t = DICTIONARY[language];

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [agreedPrivacy, setAgreedPrivacy] = useState(true);

  // Gateway config
  const [gatewayConfig, setGatewayConfig] = useState<PaymentConfigResponse | null>(null);

  // Flow step state: 'select' -> 'processing_session' -> 'gateway_checkout' -> 'verifying' -> 'success' | 'failed'
  const [checkoutStep, setCheckoutStep] = useState<
    'select' | 'processing_session' | 'gateway_checkout' | 'verifying' | 'failed'
  >('select');

  // Active session data
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeCheckoutUrl, setActiveCheckoutUrl] = useState<string>('');
  const [currentBookingRef, setCurrentBookingRef] = useState<string>('');
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyingAttempts, setVerifyingAttempts] = useState<number>(0);

  // Fetch gateway configuration on mount
  useEffect(() => {
    fetchPaymentConfig().then((cfg) => {
      setGatewayConfig(cfg);
      setIsSandboxMode(!cfg.hasValidCredentials);
    });
  }, []);

  const fareResult = calculateTripFare(
    pickupStop,
    dropoffStop,
    trip.direction,
    bookingData.passengers.map((p) => ({ fullName: p.fullName, passengerType: p.passengerType })),
    policy.seniorStudentDiscountPercent
  );

  const generateBookingReference = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BTR-${dateStr}-${rand}`;
  };

  /**
   * STEP 1: Initiate Payment
   */
  const handleInitiatePayment = async () => {
    if (!agreedPrivacy) {
      setErrorMessage('You must accept the terms of carriage and data privacy consent.');
      return;
    }

    setErrorMessage(null);
    setCheckoutStep('processing_session');

    const refCode = generateBookingReference();
    setCurrentBookingRef(refCode);

    // If CASH ON DEPARTURE selected
    if (paymentMethod === 'cash') {
      try {
        const passengerDetails = bookingData.passengers.map((p, idx) => ({
          seatId: p.seatId,
          seatLabel: p.seatLabel,
          fullName: p.fullName,
          passengerType: p.passengerType,
          idNumber: p.idNumber,
          fare: fareResult.items[idx]?.finalPassengerFare || fareResult.baseSegmentFare,
          boardingStatus: 'waiting' as const,
        }));

        const newBooking = createBooking({
          bookingReference: refCode,
          tripId: trip.id,
          contactName: bookingData.contactName,
          contactPhone: bookingData.contactPhone,
          contactEmail: bookingData.contactEmail,
          pickupStopId: pickupStop.id,
          pickupSpecifics: bookingData.pickupSpecifics,
          dropoffStopId: dropoffStop.id,
          dropoffSpecifics: bookingData.dropoffSpecifics,
          passengers: passengerDetails,
          totalFare: fareResult.subtotal,
          discountAmount: fareResult.totalDiscount,
          bookingFee: fareResult.bookingFee,
          finalAmount: fareResult.finalTotal,
          paymentMethod: 'cash',
          paymentStatus: 'pending_cash',
          paymentReference: `CASH-RESERVE-${Date.now().toString().slice(-6)}`,
          paymentGateway: 'cash',
          bookingStatus: 'confirmed',
          qrPayload: `${refCode}|${trip.tripNumber}|${bookingData.contactName}|CASH|₱${fareResult.finalTotal}`,
          cashCollectedByDriver: false,
        });

        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#0F4C5C', '#00A896', '#F4A261'],
          });
        } catch {}

        onSuccess(newBooking);
      } catch (err: any) {
        setCheckoutStep('failed');
        setErrorMessage(err.message || 'Failed to create cash reservation.');
      }
      return;
    }

    // ONLINE PAYMENT GATEWAY (PayMongo: GCash, Maya, Cards, etc.)
    try {
      // 1. Create a pending booking locally to hold seats while paying
      const passengerDetails = bookingData.passengers.map((p, idx) => ({
        seatId: p.seatId,
        seatLabel: p.seatLabel,
        fullName: p.fullName,
        passengerType: p.passengerType,
        idNumber: p.idNumber,
        fare: fareResult.items[idx]?.finalPassengerFare || fareResult.baseSegmentFare,
        boardingStatus: 'waiting' as const,
      }));

      createBooking({
        bookingReference: refCode,
        tripId: trip.id,
        contactName: bookingData.contactName,
        contactPhone: bookingData.contactPhone,
        contactEmail: bookingData.contactEmail,
        pickupStopId: pickupStop.id,
        pickupSpecifics: bookingData.pickupSpecifics,
        dropoffStopId: dropoffStop.id,
        dropoffSpecifics: bookingData.dropoffSpecifics,
        passengers: passengerDetails,
        totalFare: fareResult.subtotal,
        discountAmount: fareResult.totalDiscount,
        bookingFee: fareResult.bookingFee,
        finalAmount: fareResult.finalTotal,
        paymentMethod,
        paymentStatus: 'pending',
        paymentGateway: 'paymongo',
        bookingStatus: 'pending',
        qrPayload: `${refCode}|${trip.tripNumber}|${bookingData.contactName}|PENDING|₱${fareResult.finalTotal}`,
      });

      // 2. Request PayMongo checkout session from backend
      const checkoutResult = await requestCheckoutSession({
        tripId: trip.id,
        bookingReference: refCode,
        contactName: bookingData.contactName,
        contactPhone: bookingData.contactPhone,
        contactEmail: bookingData.contactEmail,
        pickupStopName: pickupStop.name,
        dropoffStopName: dropoffStop.name,
        seats: bookingData.passengers.map((p) => p.seatLabel),
        finalAmount: fareResult.finalTotal,
        paymentMethod,
      });

      setActiveSessionId(checkoutResult.sessionId);
      setActiveCheckoutUrl(checkoutResult.checkoutUrl);
      setIsSandboxMode(Boolean(checkoutResult.isSandboxFallback));
      setCheckoutStep('gateway_checkout');
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutStep('failed');
      setErrorMessage(err.message || 'Payment initiation failed. Please try again.');
    }
  };

  /**
   * STEP 2: Verify Payment Status with Server
   */
  const handleVerifyPayment = async () => {
    if (!activeSessionId && !currentBookingRef) return;

    setCheckoutStep('verifying');
    setErrorMessage(null);

    try {
      const verifyRes = await verifyPaymentWithServer(activeSessionId, currentBookingRef);

      if (verifyRes.verified && verifyRes.status === 'paid') {
        const confirmed = confirmPendingBooking(
          currentBookingRef,
          verifyRes.payment?.gatewayTransactionRef || `PAYMONGO-REF-${Date.now().toString().slice(-8)}`,
          verifyRes.payment?.paidAt
        );

        if (confirmed) {
          try {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#0F4C5C', '#00A896', '#F4A261', '#E76F51'],
            });
          } catch {}

          onSuccess(confirmed);
        } else {
          setCheckoutStep('failed');
          setErrorMessage('Booking confirmation update failed.');
        }
      } else if (verifyRes.status === 'expired' || verifyRes.status === 'failed') {
        cancelPendingBooking(currentBookingRef, 'Payment session expired or rejected');
        setCheckoutStep('failed');
        setErrorMessage('The payment gateway marked this transaction as expired or unsuccessful.');
      } else {
        // Still pending authorization
        setCheckoutStep('gateway_checkout');
        setVerifyingAttempts((v) => v + 1);
        setErrorMessage(
          'Payment not yet verified by PayMongo. Please complete authorization in the gateway or retry verification in a moment.'
        );
      }
    } catch (err: any) {
      setCheckoutStep('gateway_checkout');
      setErrorMessage(err.message || 'Server verification check failed. Please retry.');
    }
  };

  /**
   * Cancel pending checkout
   */
  const handleCancelPending = () => {
    if (currentBookingRef) {
      cancelPendingBooking(currentBookingRef, 'User cancelled checkout');
    }
    setCheckoutStep('select');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100">
        {/* Header */}
        <div className="bg-teal-900 px-6 py-4 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-teal-300 font-medium">Final Step 3 of 3</span>
              <span className="text-[10px] bg-teal-800 text-teal-200 border border-teal-700 font-mono px-2 py-0.5 rounded">
                PayMongo Gateway
              </span>
            </div>
            <h3 className="font-bold text-lg">{t.paymentTitle}</h3>
          </div>
          {checkoutStep === 'select' && (
            <button
              onClick={onBack}
              className="text-teal-200 hover:text-white text-xs flex items-center gap-1 cursor-pointer bg-teal-800/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6 max-h-[78vh] overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* STEP: SELECT PAYMENT METHOD & REVIEW */}
          {checkoutStep === 'select' && (
            <div className="space-y-5">
              {/* Fare Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Trip Details & Fares
                </h4>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>Trip / Vehicle:</span>
                    <span className="font-semibold text-slate-900">
                      {trip.tripNumber} · Toyota HiAce Commuter
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Route Segment:</span>
                    <span className="font-semibold text-teal-900">
                      {pickupStop.name} → {dropoffStop.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Departure:</span>
                    <span className="font-semibold text-slate-900">
                      {trip.travelDate} at {trip.departureTime} PST
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Passengers ({bookingData.passengers.length}):</span>
                    <span className="font-medium text-slate-900">
                      {bookingData.passengers.map((p) => p.seatLabel).join(', ')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Base Segment Total:</span>
                      <span>₱{fareResult.subtotal}</span>
                    </div>
                    {fareResult.totalDiscount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-semibold">
                        <span>Statutory Discounts:</span>
                        <span>-₱{fareResult.totalDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Gateway & Terminal Fees:</span>
                      <span className="text-emerald-700 font-medium">Free (₱0)</span>
                    </div>
                    <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline font-bold">
                      <span className="text-sm text-slate-900">Total Payable:</span>
                      <span className="text-xl text-teal-900 font-extrabold">
                        ₱{fareResult.finalTotal} PHP
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* GCash */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('gcash')}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'gcash'
                        ? 'border-blue-600 bg-blue-50/90 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                      G
                    </div>
                    <span className="text-xs font-bold">GCash</span>
                  </button>

                  {/* Maya */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('maya')}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'maya'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      M
                    </div>
                    <span className="text-xs font-bold">Maya</span>
                  </button>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-purple-600 bg-purple-50/90 text-purple-900 ring-2 ring-purple-500/20 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <CreditCard className="w-8 h-8 text-purple-700 p-1" />
                    <span className="text-xs font-bold">Debit/Card</span>
                  </button>

                  {/* Cash */}
                  {policy.allowCashPayments && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-amber-600 bg-amber-50/90 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Banknote className="w-8 h-8 text-amber-700 p-1" />
                      <span className="text-xs font-bold">Cash</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Method Information Details */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                {paymentMethod !== 'cash' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-slate-900">
                        PayMongo Official Checkout Session
                      </span>
                      <span className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-mono font-bold">
                        ₱{fareResult.finalTotal} PHP
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      You will be directed to PayMongo's PCI-DSS Level 1 certified checkout portal to authorize your{' '}
                      <strong>{paymentMethod.toUpperCase()}</strong> payment securely.
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-teal-800">
                      <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>
                        Protected with server-side validation and automated webhook verification.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="font-bold text-amber-900">Cash on Departure Terms</span>
                    <p className="text-amber-900/90 leading-relaxed text-[11px]">
                      Your seats will be held. You must arrive at the BTR ticket booth or pickup point{' '}
                      <strong>at least 30 minutes before departure ({trip.departureTime})</strong> to remit ₱
                      {fareResult.finalTotal} in cash and receive your physical boarding slip.
                    </p>
                  </div>
                )}
              </div>

              {/* Privacy Consent Checkbox */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="privacyConsent"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-800 focus:ring-teal-700 cursor-pointer"
                />
                <label htmlFor="privacyConsent" className="text-[11px] text-slate-600 leading-normal cursor-pointer">
                  I agree to the BTR Transport terms of carriage, cancellation policy, and consent to passenger data handling under the Philippine Data Privacy Act of 2012 (RA 10173).
                </label>
              </div>

              {/* Initiate Button */}
              <button
                type="button"
                onClick={handleInitiatePayment}
                className="w-full py-3.5 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20 cursor-pointer transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {paymentMethod === 'cash'
                    ? 'Confirm Cash Reservation'
                    : `Proceed to PayMongo Checkout (₱${fareResult.finalTotal})`}
                </span>
              </button>
            </div>
          )}

          {/* STEP: PROCESSING SESSION */}
          {checkoutStep === 'processing_session' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-teal-700 animate-spin mx-auto" />
              <h4 className="font-bold text-base text-slate-900">
                Generating Secure PayMongo Session...
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Validating seat reservation and contacting PayMongo API to prepare your checkout.
              </p>
            </div>
          )}

          {/* STEP: GATEWAY CHECKOUT ACTIVE */}
          {checkoutStep === 'gateway_checkout' && (
            <div className="space-y-5">
              <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-teal-600 animate-ping" />
                    <span className="font-bold text-sm text-teal-950">
                      Checkout Session Ready
                    </span>
                  </div>
                  <span className="font-mono text-xs text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                    Ref: {currentBookingRef}
                  </span>
                </div>

                <p className="text-xs text-teal-900 leading-relaxed">
                  Your seat reservation is held for 10 minutes. Click the button below to complete your payment with{' '}
                  <strong className="text-teal-950">{paymentMethod.toUpperCase()}</strong>.
                </p>

                {/* Gateway session info */}
                <div className="text-[11px] font-mono text-slate-600 bg-white/80 p-2.5 rounded-xl border border-teal-100 flex flex-col sm:flex-row justify-between gap-1">
                  <span>PayMongo Session: {activeSessionId}</span>
                  <span className="font-bold text-teal-900">Amount: ₱{fareResult.finalTotal} PHP</span>
                </div>
              </div>

              {/* Action: Open PayMongo Checkout */}
              <div className="space-y-3">
                <a
                  href={activeCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer text-center"
                >
                  <span>Open PayMongo Payment Portal</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Verification Action */}
                <button
                  type="button"
                  onClick={handleVerifyPayment}
                  className="w-full py-3.5 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>I've Completed Payment · Verify Status</span>
                </button>

                <div className="pt-2 flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={handleCancelPending}
                    className="text-slate-400 hover:text-red-700 font-medium cursor-pointer"
                  >
                    Cancel checkout & release seats
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Auto-webhook verification enabled
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP: VERIFYING PAYMENT WITH GATEWAY */}
          {checkoutStep === 'verifying' && (
            <div className="py-10 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-teal-800 animate-spin mx-auto" />
              <h4 className="font-bold text-base text-slate-900">
                Verifying Payment with PayMongo...
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Contacting payment gateway servers to confirm authorized receipt for{' '}
                <span className="font-mono font-bold text-slate-800">{currentBookingRef}</span>.
              </p>
            </div>
          )}

          {/* STEP: PAYMENT FAILED OR RETRY */}
          {checkoutStep === 'failed' && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-base text-slate-900">Payment Authorization Failed</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                {errorMessage ||
                  'The transaction could not be verified or was cancelled. Your card or e-wallet was not charged.'}
              </p>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelPending}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Back to Payment Options
                </button>
                <button
                  type="button"
                  onClick={handleInitiatePayment}
                  className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Payment</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
