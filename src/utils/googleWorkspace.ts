import { signInWithPopup, signOut as firebaseSignOut, GoogleAuthProvider, User } from 'firebase/auth';
import { auth, googleAuthProvider } from './firebase';

// IN-MEMORY TOKEN CACHE (Never in localStorage or sessionStorage per security guidelines)
let _inMemoryGoogleAccessToken: string | null = null;
let _currentGoogleUser: User | null = null;

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

/**
 * Sign in to Google with Drive & Tasks scopes
 */
export async function connectGoogleWorkspace(): Promise<{ user: User; accessToken: string }> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('No Google access token returned from authentication popup.');
    }

    _inMemoryGoogleAccessToken = token;
    _currentGoogleUser = result.user;

    return {
      user: result.user,
      accessToken: token,
    };
  } catch (error: any) {
    console.error('Google Workspace connect error:', error);
    throw error;
  }
}

/**
 * Disconnect Google Workspace session
 */
export async function disconnectGoogleWorkspace(): Promise<void> {
  _inMemoryGoogleAccessToken = null;
  _currentGoogleUser = null;
  await firebaseSignOut(auth);
}

/**
 * Check if Google Workspace is connected in-memory
 */
export function isGoogleWorkspaceConnected(): boolean {
  return Boolean(_inMemoryGoogleAccessToken && auth.currentUser);
}

export function getCachedGoogleUser(): User | null {
  return _currentGoogleUser || auth.currentUser;
}

export function getCachedGoogleToken(): string | null {
  return _inMemoryGoogleAccessToken;
}

/* =========================================================================
   GOOGLE DRIVE API INTEGRATION (v3)
   ========================================================================= */

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3';
const BTR_FOLDER_NAME = 'BTR Transport Palawan';

/**
 * Find or create the application folder in Google Drive
 */
export async function getOrCreateBTRFolder(token: string): Promise<string> {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${BTR_FOLDER_NAME}' and trashed = false`);
  const searchRes = await fetch(`${DRIVE_API_URL}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Failed to query Google Drive: ${err}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API_URL}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BTR_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Official backup folder for BTR Transport Buliluyan-Puerto Princesa Shuttle Service',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create BTR folder in Google Drive: ${err}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * List files saved in BTR Transport folder in Google Drive
 */
export async function listBTRDriveFiles(token: string): Promise<DriveFileInfo[]> {
  try {
    const folderId = await getOrCreateBTRFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(
      `${DRIVE_API_URL}/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,webViewLink)&orderBy=createdTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Drive list failed: ${err}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error('Error listing Drive files:', err);
    throw err;
  }
}

/**
 * Upload a file to the BTR Google Drive folder (multipart upload)
 */
export async function uploadToBTRDrive(
  token: string,
  fileName: string,
  content: string,
  mimeType: string = 'application/json'
): Promise<DriveFileInfo> {
  const folderId = await getOrCreateBTRFolder(token);

  const metadata = {
    name: fileName,
    parents: [folderId],
    description: 'BTR Transport Palawan Operational Export',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload to Google Drive: ${errText}`);
  }

  return await res.json();
}

/**
 * Delete a file in Google Drive
 */
export async function deleteDriveFile(token: string, fileId: string): Promise<boolean> {
  const res = await fetch(`${DRIVE_API_URL}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete Google Drive file: ${err}`);
  }

  return true;
}

/* =========================================================================
   GOOGLE TASKS API INTEGRATION (v1)
   ========================================================================= */

const TASKS_API_URL = 'https://tasks.googleapis.com/tasks/v1';
const BTR_TASK_LIST_NAME = 'BTR Transport Dispatch';

/**
 * Get or create "BTR Transport Dispatch" task list in Google Tasks
 */
export async function getOrCreateBTRTaskList(token: string): Promise<string> {
  const res = await fetch(`${TASKS_API_URL}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list Google Task lists: ${err}`);
  }

  const data = await res.json();
  const existing = (data.items || []).find((l: GoogleTaskList) => l.title === BTR_TASK_LIST_NAME);
  if (existing) {
    return existing.id;
  }

  // Create list
  const createRes = await fetch(`${TASKS_API_URL}/users/@me/lists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: BTR_TASK_LIST_NAME }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Tasks list: ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Fetch tasks in the BTR Dispatch task list
 */
export async function fetchBTRTasks(token: string): Promise<GoogleTaskItem[]> {
  const listId = await getOrCreateBTRTaskList(token);
  const res = await fetch(`${TASKS_API_URL}/lists/${listId}/tasks?showCompleted=true&showHidden=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Google Tasks: ${err}`);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * Create a new task in Google Tasks
 */
export async function createGoogleTask(
  token: string,
  title: string,
  notes?: string,
  due?: string
): Promise<GoogleTaskItem> {
  const listId = await getOrCreateBTRTaskList(token);
  const res = await fetch(`${TASKS_API_URL}/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      notes: notes || '',
      due: due ? new Date(due).toISOString() : undefined,
      status: 'needsAction',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create task in Google Tasks: ${err}`);
  }

  return await res.json();
}

/**
 * Toggle or update task completion in Google Tasks
 */
export async function updateGoogleTaskStatus(
  token: string,
  taskId: string,
  completed: boolean
): Promise<GoogleTaskItem> {
  const listId = await getOrCreateBTRTaskList(token);
  const res = await fetch(`${TASKS_API_URL}/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: completed ? 'completed' : 'needsAction',
      completed: completed ? new Date().toISOString() : null,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update task in Google Tasks: ${err}`);
  }

  return await res.json();
}

