import React, { useState } from 'react';
import { AppNotification } from '../../types';
import { Bell, CheckCheck, Clock, X, AlertTriangle, Info, Ticket } from 'lucide-react';
import { markAllNotificationsRead } from '../../utils/storage';

interface NotificationDrawerProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onSelectBooking?: (bookingRef: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  isOpen,
  onClose,
  onSelectBooking,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'booking':
        return <Ticket className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'trip_update':
        return <Info className="w-5 h-5 text-sky-600 shrink-0" />;
      case 'payment':
        return <CheckCheck className="w-5 h-5 text-teal-600 shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-teal-900 text-white">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-300" />
            <h2 className="font-semibold text-base">Trip Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-xs bg-amber-400 text-slate-900 font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-teal-200 hover:text-white transition-colors cursor-pointer"
                title="Mark all as read"
              >
                Mark read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-teal-800 transition-colors text-teal-200 hover:text-white cursor-pointer"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.bookingRef && onSelectBooking) {
                    onSelectBooking(n.bookingRef);
                    onClose();
                  }
                }}
                className={`p-3.5 transition-colors rounded-lg mb-1 cursor-pointer ${
                  !n.read ? 'bg-teal-50/60 hover:bg-teal-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{n.title}</h4>
                      <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(n.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                    {n.bookingRef && (
                      <span className="inline-block mt-2 text-[11px] font-mono font-medium text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded">
                        Ref: {n.bookingRef}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          Philippine Standard Time (PST / Asia/Manila)
        </div>
      </div>
    </div>
  );
};
