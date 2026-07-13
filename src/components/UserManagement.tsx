import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { Shield, ShieldAlert, User, Key, UserCheck, Trash2, X, Plus, Users, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserAccount {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'viewer';
}

interface UserManagementProps {
  onClose: () => void;
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('username', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList: UserAccount[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        userList.push({
          id: doc.id,
          username: data.username,
          name: data.name,
          role: data.role as 'admin' | 'viewer'
        });
      });
      setUsers(userList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return unsubscribe;
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanUsername || !cleanPassword || !cleanName) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (cleanUsername.length < 3) {
      alert('ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร');
      return;
    }

    if (cleanPassword.length < 4) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    // Check duplicate
    if (users.some(u => u.username === cleanUsername)) {
      alert('มีชื่อผู้ใช้งานนี้อยู่ในระบบแล้ว');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'users'), {
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        role: role
      });

      setUsername('');
      setPassword('');
      setName('');
      setRole('viewer');
      alert('เพิ่มผู้ใช้งานและกำหนดสิทธิ์สำเร็จแล้ว');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, userName: string, userRole: string) => {
    if (userName === 'admin') {
      alert('ไม่สามารถลบผู้ดูแลระบบหลัก (admin) ได้');
      return;
    }

    const savedUserStr = localStorage.getItem('winstock_user');
    const currentUser = savedUserStr ? JSON.parse(savedUserStr) : null;
    if (currentUser && currentUser.username === userName) {
      alert('ไม่สามารถลบบัญชีผู้ใช้งานที่กำลังใช้งานอยู่ได้');
      return;
    }

    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งาน "${userName}" (${userRole})?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', id));
      alert('ลบผู้ใช้งานเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'users');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">จัดการบัญชีผู้ใช้งาน & สิทธิ์การเข้าถึง</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดระดับสิทธิ์ Admin (แก้ไขเปลี่ยนแปลงได้) หรือ Viewer (ดูข้อมูลได้อย่างเดียว)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200/60 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content body - Two column grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Column 1: Add User Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-slate-800 text-sm">สร้างผู้ใช้งานใหม่</h4>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ชื่อผู้ใช้งาน / Username *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="เช่น komsin, worker1"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  รหัสผ่าน / Password *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="ความยาวขั้นต่ำ 4 ตัวอักษร"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ชื่อเต็ม / Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ดวงดี, เจ้าหน้าที่สมชาย"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ระดับสิทธิ์การใช้งาน / Permissions *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all flex items-center justify-center space-x-1.5 ${
                      role === 'admin'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin (แก้ไขได้)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('viewer')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all flex items-center justify-center space-x-1.5 ${
                      role === 'viewer'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Viewer (ดูได้อย่างเดียว)</span>
                  </button>
                </div>
                <p className="text-xxs text-slate-400 mt-1.5 leading-relaxed">
                  * **Admin**: มีสิทธิ์เต็มในการเพิ่มสินค้า, นำเข้า-เบิกจ่าย, ลบ, แก้ไข และตั้งค่าระบบ<br />
                  * **Viewer**: สามารถค้นหา ดูประวัติ ออกรายงาน PDF/Excel ได้เท่านั้น โดยระบบจะปิดกั้นฟังก์ชันปุ่มบันทึกและลบทั้งหมด
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
              >
                <Plus className="w-4 h-4" />
                <span>{loading ? 'กำลังเพิ่ม...' : 'สร้างบัญชีผู้ใช้งาน'}</span>
              </button>
            </form>
          </div>

          {/* Column 2: Users List */}
          <div className="lg:col-span-7 flex flex-col h-full min-h-[300px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-600" />
                <h4 className="font-bold text-slate-800 text-sm">รายชื่อผู้ใช้งานทั้งหมด ({users.length})</h4>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-100 bg-slate-50/30">
              {users.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-800 text-sm">{u.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xxs font-bold ${
                          u.role === 'admin' 
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {u.role === 'admin' ? 'ADMIN' : 'VIEWER'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">ID: {u.username}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteUser(u.id, u.username, u.role)}
                    disabled={u.username === 'admin'}
                    className={`p-2 rounded-xl transition-all ${
                      u.username === 'admin'
                        ? 'opacity-30 cursor-not-allowed text-slate-300'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                    title={u.username === 'admin' ? 'ไม่สามารถลบผู้ดูแลระบบหลักได้' : 'ลบผู้ใช้งาน'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {users.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">
                  ไม่พบบัญชีผู้ใช้งานในระบบ
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
