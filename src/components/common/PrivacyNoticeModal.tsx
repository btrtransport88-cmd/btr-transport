import React from 'react';
import { ShieldCheck, X, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-teal-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-lg">Data Privacy & Passenger Terms</h3>
          </div>
          <button
            onClick={onClose}
            className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">
                Philippine Data Privacy Act of 2012 (RA 10173) Compliance
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                BTR Transport is committed to safeguarding personal passenger data collected for booking, safety manifests, and transit verification.
              </p>
            </div>
          </div>

          <section>
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              1. Passenger Manifest & Safety Requirements
            </h4>
            <p className="text-xs text-slate-600">
              Pursuant to the Land Transportation Franchising and Regulatory Board (LTFRB) and Philippine Coast Guard / Marina safety protocols along southern Palawan and Balabac crossing corridors, all passengers must provide accurate legal names, contact numbers, and verified ID details (for Senior Citizens, PWDs, and Students).
            </p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              2. Cancellation & Refund Policy
            </h4>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
              <li>Cancellations made <strong>24 hours or more</strong> prior to scheduled departure are eligible for a <strong>100% refund</strong>.</li>
              <li>Cancellations made between <strong>12 to 24 hours</strong> prior to departure receive an <strong>80% refund</strong>.</li>
              <li>Cancellations under 12 hours or no-shows are non-refundable, but may be rescheduled subject to seat availability.</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              3. Luggage & Island Ferry Connections
            </h4>
            <p className="text-xs text-slate-600">
              Standard allowance includes 1 carry-on bag (up to 7kg) and 1 luggage (up to 15kg). Passengers boarding at Buliluyan Port for connecting pumpboats to Balabac Island are advised to inform drivers upon boarding.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              4. Payment Verifications
            </h4>
            <p className="text-xs text-slate-600">
              Online GCash and Maya payments are confirmed via trusted payment reference numbers. Cash reservations require arrival at terminal counters 30 minutes before departure.
            </p>
          </section>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
