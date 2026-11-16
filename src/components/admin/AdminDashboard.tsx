import React, { useState, useEffect } from 'react';
import {
  Booking,
  Driver,
  Language,
  OperatingPolicy,
  RouteStop,
  Trip,
  Vehicle,
  PaymentRecord,
  PaymentTransaction,
  PaymentStatus,
  AuthUser,
  AuthAuditLog,
  AccountStatus,
  UserRole,
} from '../../types';
import { DICTIONARY } from '../../utils/translations';
import {
  addNotification,
  cancelBooking,
  saveDrivers,
  savePolicy,
  saveStops,
  saveTrips,
  saveVehicles,
  deleteDriver,
  clearAllDrivers,
  restoreSampleDrivers,
  verifyDriver,
} from '../../utils/storage';
import { STANDARD_HIACE_SEATS } from '../../data/mockInitialData';
import {
  fetchAdminPaymentTransactions,
  requestServerRefund,
  fetchPaymentConfig,
  PaymentConfigResponse,
} from '../../utils/paymentApi';
import { authApi } from '../../utils/authApi';
import {
  TrendingUp,
  Users,
  Calendar,
  Bus,
  MapPin,
  Settings,
  Plus,
  Download,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Clock,
  Shield,
  FileSpreadsheet,
  CreditCard,
  Lock,
  RefreshCw,
  Receipt,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  UserX,
  Key,
  ShieldAlert,
  History,
  Activity,
  UserPlus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { GoogleWorkspacePanel } from '../common/GoogleWorkspacePanel';
import { AdminApprovalView } from './AdminApprovalView';
import { MonthlyRevenueChart } from './MonthlyRevenueChart';
import { DriverPerformanceOverview } from './DriverPerformanceOverview';

interface AdminDashboardProps {
  trips: Trip[];
  bookings: Booking[];
  stops: RouteStop[];
  vehicles: Vehicle[];
  drivers: Driver[];
  policy: OperatingPolicy;
  language: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  trips,
  bookings,
  stops,
  vehicles,
  drivers,
  policy,
  language,
}) => {
  const t = DICTIONARY[language];
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'approvals'
    | 'trips'
    | 'bookings'
    | 'payments'
    | 'workspace'
    | 'users'
    | 'audit'
    | 'fleet'
    | 'drivers'
    | 'stops'
    | 'policies'
    | 'broadcast'
  >('overview');

  // Search & Filters for Bookings
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');

  // PayMongo Payment Management States
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<PaymentTransaction[]>([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [gatewayConfig, setGatewayConfig] = useState<PaymentConfigResponse | null>(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<PaymentRecord | null>(null);
  const [refundTargetPayment, setRefundTargetPayment] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('Passenger requested schedule cancellation');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundSuccessNotice, setRefundSuccessNotice] = useState<string | null>(null);

  const [showAddTripModal, setShowAddTripModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  // User Management & Security Audit States
  const [userAccounts, setUserAccounts] = useState<AuthUser[]>([]);
  const [securityAuditLogs, setSecurityAuditLogs] = useState<AuthAuditLog[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'driver' as UserRole,
    password: '',
    driverId: drivers[0]?.id || 'drv-01',
  });
  const [userActionNotice, setUserActionNotice] = useState<string | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // New Trip form state
  const [newTripData, setNewTripData] = useState({
    direction: 'buliluyan_to_puerto' as const,
    travelDate: new Date().toISOString().split('T')[0],
    departureTime: '08:00',
    estimatedArrivalTime: '13:40',
    vehicleId: vehicles[0]?.id || '',
    driverId: drivers[0]?.id || '',
    baseFare: policy.fullRouteFare || 850,
    notes: 'Standard aircon shuttle',
  });

  // New Vehicle form state
  const [newVehicleData, setNewVehicleData] = useState({
    model: 'Toyota HiAce Commuter 2025',
    plateNumber: 'ABC 1234',
    capacity: 14,
    hasAircon: true,
  });

  // New Driver form state
  const [newDriverData, setNewDriverData] = useState({
    name: 'Kuya Joel Reyes',
    phone: '0917-333-8899',
    licenseNumber: 'N03-20-998811',
  });

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSentNotice, setBroadcastSentNotice] = useState(false);

  // Policy edit state
  const [editablePolicy, setEditablePolicy] = useState<OperatingPolicy>({ ...policy });
  const [policySavedNotice, setPolicySavedNotice] = useState(false);

  // Financial & Operational Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrips = trips.filter((t) => t.travelDate === todayStr);
  const totalBookingsCount = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'confirmed');

  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.finalAmount, 0);
  const gcashRevenue = confirmedBookings
    .filter((b) => b.paymentMethod === 'gcash')
    .reduce((sum, b) => sum + b.finalAmount, 0);
  const mayaRevenue = confirmedBookings
    .filter((b) => b.paymentMethod === 'maya')
    .reduce((sum, b) => sum + b.finalAmount, 0);
  const cashRevenue = confirmedBookings
    .filter((b) => b.paymentMethod === 'cash')
    .reduce((sum, b) => sum + b.finalAmount, 0);

  const totalSeatsCapacity = todayTrips.reduce((sum, t) => sum + t.seatCapacity, 0);
  const totalBookedSeatsToday = todayTrips.reduce((sum, t) => sum + t.bookedSeatIds.length, 0);
  const occupancyPercentage =
    totalSeatsCapacity > 0 ? Math.round((totalBookedSeatsToday / totalSeatsCapacity) * 100) : 0;

  // Add Trip Handler
  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Trip = {
      id: `trip-${Date.now()}`,
      tripNumber: `BTR-${Math.floor(100 + Math.random() * 900)}`,
      direction: newTripData.direction,
      originStopId:
        newTripData.direction === 'buliluyan_to_puerto' ? 'stop-buliluyan' : 'stop-puerto',
      destinationStopId:
        newTripData.direction === 'buliluyan_to_puerto' ? 'stop-puerto' : 'stop-buliluyan',
      travelDate: newTripData.travelDate,
      departureTime: newTripData.departureTime,
      estimatedArrivalTime: newTripData.estimatedArrivalTime,
      vehicleId: newTripData.vehicleId,
      driverId: newTripData.driverId,
      baseFare: Number(newTripData.baseFare),
      status: 'scheduled',
      seatCapacity: 14,
      bookedSeatIds: [],
      blockedSeatIds: [],
      notes: newTripData.notes,
    };
    saveTrips([created, ...trips]);
    setShowAddTripModal(false);
  };

  // Add Vehicle Handler
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Vehicle = {
      id: `veh-${Date.now()}`,
      plateNumber: newVehicleData.plateNumber.toUpperCase(),
      model: newVehicleData.model,
      capacity: newVehicleData.capacity,
      hasAircon: newVehicleData.hasAircon,
      status: 'active',
      seats: STANDARD_HIACE_SEATS,
    };
    saveVehicles([created, ...vehicles]);
    setShowAddVehicleModal(false);
  };

  // Add Driver Handler
  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Driver = {
      id: `drv-${Date.now()}`,
      name: newDriverData.name,
      phone: newDriverData.phone,
      licenseNumber: newDriverData.licenseNumber,
      rating: 5.0,
      tripsCompleted: 0,
    };
    saveDrivers([created, ...drivers]);
    setShowAddDriverModal(false);
  };

  // Broadcast Notification
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;

    addNotification({
      title: broadcastTitle,
      message: broadcastMessage,
      type: 'broadcast',
    });

    setBroadcastSentNotice(true);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setTimeout(() => setBroadcastSentNotice(false), 3000);
  };

  // Save Policy
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    savePolicy(editablePolicy);
    setPolicySavedNotice(true);
    setTimeout(() => setPolicySavedNotice(false), 3000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Booking Reference',
      'Contact Name',
      'Contact Phone',
      'Travel Date',
      'Trip Number',
      'Pickup Stop',
      'Dropoff Stop',
      'Passenger Count',
      'Seat Numbers',
      'Total Fare PHP',
      'Payment Method',
      'Payment Status',
      'Booking Status',
    ];

    const rows = bookings.map((b) => {
      const trip = trips.find((t) => t.id === b.tripId);
      const pickup = stops.find((s) => s.id === b.pickupStopId)?.name || b.pickupStopId;
      const dropoff = stops.find((s) => s.id === b.dropoffStopId)?.name || b.dropoffStopId;

      return [
        b.bookingReference,
        `"${b.contactName}"`,
        b.contactPhone,
        trip?.travelDate || 'N/A',
        trip?.tripNumber || 'N/A',
        `"${pickup}"`,
        `"${dropoff}"`,
        b.passengers.length,
        `"${b.passengers.map((p) => p.seatLabel).join(', ')}"`,
        b.finalAmount,
        b.paymentMethod,
        b.paymentStatus,
        b.bookingStatus,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BTR_Bookings_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Payment Management Effects & Handlers
  const loadPaymentTransactions = () => {
    fetchAdminPaymentTransactions().then((res) => {
      setPaymentRecords(res.payments || []);
      setAuditLogs(res.auditLogs || []);
    }).catch(() => {});
  };

  const loadUserAccounts = () => {
    authApi.adminGetUsers().then((res) => setUserAccounts(res)).catch(() => {});
  };

  const loadSecurityAuditLogs = () => {
    authApi.getAuditLogs(100).then((res) => setSecurityAuditLogs(res)).catch(() => {});
  };

  const handleToggleUserStatus = async (targetUser: AuthUser) => {
    const nextStatus: AccountStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
    try {
      setIsUpdatingUser(true);
      await authApi.adminUpdateUserStatus(targetUser.id, nextStatus);
      setUserActionNotice(`Account for ${targetUser.name} is now ${nextStatus.toUpperCase()}.`);
      loadUserAccounts();
      loadSecurityAuditLogs();
      setTimeout(() => setUserActionNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleApproveDriver = async (driverId: string) => {
    verifyDriver(driverId);
    const matchedUser = userAccounts.find((u) => u.driverId === driverId);
    if (matchedUser && matchedUser.status === 'pending_verification') {
      try {
        await authApi.adminUpdateUserStatus(matchedUser.id, 'active');
        loadUserAccounts();
      } catch (err) {
        console.warn('Failed to update server user account status:', err);
      }
    }
    const targetDriver = drivers.find((d) => d.id === driverId);
    setUserActionNotice(`Driver ${targetDriver?.name || driverId} approved! Route operations unlocked.`);
    loadUserAccounts();
    setTimeout(() => setUserActionNotice(null), 4000);
  };

  const handleCreateStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingUser(true);
      await authApi.adminCreateUser({
        name: newStaffData.name,
        email: newStaffData.email,
        phone: newStaffData.phone,
        role: newStaffData.role,
        password: newStaffData.password,
        driverId: newStaffData.role === 'driver' ? newStaffData.driverId : undefined,
      });
      setUserActionNotice(`Staff account for ${newStaffData.name} created successfully!`);
      setShowAddStaffModal(false);
      setNewStaffData({
        name: '',
        email: '',
        phone: '',
        role: 'driver',
        password: '',
        driverId: drivers[0]?.id || 'drv-01',
      });
      loadUserAccounts();
      loadSecurityAuditLogs();
      setTimeout(() => setUserActionNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to create staff account.');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  useEffect(() => {
    fetchPaymentConfig().then((cfg) => setGatewayConfig(cfg)).catch(() => {});
    loadPaymentTransactions();
    loadUserAccounts();
    loadSecurityAuditLogs();
    const interval = setInterval(() => {
      loadPaymentTransactions();
      loadSecurityAuditLogs();
    }, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  const handleExportPaymentsCSV = () => {
    const headers = [
      'Payment ID',
      'Booking Reference',
      'Gateway',
      'Gateway Session ID',
      'Transaction Reference',
      'Payment Method',
      'Amount PHP',
      'Status',
      'Created At',
      'Paid At',
      'Refunded Amount',
    ];
    const rows = paymentRecords.map((p) => [
      p.id,
      p.bookingReference,
      p.paymentGateway,
      p.gatewaySessionId || 'N/A',
      p.gatewayTransactionRef || 'N/A',
      p.paymentMethod,
      p.amount,
      p.paymentStatus,
      p.createdAt,
      p.paidAt || 'N/A',
      p.refundedAmount || 0,
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BTR_PayMongo_Payments_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTargetPayment) return;
    setIsProcessingRefund(true);
    try {
      const res = await requestServerRefund(refundTargetPayment.id, refundReason, refundTargetPayment.amount);
      if (res.success) {
        setRefundSuccessNotice(`Refund of ₱${res.refundAmount} successfully processed and logged!`);
        loadPaymentTransactions();
        setTimeout(() => {
          setRefundTargetPayment(null);
          setRefundSuccessNotice(null);
        }, 2200);
      }
    } catch (err: any) {
      alert(err.message || 'Refund processing failed');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  // Filtered bookings
  const filteredBookings = bookings.filter((b) => {
    const matchSearch =
      b.bookingReference.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.contactName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.passengers.some((p) => p.fullName.toLowerCase().includes(bookingSearch.toLowerCase()));

    const matchStatus =
      bookingStatusFilter === 'all' ? true : b.bookingStatus === bookingStatusFilter;

    return matchSearch && matchStatus;
  });

  // Filtered payments
  const filteredPayments = paymentRecords.filter((p) => {
    const matchSearch =
      p.bookingReference.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      p.id.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      (p.gatewayTransactionRef && p.gatewayTransactionRef.toLowerCase().includes(paymentSearch.toLowerCase())) ||
      (p.gatewaySessionId && p.gatewaySessionId.toLowerCase().includes(paymentSearch.toLowerCase()));

    const matchStatus = paymentStatusFilter === 'all' ? true : p.paymentStatus === paymentStatusFilter;
    const matchMethod = paymentMethodFilter === 'all' ? true : p.paymentMethod === paymentMethodFilter;

    return matchSearch && matchStatus && matchMethod;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">
              Administrator Portal
            </span>
            <span className="text-xs text-slate-400">Buliluyan · Bataraza · Puerto Princesa</span>
          </div>
          <h2 className="text-2xl font-bold mt-1.5">{t.adminDashboard}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fleet scheduling, fare policies, real-time manifests, and financial accounting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPaymentsCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Export Payments CSV</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Export Bookings CSV</span>
          </button>
          <button
            onClick={() => setShowAddTripModal(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trip Departure</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Revenue' },
          {
            id: 'approvals',
            label: `Driver Approvals (${
              drivers.filter((d) => d.verificationStatus === 'pending_verification').length ||
              userAccounts.filter((u) => u.role === 'driver' && u.status === 'pending_verification').length
            })`,
          },
          { id: 'trips', label: `Trips (${trips.length})` },
          { id: 'bookings', label: `Bookings (${bookings.length})` },
          { id: 'payments', label: `Payments & PayMongo (${paymentRecords.length})` },
          { id: 'workspace', label: 'Google Workspace (Drive/Tasks/Docs/Gmail)' },
          { id: 'users', label: `Users & RBAC (${userAccounts.length})` },
          { id: 'audit', label: `Security Logs (${securityAuditLogs.length})` },
          { id: 'fleet', label: `Fleet (${vehicles.length})` },
          { id: 'drivers', label: `Drivers (${drivers.length})` },
          { id: 'stops', label: `Stops & Fares (${stops.length})` },
          { id: 'policies', label: 'Pricing & Policies' },
          { id: 'broadcast', label: 'Passenger Broadcast' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: DRIVER APPROVALS (FIRESTORE) */}
      {activeTab === 'approvals' && (
        <AdminApprovalView
          drivers={drivers}
          vehicles={vehicles}
          userAccounts={userAccounts}
          onRefreshUsers={loadUserAccounts}
        />
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Revenue
              </span>
              <div className="text-2xl font-black text-teal-950 mt-1">₱{totalRevenue} PHP</div>
              <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-2">
                <span>GCash: ₱{gcashRevenue}</span>
                <span>·</span>
                <span>Maya: ₱{mayaRevenue}</span>
                <span>·</span>
                <span>Cash: ₱{cashRevenue}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Today's Departures
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {todayTrips.length} Trips
              </div>
              <p className="text-[11px] text-teal-700 mt-2 font-medium">
                {todayTrips.filter((t) => t.status === 'departed').length} departed ·{' '}
                {todayTrips.filter((t) => t.status === 'boarding').length} boarding
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Occupancy Rate (Today)
              </span>
              <div className="text-2xl font-black text-emerald-800 mt-1">{occupancyPercentage}%</div>
              <p className="text-[11px] text-slate-500 mt-2">
                {totalBookedSeatsToday} of {totalSeatsCapacity} seats filled
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Confirmed Bookings
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {confirmedBookings.length}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {bookings.filter((b) => b.bookingStatus === 'cancelled').length} cancellations
              </p>
            </div>
          </div>

          {/* Monthly Revenue Line Chart */}
          <MonthlyRevenueChart bookings={bookings} trips={trips} />

          {/* Driver Performance Overview Chart */}
          <DriverPerformanceOverview
            drivers={drivers}
            trips={trips}
            vehicles={vehicles}
            userAccounts={userAccounts}
            onNavigateTab={setActiveTab}
          />

          {/* Today's Schedule Snapshot */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900">Today's Shuttle Run Manifests</h3>
            <div className="divide-y divide-slate-100">
              {todayTrips.map((tr) => {
                const veh = vehicles.find((v) => v.id === tr.vehicleId);
                const drv = drivers.find((d) => d.id === tr.driverId);
                const bookedCount = tr.bookedSeatIds.length;

                return (
                  <div key={tr.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                          {tr.tripNumber}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          {tr.direction === 'buliluyan_to_puerto'
                            ? 'Buliluyan → Puerto Princesa'
                            : 'Puerto Princesa → Buliluyan'}
                        </span>
                        <span className="text-xs font-bold text-teal-800">
                          Departure: {tr.departureTime}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Vehicle: {veh?.plateNumber || 'VAR 8920'} · Driver:{' '}
                        {drv ? (
                          <span className="font-semibold text-slate-700">{drv.name}</span>
                        ) : (
                          <span className="text-amber-700 font-semibold italic">Unassigned (Pending)</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">
                        {bookedCount} / {tr.seatCapacity} seats booked
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${
                          tr.status === 'boarding'
                            ? 'bg-amber-100 text-amber-900'
                            : tr.status === 'departed'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {tr.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRIPS & SCHEDULES */}
      {activeTab === 'trips' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">Scheduled Trips</h3>
              <p className="text-xs text-slate-500">
                All daily passenger shuttle departures between Buliluyan and Puerto Princesa.
              </p>
            </div>
            <button
              onClick={() => setShowAddTripModal(true)}
              className="px-3.5 py-2 bg-teal-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Departure</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Trip #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Direction</th>
                  <th className="py-3 px-3">Times</th>
                  <th className="py-3 px-3">Vehicle & Plate</th>
                  <th className="py-3 px-3">Driver</th>
                  <th className="py-3 px-3">Fare</th>
                  <th className="py-3 px-3">Seats</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map((tr) => {
                  const veh = vehicles.find((v) => v.id === tr.vehicleId);
                  const drv = drivers.find((d) => d.id === tr.driverId);
                  return (
                    <tr key={tr.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-teal-900">
                        {tr.tripNumber}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">{tr.travelDate}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {tr.direction === 'buliluyan_to_puerto'
                          ? 'Buliluyan → PPS'
                          : 'PPS → Buliluyan'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900">{tr.departureTime}</span> -{' '}
                        <span className="text-slate-500">{tr.estimatedArrivalTime}</span>
                      </td>
                      <td className="py-3 px-3 font-medium">{veh?.plateNumber || 'VAR 8920'}</td>
                      <td className="py-3 px-3 font-medium">
                        {drv ? (
                          drv.name
                        ) : (
                          <span className="text-amber-700 font-semibold italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold font-mono">₱{tr.baseFare}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold">{tr.bookedSeatIds.length}</span> /{' '}
                        {tr.seatCapacity}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full capitalize">
                          {tr.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BOOKINGS MANAGEMENT */}
      {activeTab === 'bookings' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">Passenger Reservations</h3>
              <p className="text-xs text-slate-500">
                Search, inspect, and modify passenger bookings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search reference or name..."
                  className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700 w-52 sm:w-64"
                />
              </div>

              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Passengers & Seats</th>
                  <th className="py-3 px-3">Route Segment</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const pickup = stops.find((s) => s.id === b.pickupStopId)?.name;
                  const dropoff = stops.find((s) => s.id === b.dropoffStopId)?.name;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-teal-950">
                        {b.bookingReference}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{b.contactName}</div>
                        <div className="text-[11px] text-slate-500">{b.contactPhone}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">
                          {b.passengers.map((p) => p.fullName).join(', ')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Seats: {b.passengers.map((p) => p.seatLabel).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{pickup}</div>
                        <div className="text-slate-400 text-[10px]">to {dropoff}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">₱{b.finalAmount}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {b.paymentStatus.toUpperCase()} ({b.paymentMethod})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            b.bookingStatus === 'confirmed'
                              ? 'bg-teal-100 text-teal-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {b.bookingStatus.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {b.bookingStatus === 'confirmed' && (
                          <button
                            onClick={() => cancelBooking(b.id, 'Admin cancellation')}
                            className="text-[11px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS & PAYMONGO GATEWAY */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Gateway Status & Health Card */}
          <div className="bg-gradient-to-r from-slate-900 to-teal-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-800/80 border border-teal-600 flex items-center justify-center font-bold text-emerald-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">PayMongo Payment Gateway</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        gatewayConfig?.hasValidCredentials
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {gatewayConfig?.hasValidCredentials
                        ? gatewayConfig.isLive
                          ? 'LIVE PRODUCTION GATEWAY'
                          : 'TEST SANDBOX ACTIVE'
                        : 'TEST SIMULATION (NO SECRET KEY CONFIGURED)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Official PCI-DSS compliant checkout session processing for GCash, Maya, Debit/Credit Card, and QR Ph.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadPaymentTransactions}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Integration Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Webhook Endpoint
                </span>
                <span className="font-mono text-teal-300 text-[11px] break-all block mt-0.5">
                  /api/payments/webhook
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  HMAC-SHA256 Signature Verification
                </span>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Supported Methods
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {['GCash', 'Maya', 'Card', 'GrabPay', 'QR Ph', 'Cash'].map((m) => (
                    <span
                      key={m}
                      className="text-[10px] bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/60">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">
                  Idempotency & Concurrency
                </span>
                <span className="text-[11px] text-slate-300 block mt-0.5">
                  Duplicate webhook & payment protection enabled
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Server-side amount & fare integrity check
                </span>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Collections
              </span>
              <div className="text-2xl font-black text-teal-950 mt-1">
                ₱
                {paymentRecords
                  .filter((p) => p.paymentStatus === 'paid')
                  .reduce((sum, p) => sum + p.amount, 0)}{' '}
                <span className="text-xs font-normal text-slate-500">PHP</span>
              </div>
              <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                {paymentRecords.filter((p) => p.paymentStatus === 'paid').length} verified transactions
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                GCash Collections
              </span>
              <div className="text-2xl font-black text-blue-900 mt-1">
                ₱
                {paymentRecords
                  .filter((p) => p.paymentMethod === 'gcash' && p.paymentStatus === 'paid')
                  .reduce((sum, p) => sum + p.amount, 0)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Direct e-wallet authorization</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Maya & Card Collections
              </span>
              <div className="text-2xl font-black text-emerald-900 mt-1">
                ₱
                {paymentRecords
                  .filter((p) => (p.paymentMethod === 'maya' || p.paymentMethod === 'card') && p.paymentStatus === 'paid')
                  .reduce((sum, p) => sum + p.amount, 0)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">QR Ph & Card Gateways</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Refunds Processed
              </span>
              <div className="text-2xl font-black text-rose-900 mt-1">
                ₱
                {paymentRecords
                  .filter((p) => p.paymentStatus === 'refunded')
                  .reduce((sum, p) => sum + (p.refundedAmount || p.amount), 0)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {paymentRecords.filter((p) => p.paymentStatus === 'refunded').length} refunded
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Payment Transactions</h3>
                <p className="text-xs text-slate-500">
                  Real-time gateway records, transaction IDs, checkout sessions, and status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                    placeholder="Search ref, session, or ID..."
                    className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700 w-52 sm:w-60"
                  />
                </div>

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                  <option value="expired">Expired</option>
                </select>

                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="all">All Methods</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No payment transactions matching your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Booking Ref</th>
                      <th className="py-3 px-3">Gateway & Session ID</th>
                      <th className="py-3 px-3">Method</th>
                      <th className="py-3 px-3">Amount (PHP)</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => {
                      const isPaid = p.paymentStatus === 'paid';
                      const isRefunded = p.paymentStatus === 'refunded';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-teal-950">
                            {p.bookingReference}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-[11px] text-slate-800 truncate max-w-[170px]">
                              {p.gatewayTransactionRef || p.gatewaySessionId || p.id}
                            </div>
                            <span className="text-[10px] text-slate-400 uppercase font-medium">
                              {p.paymentGateway}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            ₱{p.amount}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isRefunded
                                  ? 'bg-purple-100 text-purple-900'
                                  : p.paymentStatus === 'failed' || p.paymentStatus === 'expired'
                                  ? 'bg-rose-100 text-rose-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {p.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {new Date(p.createdAt).toLocaleDateString()}{' '}
                            {new Date(p.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedPaymentDetail(p)}
                                className="px-2.5 py-1 text-teal-800 hover:bg-teal-50 font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                Details
                              </button>
                              {isPaid && !isRefunded && (
                                <button
                                  onClick={() => {
                                    setRefundTargetPayment(p);
                                    setRefundReason('Customer cancellation per operator policy');
                                  }}
                                  className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Trail & Webhook Event Logs */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-700" />
                <span>Audited Gateway Activity & Webhooks</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Latest {auditLogs.length} logged events
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No audit logs recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.event === 'payment_success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.event === 'refund_completed'
                            ? 'bg-purple-100 text-purple-900'
                            : log.event === 'payment_failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {log.event}
                      </span>
                      <span className="font-bold text-slate-800">{log.bookingReference}</span>
                      <span className="text-slate-500 font-sans">{log.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: FLEET VEHICLES */}
      {activeTab === 'fleet' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-900">Vehicle Fleet</h3>
              <p className="text-xs text-slate-500">
                BTR Transport passenger vans operating between Buliluyan and Puerto Princesa.
              </p>
            </div>
            <button
              onClick={() => setShowAddVehicleModal(true)}
              className="px-3.5 py-2 bg-teal-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vehicle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <div key={v.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-900">
                    {v.plateNumber}
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full capitalize">
                    {v.status}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900">{v.model}</h4>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div>Passenger Capacity: {v.capacity} seats</div>
                  <div>Air-Conditioning: {v.hasAircon ? 'Dual Aircon System' : 'Standard'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DRIVERS ROSTER */}
      {activeTab === 'drivers' && (
        <div className="space-y-6">
          <AdminApprovalView
            drivers={drivers}
            vehicles={vehicles}
            userAccounts={userAccounts}
            onRefreshUsers={loadUserAccounts}
          />
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">Drivers & Dispatch Staff</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {drivers.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Licensed professional drivers assigned to Palawan transit corridors.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {drivers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to remove all drivers from the fleet roster? Trips will be marked as unassigned.')) {
                      clearAllDrivers();
                    }
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Remove all drivers from the roster"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Clear All Drivers</span>
                </button>
              )}
              {drivers.length === 0 && (
                <button
                  type="button"
                  onClick={() => restoreSampleDrivers()}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Restore Sample Drivers</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAddDriverModal(true)}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Driver</span>
              </button>
            </div>
          </div>

          {drivers.length === 0 ? (
            <div className="py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                <Users className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-extrabold text-base text-slate-900">No Drivers on Active Roster</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All drivers have been removed from the fleet roster. All scheduled shuttle trips remain active and marked as unassigned. You can register new licensed drivers or load sample profiles.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(true)}
                  className="px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Driver</span>
                </button>
                <button
                  type="button"
                  onClick={() => restoreSampleDrivers()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Restore Sample Drivers</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 border rounded-2xl bg-white space-y-2.5 shadow-xs relative group ${
                    d.verificationStatus === 'pending_verification'
                      ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{d.name}</h4>
                      {d.verificationStatus === 'pending_verification' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md mt-0.5">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>Pending Verification</span>
                        </span>
                      ) : d.verificationStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md mt-0.5">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 mt-0.5">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Active / Verified</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        ★ {d.rating}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${d.name} from the driver roster?`)) {
                            deleteDriver(d.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete driver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Mobile: <a href={`tel:${d.phone}`} className="text-teal-700 font-medium">{d.phone}</a></div>
                    <div>License: <strong className="font-mono text-slate-800">{d.licenseNumber}</strong></div>
                    <div>Trips Completed: <strong className="text-slate-900">{d.tripsCompleted}</strong></div>
                  </div>

                  {/* Verification action */}
                  {d.verificationStatus === 'pending_verification' && (
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-amber-800 font-medium">Needs Admin Approval</span>
                      <button
                        type="button"
                        onClick={() => handleApproveDriver(d.id)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve & Authorize</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* TAB 6: STOPS & PRICING */}
      {activeTab === 'stops' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Approved Highway Stops</h3>
            <p className="text-xs text-slate-500">
              Intermediate municipalities and pickup spots along South Palawan Highway.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Order</th>
                  <th className="py-3 px-3">Stop Name</th>
                  <th className="py-3 px-3">Municipality</th>
                  <th className="py-3 px-3">Official Landmark</th>
                  <th className="py-3 px-3">Fare from Buliluyan</th>
                  <th className="py-3 px-3">Fare from Puerto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stops.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-400">{s.orderFromBuliluyan + 1}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-3 font-medium text-teal-800">{s.municipality}</td>
                    <td className="py-3 px-3 text-slate-600">{s.landmark}</td>
                    <td className="py-3 px-3 font-mono font-bold">₱{s.fareFromBuliluyan}</td>
                    <td className="py-3 px-3 font-mono font-bold">₱{s.fareFromPuerto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: OPERATING POLICIES & FARE SETTINGS */}
      {activeTab === 'policies' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="font-bold text-base text-slate-900">Operating Policies & Pricing Settings</h3>
            <p className="text-xs text-slate-500">
              Configure standard fares, statutory discounts, cancellation terms, and cash booking rules.
            </p>
          </div>

          {policySavedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Policies saved successfully.</span>
            </div>
          )}

          <form onSubmit={handleSavePolicy} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Route Base Fare (PHP)
              </label>
              <input
                type="number"
                value={editablePolicy.fullRouteFare}
                onChange={(e) =>
                  setEditablePolicy({ ...editablePolicy, fullRouteFare: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Senior / Student / PWD Statutory Discount (%)
              </label>
              <input
                type="number"
                value={editablePolicy.seniorStudentDiscountPercent}
                onChange={(e) =>
                  setEditablePolicy({
                    ...editablePolicy,
                    seniorStudentDiscountPercent: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Seat Hold Timeout (Minutes)
              </label>
              <input
                type="number"
                value={editablePolicy.seatHoldMinutes}
                onChange={(e) =>
                  setEditablePolicy({
                    ...editablePolicy,
                    seatHoldMinutes: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hours Before Trip for 100% Refund
              </label>
              <input
                type="number"
                value={editablePolicy.refundPolicy.hoursBeforeTripForFullRefund}
                onChange={(e) =>
                  setEditablePolicy({
                    ...editablePolicy,
                    refundPolicy: {
                      ...editablePolicy.refundPolicy,
                      hoursBeforeTripForFullRefund: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="allowCash"
                checked={editablePolicy.allowCashPayments}
                onChange={(e) =>
                  setEditablePolicy({ ...editablePolicy, allowCashPayments: e.target.checked })
                }
                className="rounded border-slate-300 text-teal-800 focus:ring-teal-700 cursor-pointer"
              />
              <label htmlFor="allowCash" className="font-semibold text-slate-800 cursor-pointer">
                Enable Cash on Departure / Terminal Payment Option for Passengers
              </label>
            </div>

            <div className="sm:col-span-2 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl cursor-pointer shadow-sm transition-colors"
              >
                Save Policies
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 8: BROADCAST NOTIFICATIONS */}
      {activeTab === 'broadcast' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4 max-w-2xl">
          <div>
            <h3 className="font-bold text-base text-slate-900">Broadcast Passenger Notification</h3>
            <p className="text-xs text-slate-500">
              Send road advisory, weather alerts, or departure notices to all active passengers.
            </p>
          </div>

          {broadcastSentNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Broadcast dispatched to passenger notification center!</span>
            </div>
          )}

          <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alert Title</label>
              <input
                type="text"
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Weather Advisory: Balabac Ferry Crossing"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alert Message</label>
              <textarea
                required
                rows={3}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="e.g. Please note morning vans are on regular schedule. Heavy rain caution between Brooke's Point and Española."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Send Broadcast</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB: GOOGLE WORKSPACE ENTERPRISE */}
      {activeTab === 'workspace' && (
        <GoogleWorkspacePanel
          trips={trips}
          bookings={bookings}
          vehicles={vehicles}
          drivers={drivers}
        />
      )}

      {/* TAB: USER ACCOUNTS & RBAC */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
                  Access Management
                </span>
                <span className="text-xs text-slate-500">BTR Transport Security</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                User Accounts & Role-Based Access Control
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage passenger self-registrations, driver vehicle associations, and dispatch supervisor credentials.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadUserAccounts}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Accounts</span>
              </button>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Driver / Staff Account</span>
              </button>
            </div>
          </div>

          {userActionNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{userActionNotice}</span>
            </div>
          )}

          {/* Account Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Accounts</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{userAccounts.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">Active</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {userAccounts.filter((u) => u.status === 'active').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-blue-600 uppercase">Passengers</div>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {userAccounts.filter((u) => u.role === 'passenger').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-teal-700 uppercase">Drivers</div>
              <div className="text-2xl font-black text-teal-700 mt-1">
                {userAccounts.filter((u) => u.role === 'driver').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase">Dispatch Admins</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {userAccounts.filter((u) => u.role === 'admin').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 text-center shadow-xs">
              <div className="text-[11px] font-bold text-rose-600 uppercase">Suspended</div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {userAccounts.filter((u) => u.status === 'suspended').length}
              </div>
            </div>
          </div>

          {/* Filters & Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user by name, email, or phone..."
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none bg-white"
                >
                  <option value="all">All Roles</option>
                  <option value="passenger">Passengers</option>
                  <option value="driver">Drivers</option>
                  <option value="admin">Administrators</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending_verification">Pending Verification</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">User Details</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Account Status</th>
                    <th className="pb-3 font-semibold">Registered</th>
                    <th className="pb-3 font-semibold">Last Active</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userAccounts
                    .filter((u) => {
                      const matchSearch =
                        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                        (u.phone && u.phone.includes(userSearch));
                      const matchRole = userRoleFilter === 'all' ? true : u.role === userRoleFilter;
                      const matchStatus = userStatusFilter === 'all' ? true : u.status === userStatusFilter;
                      return matchSearch && matchRole && matchStatus;
                    })
                    .map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-900">{acc.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{acc.email}</div>
                          {acc.phone && (
                            <div className="text-[10px] text-slate-400">{acc.phone}</div>
                          )}
                        </td>

                        <td className="py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                              acc.role === 'admin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : acc.role === 'driver'
                                ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-300'
                            }`}
                          >
                            {acc.role}
                          </span>
                          {acc.driverId && (
                            <div className="text-[10px] text-teal-700 font-mono mt-0.5">
                              ID: {acc.driverId}
                            </div>
                          )}
                        </td>

                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              acc.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : acc.status === 'pending_verification'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                                : acc.status === 'rejected' || acc.status === 'suspended'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {acc.status === 'pending_verification' ? 'Pending Verification' : acc.status}
                          </span>
                        </td>

                        <td className="py-3 text-slate-600 text-[11px]">
                          {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : 'N/A'}
                        </td>

                        <td className="py-3 text-slate-600 text-[11px]">
                          {acc.lastLoginAt ? new Date(acc.lastLoginAt).toLocaleString() : 'Never'}
                        </td>

                        <td className="py-3 text-right">
                          {acc.status === 'pending_verification' ? (
                            <button
                              disabled={isUpdatingUser}
                              onClick={() => handleApproveDriver(acc.driverId || '')}
                              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1 shadow-xs"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Approve Driver</span>
                            </button>
                          ) : (
                            <button
                              disabled={isUpdatingUser || acc.role === 'admin'}
                              onClick={() => handleToggleUserStatus(acc)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                acc.status === 'suspended'
                                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                              title={acc.role === 'admin' ? 'Primary admin cannot be suspended' : ''}
                            >
                              {acc.status === 'suspended' ? 'Activate Account' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: SECURITY & AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">
                  Security Log
                </span>
                <span className="text-xs text-slate-400">Append-Only Audit Trail</span>
              </div>
              <h3 className="text-xl font-bold mt-1">Authentication & Authorization Audit Logs</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time monitoring of sign-ins, logouts, password resets, and unauthorized portal access attempts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadSecurityAuditLogs}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-300" />
                <span>Refresh Log</span>
              </button>
            </div>
          </div>

          {/* Audit Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Audit Events</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{securityAuditLogs.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase">Logins Success</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {securityAuditLogs.filter((l) => l.action === 'login_success').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase">Failed Logins</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {securityAuditLogs.filter((l) => l.action === 'login_failed').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-xs">
              <div className="text-[11px] font-bold text-rose-600 uppercase">Unauthorized Attempts</div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {securityAuditLogs.filter((l) => l.action === 'unauthorized_access_attempt').length}
              </div>
            </div>
          </div>

          {/* Audit Events Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Recent Security Audit Records</h4>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl font-medium focus:outline-none bg-white"
              >
                <option value="all">All Events</option>
                <option value="login_success">Login Success</option>
                <option value="login_failed">Login Failed</option>
                <option value="unauthorized_access_attempt">Unauthorized Access Attempts</option>
                <option value="logout">Logout</option>
                <option value="register">Registration</option>
                <option value="password_reset_request">Password Reset Requests</option>
                <option value="account_suspended">Account Suspended</option>
                <option value="account_activated">Account Activated</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold">Event</th>
                    <th className="pb-3 font-semibold">Account / Email</th>
                    <th className="pb-3 font-semibold">IP Address</th>
                    <th className="pb-3 font-semibold">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {securityAuditLogs
                    .filter((l) => auditActionFilter === 'all' || l.action === auditActionFilter)
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                              log.action === 'login_success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action === 'login_failed'
                                ? 'bg-amber-100 text-amber-800'
                                : log.action === 'unauthorized_access_attempt'
                                ? 'bg-rose-100 text-rose-800 font-extrabold'
                                : log.action === 'account_suspended'
                                ? 'bg-rose-100 text-rose-800'
                                : log.action === 'register'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="py-2.5 font-mono text-[11px] text-slate-800">
                          {log.userEmail || 'anonymous'}
                        </td>

                        <td className="py-2.5 font-mono text-[11px] text-slate-500">
                          {log.ip || '127.0.0.1'}
                        </td>

                        <td className="py-2.5 text-slate-600 text-[11px] max-w-xs truncate">
                          {log.details || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Trip */}
      {showAddTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-base text-slate-900">Schedule New Shuttle Departure</h4>
            <form onSubmit={handleCreateTrip} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Route Direction</label>
                <select
                  value={newTripData.direction}
                  onChange={(e) =>
                    setNewTripData({ ...newTripData, direction: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                >
                  <option value="buliluyan_to_puerto">
                    Buliluyan, Bataraza → Puerto Princesa City
                  </option>
                  <option value="puerto_to_buliluyan">
                    Puerto Princesa City → Buliluyan, Bataraza
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Travel Date</label>
                  <input
                    type="date"
                    required
                    value={newTripData.travelDate}
                    onChange={(e) =>
                      setNewTripData({ ...newTripData, travelDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departure Time</label>
                  <input
                    type="time"
                    required
                    value={newTripData.departureTime}
                    onChange={(e) =>
                      setNewTripData({ ...newTripData, departureTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle</label>
                  <select
                    value={newTripData.vehicleId}
                    onChange={(e) =>
                      setNewTripData({ ...newTripData, vehicleId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} ({v.model.slice(0, 15)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Driver</label>
                  <select
                    value={newTripData.driverId}
                    onChange={(e) =>
                      setNewTripData({ ...newTripData, driverId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">-- Unassigned (Pending Assignment) --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Fare (PHP)</label>
                <input
                  type="number"
                  value={newTripData.baseFare}
                  onChange={(e) =>
                    setNewTripData({ ...newTripData, baseFare: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTripModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-800 text-white font-bold rounded-xl cursor-pointer"
                >
                  Add Departure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-base text-slate-900">Add Shuttle Vehicle</h4>
            <form onSubmit={handleCreateVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plate Number</label>
                <input
                  type="text"
                  required
                  value={newVehicleData.plateNumber}
                  onChange={(e) =>
                    setNewVehicleData({ ...newVehicleData, plateNumber: e.target.value })
                  }
                  placeholder="e.g. VAR 9021"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Make & Model</label>
                <input
                  type="text"
                  required
                  value={newVehicleData.model}
                  onChange={(e) =>
                    setNewVehicleData({ ...newVehicleData, model: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-800 text-white font-bold rounded-xl cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Driver */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-base text-slate-900">Register New Driver</h4>
            <form onSubmit={handleCreateDriver} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Driver Full Name</label>
                <input
                  type="text"
                  required
                  value={newDriverData.name}
                  onChange={(e) =>
                    setNewDriverData({ ...newDriverData, name: e.target.value })
                  }
                  placeholder="e.g. Kuya Joel Reyes"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input
                  type="tel"
                  required
                  value={newDriverData.phone}
                  onChange={(e) =>
                    setNewDriverData({ ...newDriverData, phone: e.target.value })
                  }
                  placeholder="0917-XXX-XXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">LTO License #</label>
                <input
                  type="text"
                  required
                  value={newDriverData.licenseNumber}
                  onChange={(e) =>
                    setNewDriverData({ ...newDriverData, licenseNumber: e.target.value })
                  }
                  placeholder="N03-XX-XXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-800 text-white font-bold rounded-xl cursor-pointer"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Payment Details & Audit Trail */}
      {selectedPaymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-800" />
                <h4 className="font-bold text-base text-slate-900">Payment Transaction Record</h4>
              </div>
              <button
                onClick={() => setSelectedPaymentDetail(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Reference:</span>
                  <span className="font-mono font-bold text-teal-950">
                    {selectedPaymentDetail.bookingReference}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment ID:</span>
                  <span className="font-mono text-slate-800">{selectedPaymentDetail.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Gateway:</span>
                  <span className="font-semibold text-slate-900 uppercase">
                    {selectedPaymentDetail.paymentGateway}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway Session ID:</span>
                  <span className="font-mono text-[11px] text-slate-800 truncate max-w-[200px]">
                    {selectedPaymentDetail.gatewaySessionId || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Reference:</span>
                  <span className="font-mono text-[11px] text-slate-800 truncate max-w-[200px]">
                    {selectedPaymentDetail.gatewayTransactionRef || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold text-slate-900 uppercase">
                    {selectedPaymentDetail.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Amount:</span>
                  <span className="font-bold font-mono text-slate-900">
                    ₱{selectedPaymentDetail.amount} PHP ({selectedPaymentDetail.amountCentavos} centavos)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                    {selectedPaymentDetail.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created:</span>
                  <span className="text-slate-700">{selectedPaymentDetail.createdAt}</span>
                </div>
                {selectedPaymentDetail.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid Timestamp:</span>
                    <span className="text-emerald-800 font-medium">
                      {selectedPaymentDetail.paidAt}
                    </span>
                  </div>
                )}
                {selectedPaymentDetail.refundedAmount && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Refunded Amount:</span>
                    <span>₱{selectedPaymentDetail.refundedAmount} PHP</span>
                  </div>
                )}
              </div>

              {/* Event Logs for this booking */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 block">Audit Trail & Verification Events:</span>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {auditLogs
                    .filter((l) => l.bookingReference === selectedPaymentDetail.bookingReference)
                    .map((l) => (
                      <div
                        key={l.id}
                        className="p-2 bg-slate-50 rounded-xl text-[11px] flex justify-between items-center"
                      >
                        <div>
                          <span className="font-bold text-slate-800 uppercase mr-1">
                            [{l.event}]
                          </span>
                          <span className="text-slate-600">{l.details}</span>
                        </div>
                        <span className="text-slate-400 text-[10px] shrink-0">
                          {new Date(l.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPaymentDetail(null)}
                className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Authorized Refund */}
      {refundTargetPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-base">Process Payment Refund</h4>
              </div>
              <button
                onClick={() => {
                  setRefundTargetPayment(null);
                  setRefundSuccessNotice(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {refundSuccessNotice ? (
              <div className="py-6 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h5 className="font-bold text-slate-900">Refund Completed</h5>
                <p className="text-xs text-slate-600">{refundSuccessNotice}</p>
              </div>
            ) : (
              <form onSubmit={handleProcessRefund} className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  You are about to issue a refund for booking{' '}
                  <strong className="text-slate-900 font-mono">
                    {refundTargetPayment.bookingReference}
                  </strong>{' '}
                  ({refundTargetPayment.paymentMethod.toUpperCase()}).
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Ref:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {refundTargetPayment.gatewayTransactionRef || refundTargetPayment.gatewaySessionId}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Refund Amount:</span>
                    <span className="text-rose-700">₱{refundTargetPayment.amount} PHP</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Audit Reason for Refund *
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Customer schedule cancellation per operator policy">
                      Customer schedule cancellation per operator policy
                    </option>
                    <option value="Trip cancelled or delayed due to weather / Balabac boat advisory">
                      Trip cancelled or delayed due to weather / Balabac boat advisory
                    </option>
                    <option value="Duplicate booking adjustment">
                      Duplicate booking adjustment
                    </option>
                    <option value="Administrative courtesy refund">
                      Administrative courtesy refund
                    </option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRefundTargetPayment(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingRefund}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl cursor-pointer transition-colors shadow-sm"
                  >
                    {isProcessingRefund ? 'Authorizing Refund...' : 'Authorize Refund'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Staff / Driver Account */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-teal-900">
                <UserPlus className="w-5 h-5 text-teal-800" />
                <h4 className="font-bold text-base">Provision Staff / Driver Account</h4>
              </div>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStaffData.name}
                  onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                  placeholder="e.g. Kuya Jun Magbanua"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  value={newStaffData.email}
                  onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                  placeholder="e.g. driver.name@btrtransport.ph"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                  <select
                    value={newStaffData.role}
                    onChange={(e) =>
                      setNewStaffData({ ...newStaffData, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="driver">Driver</option>
                    <option value="admin">Dispatch Admin</option>
                    <option value="passenger">Passenger</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newStaffData.phone}
                    onChange={(e) => setNewStaffData({ ...newStaffData, phone: e.target.value })}
                    placeholder="0917-XXX-XXXX"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {newStaffData.role === 'driver' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assign Fleet Driver Profile
                  </label>
                  <select
                    value={newStaffData.driverId}
                    onChange={(e) => setNewStaffData({ ...newStaffData, driverId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {drivers.length === 0 ? (
                      <option value="">-- No active drivers registered yet --</option>
                    ) : (
                      drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} (License: {d.licenseNumber})
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Links this login account directly to assigned trips and manifest passenger records.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={newStaffData.password}
                  onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  {isUpdatingUser ? 'Creating Account...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
