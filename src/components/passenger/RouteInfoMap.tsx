import React from 'react';
import { RouteStop } from '../../types';
import { MapPin, Navigation, Clock, Shield, Compass, Anchor, Fuel } from 'lucide-react';

interface RouteInfoMapProps {
  stops: RouteStop[];
}

export const RouteInfoMap: React.FC<RouteInfoMapProps> = ({ stops }) => {
  // Sort stops by order from Buliluyan
  const orderedStops = [...stops].sort((a, b) => a.orderFromBuliluyan - b.orderFromBuliluyan);

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-teal-800 text-xs font-bold tracking-wider uppercase">
            <Compass className="w-4 h-4 text-teal-600" />
            <span>Palawan Highway Transit Guide</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            Buliluyan, Bataraza ⇄ Puerto Princesa City Corridor
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Approx. 260 km scenic highway route across Southern Palawan. Typical travel duration: 5 to 6 hours.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-teal-50 border border-teal-200/60 text-teal-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold">
          <Clock className="w-4 h-4 text-teal-700" />
          <span>Daily Express Departures</span>
        </div>
      </div>

      {/* Visual Route Timeline / Roadmap */}
      <div className="relative pt-2 pb-4">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-10 left-6 right-6 h-1 bg-gradient-to-r from-teal-700 via-emerald-600 to-sky-700 -z-0 rounded-full" />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 relative z-10">
          {orderedStops.map((stop, index) => {
            const isTerminal = stop.isTerminal;
            return (
              <div
                key={stop.id}
                className="flex flex-col items-start md:items-center text-left md:text-center p-3 rounded-2xl bg-slate-50/90 hover:bg-teal-50/60 border border-slate-200/60 transition-colors"
              >
                {/* Node icon */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-xs mb-2 ${
                    isTerminal
                      ? 'bg-teal-900 text-amber-300 ring-2 ring-teal-700'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  {index === 0 ? (
                    <Anchor className="w-4 h-4" />
                  ) : index === orderedStops.length - 1 ? (
                    <Navigation className="w-4 h-4" />
                  ) : index === 1 ? (
                    <Fuel className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{stop.name}</h4>
                <span className="text-[11px] text-teal-800 font-medium">{stop.municipality}</span>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                  {stop.landmark}
                </p>
                <span className="mt-2 text-[10px] font-mono font-semibold text-slate-400">
                  {stop.estimatedMinutesFromBuliluyan > 0
                    ? `+${Math.floor(stop.estimatedMinutesFromBuliluyan / 60)}h ${
                        stop.estimatedMinutesFromBuliluyan % 60
                      }m`
                    : 'Origin 0 km'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Travel Tips & Balabac Ferry Connection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-start gap-3">
          <Anchor className="w-5 h-5 text-teal-800 shrink-0 mt-0.5" />
          <div className="text-xs text-teal-950">
            <h5 className="font-bold mb-0.5">Balabac Island Ferry Connections</h5>
            <p className="text-teal-900/80 leading-relaxed">
              Buliluyan Port is the primary passenger jump-off point for passenger boats going to Balabac mainland and island-hopping tours. Morning shuttles arrive in time for boat departures.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950">
            <h5 className="font-bold mb-0.5">Luggage & Comfort Policy</h5>
            <p className="text-amber-900/80 leading-relaxed">
              All BTR vans feature dual air conditioning, comfortable reclining seats, and dedicated rear luggage compartment. Free mineral water stops in Narra and Brooke's Point.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
