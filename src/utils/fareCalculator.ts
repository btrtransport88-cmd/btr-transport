import { PassengerType, RouteStop } from '../types';

export interface CalculatedFareItem {
  passengerIndex: number;
  passengerName: string;
  passengerType: PassengerType;
  baseSegmentFare: number;
  discountPercentage: number;
  discountAmount: number;
  finalPassengerFare: number;
}

export interface FareCalculationResult {
  baseSegmentFare: number;
  items: CalculatedFareItem[];
  subtotal: number;
  totalDiscount: number;
  bookingFee: number;
  finalTotal: number;
}

export const calculateSegmentFare = (
  pickupStop: RouteStop,
  dropoffStop: RouteStop,
  direction: 'buliluyan_to_puerto' | 'puerto_to_buliluyan'
): number => {
  // If either stop is terminal
  if (pickupStop.id === 'stop-buliluyan' && dropoffStop.id === 'stop-puerto') return 850;
  if (pickupStop.id === 'stop-puerto' && dropoffStop.id === 'stop-buliluyan') return 850;

  if (direction === 'buliluyan_to_puerto') {
    const fare = Math.abs(dropoffStop.fareFromBuliluyan - pickupStop.fareFromBuliluyan);
    return Math.max(fare, 150); // Minimum provincial shuttle fare ₱150
  } else {
    const fare = Math.abs(dropoffStop.fareFromPuerto - pickupStop.fareFromPuerto);
    return Math.max(fare, 150);
  }
};

export const calculateTripFare = (
  pickupStop: RouteStop,
  dropoffStop: RouteStop,
  direction: 'buliluyan_to_puerto' | 'puerto_to_buliluyan',
  passengers: { fullName: string; passengerType: PassengerType }[],
  seniorStudentDiscountPercent: number = 20
): FareCalculationResult => {
  const baseSegmentFare = calculateSegmentFare(pickupStop, dropoffStop, direction);

  const items: CalculatedFareItem[] = passengers.map((p, idx) => {
    let discountPercentage = 0;
    if (p.passengerType === 'senior' || p.passengerType === 'pwd' || p.passengerType === 'student') {
      discountPercentage = seniorStudentDiscountPercent;
    } else if (p.passengerType === 'child') {
      discountPercentage = 50; // 50% off for children under 7
    }

    const discountAmount = Math.round((baseSegmentFare * discountPercentage) / 100);
    const finalPassengerFare = baseSegmentFare - discountAmount;

    return {
      passengerIndex: idx,
      passengerName: p.fullName || `Passenger ${idx + 1}`,
      passengerType: p.passengerType,
      baseSegmentFare,
      discountPercentage,
      discountAmount,
      finalPassengerFare,
    };
  });

  const subtotal = baseSegmentFare * passengers.length;
  const totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
  const bookingFee = 0; // BTR direct zero booking fee promotion
  const finalTotal = subtotal - totalDiscount + bookingFee;

  return {
    baseSegmentFare,
    items,
    subtotal,
    totalDiscount,
    bookingFee,
    finalTotal,
  };
};
