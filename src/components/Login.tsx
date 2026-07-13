import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Boxes, Lock, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: (user: { username: string; name: string; role: 'admin' | 'viewer' }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Auto-seed default credentials if collection is empty
  useEffect(() => {
    const checkAndSeedUsers = async () => {
      try {
        const q = collection(db, 'users');
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setIsSeeding(true);
          // Seed admin
          await addDoc(collection(db, 'users'), {
            username: 'admin',
            password: 'password123',
            name: 'สมชาย (ผู้ดูแลระบบ)',
            role: 'admin'
          });
          // Seed viewer
          await addDoc(collection(db, 'users'), {
            username: 'viewer',
            password: 'password123',
            name: 'สมหญิง (เจ้าหน้าที่ทั่วไป)',
            role: 'viewer'
          });
        }
      } catch (err) {
        console.error('Error seeding users:', err);
      } finally {
        setIsSeeding(false);
      }
    };
    checkAndSeedUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', cleanUsername)
      );
      const snapshot = await getDocs(q);

      let authenticatedUser: { username: string; name: string; role: 'admin' | 'viewer' } | null = null;

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (userData.password === cleanPassword) {
          authenticatedUser = {
            username: userData.username,
            name: userData.name,
            role: userData.role as 'admin' | 'viewer'
          };
        } else {
          setError('รหัสผ่านไม่ถูกต้อง');
          setLoading(false);
          return;
        }
      } else {
        // Fallback: If not found in DB but matches default credentials, perform self-healing seed and log in
        if (cleanUsername === 'admin' && cleanPassword === 'password123') {
          authenticatedUser = {
            username: 'admin',
            name: 'สมชาย (ผู้ดูแลระบบ)',
            role: 'admin'
          };
          // Try to seed in background
          addDoc(collection(db, 'users'), {
            username: 'admin',
            password: 'password123',
            name: 'สมชาย (ผู้ดูแลระบบ)',
            role: 'admin'
          }).catch(err => console.error('Auto-seed admin error:', err));
        } else if (cleanUsername === 'viewer' && cleanPassword === 'password123') {
          authenticatedUser = {
            username: 'viewer',
            name: 'สมหญิง (เจ้าหน้าที่ทั่วไป)',
            role: 'viewer'
          };
          // Try to seed in background
          addDoc(collection(db, 'users'), {
            username: 'viewer',
            password: 'password123',
            name: 'สมหญิง (เจ้าหน้าที่ทั่วไป)',
            role: 'viewer'
          }).catch(err => console.error('Auto-seed viewer error:', err));
        } else {
          setError('ไม่พบชื่อผู้ใช้งานนี้ในระบบ');
          setLoading(false);
          return;
        }
      }

      if (authenticatedUser) {
        localStorage.setItem('winstock_user', JSON.stringify(authenticatedUser));
        onLoginSuccess(authenticatedUser);
      }
    } catch (err: any) {
      console.error(err);
      setError(`เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl flex items-center justify-center">
            <Boxes className="w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black text-white tracking-tight">
          WinStock V1.0
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          ระบบจัดการบัญชีสินค้าและอุปกรณ์
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-slate-800/80 backdrop-blur-md py-8 px-4 shadow-2xl rounded-3xl sm:px-10 border border-slate-700/50">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-300">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="mt-1 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm"
                  placeholder="กรอกชื่อผู้ใช้งาน"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300">
                รหัสผ่าน (Password)
              </label>
              <div className="mt-1 relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-700 bg-slate-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm"
                  placeholder="กรอกรหัสผ่าน"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-900/40 p-3.5 border border-rose-500/30 flex items-start space-x-2">
                <ShieldAlert className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-rose-200">{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || isSeeding}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </div>
          </form>

          {/* Helper panel to display default credentials */}
          <div className="mt-8 pt-6 border-t border-slate-700/60">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              ข้อมูลบัญชีเข้าใช้งานจำลองเพื่อทดสอบระบบ:
            </h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div 
                onClick={() => { setUsername('admin'); setPassword('password123'); }}
                className="p-2.5 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/40 rounded-xl cursor-pointer transition-all flex justify-between items-center"
              >
                <div>
                  <span className="font-bold text-indigo-400">ผู้ดูแลระบบ (Admin)</span>
                  <div className="text-xxs text-slate-500 mt-0.5">แก้ไข เพิ่ม ลบ ปรับปรุงสต็อค จัดสิทธิ์</div>
                </div>
                <div className="text-right text-xxs font-mono">
                  <div>U: <span className="text-white font-semibold">admin</span></div>
                  <div>P: <span className="text-white font-semibold">password123</span></div>
                </div>
              </div>

              <div 
                onClick={() => { setUsername('viewer'); setPassword('password123'); }}
                className="p-2.5 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-700/40 rounded-xl cursor-pointer transition-all flex justify-between items-center"
              >
                <div>
                  <span className="font-bold text-sky-400">ผู้เข้าชม (Viewer)</span>
                  <div className="text-xxs text-slate-500 mt-0.5">ดูรายงาน ค้นหาข้อมูล พิมพ์ออก PDF เท่านั้น</div>
                </div>
                <div className="text-right text-xxs font-mono">
                  <div>U: <span className="text-white font-semibold">viewer</span></div>
                  <div>P: <span className="text-white font-semibold">password123</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
