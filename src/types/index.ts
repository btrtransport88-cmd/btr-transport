export type UserRole = 'passenger' | 'driver' | 'admin';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'rejected';

export type Language = 'en' | 'fil';

export type TravelDirection = 'buliluyan_to_puerto' | 'puerto_to_buliluyan';

export type TripStatus = 'scheduled' | 'boarding' | 'departed' | 'arrived' | 'cancelled';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  passwordHash: string;
  status: AccountStatus;
  driverId?: string; // Links driver account to driver profile in fleet
  licenseNumber?: string;
  assignedVehicleId?: string;
  createdAt: string;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: AccountStatus;
  driverId?: string;
  licenseNumber?: string;
  assignedVehicleId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  token: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
  isValid: boolean;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export type AuthAuditEvent =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'account_suspended'
  | 'account_activated'
  | 'role_changed'
  | 'unauthorized_access_attempt';

export interface AuthAuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  action: AuthAuditEvent;
  ip?: string;
  userAgent?: string;
  details?: string;
  timestamp: string;
}

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'
  | 'pending_cash';

export type PaymentMethod = 'gcash' | 'maya' | 'cash' | 'card' | 'grab_pay' | 'qrph';

export type PaymentGateway = 'paymongo' | 'cash' | 'manual';

export type PassengerType = 'regular' | 'senior' | 'pwd' | 'student' | 'child';

export type BoardingStatus = 'waiting' | 'checked_in' | 'boarded' | 'no_show';

export interface RouteStop {
  id: string;
  name: string;
  municipality: string;
  landmark: string;
  isTerminal: boolean;
  orderFromBuliluyan: number; // 0 to 7
  fareFromBuliluyan: number; // PHP base fare to this stop from Buliluyan
  fareFromPuerto: number;    // PHP base fare to this stop from Puerto Princesa
  estimatedMinutesFromBuliluyan: number;
  estimatedMinutesFromPuerto: number;
}

export interface VehicleSeat {
  id: string; // e.g., '1', '2', 'driver', 'jump_1'
  label: string; // 'Seat 1 (Front)', 'Seat 4'
  row: number;
  col: number;
  isDriver?: boolean;
  isAisle?: boolean;
  isWindow?: boolean;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string; // e.g. "Toyota HiAce Commuter 2024"
  capacity: number; // e.g. 14
  hasAircon: boolean;
  status: 'active' | 'maintenance' | 'inactive';
  seats: VehicleSeat[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  photoUrl?: string;
  assignedVehicleId?: string;
  rating: number;
  tripsCompleted: number;
  verificationStatus?: 'verified' | 'pending_verification' | 'rejected';
}

export interface Trip {
  id: string;
  tripNumber: string; // e.g., "BTR-101"
  direction: TravelDirection;
  originStopId: string;
  destinationStopId: string;
  travelDate: string; // YYYY-MM-DD
  departureTime: string; // e.g. "06:00"
  estimatedArrivalTime: string; // e.g. "11:30"
  vehicleId: string;
  driverId?: string;
  baseFare: number; // Full route fare in PHP
  status: TripStatus;
  seatCapacity: number;
  bookedSeatIds: string[]; // List of seat IDs already booked
  heldSeats?: { seatId: string; expiresAt: number; sessionId: string }[];
  blockedSeatIds: string[]; // Blocked by admin (e.g. for luggage/reserved)
  notes?: string;
}

export interface PassengerDetail {
  seatId: string;
  seatLabel: string;
  fullName: string;
  passengerType: PassengerType;
  idNumber?: string; // For Senior/PWD/Student discount verification
  fare: number;
  boardingStatus: BoardingStatus;
}

export interface Booking {
  id: string;
  bookingReference: string; // e.g. "BTR-20261028-7K2X"
  tripId: string;
  userId?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  pickupStopId: string;
  pickupSpecifics?: string;
  dropoffStopId: string;
  dropoffSpecifics?: string;
  passengers: PassengerDetail[];
  totalFare: number;
  discountAmount: number;
  bookingFee: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  bookingStatus: BookingStatus;
  createdAt: string;
  qrPayload: string;
  cashCollectedByDriver?: boolean;
  cancellationReason?: string;
  refundAmount?: number;
  // Enhanced Payment & Gateway relationship fields
  paymentId?: string;
  paymentGateway?: PaymentGateway;
  checkoutSessionId?: string;
  checkoutUrl?: string;
  expiresAt?: string; // Booking hold expiration time (ISO)
  paidAt?: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  userId?: string;
  paymentGateway: PaymentGateway; // 'paymongo' | 'cash'
  gatewaySessionId?: string; // PayMongo checkout_session_id (cs_...)
  gatewayPaymentIntentId?: string; // PayMongo pi_...
  gatewayTransactionRef?: string; // PayMongo pay_... or source reference
  paymentMethod: PaymentMethod;
  amount: number; // in PHP decimal (e.g., 850.00)
  amountCentavos: number; // in centavos integer (e.g., 85000)
  currency: 'PHP';
  paymentStatus: PaymentStatus;
  checkoutUrl?: string;
  clientKey?: string;
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  refundedAmount?: number;
  refundReason?: string;
}

export type PaymentTransactionEvent =
  | 'checkout_created'
  | 'payment_success'
  | 'payment_failed'
  | 'webhook_received'
  | 'refund_requested'
  | 'refund_completed'
  | 'verification_checked';

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  bookingReference: string;
  event: PaymentTransactionEvent;
  status: PaymentStatus;
  amount: number;
  reference?: string;
  gateway: PaymentGateway;
  timestamp: string;
  details?: string;
  rawPayload?: any;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'trip_update' | 'payment' | 'broadcast';
  timestamp: string;
  read: boolean;
  tripId?: string;
  bookingRef?: string;
}

export interface OperatingPolicy {
  fullRouteFare: number;
  seniorStudentDiscountPercent: number; // 20%
  seatHoldMinutes: number; // default 10 minutes
  allowCashPayments: boolean;
  refundPolicy: {
    hoursBeforeTripForFullRefund: number; // e.g. 24h
    fullRefundPercentage: number; // 100%
    lateRefundPercentage: number; // 80% if > 12h
  };
  contactHotline: string;
  emergencyHotline: string;
}