/**
 * Delete a task in Google Tasks
 */
export async function deleteGoogleTask(token: string, taskId: string): Promise<boolean> {
  const listId = await getOrCreateBTRTaskList(token);
  const res = await fetch(`${TASKS_API_URL}/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to delete task in Google Tasks: ${err}`);
  }

  return true;
}

/**
 * Standard pre-seeded Palawan transport checklists
 */
export const DEFAULT_BTR_CHECKLISTS = [
  {
    title: 'Pre-Trip Van Roadworthiness & LTFRB Compliance Check',
    notes: 'Verify tire tread/pressure (including spare), brake fluid level, operational head/tail lights, working air conditioning, and functioning emergency dashcam.',
  },
  {
    title: 'Buliluyan Port Balabac Ferry Connection Sync',
    notes: 'Coordinate with Balabac passenger pumpboat arrivals at Buliluyan Pier. Confirm baggage transfer and headcount for Puerto Princesa connecting shuttle.',
  },
  {
    title: 'Emergency Safety & First Aid Kit Inspection',
    notes: 'Confirm presence of fully charged fire extinguisher, onboard first aid kit, early warning triangle device, and heavy-duty tire jack.',
  },
  {
    title: 'Diesel Fuel & Toll Preparation (South Palawan Highway)',
    notes: 'Refuel at Brooke’s Point or Narra gas station; ensure spare cash for ferry gate permits and emergency roadside support.',
  },
  {
    title: 'Passenger Manifest Printing & LTFRB Travel Log',
    notes: 'Download verified digital passenger manifest, verify all seat numbers match bookings, and file copy at Dispatch logbook before departure.',
  },
];

/* =========================================================================
   GOOGLE DOCS API INTEGRATION (v1)
   ========================================================================= */

const DOCS_API_URL = 'https://docs.googleapis.com/v1';

export interface GoogleDocResult {
  documentId: string;
  title: string;
  url: string;
}

/**
 * Create a new Google Document with formatted content
 */
