/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Booking,
  Driver,
  Language,
  OperatingPolicy,
  RouteStop,
  Trip,
  UserRole,
  Vehicle,
  AppNotification,
} from './types';
import {
  getStoredBookings,
  getStoredDrivers,
  getStoredNotifications,
  getStoredPolicy,
  getStoredStops,
  getStoredTrips,
  getStoredVehicles,
  confirmPendingBooking,
} from './utils/storage';
import { verifyPaymentWithServer } from './utils/paymentApi';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { SearchTrips } from './components/passenger/SearchTrips';
import { SeatSelectionModal } from './components/passenger/SeatSelectionModal';
import { PassengerInfoForm } from './components/passenger/PassengerInfoForm';
import { CheckoutModal } from './components/passenger/CheckoutModal';
import { BookingTicketModal } from './components/passenger/BookingTicketModal';
import { MyBookingsView } from './components/passenger/MyBookingsView';
import { RouteInfoMap } from './components/passenger/RouteInfoMap';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { PrivacyNoticeModal } from './components/common/PrivacyNoticeModal';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { ForgotPasswordModal } from './components/auth/ForgotPasswordModal';
import { AccessDenied403 } from './components/auth/AccessDenied403';
import { DICTIONARY } from './utils/translations';
import { Phone, Shield, Anchor, HeartHandshake, Compass } from 'lucide-react';

