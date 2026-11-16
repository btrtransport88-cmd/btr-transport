import {
  Booking,
  Driver,
  OperatingPolicy,
  RouteStop,
  Trip,
  Vehicle,
  AppNotification,
  BoardingStatus,
  TripStatus,
} from '../types';
import {
  INITIAL_BOOKINGS,
  INITIAL_DRIVERS,
  INITIAL_POLICY,
  INITIAL_STOPS,
  INITIAL_TRIPS,
  INITIAL_VEHICLES,
  SAMPLE_PALAWAN_DRIVERS,
} from '../data/mockInitialData';

const KEYS = {
  TRIPS: 'btr_trips_v1',
  BOOKINGS: 'btr_bookings_v1',
  VEHICLES: 'btr_vehicles_v1',
  DRIVERS: 'btr_drivers_v2',
  STOPS: 'btr_stops_v1',
  POLICY: 'btr_policy_v1',
  NOTIFICATIONS: 'btr_notifications_v1',
};

// Dispatch local event for reactive updates across tabs/components
export const notifyDataChanged = () => {
  window.dispatchEvent(new Event('btr_data_updated'));
};

export const getStoredStops = (): RouteStop[] => {
  try {
    const raw = localStorage.getItem(KEYS.STOPS);
    return raw ? JSON.parse(raw) : INITIAL_STOPS;
  } catch {
    return INITIAL_STOPS;
  }
};

export const saveStops = (stops: RouteStop[]) => {
  localStorage.setItem(KEYS.STOPS, JSON.stringify(stops));
  notifyDataChanged();
};

export const getStoredVehicles = (): Vehicle[] => {
  try {
    const raw = localStorage.getItem(KEYS.VEHICLES);
    return raw ? JSON.parse(raw) : INITIAL_VEHICLES;
  } catch {
    return INITIAL_VEHICLES;
  }
};

export const saveVehicles = (vehicles: Vehicle[]) => {
  localStorage.setItem(KEYS.VEHICLES, JSON.stringify(vehicles));
  notifyDataChanged();
};

export const getStoredDrivers = (): Driver[] => {
  try {
    // Legacy cache cleanup
    if (typeof localStorage !== 'undefined' && localStorage.getItem('btr_drivers_v1')) {
      localStorage.removeItem('btr_drivers_v1');
    }
    const raw = localStorage.getItem(KEYS.DRIVERS);
    return raw ? JSON.parse(raw) : INITIAL_DRIVERS;
  } catch {
    return INITIAL_DRIVERS;
  }
};

export const saveDrivers = (drivers: Driver[]) => {
  localStorage.setItem(KEYS.DRIVERS, JSON.stringify(drivers));
  notifyDataChanged();
};

export const deleteDriver = (driverId: string) => {
  const current = getStoredDrivers();
  const filtered = current.filter((d) => d.id !== driverId);
  saveDrivers(filtered);
  // Unassign from any trips
  try {
    const rawTrips = localStorage.getItem(KEYS.TRIPS);
    if (rawTrips) {
      const trips: Trip[] = JSON.parse(rawTrips);
      const updatedTrips = trips.map((t) =>
        t.driverId === driverId ? { ...t, driverId: undefined } : t
      );
      localStorage.setItem(KEYS.TRIPS, JSON.stringify(updatedTrips));
    }
  } catch (err) {
    console.warn('Failed to unassign driver from trips:', err);
  }
  notifyDataChanged();
};

export const clearAllDrivers = () => {
  saveDrivers([]);
  try {
    const rawTrips = localStorage.getItem(KEYS.TRIPS);
    if (rawTrips) {
      const trips: Trip[] = JSON.parse(rawTrips);
      const updatedTrips = trips.map((t) => ({ ...t, driverId: undefined }));
      localStorage.setItem(KEYS.TRIPS, JSON.stringify(updatedTrips));
    }
  } catch (err) {
    console.warn('Failed to unassign all trips:', err);
  }
  notifyDataChanged();
};

export const restoreSampleDrivers = () => {
  saveDrivers(SAMPLE_PALAWAN_DRIVERS.map((d) => ({ ...d, verificationStatus: 'verified' })));
  notifyDataChanged();
};

export const verifyDriver = (driverId: string) => {
  const current = getStoredDrivers();
  const updated = current.map((d) =>
    d.id === driverId ? { ...d, verificationStatus: 'verified' as const } : d
  );
  saveDrivers(updated);
  notifyDataChanged();
};

export const rejectDriver = (driverId: string) => {
  const current = getStoredDrivers();
  const updated = current.map((d) =>
    d.id === driverId ? { ...d, verificationStatus: 'rejected' as const } : d
  );
  saveDrivers(updated);
  notifyDataChanged();
};

