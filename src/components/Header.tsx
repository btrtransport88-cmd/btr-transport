import React, { useState, useRef, useEffect } from 'react';
import { Language, UserRole } from '../types';
import { DICTIONARY } from '../utils/translations';
import { useAuth } from '../context/AuthContext';
import {
  Bus,
  Bell,
  Globe,
  User,
  Shield,
  Ticket,
  MapPin,
  Calendar,
  Compass,
  Menu,
  X,
  LogIn,
  LogOut,
  UserPlus,
  Lock,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activePassengerView: 'search' | 'my_bookings' | 'route_guide';
  onPassengerViewChange: (view: 'search' | 'my_bookings' | 'route_guide') => void;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenPrivacy: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  language,
  onLanguageChange,
  activePassengerView,
  onPassengerViewChange,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenPrivacy,
}) => {
  const t = DICTIONARY[language];
  const {
    user,
    isAuthenticated,
    logout,
    openLoginModal,
    openRegisterModal,
    switchRoleView,
  } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleClick = (targetRole: UserRole) => {
    const allowed = switchRoleView(targetRole);
    if (allowed) {
      onRoleChange(targetRole);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-teal-950/95 backdrop-blur-md border-b border-teal-900/80 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Route Kicker */}
        <div
          onClick={() => {
            onRoleChange('passenger');
            onPassengerViewChange('search');
          }}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-teal-950 flex items-center justify-center font-black shadow-md shadow-amber-400/20 group-hover:scale-105 transition-transform">
            <Bus className="w-5 h-5 text-teal-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white group-hover:text-amber-300 transition-colors">
                BTR Transport
              </span>
              <span className="text-[10px] bg-teal-900/90 text-teal-200 border border-teal-700/60 font-semibold px-2 py-0.5 rounded-full">
                Palawan
              </span>
            </div>
            <p className="text-[11px] text-teal-200/80 hidden sm:block">
              Buliluyan, Bataraza ⇄ Puerto Princesa Express
            </p>
          </div>
        </div>

        {/* Passenger Navigation Tabs (Desktop) */}
        {currentRole === 'passenger' && (
          <nav className="hidden md:flex items-center gap-1 bg-teal-900/60 p-1 rounded-xl border border-teal-800/60">
            <button
              onClick={() => onPassengerViewChange('search')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePassengerView === 'search'
                  ? 'bg-teal-800 text-amber-300 shadow-xs'
                  : 'text-teal-200 hover:text-white hover:bg-teal-850/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{t.searchTrips}</span>
            </button>

            <button
              onClick={() => onPassengerViewChange('my_bookings')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePassengerView === 'my_bookings'
                  ? 'bg-teal-800 text-amber-300 shadow-xs'
                  : 'text-teal-200 hover:text-white hover:bg-teal-850/50'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>{t.myBookingsTitle}</span>
            </button>

            <button
              onClick={() => onPassengerViewChange('route_guide')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activePassengerView === 'route_guide'
                  ? 'bg-teal-800 text-amber-300 shadow-xs'
                  : 'text-teal-200 hover:text-white hover:bg-teal-850/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Transit Guide</span>
            </button>
          </nav>
        )}

        {/* Right Controls: Role Switcher, Auth, Language, Notification */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* RBAC Portal Switcher */}
          <div className="flex items-center bg-teal-900/80 p-0.5 rounded-xl border border-teal-800">
            <button
              onClick={() => handleRoleClick('passenger')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentRole === 'passenger'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-teal-200 hover:text-white'
              }`}
              title="Passenger Booking & Schedules"
            >
              {t.rolePassenger}
            </button>

            <button
              onClick={() => handleRoleClick('driver')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                currentRole === 'driver'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-teal-200 hover:text-white'
              }`}
              title={isAuthenticated && (user?.role === 'driver' || user?.role === 'admin') ? 'Driver Portal' : 'Driver Sign-In Required'}
            >
              <span>{t.roleDriver}</span>
              {(!isAuthenticated || (user?.role !== 'driver' && user?.role !== 'admin')) && (
                <Lock className="w-2.5 h-2.5 opacity-60" />
              )}
            </button>

            <button
              onClick={() => handleRoleClick('admin')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                currentRole === 'admin'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-teal-200 hover:text-white'
              }`}
              title={isAuthenticated && user?.role === 'admin' ? 'Dispatch Administration' : 'Admin Sign-In Required'}
            >
              <span>{t.roleAdmin}</span>
              {(!isAuthenticated || user?.role !== 'admin') && (
                <Lock className="w-2.5 h-2.5 opacity-60" />
              )}
            </button>
          </div>

          {/* Authentication Badge & Dropdown */}
          {isAuthenticated && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-teal-900/70 hover:bg-teal-850 border border-teal-700/70 rounded-xl transition-all cursor-pointer text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-amber-300/90 font-mono font-semibold uppercase">
                    {user.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-teal-300" />
              </button>

              {/* User Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-teal-800 rounded-2xl shadow-2xl py-3 px-3 z-50 text-white animate-in fade-in zoom-in-95 duration-150">
                  <div className="pb-3 border-b border-slate-800">
                    <div className="font-bold text-sm text-white">{user.name}</div>
                    <div className="text-xs text-slate-400 truncate">{user.email}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {user.role}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Active Session
                      </span>
                    </div>
                    {user.driverId && (
                      <div className="text-[11px] text-teal-300 mt-1 font-mono">
                        Assigned Driver ID: {user.driverId}
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openLoginModal()}
                className="px-3 py-1.5 bg-teal-900/80 hover:bg-teal-800 text-teal-100 hover:text-white rounded-xl text-xs font-bold border border-teal-700/60 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
              <button
                onClick={openRegisterModal}
                className="hidden sm:flex px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-extrabold transition-all items-center gap-1.5 shadow-sm shadow-amber-400/20 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* Language Toggle (EN / FIL) */}
          <button
            onClick={() => onLanguageChange(language === 'en' ? 'fil' : 'en')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-900/60 hover:bg-teal-800 text-teal-200 hover:text-white rounded-xl text-xs font-bold border border-teal-800/80 transition-colors cursor-pointer"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language.toUpperCase()}</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 text-teal-200 hover:text-white hover:bg-teal-800/70 rounded-xl transition-colors cursor-pointer"
            title="Trip Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-teal-950 animate-pulse" />
            )}
          </button>

          {/* Privacy info button */}
          <button
            onClick={onOpenPrivacy}
            className="hidden sm:flex p-2 text-teal-200 hover:text-white hover:bg-teal-800/70 rounded-xl transition-colors cursor-pointer"
            title="Data Privacy Act & Terms"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Mobile hamburger for passenger views */}
          {currentRole === 'passenger' && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-teal-200 hover:text-white hover:bg-teal-800/70 rounded-xl cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && currentRole === 'passenger' && (
        <div className="md:hidden bg-teal-950 border-t border-teal-900 px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => {
              onPassengerViewChange('search');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
              activePassengerView === 'search'
                ? 'bg-teal-800 text-amber-300'
                : 'text-teal-200 hover:bg-teal-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{t.searchTrips}</span>
          </button>

          <button
            onClick={() => {
              onPassengerViewChange('my_bookings');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
              activePassengerView === 'my_bookings'
                ? 'bg-teal-800 text-amber-300'
                : 'text-teal-200 hover:bg-teal-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>{t.myBookingsTitle}</span>
          </button>

          <button
            onClick={() => {
              onPassengerViewChange('route_guide');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
              activePassengerView === 'route_guide'
                ? 'bg-teal-800 text-amber-300'
                : 'text-teal-200 hover:bg-teal-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Transit Guide</span>
          </button>
        </div>
      )}
    </header>
  );
};
