import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Star, CheckCircle2, Users, RotateCcw, ArrowRight } from 'lucide-react';
import { AuthUser, Driver, Trip, Vehicle } from '../../types';
import { db, handleFirestoreError, OperationType } from '../../utils/firebase';
import { useAuth } from '../../context/AuthContext';
import { restoreSampleDrivers } from '../../utils/storage';

interface DriverPerformanceOverviewProps {
  drivers: Driver[];
  trips: Trip[];
  vehicles: Vehicle[];
  userAccounts?: AuthUser[];
  onNavigateTab?: (tab: 'drivers' | 'approvals') => void;
}

interface ActiveDriverMetric {
  id: string;
  name: string;
  shortName: string;
  licenseNumber: string;
  vehicleLabel: string;
  rating: number;
  completedTrips: number;
  activeOrScheduledTrips: number;
  cancelledTrips: number;
  completionRate: number;
}

type MetricView = 'both' | 'completion' | 'rating';
type SortOption = 'completion' | 'rating' | 'trips';

function shortenDriverName(fullName: string): string {
  const cleaned = fullName.trim();
  if (!cleaned) return 'Driver';
  // Preserve "Kuya <First>" or shorten long multi-word names cleanly for chart axis
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2 && parts[0].toLowerCase() === 'kuya') {
    return `${parts[0]} ${parts[1]}`;
  }
  if (cleaned.length <= 14) return cleaned;
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : cleaned.slice(0, 14);
}

interface CustomDriverTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: ActiveDriverMetric;
  }>;
}

const CustomDriverTooltip: React.FC<CustomDriverTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const d = payload[0].payload;

  return (
    <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg border border-slate-800 min-w-[230px]">
      <div className="font-bold text-sm text-white">{d.name}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">
        {d.licenseNumber} · {d.vehicleLabel}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Trip Completion Rate</span>
          <span className="font-mono font-bold tabular-nums text-emerald-400">
            {d.completionRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Passenger Rating</span>
          <span className="font-mono font-bold tabular-nums text-amber-300">
            {d.rating.toFixed(1)} / 5.0 ★
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800/70">
          <span className="text-slate-400">Completed Trips</span>
          <span className="font-mono tabular-nums text-slate-100">{d.completedTrips}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Scheduled / In-Transit</span>
          <span className="font-mono tabular-nums text-slate-200">{d.activeOrScheduledTrips}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Cancelled Trips</span>
          <span className="font-mono tabular-nums text-rose-300">{d.cancelledTrips}</span>
        </div>
      </div>
    </div>
  );
};

