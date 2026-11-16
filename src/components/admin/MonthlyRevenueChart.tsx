import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Booking, Trip } from '../../types';

interface MonthlyRevenueChartProps {
  bookings: Booking[];
  trips: Trip[];
}

interface MonthlyRevenuePoint {
  monthKey: string;
  label: string;
  fullLabel: string;
  revenue: number;
  digitalRevenue: number;
  cashRevenue: number;
  bookingCount: number;
  passengerCount: number;
}

type RangeOption = '6m' | '12m';
type DateBasis = 'booking' | 'travel';

function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseDateSafe(value?: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Handle YYYY-MM-DD in local time to prevent UTC day shift across month boundaries
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPhpCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactAxis(value: number): string {
  if (value === 0) return '₱0';
  if (Math.abs(value) >= 1_000_000) {
    return `₱${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₱${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  }
  return `₱${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    payload?: MonthlyRevenuePoint;
  }>;
}

const CustomRevenueTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg border border-slate-800 min-w-[210px]">
      <div className="text-xs font-medium text-slate-400">{point.fullLabel}</div>
      <div className="text-lg font-bold text-white tabular-nums mt-0.5">
        {formatPhpCurrency(point.revenue)}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Bookings</span>
          <span className="font-mono tabular-nums text-slate-100">
            {point.bookingCount} ({point.passengerCount} pax)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">GCash / Maya</span>
          <span className="font-mono tabular-nums text-emerald-400">
            {formatPhpCurrency(point.digitalRevenue)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Cash</span>
          <span className="font-mono tabular-nums text-amber-300">
            {formatPhpCurrency(point.cashRevenue)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyRevenueChart: React.FC<MonthlyRevenueChartProps> = ({ bookings, trips }) => {
  const [range, setRange] = useState<RangeOption>('6m');
  const [dateBasis, setDateBasis] = useState<DateBasis>('booking');

  const tripById = useMemo(() => {
    const map = new Map<string, Trip>();
    trips.forEach((trip) => map.set(trip.id, trip));
    return map;
  }, [trips]);

  const { chartData, periodTotal, periodBookings, peakMonth, currentMonthRevenue, momDeltaPercent } =
    useMemo(() => {
      const monthCount = range === '6m' ? 6 : 12;
      const revenueEligibleBookings = bookings.filter(
        (b) => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed'
      );

      // Anchor timeline to the latest relevant month (or current month if ahead/empty)
      const now = new Date();
      let anchorDate = new Date(now.getFullYear(), now.getMonth(), 1);

      revenueEligibleBookings.forEach((booking) => {
        const linkedTrip = tripById.get(booking.tripId);
        const targetDate =
          dateBasis === 'travel'
            ? parseDateSafe(linkedTrip?.travelDate) || parseDateSafe(booking.createdAt)
            : parseDateSafe(booking.paidAt) || parseDateSafe(booking.createdAt);

        if (targetDate) {
          const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
          if (monthStart.getTime() > anchorDate.getTime()) {
            anchorDate = monthStart;
          }
        }
      });

      const buckets = new Map<string, MonthlyRevenuePoint>();
      const orderedKeys: string[] = [];

      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
        const key = formatMonthKey(d);
        const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
        const shortYear = String(d.getFullYear()).slice(-2);
        const fullLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        orderedKeys.push(key);
        buckets.set(key, {
          monthKey: key,
          label: `${shortMonth} '${shortYear}`,
          fullLabel,
          revenue: 0,
          digitalRevenue: 0,
          cashRevenue: 0,
          bookingCount: 0,
          passengerCount: 0,
        });
      }

      revenueEligibleBookings.forEach((booking) => {
        const linkedTrip = tripById.get(booking.tripId);
        const targetDate =
          dateBasis === 'travel'
            ? parseDateSafe(linkedTrip?.travelDate) || parseDateSafe(booking.createdAt)
            : parseDateSafe(booking.paidAt) || parseDateSafe(booking.createdAt);

        if (!targetDate) return;
        const key = formatMonthKey(targetDate);
        const bucket = buckets.get(key);
        if (!bucket) return;

        const amount = Number.isFinite(booking.finalAmount) ? booking.finalAmount : 0;
        bucket.revenue += amount;
        if (booking.paymentMethod === 'cash') {
          bucket.cashRevenue += amount;
        } else {
          bucket.digitalRevenue += amount;
        }
        bucket.bookingCount += 1;
        bucket.passengerCount += booking.passengers.length;
      });

      const points = orderedKeys.map((k) => buckets.get(k)!);
      const total = points.reduce((sum, p) => sum + p.revenue, 0);
      const totalCount = points.reduce((sum, p) => sum + p.bookingCount, 0);

      let peak: MonthlyRevenuePoint | null = null;
      points.forEach((p) => {
        if (p.revenue > 0 && (!peak || p.revenue > peak.revenue)) {
          peak = p;
        }
      });

      const latest = points[points.length - 1];
      const previous = points.length >= 2 ? points[points.length - 2] : undefined;
      let delta: number | null = null;
      if (latest && previous && previous.revenue > 0) {
        delta = Math.round(((latest.revenue - previous.revenue) / previous.revenue) * 100);
      }

      return {
        chartData: points,
        periodTotal: total,
        periodBookings: totalCount,
        peakMonth: peak as MonthlyRevenuePoint | null,
        currentMonthRevenue: latest?.revenue ?? 0,
        momDeltaPercent: delta,
      };
    }, [bookings, tripById, range, dateBasis]);

  const hasAnyRevenue = periodTotal > 0;

  return (
    <section
      aria-label="Monthly Revenue"
      className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header & Interactive Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900">Monthly Revenue</h3>
            {momDeltaPercent !== null ? (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                  momDeltaPercent > 0
                    ? 'text-emerald-700'
                    : momDeltaPercent < 0
                    ? 'text-rose-700'
                    : 'text-slate-500'
                }`}
              >
                {momDeltaPercent > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : momDeltaPercent < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {momDeltaPercent > 0 ? `+${momDeltaPercent}%` : `${momDeltaPercent}%`} vs prior month
              </span>
            ) : (
              <span className="text-xs text-slate-500">Confirmed &amp; completed bookings (PHP)</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Period total:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatPhpCurrency(periodTotal)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Latest month:{' '}
              <strong className="font-mono tabular-nums text-teal-800">
                {formatPhpCurrency(currentMonthRevenue)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Bookings:{' '}
              <strong className="font-mono tabular-nums text-slate-900">{periodBookings}</strong>
            </span>
            {peakMonth && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Peak:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {peakMonth.label} ({formatPhpCurrency(peakMonth.revenue)})
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Functional Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Date grouping basis"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setDateBasis('booking')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dateBasis === 'booking'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Booking Date
            </button>
            <button
              type="button"
              onClick={() => setDateBasis('travel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dateBasis === 'travel'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Travel Date
            </button>
          </div>

          <div
            role="group"
            aria-label="Timeframe range"
            className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setRange('6m')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                range === '6m'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 Months
            </button>
            <button
              type="button"
              onClick={() => setRange('12m')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                range === '12m'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              12 Months
            </button>
          </div>
        </div>
      </div>

      {/* Line Chart Area */}
      <div className="relative w-full h-[300px] min-w-0">
        {!hasAnyRevenue && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 border border-slate-200 rounded-xl px-4 py-2.5 text-center max-w-sm">
              <p className="text-xs font-semibold text-slate-700">
                No confirmed booking revenue recorded in this {range === '6m' ? '6-month' : '12-month'} window
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly totals update automatically as passenger reservations are confirmed.
              </p>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 12 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={formatCompactAxis}
              tick={{ fill: '#64748b', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={60}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomRevenueTooltip />}
              cursor={{ stroke: '#0f766e', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Monthly Revenue"
              stroke="#0f766e"
              strokeWidth={2.75}
              dot={{ r: 4, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