export const getStoredPolicy = (): OperatingPolicy => {
  try {
    const raw = localStorage.getItem(KEYS.POLICY);
    return raw ? JSON.parse(raw) : INITIAL_POLICY;
  } catch {
    return INITIAL_POLICY;
  }
};

export const savePolicy = (policy: OperatingPolicy) => {
  localStorage.setItem(KEYS.POLICY, JSON.stringify(policy));
  notifyDataChanged();
};

// Clean expired seat holds
const cleanExpiredHolds = (trips: Trip[]): Trip[] => {
  const now = Date.now();
  let changed = false;
  const updated = trips.map((trip) => {
    if (!trip.heldSeats || trip.heldSeats.length === 0) return trip;
    const remaining = trip.heldSeats.filter((h) => h.expiresAt > now);
    if (remaining.length !== trip.heldSeats.length) {
      changed = true;
      return { ...trip, heldSeats: remaining };
    }
    return trip;
  });
  if (changed) {
    try {
      localStorage.setItem(KEYS.TRIPS, JSON.stringify(updated));
    } catch {}
  }
  return updated;
};

export const getStoredTrips = (): Trip[] => {
  try {
    const raw = localStorage.getItem(KEYS.TRIPS);
    const trips: Trip[] = raw ? JSON.parse(raw) : INITIAL_TRIPS;
    const currentDrivers = getStoredDrivers();
    const validated = trips.map((t) => {
      if (t.driverId && !currentDrivers.some((d) => d.id === t.driverId)) {
        return { ...t, driverId: undefined };
      }
      return t;
    });
    return cleanExpiredHolds(validated);
  } catch {
    return INITIAL_TRIPS;
  }
};

export const saveTrips = (trips: Trip[]) => {
  localStorage.setItem(KEYS.TRIPS, JSON.stringify(trips));
  notifyDataChanged();
};

export const getStoredBookings = (): Booking[] => {
  try {
    const raw = localStorage.getItem(KEYS.BOOKINGS);
    return raw ? JSON.parse(raw) : INITIAL_BOOKINGS;
  } catch {
    return INITIAL_BOOKINGS;
  }
};

export const saveBookings = (bookings: Booking[]) => {
  localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(bookings));
  notifyDataChanged();
};

export const getStoredNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
    if (!raw) {
      const initial: AppNotification[] = [
        {
          id: 'notif-1',
          title: 'Welcome to BTR Transport!',
          message: 'Daily express shuttle service now open between Buliluyan, Bataraza and Puerto Princesa City.',
          type: 'broadcast',
          timestamp: new Date().toISOString(),
          read: false,
        },
        {
          id: 'notif-2',
          title: 'Balabac Connecting Notice',
          message: 'Morning shuttle BTR-101 departs Buliluyan Port at 06:00 AM, coordinating with island boat arrivals.',
          type: 'trip_update',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          read: false,
        },
      ];
      localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
  const all = getStoredNotifications();
  const created: AppNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([created, ...all]));
  notifyDataChanged();
  return created;
};

export const markAllNotificationsRead = () => {
  const all = getStoredNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(all));
  notifyDataChanged();
};

// Seat hold mechanism with concurrency protection
export const holdSeats = (
  tripId: string,
  seatIds: string[],
  sessionId: string,
  holdDurationMinutes: number = 10
): { success: boolean; error?: string } => {
  const trips = getStoredTrips();
  const tripIndex = trips.findIndex((t) => t.id === tripId);
  if (tripIndex === -1) return { success: false, error: 'Trip not found' };

  const trip = trips[tripIndex];
  const now = Date.now();
  const expiresAt = now + holdDurationMinutes * 60 * 1000;

  // Check if any seat is already booked or held by another session
  const currentHeld = (trip.heldSeats || []).filter((h) => h.expiresAt > now);

  for (const seatId of seatIds) {
    if (trip.bookedSeatIds.includes(seatId)) {
      return { success: false, error: `Seat is already booked by another passenger.` };
    }
    if (trip.blockedSeatIds?.includes(seatId)) {
      return { success: false, error: `Seat is blocked by administration.` };
    }
    const otherHold = currentHeld.find((h) => h.seatId === seatId && h.sessionId !== sessionId);
    if (otherHold) {
      return { success: false, error: `Seat is temporarily held by another customer during checkout.` };
    }
  }

  // Update holds
  const filteredHolds = currentHeld.filter((h) => !seatIds.includes(h.seatId));
  const newHolds = [
    ...filteredHolds,
    ...seatIds.map((seatId) => ({ seatId, expiresAt, sessionId })),
  ];

  trips[tripIndex] = {
    ...trip,
    heldSeats: newHolds,
  };

  saveTrips(trips);
  return { success: true };
};

