import React, { useState } from 'react';
import { Driver, Language, RouteStop, TravelDirection, Trip, Vehicle } from '../../types';
import { DICTIONARY } from '../../utils/translations';
import { calculateSegmentFare } from '../../utils/fareCalculator';
import {
  Calendar,
  Clock,
  ArrowRightLeft,
  ArrowRight,
  Armchair,
  Users,
  Star,
  MapPin,
  ChevronRight,
  Bus,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface SearchTripsProps {
  trips: Trip[];
  stops: RouteStop[];
  vehicles: Vehicle[];
  drivers: Driver[];
  language: Language;
  onSelectTrip: (trip: Trip, pickupStop: RouteStop, dropoffStop: RouteStop) => void;
}

export const SearchTrips: React.FC<SearchTripsProps> = ({
  trips,
  stops,
  vehicles,
  drivers,
  language,
  onSelectTrip,
}) => {
  const t = DICTIONARY[language];

  // Helpers for dates
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const [direction, setDirection] = useState<TravelDirection>('buliluyan_to_puerto');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Default pickup & dropoff
  const [pickupStopId, setPickupStopId] = useState<string>(
    direction === 'buliluyan_to_puerto' ? 'stop-buliluyan' : 'stop-puerto'
  );
  const [dropoffStopId, setDropoffStopId] = useState<string>(
    direction === 'buliluyan_to_puerto' ? 'stop-puerto' : 'stop-buliluyan'
  );

  const handleSwapDirection = () => {
    const newDir: TravelDirection =
      direction === 'buliluyan_to_puerto' ? 'puerto_to_buliluyan' : 'buliluyan_to_puerto';
    setDirection(newDir);
    setPickupStopId(newDir === 'buliluyan_to_puerto' ? 'stop-buliluyan' : 'stop-puerto');
    setDropoffStopId(newDir === 'buliluyan_to_puerto' ? 'stop-puerto' : 'stop-buliluyan');
  };

  const pickupStop = stops.find((s) => s.id === pickupStopId) || stops[0];
  const dropoffStop = stops.find((s) => s.id === dropoffStopId) || stops[stops.length - 1];

  // Filter available trips by direction and date
  const filteredTrips = trips.filter(
    (tr) => tr.direction === direction && tr.travelDate === selectedDate
  );

  const getVehicle = (id?: string) => (id ? vehicles.find((v) => v.id === id) : undefined);
  const getDriver = (id?: string) => (id ? drivers.find((d) => d.id === id) : undefined);

  const currentSegmentFare = calculateSegmentFare(pickupStop, dropoffStop, direction);

  return (
    <div className="space-y-6">
      {/* Hero / Search Card */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-900 rounded-3xl p-5 sm:p-8 text-white shadow-xl shadow-teal-950/15 relative overflow-hidden">
        {/* Subtle decorative background wave */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 rounded-full bg-white/5 pointer-events-none blur-2xl" />

        <div className="relative z-10 max-w-2xl mb-6">
          <span className="text-[11px] font-bold tracking-widest text-amber-300 uppercase bg-teal-950/40 px-3 py-1 rounded-full border border-teal-700/50">
            Palawan Island Shuttle
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
            {t.searchTitle}
          </h1>
          <p className="text-xs sm:text-sm text-teal-100/90 mt-1 leading-relaxed">
            {t.searchSubtitle}
          </p>
        </div>

        {/* Search Filter Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/15 space-y-4">
          {/* Direction Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-teal-200">{t.selectDirection}:</span>
              <span className="font-bold text-sm text-white">
                {direction === 'buliluyan_to_puerto' ? t.buliluyanToPuerto : t.puertoToBuliluyan}
              </span>
            </div>

            <button
              onClick={handleSwapDirection}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Switch Route</span>
            </button>
          </div>

          {/* Date, Pickup, and Drop-off Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Travel Date */}
            <div>
              <label className="block text-xs font-semibold text-teal-200 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.travelDate}</span>
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={selectedDate}
                  min={todayStr}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 font-sans shadow-xs"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedDate === todayStr
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-white/20 text-teal-100 hover:bg-white/30'
                    }`}
                  >
                    {t.today}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(tomorrowStr)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      selectedDate === tomorrowStr
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-white/20 text-teal-100 hover:bg-white/30'
                    }`}
                  >
                    {t.tomorrow}
                  </button>
                </div>
              </div>
            </div>

            {/* Pickup Stop */}
            <div>
              <label className="block text-xs font-semibold text-teal-200 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                <span>{t.pickupStop}</span>
              </label>
              <select
                value={pickupStopId}
                onChange={(e) => setPickupStopId(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2.5 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.municipality})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-teal-200 mt-1 truncate">
                {pickupStop.landmark}
              </p>
            </div>

            {/* Drop-off Stop */}
            <div>
              <label className="block text-xs font-semibold text-teal-200 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-300" />
                <span>{t.dropoffStop}</span>
              </label>
              <select
                value={dropoffStopId}
                onChange={(e) => setDropoffStopId(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2.5 bg-white text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.municipality})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-teal-200 mt-1 truncate">
                {dropoffStop.landmark}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Available Trips for {selectedDate}</span>
            <span className="text-xs font-normal text-slate-500">
              ({filteredTrips.length} departure{filteredTrips.length !== 1 ? 's' : ''})
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Estimated segment fare: <strong className="text-teal-900">₱{currentSegmentFare}</strong> per seat · Air-conditioned vans
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Real-time seat availability</span>
        </div>
      </div>

      {/* Trip Cards Listing */}
      {filteredTrips.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <Bus className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
          <h3 className="font-bold text-base text-slate-800">No scheduled departures found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            There are currently no listed trips matching this date and direction. Try selecting{' '}
            <strong className="text-slate-700">{todayStr}</strong> or{' '}
            <strong className="text-slate-700">{tomorrowStr}</strong> to view standard daily departures.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Check Today's Schedule
            </button>
            <button
              onClick={() => setSelectedDate(tomorrowStr)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Check Tomorrow
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => {
            const vehicle = getVehicle(trip.vehicleId);
            const driver = getDriver(trip.driverId);

            // Calculate remaining available seats
            const bookedCount = trip.bookedSeatIds.length;
            const blockedCount = trip.blockedSeatIds?.length || 0;
            const now = Date.now();
            const heldCount = (trip.heldSeats || []).filter((h) => h.expiresAt > now).length;
            const seatsRemaining = Math.max(
              0,
              trip.seatCapacity - (bookedCount + blockedCount + heldCount)
            );
            const isFull = seatsRemaining === 0;

            return (
              <div
                key={trip.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-teal-300/80 space-y-4"
              >
                {/* Trip Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                      {trip.tripNumber}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {trip.direction === 'buliluyan_to_puerto'
                        ? 'Buliluyan Port to Puerto Princesa'
                        : 'Puerto Princesa to Buliluyan Port'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {trip.status === 'boarding' ? (
                      <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" />
                        Boarding Now
                      </span>
                    ) : trip.status === 'departed' ? (
                      <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-0.5 rounded-full">
                        Departed
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full">
                        Scheduled Departure
                      </span>
                    )}
                  </div>
                </div>

                {/* Times & Capacity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Left: Schedule Times */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Departure
                      </span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {trip.departureTime}
                      </span>
                      <span className="text-[11px] text-teal-800 font-semibold block truncate max-w-[130px]">
                        {pickupStop.name}
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-[10px] text-slate-400 font-medium">~5h 40m</span>
                      <div className="w-12 h-0.5 bg-slate-300 relative my-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-700 absolute -top-0.5 right-0" />
                      </div>
                      <span className="text-[9px] text-slate-400">Direct</span>
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Est. Arrival
                      </span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {trip.estimatedArrivalTime}
                      </span>
                      <span className="text-[11px] text-slate-600 font-semibold block truncate max-w-[130px]">
                        {dropoffStop.name}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Vehicle & Driver details */}
                  <div className="sm:col-span-4 space-y-1.5 text-xs text-slate-600 border-t sm:border-t-0 sm:border-l sm:border-r border-slate-100 sm:px-4 py-2 sm:py-0">
                    <div className="flex items-center gap-2">
                      <Bus className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span className="font-semibold text-slate-900">
                        {vehicle?.model || 'Toyota HiAce Commuter'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-slate-500 font-medium">
                        Plate: {vehicle?.plateNumber || 'VAR 8920'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-semibold">Dual Aircon</span>
                    </div>
                    {driver && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span className="font-medium">{driver.name}</span>
                        <div className="flex items-center text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span className="ml-0.5">{driver.rating}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Seat Availability & Action */}
                  <div className="sm:col-span-4 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0">
                    <div>
                      <div className="flex items-baseline gap-1 sm:justify-end">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Fare:</span>
                        <span className="text-xl font-extrabold text-teal-950">
                          ₱{currentSegmentFare}
                        </span>
                        <span className="text-[10px] text-slate-500">/ seat</span>
                      </div>

                      <div className="flex items-center gap-1 sm:justify-end text-xs mt-0.5">
                        <Armchair className="w-3.5 h-3.5 text-slate-400" />
                        <span
                          className={`font-bold ${
                            seatsRemaining <= 3 ? 'text-amber-600' : 'text-emerald-700'
                          }`}
                        >
                          {isFull ? 'Sold Out' : `${seatsRemaining} seats left`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => onSelectTrip(trip, pickupStop, dropoffStop)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isFull
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-teal-800 hover:bg-teal-900 text-white shadow-sm hover:shadow-md'
                      }`}
                    >
                      <span>{isFull ? t.soldOut : t.selectSeats}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {trip.notes && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{trip.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