function BTRTransportApp() {
  const { user, activeRoleView, switchRoleView, isAuthenticated } = useAuth();

  // Session identifier for concurrent seat holding
  const [sessionId] = useState(() => `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  // State loaded from storage
  const [trips, setTrips] = useState<Trip[]>(getStoredTrips);
  const [bookings, setBookings] = useState<Booking[]>(getStoredBookings);
  const [stops, setStops] = useState<RouteStop[]>(getStoredStops);
  const [vehicles, setVehicles] = useState<Vehicle[]>(getStoredVehicles);
  const [drivers, setDrivers] = useState<Driver[]>(getStoredDrivers);
  const [policy, setPolicy] = useState<OperatingPolicy>(getStoredPolicy);
  const [notifications, setNotifications] = useState<AppNotification[]>(getStoredNotifications);

  // App UI state
  const [language, setLanguage] = useState<Language>('en');
  const [activePassengerView, setActivePassengerView] = useState<'search' | 'my_bookings' | 'route_guide'>('search');

  // Modals
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [viewingTicketBooking, setViewingTicketBooking] = useState<Booking | null>(null);

  // Passenger Booking Flow States
  const [bookingTrip, setBookingTrip] = useState<Trip | null>(null);
  const [bookingPickupStop, setBookingPickupStop] = useState<RouteStop | null>(null);
  const [bookingDropoffStop, setBookingDropoffStop] = useState<RouteStop | null>(null);

  // Step 1: Selected seats
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedSeatLabels, setSelectedSeatLabels] = useState<string[]>([]);

  // Step 2: Passenger form modal
  const [showPassengerForm, setShowPassengerForm] = useState(false);
  const [passengerFormData, setPassengerFormData] = useState<any | null>(null);

  // Step 3: Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);

  // Re-read storage on custom events
  useEffect(() => {
    const handleStorageUpdate = () => {
      setTrips(getStoredTrips());
      setBookings(getStoredBookings());
      setStops(getStoredStops());
      setVehicles(getStoredVehicles());
      setDrivers(getStoredDrivers());
      setPolicy(getStoredPolicy());
      setNotifications(getStoredNotifications());
    };

    window.addEventListener('btr_data_updated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('btr_data_updated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Listen for payment return redirect and verify with server
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentParam = urlParams.get('payment');
    const bookingRef = urlParams.get('ref');
    const paySessionId = urlParams.get('session_id') || urlParams.get('checkout_id');

    if (paymentParam === 'success' && bookingRef) {
      verifyPaymentWithServer(paySessionId || '', bookingRef)
        .then((res) => {
          if (res.verified) {
            const confirmed = confirmPendingBooking(
              bookingRef,
              res.payment?.gatewayTransactionRef || 'PAYMONGO-VERIFIED',
              res.payment?.paidAt
            );
            if (confirmed) {
              setViewingTicketBooking(confirmed);
            }
          }
        })
        .catch((err) => console.error('Verification error:', err));
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Booking Flow Handlers
  const handleStartBooking = (trip: Trip, pickup: RouteStop, dropoff: RouteStop) => {
    setBookingTrip(trip);
    setBookingPickupStop(pickup);
    setBookingDropoffStop(dropoff);
    setSelectedSeatIds([]);
    setSelectedSeatLabels([]);
    setShowPassengerForm(false);
    setShowCheckout(false);
  };

  const handleSeatsChosen = (seatIds: string[], labels: string[]) => {
    setSelectedSeatIds(seatIds);
    setSelectedSeatLabels(labels);
    setShowPassengerForm(true);
  };

  const handlePassengerDataReady = (data: any) => {
    // If logged in, automatically link userId to booking
    const enrichedData = {
      ...data,
      userId: user?.id,
    };
    setPassengerFormData(enrichedData);
    setShowPassengerForm(false);
    setShowCheckout(true);
  };

  const handleBookingCompleted = (confirmedBooking: Booking) => {
    setShowCheckout(false);
    setBookingTrip(null);
    setSelectedSeatIds([]);
    setSelectedSeatLabels([]);
    setPassengerFormData(null);
    setViewingTicketBooking(confirmedBooking);
  };

  const handleSelectBookingFromNotif = (bookingRef: string) => {
    const found = bookings.find((b) => b.bookingReference === bookingRef);
    if (found) {
      setViewingTicketBooking(found);
    } else {
      setActivePassengerView('my_bookings');
    }
  };

  const currentTripForViewing = viewingTicketBooking
    ? trips.find((t) => t.id === viewingTicketBooking.tripId)
    : undefined;
  const currentPickupForViewing = viewingTicketBooking
    ? stops.find((s) => s.id === viewingTicketBooking.pickupStopId)
    : undefined;
  const currentDropoffForViewing = viewingTicketBooking
    ? stops.find((s) => s.id === viewingTicketBooking.dropoffStopId)
    : undefined;
  const currentVehicleForViewing = currentTripForViewing
    ? vehicles.find((v) => v.id === currentTripForViewing.vehicleId)
    : undefined;
  const currentDriverForViewing = currentTripForViewing
    ? drivers.find((d) => d.id === currentTripForViewing.driverId)
    : undefined;

  // Authorization checks for portals
  const isDriverAuthorized = isAuthenticated && (user?.role === 'driver' || user?.role === 'admin');
  const isAdminAuthorized = isAuthenticated && user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-amber-400 selection:text-slate-900">
      {/* Top Universal Header */}
      <Header
        currentRole={activeRoleView}
        onRoleChange={(role) => {
          switchRoleView(role);
          if (role !== 'passenger') {
            setBookingTrip(null);
            setShowPassengerForm(false);
            setShowCheckout(false);
          }
        }}
        language={language}
        onLanguageChange={setLanguage}
        activePassengerView={activePassengerView}
        onPassengerViewChange={setActivePassengerView}
        unreadNotificationsCount={unreadCount}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenPrivacy={() => setShowPrivacy(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {/* PASSENGER ROLE PORTAL */}
        {activeRoleView === 'passenger' && (
          <div>
            {activePassengerView === 'search' && (
              <div className="space-y-10">
                <SearchTrips
                  trips={trips}
                  stops={stops}
                  vehicles={vehicles}
                  drivers={drivers}
                  language={language}
                  onSelectTrip={handleStartBooking}
                />

                {/* Highway Route Map Guide */}
                <RouteInfoMap stops={stops} />
              </div>
            )}

            {activePassengerView === 'my_bookings' && (
              <MyBookingsView
                bookings={bookings}
                trips={trips}
                stops={stops}
                vehicles={vehicles}
                drivers={drivers}
                language={language}
                onOpenTicket={(b) => setViewingTicketBooking(b)}
                onBookNew={() => setActivePassengerView('search')}
              />
            )}

            {activePassengerView === 'route_guide' && (
              <div className="space-y-6">
                <RouteInfoMap stops={stops} />
              </div>
            )}
          </div>
        )}

        {/* DRIVER ROLE PORTAL (Protected by Driver/Admin role) */}
        {activeRoleView === 'driver' && (
          isDriverAuthorized ? (
            <DriverDashboard
              trips={trips}
              bookings={bookings}
              stops={stops}
              vehicles={vehicles}
              drivers={drivers}
              language={language}
            />
          ) : (
            <AccessDenied403
              requiredRole="driver"
              onBackToAllowed={() => switchRoleView('passenger')}
            />
          )
        )}

        {/* ADMIN ROLE PORTAL (Protected by Admin role) */}
        {activeRoleView === 'admin' && (
          isAdminAuthorized ? (
            <AdminDashboard
              trips={trips}
              bookings={bookings}
              stops={stops}
              vehicles={vehicles}
              drivers={drivers}
              policy={policy}
              language={language}
            />
          ) : (
            <AccessDenied403
              requiredRole="admin"
              onBackToAllowed={() => switchRoleView('passenger')}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base">BTR Transport</span>
              <span className="text-[10px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded-full font-bold">
                Palawan
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Official public utility commuter van booking network between Buliluyan Port (Bataraza) and Puerto Princesa Grand Terminal.
            </p>
            <div className="text-[11px] text-teal-400 font-semibold flex items-center gap-1.5 pt-1">
              <Anchor className="w-3.5 h-3.5" />
              <span>Connecting Palawan Mainland to Balabac Island Ferries</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Transit Corridors
            </h4>
            <ul className="space-y-1 text-slate-400 text-xs">
              <li>Buliluyan Port (Balabac Ferry Gate)</li>
              <li>Rio Tuba Commercial Center</li>
              <li>Bataraza Poblacion Terminal</li>
              <li>Brooke's Point & Española</li>
              <li>Narra & Aborlan Junctions</li>
              <li>Puerto Princesa Grand Terminal</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Contact & Emergencies
            </h4>
            <div className="space-y-1 text-xs">
              <div>Dispatch: <span className="text-white font-mono">{policy.contactHotline}</span></div>
              <div>Rescue: <span className="text-amber-300 font-mono">PDRRMO Palawan 0917-578-2328</span></div>
              <div>Police: <span className="text-amber-300 font-mono">PNP Bataraza 0998-598-5819</span></div>
              <div className="pt-1 text-[11px] text-slate-500">
                Philippine Standard Time (Asia/Manila)
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Compliance & Privacy
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              In accordance with LTFRB regulations and the Republic Act No. 10173 (Philippine Data Privacy Act of 2012). Passenger manifest information is used strictly for travel safety and insurance verification.
            </p>
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-amber-400 hover:underline text-xs font-semibold cursor-pointer"
            >
              Read Data Privacy Notice & Terms
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 mt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div>© {new Date().getFullYear()} BTR Transport Palawan. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span>Buliluyan ⇄ Puerto Princesa Shuttle Express</span>
            <span>·</span>
            <span>GCash / Maya / Cash Accepted</span>
          </div>
        </div>
      </footer>

      {/* MODAL 1: Seat Selection Modal */}
      {bookingTrip && bookingPickupStop && bookingDropoffStop && !showPassengerForm && !showCheckout && (
        <SeatSelectionModal
          trip={bookingTrip}
          pickupStop={bookingPickupStop}
          dropoffStop={bookingDropoffStop}
          language={language}
          sessionId={sessionId}
          onClose={() => setBookingTrip(null)}
          onProceed={handleSeatsChosen}
        />
      )}

      {/* MODAL 2: Passenger Info Form Modal */}
      {showPassengerForm && bookingTrip && bookingPickupStop && bookingDropoffStop && (
        <PassengerInfoForm
          trip={bookingTrip}
          pickupStop={bookingPickupStop}
          dropoffStop={bookingDropoffStop}
          selectedSeats={selectedSeatIds.map((id, idx) => ({
            id,
            label: selectedSeatLabels[idx] || `Seat ${id}`,
          }))}
          language={language}
          onBack={() => setShowPassengerForm(false)}
          onProceed={handlePassengerDataReady}
        />
      )}

      {/* MODAL 3: Checkout Modal */}
      {showCheckout && bookingTrip && bookingPickupStop && bookingDropoffStop && passengerFormData && (
        <CheckoutModal
          trip={bookingTrip}
          pickupStop={bookingPickupStop}
          dropoffStop={bookingDropoffStop}
          bookingData={passengerFormData}
          policy={policy}
          language={language}
          onBack={() => {
            setShowCheckout(false);
            setShowPassengerForm(true);
          }}
          onSuccess={handleBookingCompleted}
        />
      )}

      {/* MODAL 4: Booking Ticket & QR Modal */}
      {viewingTicketBooking && (
        <BookingTicketModal
          booking={viewingTicketBooking}
          trip={currentTripForViewing}
          pickupStop={currentPickupForViewing}
          dropoffStop={currentDropoffForViewing}
          vehicle={currentVehicleForViewing}
          driver={currentDriverForViewing}
          language={language}
          onClose={() => setViewingTicketBooking(null)}
          onViewAllBookings={() => {
            setViewingTicketBooking(null);
            setActivePassengerView('my_bookings');
          }}
        />
      )}

      {/* Authentication Modals */}
      <LoginModal />
      <RegisterModal />
      <ForgotPasswordModal />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={showNotifications}
        notifications={notifications}
        onClose={() => setShowNotifications(false)}
        onSelectBooking={handleSelectBookingFromNotif}
      />

      {/* Privacy Notice Modal */}
      <PrivacyNoticeModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BTRTransportApp />
    </AuthProvider>
  );
}
