import React, { useState } from 'react';
import { 
  Boxes, 
  Layers, 
  Wrench, 
  Monitor, 
  Database, 
  User, 
  Activity,
  LogOut,
  Info,
  LayoutDashboard,
  Users,
  ShieldCheck
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StockManagement from './components/StockManagement';
import DemoManagement from './components/DemoManagement';
import MaterialManagement from './components/MaterialManagement';
import AssetManagement from './components/AssetManagement';
import Login from './components/Login';
import UserManagement from './components/UserManagement';

interface UserRole {
  username: string;
  name: string;
  role: 'admin' | 'viewer';
}

export default function App() {
  const [currentMenu, setCurrentMenu] = useState<'dashboard' | 'stock' | 'demo' | 'material' | 'asset'>('dashboard');
  const [user, setUser] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('winstock_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('winstock_user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50/50">
      {/* Premium Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-xs">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-black text-slate-800 tracking-tight">WinStock V1.0</span>
                <p className="text-xxs text-slate-400 mt-0.5">ระบบจัดการบัญชีสินค้าและอุปกรณ์</p>
              </div>
            </div>

            {/* Cloud Database Status & User Account Info */}
            <div className="flex items-center space-x-4">

              {/* Admin Manage Users button */}
              {user.role === 'admin' && (
                <button
                  onClick={() => setIsUserMgmtOpen(true)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center space-x-1.5 border border-transparent hover:border-indigo-100"
                  title="จัดการบัญชีผู้ใช้งาน"
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline-block text-xs font-bold">จัดการสิทธิ์</span>
                </button>
              )}

              <div className="flex items-center space-x-2.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/40 text-xs">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                  user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="font-semibold text-slate-800">{user.name}</p>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {user.role === 'admin' ? (
                      <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <User className="w-3 h-3 text-slate-400" />
                    )}
                    <span className="text-xxs text-slate-500 uppercase tracking-wider font-bold">
                      {user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้เข้าชม (Viewer)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* User Management Modal */}
      {isUserMgmtOpen && (
        <UserManagement onClose={() => setIsUserMgmtOpen(false)} />
      )}

      {/* Main Body Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Welcome Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              ยินดีต้อนรับสู่โปรแกรม WinStock
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              ระบบสากลสำหรับคลังสินค้าอุปกรณ์, จัดทําบัญชีสินค้าเข้า-ออก, เครื่อง DEMO, พาร์ทงานติดตั้ง และทะเบียนทรัพย์สินของบริษัท
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2 rounded-xl text-slate-500 border border-slate-100">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>ข้อมูลทั้งหมดจัดเก็บในฐานข้อมูลกลาง <strong>WinStock</strong> แบบเรียลไทม์</span>
          </div>
        </div>

        {/* Global Module Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/30">
          <button
            onClick={() => setCurrentMenu('dashboard')}
            className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-250 ${
              currentMenu === 'dashboard'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>0. แดชบอร์ดสรุป</span>
          </button>

          <button
            onClick={() => setCurrentMenu('stock')}
            className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-250 ${
              currentMenu === 'stock'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>1. สต็อคสินค้าหลัก</span>
          </button>

          <button
            onClick={() => setCurrentMenu('demo')}
            className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-250 ${
              currentMenu === 'demo'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. บัญชีสินค้า DEMO</span>
          </button>

          <button
            onClick={() => setCurrentMenu('material')}
            className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-250 ${
              currentMenu === 'material'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>3. บัญชีวัสดุงานติดตั้ง</span>
          </button>

          <button
            onClick={() => setCurrentMenu('asset')}
            className={`flex items-center justify-center space-x-2.5 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-250 ${
              currentMenu === 'asset'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>4. บัญชีทรัพย์สินบริษัท</span>
          </button>
        </div>

        {/* Dynamic Menu Routing */}
        <div className="mt-6">
          {currentMenu === 'dashboard' && <Dashboard />}
          {currentMenu === 'stock' && <StockManagement />}
          {currentMenu === 'demo' && <DemoManagement />}
          {currentMenu === 'material' && <MaterialManagement />}
          {currentMenu === 'asset' && <AssetManagement />}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-16 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} WinStock Inventory Management System. สงวนลิขสิทธิ์ทั้งหมด</p>
          <div className="flex space-x-4">
            <span className="hover:text-slate-600 transition-colors">นโยบายความเป็นส่วนตัว</span>
            <span>•</span>
            <span className="hover:text-slate-600 transition-colors">คู่มือการใช้งานระบบ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
