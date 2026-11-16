import React, { useState, useEffect } from 'react';
import {
  connectGoogleWorkspace,
  disconnectGoogleWorkspace,
  isGoogleWorkspaceConnected,
  getCachedGoogleUser,
  getCachedGoogleToken,
  listBTRDriveFiles,
  uploadToBTRDrive,
  deleteDriveFile,
  fetchBTRTasks,
  createGoogleTask,
  updateGoogleTaskStatus,
  deleteGoogleTask,
  DEFAULT_BTR_CHECKLISTS,
  generateManifestGoogleDoc,
  createGoogleDoc,
  sendTicketConfirmationEmail,
  sendGmailMessage,
  DriveFileInfo,
  GoogleTaskItem,
  GoogleDocResult,
} from '../../utils/googleWorkspace';
import { Trip, Booking, Vehicle, Driver } from '../../types';
import {
  HardDrive,
  CheckSquare,
  Upload,
  RefreshCw,
  Trash2,
  ExternalLink,
  Plus,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FolderPlus,
  Mail,
  FileText,
  Send,
  Bus,
} from 'lucide-react';

interface GoogleWorkspacePanelProps {
  trips: Trip[];
  bookings: Booking[];
  vehicles: Vehicle[];
  drivers: Driver[];
}

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({
  trips,
  bookings,
  vehicles,
  drivers,
}) => {
  const [isConnected, setIsConnected] = useState(isGoogleWorkspaceConnected());
  const [googleUser, setGoogleUser] = useState(getCachedGoogleUser());
  const [activeSubTab, setActiveSubTab] = useState<'drive' | 'tasks' | 'docs' | 'gmail'>('drive');

  // Loading and alerts
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [selectedTripForExport, setSelectedTripForExport] = useState<string>(trips[0]?.id || '');
  const [isExporting, setIsExporting] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDue, setNewTaskDue] = useState(new Date().toISOString().split('T')[0]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Docs state
  const [createdDocs, setCreatedDocs] = useState<GoogleDocResult[]>([]);
  const [selectedTripForDocs, setSelectedTripForDocs] = useState<string>(trips[0]?.id || '');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [customDocContent, setCustomDocContent] = useState('');

  // Gmail state
  const [selectedBookingForEmail, setSelectedBookingForEmail] = useState<string>(bookings[0]?.id || '');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Confirmation Modals for mutations
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<DriveFileInfo | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<GoogleTaskItem | null>(null);
  const [confirmSendEmail, setConfirmSendEmail] = useState<boolean>(false);
  const [confirmGenerateDoc, setConfirmGenerateDoc] = useState<boolean>(false);

  // Auto-clear success message after 4s
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load files or tasks when connected
  const refreshDriveFiles = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const files = await listBTRDriveFiles(token);
      setDriveFiles(files);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to list Google Drive files');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTasks = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const items = await fetchBTRTasks(token);
      setTasks(items);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch Google Tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      if (activeSubTab === 'drive') {
        refreshDriveFiles();
      } else if (activeSubTab === 'tasks') {
        refreshTasks();
      }
    }
  }, [isConnected, activeSubTab]);

  // Connect Google account
  const handleConnect = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await connectGoogleWorkspace();
      setIsConnected(true);
      setGoogleUser(res.user);
      setSuccessMsg(`Connected successfully with ${res.user.email}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect Google account
  const handleDisconnect = async () => {
    try {
      await disconnectGoogleWorkspace();
      setIsConnected(false);
      setGoogleUser(null);
      setDriveFiles([]);
      setTasks([]);
      setSuccessMsg('Disconnected from Google Workspace');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect');
    }
  };

  // Export Trip Manifest to Google Drive
  const handleExportTripManifest = async () => {
    const token = getCachedGoogleToken();
    if (!token) {
      setErrorMsg('Please connect your Google account first');
      return;
    }

    const trip = trips.find((t) => t.id === selectedTripForExport) || trips[0];
    if (!trip) {
      setErrorMsg('No trip selected for export');
      return;
    }

    const tripBookings = bookings.filter((b) => b.tripId === trip.id);
    const vehicle = vehicles.find((v) => v.id === trip.vehicleId);
    const driver = drivers.find((d) => d.id === trip.driverId);

    setIsExporting(true);
    setErrorMsg(null);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `BTR-Manifest-${trip.tripNumber}-${timestamp}.json`;

      const manifestPayload = {
        exportedAt: new Date().toISOString(),
        service: 'BTR Transport Palawan (Buliluyan ⇄ Puerto Princesa)',
        trip: {
          id: trip.id,
          tripNumber: trip.tripNumber,
          direction: trip.direction,
          travelDate: trip.travelDate,
          departureTime: trip.departureTime,
          status: trip.status,
          baseFare: trip.baseFare,
          vehicle: vehicle ? `${vehicle.plateNumber} (${vehicle.model})` : 'Unassigned',
          driver: driver ? `${driver.name} (${driver.licenseNumber})` : 'Unassigned',
        },
        passengerSummary: {
          totalBookings: tripBookings.length,
          totalPassengers: tripBookings.reduce((sum, b) => sum + (b.passengers?.length || 1), 0),
          totalRevenuePHP: tripBookings.reduce((sum, b) => sum + b.finalAmount, 0),
        },
        passengers: tripBookings.map((b) => ({
          seatNumbers: b.passengers?.map((s) => s.seatLabel).join(', ') || 'N/A',
          passengerName: b.contactName,
          contactPhone: b.contactPhone,
          email: b.contactEmail,
          bookingReference: b.bookingReference,
          farePaidPHP: b.finalAmount,
          paymentStatus: b.paymentStatus,
          status: b.bookingStatus,
        })),
      };

      const result = await uploadToBTRDrive(
        token,
        fileName,
        JSON.stringify(manifestPayload, null, 2),
        'application/json'
      );

      setSuccessMsg(`Exported manifest "${result.name}" directly to Google Drive folder!`);
      await refreshDriveFiles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export manifest to Google Drive');
    } finally {
      setIsExporting(false);
    }
  };

  // Export Full System Backup to Google Drive
  const handleExportSystemBackup = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;

    setIsExporting(true);
    setErrorMsg(null);

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `BTR-System-Backup-${dateStr}.json`;

      const backupData = {
        timestamp: new Date().toISOString(),
        system: 'BTR Transport Fleet & Booking Engine',
        corridor: 'Buliluyan Port, Bataraza - Puerto Princesa City, Palawan',
        trips,
        bookings,
        vehicles,
        drivers,
      };

      const result = await uploadToBTRDrive(
        token,
        fileName,
        JSON.stringify(backupData, null, 2),
        'application/json'
      );

      setSuccessMsg(`Archived full system backup "${result.name}" to Google Drive!`);
      await refreshDriveFiles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to backup to Google Drive');
    } finally {
      setIsExporting(false);
    }
  };

  // Confirmed Delete Drive File
  const handleExecuteDeleteFile = async () => {
    if (!confirmDeleteFile) return;
    const token = getCachedGoogleToken();
    if (!token) return;

    try {
      await deleteDriveFile(token, confirmDeleteFile.id);
      setSuccessMsg(`Deleted "${confirmDeleteFile.name}" from Google Drive`);
      setConfirmDeleteFile(null);
      await refreshDriveFiles();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete file');
    }
  };

  // Google Tasks: Create custom task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getCachedGoogleToken();
    if (!token || !newTaskTitle.trim()) return;

    setIsCreatingTask(true);
    setErrorMsg(null);
    try {
      await createGoogleTask(token, newTaskTitle.trim(), newTaskNotes.trim(), newTaskDue);
      setSuccessMsg('Task added to Google Tasks!');
      setNewTaskTitle('');
      setNewTaskNotes('');
      await refreshTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create Google task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Google Tasks: Toggle status
  const handleToggleTaskStatus = async (task: GoogleTaskItem) => {
    const token = getCachedGoogleToken();
    if (!token) return;

    const nextStatus = task.status !== 'completed';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus ? 'completed' : 'needsAction' } : t))
    );

    try {
      await updateGoogleTaskStatus(token, task.id, nextStatus);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update task status');
      await refreshTasks();
    }
  };

  // Confirmed Delete Task
  const handleExecuteDeleteTask = async () => {
    if (!confirmDeleteTask) return;
    const token = getCachedGoogleToken();
    if (!token) return;

    try {
      await deleteGoogleTask(token, confirmDeleteTask.id);
      setSuccessMsg(`Deleted task "${confirmDeleteTask.title}"`);
      setConfirmDeleteTask(null);
      await refreshTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete task');
    }
  };

  // Seed default checklist
  const handleSeedDefaultChecklists = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      for (const item of DEFAULT_BTR_CHECKLISTS) {
        await createGoogleTask(token, item.title, item.notes);
      }
      setSuccessMsg('Successfully seeded standard Palawan transport operations checklist!');
      await refreshTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to seed checklists');
    } finally {
      setIsLoading(false);
    }
  };

  // GOOGLE DOCS: Generate Manifest Document
  const handleExecuteGenerateDoc = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;

    const trip = trips.find((t) => t.id === selectedTripForDocs) || trips[0];
    if (!trip) return;

    const tripBookings = bookings.filter((b) => b.tripId === trip.id);
    const vehicle = vehicles.find((v) => v.id === trip.vehicleId);
    const driver = drivers.find((d) => d.id === trip.driverId);

    setIsGeneratingDoc(true);
    setErrorMsg(null);
    setConfirmGenerateDoc(false);

    try {
      const doc = await generateManifestGoogleDoc(token, trip, tripBookings, vehicle, driver);
      setCreatedDocs((prev) => [doc, ...prev]);
      setSuccessMsg(`Generated official LTFRB Manifest Google Doc: "${doc.title}"!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate Google Doc');
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  // GMAIL: Send Booking E-Ticket Email
  const handleSendTicketEmail = async () => {
    const token = getCachedGoogleToken();
    if (!token) return;

    const booking = bookings.find((b) => b.id === selectedBookingForEmail) || bookings[0];
    if (!booking) {
      setErrorMsg('No booking selected for email delivery');
      return;
    }

    const trip = trips.find((t) => t.id === booking.tripId) || {
      tripCode: 'BTR-EXPRESS',
      travelDate: new Date().toISOString().split('T')[0],
      departureTime: '08:00',
    };

    setIsSendingEmail(true);
    setErrorMsg(null);
    setConfirmSendEmail(false);

    try {
      await sendTicketConfirmationEmail(
        token,
        booking,
        trip,
        booking.pickupStopId || 'Buliluyan Port',
        booking.dropoffStopId || 'Puerto Princesa Grand Terminal'
      );
      setSuccessMsg(`Sent E-Ticket via Gmail directly to ${booking.contactEmail}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send email via Gmail');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // GMAIL: Send Custom Advisory
  const handleSendCustomEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getCachedGoogleToken();
    if (!token || !emailRecipient || !emailSubject) return;

    setIsSendingEmail(true);
    setErrorMsg(null);

    try {
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border-left: 4px solid #0d9488; background: #f8fafc;">
          <h3 style="color: #042f2e; margin-top: 0;">BTR Transport Dispatch Advisory</h3>
          <p style="color: #334155; line-height: 1.6;">${emailBody.replace(/\n/g, '<br/>')}</p>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" />
          <p style="font-size: 11px; color: #64748b;">
            BTR Transport Cooperative Palawan • Buliluyan Port, Bataraza ⇄ Puerto Princesa City<br/>
            Hotline: 0917-555-BTR1 • Rescue: PDRRMO 0917-578-2328
          </p>
        </div>
      `;

      await sendGmailMessage(token, {
        to: emailRecipient,
        subject: emailSubject,
        htmlBody,
      });

      setSuccessMsg(`Sent dispatch advisory via Gmail to ${emailRecipient}!`);
      setEmailRecipient('');
      setEmailSubject('');
      setEmailBody('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send advisory via Gmail');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card & Connection Status */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 rounded-3xl p-6 text-white border border-teal-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <HardDrive className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Google Workspace Enterprise Integration</h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Drive • Tasks • Docs • Gmail
                </span>
              </div>
              <p className="text-xs text-teal-200/80 mt-1">
                Synchronize trip manifests to Drive, manage operations in Tasks, generate LTFRB reports in Docs, and dispatch passenger tickets via Gmail.
              </p>
            </div>
          </div>

          <div>
            {isConnected ? (
              <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl border border-white/20 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center font-bold text-xs">
                  {googleUser?.displayName?.charAt(0) || googleUser?.email?.charAt(0) || 'G'}
                </div>
                <div>
                  <div className="text-xs font-bold text-white truncate max-w-[160px]">
                    {googleUser?.displayName || 'Google Workspace'}
                  </div>
                  <div className="text-[10px] text-teal-300 truncate max-w-[160px]">
                    {googleUser?.email}
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="ml-2 text-xs text-rose-300 hover:text-rose-100 font-bold bg-rose-500/20 hover:bg-rose-500/30 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="flex items-center gap-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md transition-all cursor-pointer hover:shadow-lg disabled:opacity-60"
              >
                {/* Official Google G Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoading ? 'Connecting...' : 'Connect Google Workspace'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="mt-4 bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Workspace Feature Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('drive')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'drive'
              ? 'bg-teal-900 text-amber-400 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Google Drive</span>
          {driveFiles.length > 0 && (
            <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {driveFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'bg-teal-900 text-amber-400 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Google Tasks</span>
          {tasks.length > 0 && (
            <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {tasks.filter((t) => t.status !== 'completed').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('docs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'docs'
              ? 'bg-teal-900 text-amber-400 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Google Docs</span>
          {createdDocs.length > 0 && (
            <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {createdDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('gmail')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'gmail'
              ? 'bg-teal-900 text-amber-400 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Gmail Dispatch</span>
        </button>
      </div>

      {/* TAB 1: GOOGLE DRIVE */}
      {activeSubTab === 'drive' && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto border border-teal-100">
                <HardDrive className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Connect Google Drive to Archive Manifests
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Automatically export passenger manifests, Balabac ferry connecting logs, and system schedules into a dedicated Google Drive folder (<strong>BTR Transport Palawan</strong>).
              </p>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                <span>Connect Google Drive</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Export Controls */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Upload className="w-4 h-4 text-teal-800" />
                    <span>Export to Google Drive</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Folder: <span className="font-semibold text-teal-900">BTR Transport Palawan</span>
                  </p>
                </div>

                {/* Trip Manifest Export */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Select Scheduled Trip for Manifest:
                  </label>
                  <select
                    value={selectedTripForExport}
                    onChange={(e) => setSelectedTripForExport(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    {trips.map((trip) => {
                      const count = bookings.filter((b) => b.tripId === trip.id).length;
                      return (
                        <option key={trip.id} value={trip.id}>
                          {trip.tripNumber} ({trip.travelDate} @ {trip.departureTime}) - {count} bookings
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={handleExportTripManifest}
                    disabled={isExporting}
                    className="w-full bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isExporting ? 'Exporting...' : 'Export Manifest to Drive'}</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Full System Snapshot:
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Back up all trips, vehicles, drivers, route stops, and active reservations as an archival snapshot in Google Drive.
                  </p>
                  <button
                    onClick={handleExportSystemBackup}
                    disabled={isExporting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-teal-400" />
                    <span>Backup Full System to Drive</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Google Drive Files List */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-teal-800" />
                      <span>Drive Archive Files</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Files stored in folder: <strong>BTR Transport Palawan</strong>
                    </p>
                  </div>
                  <button
                    onClick={refreshDriveFiles}
                    disabled={isLoading}
                    className="p-1.5 text-slate-600 hover:text-teal-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Refresh files"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isLoading && driveFiles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-800" />
                    <span>Loading Google Drive files...</span>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">No backup files found in Drive yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Use the export controls on the left to upload your first trip manifest or full backup.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {driveFiles.map((file) => {
                      const sizeKb = file.size ? Math.round(Number(file.size) / 1024) : 0;
                      const dateStr = file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Recent';

                      return (
                        <div
                          key={file.id}
                          className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center shrink-0">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                <span>{dateStr}</span>
                                <span>•</span>
                                <span>{sizeKb > 0 ? `${sizeKb} KB` : 'Cloud File'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                title="Open in Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </a>
                            )}
                            <button
                              onClick={() => setConfirmDeleteFile(file)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete from Google Drive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GOOGLE TASKS */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto border border-teal-100">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Connect Google Tasks for Fleet Operations
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Synchronize driver pre-trip vehicle checklists, Buliluyan Port Balabac ferry synchronization items, and dispatch schedules with Google Tasks.
              </p>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                <span>Connect Google Tasks</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Add Task & Preset Checklist */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4 text-teal-800" />
                      <span>Add Operational Task</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      List: <strong>BTR Transport Dispatch</strong>
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Task Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Balabac boat arrival manifest check"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Operational Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Inspection items, contact numbers, instructions..."
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingTask || !newTaskTitle.trim()}
                    className="w-full bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isCreatingTask ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isCreatingTask ? 'Adding...' : 'Add to Google Tasks'}</span>
                  </button>
                </form>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Pre-Trip Checklist Preset:</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Seed standard Palawan corridor safety & Balabac ferry synchronization tasks.
                  </p>
                  <button
                    onClick={handleSeedDefaultChecklists}
                    disabled={isLoading}
                    className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs py-2 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Seed Palawan Transport Checklist</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Google Tasks List */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-teal-800" />
                      <span>BTR Operational Task Items</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Synced live with Google Tasks
                    </p>
                  </div>
                  <button
                    onClick={refreshTasks}
                    disabled={isLoading}
                    className="p-1.5 text-slate-600 hover:text-teal-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Refresh tasks"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {isLoading && tasks.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-800" />
                    <span>Loading Google Tasks...</span>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">No operational tasks found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Add a new task or click "Seed Palawan Transport Checklist" to populate default operations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {tasks.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                            isDone
                              ? 'bg-emerald-50/40 border-emerald-200/60 text-slate-500'
                              : 'bg-white border-slate-200 hover:border-teal-200 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => handleToggleTaskStatus(task)}
                              className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div
                                className={`text-xs font-bold truncate ${
                                  isDone ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {task.title}
                              </div>
                              {task.notes && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                  {task.notes}
                                </p>
                              )}
                              {task.due && (
                                <div className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Due: {new Date(task.due).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => setConfirmDeleteTask(task)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GOOGLE DOCS */}
      {activeSubTab === 'docs' && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto border border-teal-100">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Connect Google Docs for Official LTFRB Manifests
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Generate official PUV Passenger Manifests, Dispatch Clearance Slips, and travel logs directly into editable Google Docs ready for printing and regulatory audit.
              </p>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                <span>Connect Google Docs</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Generate Document Controls */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-800" />
                    <span>Generate LTFRB Manifest Doc</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Creates an official formatted document in your Google Docs account.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Choose Scheduled Trip:
                  </label>
                  <select
                    value={selectedTripForDocs}
                    onChange={(e) => setSelectedTripForDocs(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    {trips.map((trip) => {
                      const count = bookings.filter((b) => b.tripId === trip.id).length;
                      return (
                        <option key={trip.id} value={trip.id}>
                          {trip.tripNumber} ({trip.travelDate} @ {trip.departureTime}) - {count} pax
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={() => setConfirmGenerateDoc(true)}
                    disabled={isGeneratingDoc}
                    className="w-full bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isGeneratingDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isGeneratingDoc ? 'Creating Doc...' : 'Generate Manifest in Google Docs'}</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-1">LTFRB Compliance Standard</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Documents are automatically styled with operator franchise details, passenger insurance coverage tags, seat numbers, Balabac ferry transit connection notes, and official driver/marshal signature fields.
                  </p>
                </div>
              </div>

              {/* Right Column: Generated Docs List */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-800" />
                    <span>Generated Google Documents</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click "Open in Google Docs" to edit, share, or print directly.
                  </p>
                </div>

                {createdDocs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">No documents generated yet in this session</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Select a trip schedule on the left and click "Generate Manifest in Google Docs".
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {createdDocs.map((doc) => (
                      <div
                        key={doc.documentId}
                        className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0 font-bold text-xs">
                            DOC
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate" title={doc.title}>
                              {doc.title}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Document ID: {doc.documentId.slice(0, 16)}...
                            </div>
                          </div>
                        </div>

                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Google Docs</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GMAIL DISPATCH */}
      {activeSubTab === 'gmail' && (
        <div className="space-y-6">
          {!isConnected ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto border border-teal-100">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Connect Gmail to Dispatch Electronic Tickets
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Send verified digital e-tickets, payment receipts, schedule updates, and ferry connection reminders directly from your Gmail account to passengers.
              </p>
              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
              >
                <span>Connect Gmail</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Dispatch Passenger E-Ticket via Gmail */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-800" />
                    <span>Send E-Ticket Confirmation Email</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dispatches a formatted HTML ticket directly to the passenger's inbox.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">
                    Select Passenger Booking:
                  </label>
                  <select
                    value={selectedBookingForEmail}
                    onChange={(e) => setSelectedBookingForEmail(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bookingReference} - {b.contactName} ({b.contactEmail})
                      </option>
                    ))}
                  </select>

                  {bookings.find((b) => b.id === selectedBookingForEmail) && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                      <div className="font-bold text-slate-800">
                        Passenger: {bookings.find((b) => b.id === selectedBookingForEmail)?.contactName}
                      </div>
                      <div className="text-slate-500">
                        Email: {bookings.find((b) => b.id === selectedBookingForEmail)?.contactEmail}
                      </div>
                      <div className="text-slate-500">
                        Phone: {bookings.find((b) => b.id === selectedBookingForEmail)?.contactPhone}
                      </div>
                      <div className="text-teal-700 font-semibold">
                        Seats: {bookings.find((b) => b.id === selectedBookingForEmail)?.passengers?.map((s) => s.seatLabel).join(', ')} • ₱{bookings.find((b) => b.id === selectedBookingForEmail)?.finalAmount.toLocaleString()}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setConfirmSendEmail(true)}
                    disabled={isSendingEmail}
                    className="w-full bg-teal-900 hover:bg-teal-850 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isSendingEmail ? 'Sending...' : 'Send E-Ticket via Gmail'}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Custom Dispatch Announcement / Delay Advisory */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-teal-800" />
                    <span>Send Custom Dispatch Advisory</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Send highway status, weather, or Balabac boat connecting notices via Gmail.
                  </p>
                </div>

                <form onSubmit={handleSendCustomEmail} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Recipient Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="passenger@example.com"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Subject Line *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Schedule Update: Buliluyan Express Trip #2"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Advisory Message *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Write your dispatch notice or instructions..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingEmail || !emailRecipient || !emailSubject}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSendingEmail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-teal-400" />}
                    <span>{isSendingEmail ? 'Dispatching...' : 'Dispatch Email Notice'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION DIALOG: SEND E-TICKET VIA GMAIL */}
      {confirmSendEmail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Confirm Sending E-Ticket Email?
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                You are about to send an official BTR Transport E-Ticket via your connected Gmail account to{' '}
                <strong className="text-slate-800">
                  {bookings.find((b) => b.id === selectedBookingForEmail)?.contactEmail}
                </strong>
                . Do you wish to proceed?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmSendEmail(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTicketEmail}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-900 hover:bg-teal-850 text-white shadow-sm transition-all cursor-pointer"
              >
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: GENERATE GOOGLE DOC */}
      {confirmGenerateDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Create LTFRB Passenger Manifest in Google Docs?
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This will create a new editable Google Document in your Google Docs account with the complete passenger manifest for trip{' '}
                <strong className="text-slate-800">
                  {trips.find((t) => t.id === selectedTripForDocs)?.tripNumber}
                </strong>
                .
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmGenerateDoc(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteGenerateDoc}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white shadow-sm transition-all cursor-pointer"
              >
                Generate Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: DELETE GOOGLE DRIVE FILE */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Delete File from Google Drive?
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-800">{confirmDeleteFile.name}</strong> from your
                Google Drive folder? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDeleteFile(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDeleteFile}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: DELETE GOOGLE TASK */}
      {confirmDeleteTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Delete Task from Google Tasks?
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Are you sure you want to remove task{' '}
                <strong className="text-slate-800">"{confirmDeleteTask.title}"</strong> from your
                Google Tasks operational checklist?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setConfirmDeleteTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDeleteTask}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