export async function createGoogleDoc(
  token: string,
  title: string,
  textContent: string
): Promise<GoogleDocResult> {
  // Step 1: Create empty document
  const createRes = await fetch(`${DOCS_API_URL}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Doc: ${err}`);
  }

  const doc = await createRes.json();
  const documentId = doc.documentId;

  // Step 2: Batch update to insert text content
  if (textContent) {
    const updateRes = await fetch(`${DOCS_API_URL}/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: textContent,
            },
          },
        ],
      }),
    });

    if (!updateRes.ok) {
      console.warn('Could not insert initial text into Google Doc:', await updateRes.text());
    }
  }

  return {
    documentId,
    title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Generate official LTFRB PUV Passenger Manifest in Google Docs
 */
export async function generateManifestGoogleDoc(
  token: string,
  trip: any,
  bookings: any[],
  vehicle?: any,
  driver?: any
): Promise<GoogleDocResult> {
  const tripDate = trip.travelDate || new Date().toISOString().split('T')[0];
  const tripCode = trip.tripNumber || trip.tripCode || 'BTR-TRIP';
  const docTitle = `LTFRB Passenger Manifest - ${tripCode} (${tripDate})`;

  const directionText =
    trip.direction === 'buliluyan_to_puerto'
      ? 'Buliluyan Port, Bataraza → Puerto Princesa City Grand Terminal'
      : 'Puerto Princesa City Grand Terminal → Buliluyan Port, Bataraza';

  let manifestText = `BTR TRANSPORT COOPERATIVE - OFFICIAL PASSENGER MANIFEST\n`;
  manifestText += `Land Transportation Franchising and Regulatory Board (LTFRB) Compliance Document\n`;
  manifestText += `=========================================================================\n\n`;
  manifestText += `TRIP DETAILS:\n`;
  manifestText += `  • Trip Number: ${tripCode}\n`;
  manifestText += `  • Route Corridor: ${directionText}\n`;
  manifestText += `  • Date of Travel: ${tripDate}\n`;
  manifestText += `  • Scheduled Departure: ${trip.departureTime} PST\n`;
  manifestText += `  • Vehicle Assigned: ${vehicle ? `${vehicle.plateNumber} (${vehicle.model})` : 'TBD'}\n`;
  manifestText += `  • Authorized Driver: ${driver ? `${driver.name} (License: ${driver.licenseNumber})` : 'TBD'}\n`;
  manifestText += `  • Total Bookings: ${bookings.length}\n\n`;
  manifestText += `-------------------------------------------------------------------------\n`;
  manifestText += `PASSENGER ROSTER:\n`;
  manifestText += `-------------------------------------------------------------------------\n`;

  if (bookings.length === 0) {
    manifestText += `  [No confirmed passengers on this trip yet]\n`;
  } else {
    bookings.forEach((b, index) => {
      const passengerList = b.passengers && Array.isArray(b.passengers)
        ? b.passengers.map((p: any) => `${p.fullName} (Seat ${p.seatLabel})`).join(', ')
        : (b.passengerName || b.contactName);
      const seats = b.passengers && Array.isArray(b.passengers)
        ? b.passengers.map((p: any) => p.seatLabel).join(', ')
        : (b.seats?.map((s: any) => s.seatLabel).join(', ') || 'General Seat');
      const name = b.contactName || b.passengerName || 'Passenger';
      const phone = b.contactPhone || b.passengerPhone || 'N/A';
      const fare = b.finalAmount || b.totalFare || 0;
      const status = b.bookingStatus || b.status || 'confirmed';

      manifestText += `\n[${index + 1}] Contact: ${name} (${passengerList})\n`;
      manifestText += `    • Seat(s): ${seats}\n`;
      manifestText += `    • Contact Phone: ${phone}\n`;
      manifestText += `    • Reference Number: ${b.bookingReference}\n`;
      manifestText += `    • Fare: ₱${fare.toLocaleString()} (${(b.paymentStatus || 'paid').toUpperCase()})\n`;
      manifestText += `    • Status: ${status.toUpperCase()}\n`;
    });
  }

  manifestText += `\n=========================================================================\n`;
  manifestText += `DISPATCH & SAFETY DECLARATION:\n`;
  manifestText += `I hereby certify that all passengers listed above are physically boarded or accounted for, and vehicle safety inspections (tires, brakes, fire extinguisher, emergency first aid kit) are compliant with LTFRB standards.\n\n`;
  manifestText += `Driver Signature: _______________________      Date: ______________\n`;
  manifestText += `Dispatch Officer: ______________________      Date: ______________\n`;
  manifestText += `Emergency Hotline: Palawan Rescue PDRRMO 0917-578-2328 | BTR Dispatch 0917-555-BTR1\n`;

  return await createGoogleDoc(token, docTitle, manifestText);
}

/* =========================================================================
   GMAIL API INTEGRATION (v1)
   ========================================================================= */

const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface SendEmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
}

export interface GmailSendResult {
  id: string;
  threadId: string;
}

/**
 * Encode an RFC 2822 email to base64url format for Gmail API
 */
function buildBase64UrlEmail(to: string, subject: string, htmlBody: string): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    htmlBody,
  ];
  const message = messageParts.join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Send an email directly via Gmail API
 */
export async function sendGmailMessage(
  token: string,
  payload: SendEmailPayload
): Promise<GmailSendResult> {
  const raw = buildBase64UrlEmail(payload.to, payload.subject, payload.htmlBody);

  const res = await fetch(`${GMAIL_API_URL}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send email via Gmail: ${err}`);
  }

  return await res.json();
}

/**
 * Send Electronic Ticket and Booking Confirmation via Gmail
 */
export async function sendTicketConfirmationEmail(
  token: string,
  booking: any,
  trip: any,
  pickupName: string,
  dropoffName: string
): Promise<GmailSendResult> {
  const recipientEmail = booking.contactEmail || booking.passengerEmail;
  if (!recipientEmail) {
    throw new Error('Passenger contact email is missing from booking');
  }

  const passengerName = booking.contactName || booking.passengerName || 'Passenger';
  const tripCode = trip.tripNumber || trip.tripCode || 'BTR Express';
  const subject = `BTR Transport E-Ticket: Reference ${booking.bookingReference}`;

  const seatList = booking.passengers && Array.isArray(booking.passengers)
    ? booking.passengers.map((p: any) => p.seatLabel).join(', ')
    : (booking.seats?.map((s: any) => s.seatLabel).join(', ') || 'Reserved');

  const fareAmount = booking.finalAmount || booking.totalFare || 0;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #0d9488; border-radius: 12px; background-color: #ffffff;">
      <div style="background-color: #042f2e; color: #ffffff; padding: 16px; border-radius: 8px; text-align: center;">
        <h2 style="margin: 0; color: #fbbf24;">BTR TRANSPORT PALAWAN</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #99f6e4;">Buliluyan Port ⇄ Puerto Princesa City Express Shuttle</p>
      </div>

      <div style="padding: 20px 0; border-bottom: 2px dashed #e2e8f0;">
        <h3 style="margin-top: 0; color: #0f172a;">Confirmed E-Ticket</h3>
        <p>Dear <strong>${passengerName}</strong>,</p>
        <p>Your booking with BTR Transport has been confirmed. Please present your booking reference upon boarding.</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; color: #475569;">Booking Reference:</td>
            <td style="padding: 8px; font-weight: bold; color: #042f2e; font-size: 16px;">${booking.bookingReference}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Trip Number:</td>
            <td style="padding: 8px;">${tripCode}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; color: #475569;">Travel Date:</td>
            <td style="padding: 8px;">${trip.travelDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Departure Time:</td>
            <td style="padding: 8px;">${trip.departureTime} PST</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; color: #475569;">Boarding Point:</td>
            <td style="padding: 8px;">${pickupName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Drop-off Point:</td>
            <td style="padding: 8px;">${dropoffName}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; color: #475569;">Assigned Seat(s):</td>
            <td style="padding: 8px; font-weight: bold; color: #d97706;">${seatList}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">Total Fare Paid:</td>
            <td style="padding: 8px; font-weight: bold; color: #059669;">₱${fareAmount.toLocaleString()} (${(booking.paymentMethod || 'PAID').toUpperCase()})</td>
          </tr>
        </table>
      </div>

      <div style="padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5;">
        <p><strong>Boarding Guidelines:</strong></p>
        <ul>
          <li>Please arrive at your pickup point at least 20 minutes before departure time.</li>
          <li>For passengers connecting from Balabac Island pumpboats at Buliluyan Pier, inform our station marshal upon arrival.</li>
          <li>Luggage allowance: Standard 1 check-in bag + 1 backpack per seat.</li>
        </ul>
        <p>Emergency Dispatch Hotline: <strong>0917-555-BTR1</strong> | Palawan Emergency PDRRMO: <strong>0917-578-2328</strong></p>
      </div>
    </div>
  `;

  return await sendGmailMessage(token, {
    to: recipientEmail,
    subject,
    htmlBody,
  });
}

