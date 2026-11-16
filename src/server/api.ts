import { Router, Request, Response } from 'express';
import {
  createPayMongoCheckoutSession,
  getPayMongoConfig,
  verifyPayMongoSession,
  verifyWebhookSignature,
} from './paymongoService';
import {
  getPaymentById,
  getPaymentBySessionId,
  getPaymentByBookingRef,
  getPayments,
  getTransactions,
  logTransaction,
  savePayment,
  updateBookingAndPaymentStatus,
  isWebhookProcessed,
  markWebhookProcessed,
} from './db';
import { PaymentRecord, PaymentStatus, BookingStatus } from '../types';
import { requireAuth, requireRole, optionalAuth } from './auth';

export const paymentsRouter = Router();

/**
 * 1. GET /api/payments/config
 * Returns public payment configuration & active gateway information
 */
paymentsRouter.get('/config', (req: Request, res: Response) => {
  const config = getPayMongoConfig();
  res.json({
    provider: 'paymongo',
    publicKey: config.publicKey,
    hasValidCredentials: config.hasValidCredentials,
    isLive: config.isLive,
    supportedMethods: ['gcash', 'maya', 'card', 'grab_pay', 'qrph', 'cash'],
    webhookConfigured: Boolean(config.webhookSecret),
  });
});

/**
 * 2. POST /api/payments/create-checkout
 * Server-side creation of a validated payment session
 */
paymentsRouter.post('/create-checkout', optionalAuth, async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      tripId,
      bookingReference,
      contactName,
      contactPhone,
      contactEmail,
      pickupStopName,
      dropoffStopName,
      seats,
      finalAmount, // validated
      paymentMethod = 'gcash',
      returnUrl,
    } = req.body;

    if (!bookingReference || !finalAmount || finalAmount <= 0) {
      return res.status(400).json({
        error: 'Missing or invalid booking parameters',
      });
    }

    // Check for duplicate pending payment for this booking
    const existing = getPaymentByBookingRef(bookingReference);
    if (existing && existing.paymentStatus === 'paid') {
      return res.status(409).json({
        error: 'This booking has already been paid and confirmed.',
        bookingReference,
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const appOrigin = process.env.APP_URL || `${protocol}://${host}`;

    const successCallback = returnUrl || `${appOrigin}/?payment=success&ref=${bookingReference}`;
    const cancelCallback = `${appOrigin}/?payment=cancelled&ref=${bookingReference}`;

    // Create session via PayMongo service
    const sessionResponse = await createPayMongoCheckoutSession({
      bookingReference,
      amount: finalAmount,
      description: `BTR Shuttle: ${pickupStopName} to ${dropoffStopName} (${seats?.length || 1} seat(s))`,
      customerName: contactName,
      customerEmail: contactEmail,
      customerPhone: contactPhone,
      successUrl: successCallback,
      cancelUrl: cancelCallback,
    });

    const paymentRecord: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingId: bookingReference,
      bookingReference,
      userId: (req as any).user?.id,
      paymentGateway: 'paymongo',
      gatewaySessionId: sessionResponse.id,
      gatewayPaymentIntentId: sessionResponse.paymentIntentId,
      paymentMethod: paymentMethod as any,
      amount: finalAmount,
      amountCentavos: Math.round(finalAmount * 100),
      currency: 'PHP',
      paymentStatus: 'pending',
      checkoutUrl: sessionResponse.checkoutUrl,
      clientKey: sessionResponse.clientKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savePayment(paymentRecord);
    logTransaction('checkout_created', paymentRecord, `Created PayMongo checkout session ${sessionResponse.id}`);

    return res.status(201).json({
      success: true,
      checkoutUrl: sessionResponse.checkoutUrl,
      sessionId: sessionResponse.id,
      bookingReference,
      amount: finalAmount,
      isSandboxFallback: sessionResponse.isSandboxFallback,
    });
  } catch (err: any) {
    console.error('Failed to create payment session:', err);
    return res.status(500).json({
      error: err.message || 'Payment creation failed',
    });
  }
});

/**
 * 3. POST /api/payments/verify
 * Trusted server-to-gateway verification
 */