export const releaseHeldSeats = (tripId: string, seatIds: string[], sessionId: string) => {
  const trips = getStoredTrips();
  const tripIndex = trips.findIndex((t) => t.id === tripId);
  if (tripIndex === -1) return;

  const trip = trips[tripIndex];
  if (!trip.heldSeats) return;

  trips[tripIndex] = {
    ...trip,
    heldSeats: trip.heldSeats.filter(
      (h) => !(seatIds.includes(h.seatId) && h.sessionId === sessionId)
    ),
  };

  saveTrips(trips);
};

// Create a finalized booking
export const createBooking = (bookingData: Omit<Booking, 'id' | 'createdAt'>): Booking => {
  const bookings = getStoredBookings();
  const trips = getStoredTrips();

  const newBooking: Booking = {
    ...bookingData,
    id: `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  // Add booked seats to the trip and remove from held
  const tripIndex = trips.findIndex((t) => t.id === bookingData.tripId);
  if (tripIndex !== -1) {
    const trip = trips[tripIndex];
    const newBookedSeatIds = [
      ...new Set([...trip.bookedSeatIds, ...bookingData.passengers.map((p) => p.seatId)]),
    ];
    const remainingHeld = (trip.heldSeats || []).filter(
      (h) => !bookingData.passengers.some((p) => p.seatId === h.seatId)
    );

    trips[tripIndex] = {
      ...trip,
      bookedSeatIds: newBookedSeatIds,
      heldSeats: remainingHeld,
    };
    saveTrips(trips);
  }

  saveBookings([newBooking, ...bookings]);

  // Create notification
  addNotification({
    title: `Booking Confirmed: ${newBooking.bookingReference}`,
    message: `Your shuttle reservation for ${bookingData.passengers.length} passenger(s) is confirmed. Reference: ${newBooking.bookingReference}.`,
    type: 'booking',
    bookingRef: newBooking.bookingReference,
    tripId: newBooking.tripId,
  });

  return newBooking;
};

// Confirm a pending booking once server payment is verified
export const confirmPendingBooking = (
  bookingReference: string,
  gatewayReference: string,
  paidAt?: string
): Booking | null => {
  const bookings = getStoredBookings();
  const trips = getStoredTrips();
  const bIndex = bookings.findIndex((b) => b.bookingReference === bookingReference);
  if (bIndex === -1) return null;

  const booking = bookings[bIndex];
  const updatedBooking: Booking = {
    ...booking,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentReference: gatewayReference,
    paidAt: paidAt || new Date().toISOString(),
    qrPayload: `${booking.bookingReference}|${booking.tripId}|${booking.contactName}|PAID|₱${booking.finalAmount}`,
  };

  bookings[bIndex] = updatedBooking;

  // Ensure seats are in trip.bookedSeatIds
  const tripIdx = trips.findIndex((t) => t.id === booking.tripId);
  if (tripIdx !== -1) {
    const trip = trips[tripIdx];
    const seatsToBook = booking.passengers.map((p) => p.seatId);
    trips[tripIdx] = {
      ...trip,
      bookedSeatIds: [...new Set([...trip.bookedSeatIds, ...seatsToBook])],
      heldSeats: (trip.heldSeats || []).filter((h) => !seatsToBook.includes(h.seatId)),
    };
    saveTrips(trips);
  }

  saveBookings(bookings);

  addNotification({
    title: `Payment Verified: ${updatedBooking.bookingReference}`,
    message: `PayMongo payment verified! Your seats are confirmed. Reference: ${updatedBooking.bookingReference}.`,
    type: 'payment',
    bookingRef: updatedBooking.bookingReference,
    tripId: updatedBooking.tripId,
  });

  return updatedBooking;
};

// Cancel or expire an unconfirmed/failed pending booking
export const cancelPendingBooking = (
  bookingReference: string,
  reason: string = 'Payment failed or cancelled'
): boolean => {
  const bookings = getStoredBookings();
  const trips = getStoredTrips();
  const bIndex = bookings.findIndex((b) => b.bookingReference === bookingReference);
  if (bIndex === -1) return false;

  const booking = bookings[bIndex];

  // Release any held/booked seats from trip
  const tripIdx = trips.findIndex((t) => t.id === booking.tripId);
  if (tripIdx !== -1) {
    const trip = trips[tripIdx];
    const seatIds = booking.passengers.map((p) => p.seatId);
    trips[tripIdx] = {
      ...trip,
      bookedSeatIds: trip.bookedSeatIds.filter((s) => !seatIds.includes(s)),
      heldSeats: (trip.heldSeats || []).filter((h) => !seatIds.includes(h.seatId)),
    };
    saveTrips(trips);
  }

  bookings[bIndex] = {
    ...booking,
    bookingStatus: 'cancelled',
    paymentStatus: 'failed',
    cancellationReason: reason,
  };

  saveBookings(bookings);
  return true;
};

// Update Passenger Boarding Status (Driver dashboard)
export const updatePassengerBoarding = (
  bookingId: string,
  seatId: string,
  status: BoardingStatus
) => {
  const bookings = getStoredBookings();
  const bIndex = bookings.findIndex((b) => b.id === bookingId);
  if (bIndex === -1) return;

  const booking = bookings[bIndex];
  const updatedPassengers = booking.passengers.map((p) => {
    if (p.seatId === seatId) {
      return { ...p, boardingStatus: status };
    }
    return p;
  });

  bookings[bIndex] = {
    ...booking,
    passengers: updatedPassengers,
  };

  saveBookings(bookings);
};

// Driver marks cash collected
export const markDriverCashCollected = (bookingId: string, collected: boolean) => {
  const bookings = getStoredBookings();
  const bIndex = bookings.findIndex((b) => b.id === bookingId);
  if (bIndex === -1) return;

  bookings[bIndex] = {
    ...bookings[bIndex],
    cashCollectedByDriver: collected,
    paymentStatus: collected ? 'paid' : 'pending_cash',
  };

  saveBookings(bookings);
};

// Update Trip Status (Driver or Admin)
export const updateTripStatus = (tripId: string, status: TripStatus) => {
  const trips = getStoredTrips();
  const idx = trips.findIndex((t) => t.id === tripId);
  if (idx === -1) return;

  trips[idx] = {
    ...trips[idx],
    status,
  };

  saveTrips(trips);

  // Send notification for status change
  const statusLabel =
    status === 'boarding'
      ? 'now boarding passengers'
      : status === 'departed'
      ? 'departed and is en route'
      : status === 'arrived'
      ? 'safely arrived at destination'
      : status === 'cancelled'
      ? 'cancelled by dispatch'
      : 'scheduled';

  addNotification({
    title: `Trip ${trips[idx].tripNumber} Update`,
    message: `Shuttle trip ${trips[idx].tripNumber} is ${statusLabel}.`,
    type: 'trip_update',
    tripId,
  });
};

// Cancel booking with policy calculation
export const cancelBooking = (
  bookingId: string,
  reason: string
): { success: boolean; refundAmount: number; error?: string } => {
  const bookings = getStoredBookings();
  const trips = getStoredTrips();
  const policy = getStoredPolicy();

  const bIndex = bookings.findIndex((b) => b.id === bookingId);
  if (bIndex === -1) return { success: false, refundAmount: 0, error: 'Booking not found' };

  const booking = bookings[bIndex];
  if (booking.bookingStatus === 'cancelled') {
    return { success: false, refundAmount: 0, error: 'Booking is already cancelled' };
  }

  const trip = trips.find((t) => t.id === booking.tripId);
  let refundPercentage = 0;

  if (trip) {
    const departureDateTime = new Date(`${trip.travelDate}T${trip.departureTime}:00`);
    const hoursRemaining = (departureDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursRemaining >= policy.refundPolicy.hoursBeforeTripForFullRefund) {
      refundPercentage = policy.refundPolicy.fullRefundPercentage;
    } else if (hoursRemaining >= 12) {
      refundPercentage = policy.refundPolicy.lateRefundPercentage;
    } else {
      refundPercentage = 0; // Less than 12h
    }

    // Release seats from trip
    const cancelledSeatIds = booking.passengers.map((p) => p.seatId);
    const updatedBookedSeatIds = trip.bookedSeatIds.filter((s) => !cancelledSeatIds.includes(s));

    const tripIdx = trips.findIndex((t) => t.id === trip.id);
    if (tripIdx !== -1) {
      trips[tripIdx] = {
        ...trip,
        bookedSeatIds: updatedBookedSeatIds,
      };
      saveTrips(trips);
    }
  }

  const refundAmount = Math.round((booking.finalAmount * refundPercentage) / 100);

  bookings[bIndex] = {
    ...booking,
    bookingStatus: 'cancelled',
    paymentStatus: refundAmount > 0 ? 'refunded' : booking.paymentStatus,
    cancellationReason: reason,
    refundAmount,
  };

  saveBookings(bookings);

  addNotification({
    title: `Booking Cancelled: ${booking.bookingReference}`,
    message: `Reservation ${booking.bookingReference} was cancelled. Refund computed: ₱${refundAmount} (${refundPercentage}% per policy).`,
    type: 'payment',
    bookingRef: booking.bookingReference,
  });

  return { success: true, refundAmount };
};