export const DriverPerformanceOverview: React.FC<DriverPerformanceOverviewProps> = ({
  drivers,
  trips,
  vehicles,
  userAccounts = [],
  onNavigateTab,
}) => {
  const { firebaseUser } = useAuth();
  const [metricView, setMetricView] = useState<MetricView>('both');
  const [sortBy, setSortBy] = useState<SortOption>('completion');
  const [firestoreActiveDrivers, setFirestoreActiveDrivers] = useState<Driver[]>([]);

  // Subscribe to active verified driver accounts in Firestore when signed in
  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreActiveDrivers([]);
      return;
    }

    const usersRef = collection(db, 'users');
    const activeDriversQuery = query(
      usersRef,
      where('role', '==', 'driver'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      activeDriversQuery,
      (snapshot) => {
        const synced: Driver[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: (data.driverId as string) || docSnap.id,
            name: (data.name as string) || 'Active Driver',
            phone: (data.phone as string) || '',
            licenseNumber: (data.licenseNumber as string) || 'LTO Verified',
            assignedVehicleId: (data.assignedVehicleId as string) || undefined,
            rating: typeof data.rating === 'number' ? data.rating : 5.0,
            tripsCompleted: typeof data.tripsCompleted === 'number' ? data.tripsCompleted : 0,
            verificationStatus: 'verified',
          };
        });
        setFirestoreActiveDrivers(synced);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch {
          // Structured error logged; keep local/server driver roster active
        }
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  // Merge active drivers from fleet store, Express user accounts, and Firestore active driver users
  const performanceRows: ActiveDriverMetric[] = useMemo(() => {
    const vehicleById = new Map<string, Vehicle>();
    vehicles.forEach((v) => vehicleById.set(v.id, v));

    const driverMap = new Map<string, Driver>();

    // 1. Local fleet drivers excluding pending_verification & rejected
    drivers.forEach((drv) => {
      if (
        drv.verificationStatus !== 'pending_verification' &&
        drv.verificationStatus !== 'rejected'
      ) {
        driverMap.set(drv.id, drv);
      }
    });

    // 2. Active server driver accounts (if not already present in fleet map)
    userAccounts.forEach((acc) => {
      if (acc.role === 'driver' && acc.status === 'active') {
        const targetId = acc.driverId || acc.id;
        if (!driverMap.has(targetId)) {
          driverMap.set(targetId, {
            id: targetId,
            name: acc.name,
            phone: acc.phone || '',
            licenseNumber: acc.licenseNumber || 'LTO Verified',
            assignedVehicleId: acc.assignedVehicleId,
            rating: 5.0,
            tripsCompleted: 0,
            verificationStatus: 'verified',
          });
        }
      }
    });

    // 3. Active Firestore driver accounts
    firestoreActiveDrivers.forEach((fsDrv) => {
      if (!driverMap.has(fsDrv.id)) {
        driverMap.set(fsDrv.id, fsDrv);
      }
    });

    const rows: ActiveDriverMetric[] = Array.from(driverMap.values()).map((drv) => {
      const assignedTrips = trips.filter((t) => t.driverId === drv.id);
      const arrivedFromSchedule = assignedTrips.filter((t) => t.status === 'arrived').length;
      const cancelledTrips = assignedTrips.filter((t) => t.status === 'cancelled').length;
      const activeOrScheduledTrips = assignedTrips.filter(
        (t) => t.status === 'scheduled' || t.status === 'boarding' || t.status === 'departed'
      ).length;

      const completedTrips = (drv.tripsCompleted || 0) + arrivedFromSchedule;
      const totalTrackable = completedTrips + cancelledTrips + activeOrScheduledTrips;
      const completionRate =
        totalTrackable > 0
          ? Math.round((completedTrips / totalTrackable) * 1000) / 10
          : 0;

      const assignedVehicle = drv.assignedVehicleId
        ? vehicleById.get(drv.assignedVehicleId)
        : undefined;

      return {
        id: drv.id,
        name: drv.name,
        shortName: shortenDriverName(drv.name),
        licenseNumber: drv.licenseNumber || 'LTO Verified',
        vehicleLabel: assignedVehicle ? assignedVehicle.plateNumber : 'Unassigned Van',
        rating: Math.min(5, Math.max(0, Number(drv.rating ?? 5.0))),
        completedTrips,
        activeOrScheduledTrips,
        cancelledTrips,
        completionRate,
      };
    });

    return rows.sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating || b.completionRate - a.completionRate;
      }
      if (sortBy === 'trips') {
        return b.completedTrips - a.completedTrips || b.completionRate - a.completionRate;
      }
      return b.completionRate - a.completionRate || b.rating - a.rating;
    });
  }, [drivers, userAccounts, firestoreActiveDrivers, trips, vehicles, sortBy]);

  const summary = useMemo(() => {
    if (performanceRows.length === 0) {
      return {
        activeCount: 0,
        avgCompletion: 0,
        avgRating: 0,
        totalCompleted: 0,
      };
    }

    const totalCompleted = performanceRows.reduce((sum, r) => sum + r.completedTrips, 0);
    const avgCompletion =
      Math.round(
        (performanceRows.reduce((sum, r) => sum + r.completionRate, 0) / performanceRows.length) *
          10
      ) / 10;
    const avgRating =
      Math.round(
        (performanceRows.reduce((sum, r) => sum + r.rating, 0) / performanceRows.length) * 100
      ) / 100;

    return {
      activeCount: performanceRows.length,
      avgCompletion,
      avgRating,
      totalCompleted,
    };
  }, [performanceRows]);

  const pendingApprovalsCount = useMemo(
    () =>
      drivers.filter((d) => d.verificationStatus === 'pending_verification').length +
      userAccounts.filter((u) => u.role === 'driver' && u.status === 'pending_verification').length,
    [drivers, userAccounts]
  );

  return (
    <section
      aria-label="Driver Performance"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Driver Performance</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Active drivers:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {summary.activeCount}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Avg. completion rate:{' '}
              <strong className="font-mono tabular-nums text-teal-800">
                {summary.avgCompletion.toFixed(1)}%
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Avg. rating:{' '}
              <strong className="font-mono tabular-nums text-amber-700">
                {summary.avgRating.toFixed(2)} / 5.0
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Trips completed:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {summary.totalCompleted.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        {/* Interactive Controls */}
        {performanceRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Performance metric view"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setMetricView('both')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricView === 'both'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Combined
              </button>
              <button
                type="button"
                onClick={() => setMetricView('completion')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricView === 'completion'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completion Rate
              </button>
              <button
                type="button"
                onClick={() => setMetricView('rating')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metricView === 'rating'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Passenger Rating
              </button>
            </div>

            <div
              role="group"
              aria-label="Sort drivers"
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setSortBy('completion')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortBy === 'completion'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top Completion
              </button>
              <button
                type="button"
                onClick={() => setSortBy('rating')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortBy === 'rating'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top Rated
              </button>
              <button
                type="button"
                onClick={() => setSortBy('trips')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortBy === 'trips'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Most Trips
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Populated vs Empty State */}
      {performanceRows.length === 0 ? (
        <div className="py-10 px-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 space-y-3">
          <div className="w-11 h-11 mx-auto rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
            <Users className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="font-bold text-sm text-slate-900">No Active Verified Drivers Yet</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trip completion rates and passenger ratings will appear here once active shuttle
              drivers are approved or added to the fleet roster.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => restoreSampleDrivers()}
              className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restore Sample Drivers</span>
            </button>
            {onNavigateTab && pendingApprovalsCount > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('approvals')}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Review Pending Approvals ({pendingApprovalsCount})</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('drivers')}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Open Driver Roster</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Recharts Visualization */}
          <div className="w-full h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={performanceRows}
                margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: '#475569', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  dy={6}
                />

                {metricView !== 'rating' && (
                  <YAxis
                    yAxisId="completion"
                    domain={[0, 100]}
                    tickFormatter={(val) => `${val}%`}
                    tick={{ fill: '#0f766e', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                )}

                {metricView !== 'completion' && (
                  <YAxis
                    yAxisId="rating"
                    orientation={metricView === 'rating' ? 'left' : 'right'}
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tickFormatter={(val) => `${Number(val).toFixed(1)}★`}
                    tick={{ fill: '#b45309', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                )}

                <Tooltip
                  content={<CustomDriverTooltip />}
                  cursor={{ fill: 'rgba(15, 118, 110, 0.06)' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '12px' }}
                />

                {metricView !== 'rating' && (
                  <Bar
                    yAxisId="completion"
                    dataKey="completionRate"
                    name="Trip Completion Rate (%)"
                    fill="#0f766e"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={false}
                  />
                )}

                {metricView === 'both' && (
                  <Line
                    yAxisId="rating"
                    type="monotone"
                    dataKey="rating"
                    name="Passenger Rating (0–5.0)"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#b45309', stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                )}

                {metricView === 'rating' && (
                  <Bar
                    yAxisId="rating"
                    dataKey="rating"
                    name="Passenger Rating (0–5.0)"
                    fill="#d97706"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={42}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Driver Scorecard Table */}
          <div className="overflow-x-auto border-t border-slate-100 pt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Driver</th>
                  <th className="py-2.5 px-3">Vehicle</th>
                  <th className="py-2.5 px-3 text-right">Completed</th>
                  <th className="py-2.5 px-3 text-right">Scheduled / Active</th>
                  <th className="py-2.5 px-3 text-right">Cancelled</th>
                  <th className="py-2.5 px-3 text-right">Completion Rate</th>
                  <th className="py-2.5 px-3 text-right">Passenger Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performanceRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {row.licenseNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{row.vehicleLabel}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {row.completedTrips}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {row.activeOrScheduledTrips}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {row.cancelledTrips}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-mono tabular-nums font-semibold ${
                          row.completionRate >= 90
                            ? 'text-emerald-700'
                            : row.completionRate >= 75
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{row.completionRate.toFixed(1)}%</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1 font-mono tabular-nums font-semibold text-amber-700">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" aria-hidden="true" />
                        <span>{row.rating.toFixed(1)}</span>
                        <span className="text-slate-400 font-normal">/ 5.0</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