paymentsRouter.post('/verify', async (req: Request, res: Response): Promise<any> => {
  try {
    const { sessionId, bookingReference } = req.body;

    if (!sessionId && !bookingReference) {
      return res.status(400).json({ error: 'Session ID or Booking Reference is required' });
    }

    const payment = sessionId ? getPaymentBySessionId(sessionId) : getPaymentByBookingRef(bookingReference);

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Call PayMongo API to verify actual status
    const verification = await verifyPayMongoSession(payment.gatewaySessionId || sessionId, payment.bookingReference);

    if (verification.isPaid) {
      payment.paymentStatus = 'paid';
      payment.paidAt = new Date().toISOString();
      if (verification.transactionId) {
        payment.gatewayTransactionRef = verification.transactionId;
      }
      savePayment(payment);

      logTransaction(
        'payment_success',
        payment,
        `Verified payment via PayMongo API. Ref: ${payment.gatewayTransactionRef || 'N/A'}`
      );

      return res.json({
        verified: true,
        status: 'paid',
        payment,
      });
    }

    if (verification.status === 'expired') {
      payment.paymentStatus = 'expired';
      savePayment(payment);
      logTransaction('payment_failed', payment, 'PayMongo checkout session expired without payment');
      return res.json({
        verified: false,
        status: 'expired',
        payment,
      });
    }

    return res.json({
      verified: false,
      status: payment.paymentStatus,
      payment,
    });
  } catch (err: any) {
    console.error('Verification failed:', err);
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

/**
 * 4. POST /api/payments/webhook
 * PayMongo Webhook listener with HMAC-SHA256 signature verification & idempotency
 */
paymentsRouter.post('/webhook', async (req: Request, res: Response): Promise<any> => {
  try {
    const signature = req.headers['paymongo-signature'] as string | undefined;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const config = getPayMongoConfig();

    // Verify signature if webhook secret is configured
    if (config.webhookSecret) {
      const isValid = verifyWebhookSignature(rawBody, signature, config.webhookSecret);
      if (!isValid) {
        console.warn('Unauthorized webhook: Signature verification failed');
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
    }

    const payload = req.body;
    const event = payload?.data?.attributes;
    const eventType = event?.type;
    const eventId = payload?.data?.id;

    if (!eventType) {
      return res.status(400).json({ error: 'Malformed webhook payload' });
    }

    // Idempotency check: don't process duplicate events twice
    if (eventId && isWebhookProcessed(eventId)) {
      return res.status(200).json({ received: true, message: 'Event already processed' });
    }

    const eventData = event.data?.attributes;
    const bookingRef =
      eventData?.reference_number ||
      eventData?.description?.split(' ')?.[3] ||
      eventData?.metadata?.booking_reference;

    if (bookingRef) {
      const payment = getPaymentByBookingRef(bookingRef);
      if (payment) {
        if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
          updateBookingAndPaymentStatus(
            bookingRef,
            'paid',
            'confirmed',
            payload?.data?.id || 'paymongo_webhook_event',
            `Webhook received: ${eventType}`
          );
        } else if (eventType === 'payment.failed') {
          updateBookingAndPaymentStatus(
            bookingRef,
            'failed',
            'pending',
            undefined,
            `Webhook received: ${eventType} - ${eventData?.failed_message || 'Payment failure'}`
          );
        }
      }
    }

    if (eventId) {
      markWebhookProcessed(eventId);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal webhook error' });
  }
});

/**
 * 5. GET /api/payments/transactions
 * Admin transaction list & audit records (Requires Admin role)
 */
paymentsRouter.get('/transactions', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { search, status, method } = req.query;
  let list = getPayments();

  if (status && status !== 'all') {
    list = list.filter((p) => p.paymentStatus === status);
  }
  if (method && method !== 'all') {
    list = list.filter((p) => p.paymentMethod === method);
  }
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter((p) => p.bookingReference.toLowerCase().includes(s) || p.id.toLowerCase().includes(s));
  }

  const logs = getTransactions();

  res.json({
    payments: list,
    auditLogs: logs.slice(0, 50),
    totalCount: list.length,
    totalCollected: list
      .filter((p) => p.paymentStatus === 'paid')
      .reduce((sum, p) => sum + p.amount, 0),
  });
});

/**
 * 6. POST /api/payments/refund
 * Admin refund trigger (Requires Admin role)
 */
paymentsRouter.post('/refund', requireAuth, requireRole('admin'), (req: Request, res: Response): any => {
  const { paymentId, bookingReference, reason, amount } = req.body;

  const payment = paymentId ? getPaymentById(paymentId) : getPaymentByBookingRef(bookingReference);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  if (payment.paymentStatus === 'refunded') {
    return res.status(400).json({ error: 'Payment has already been refunded' });
  }

  const refundAmt = amount || payment.amount;
  payment.paymentStatus = 'refunded';
  payment.refundedAmount = refundAmt;
  payment.refundReason = reason || 'Admin requested cancellation and refund';
  payment.updatedAt = new Date().toISOString();

  savePayment(payment);
  logTransaction('refund_completed', payment, `Refunded ₱${refundAmt}: ${payment.refundReason}`);

  return res.json({
    success: true,
    payment,
    refundAmount: refundAmt,
  });
});
