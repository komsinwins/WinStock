import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { DemoItem } from '../types';
import { formatBaht, exportToExcel, printReport } from '../lib/reports';
import { 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  UserCheck, 
  Calendar, 
  RotateCcw, 
  Trash2, 
  AlertTriangle,
  Tag, 
  Laptop, 
  CheckCircle2,
  X,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageModal, ImageUploadField, getFallbackImage } from '../lib/imageUtils';

export default function DemoManagement() {
  const savedUser = localStorage.getItem('winstock_user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = true; // เปิดใช้งานสิทธิ์เต็มรูปแบบทุกฟังก์ชัน

  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form States
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Zoomed image modal state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Checkout (Borrow) State Modal
  const [selectedItem, setSelectedItem] = useState<DemoItem | null>(null);
  const [borrower, setBorrower] = useState('');
  const [borrowDate, setBorrowDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState('');

  // Real-time Firestore Sync
  useEffect(() => {
    const q = query(collection(db, 'demoItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const demoList: DemoItem[] = [];
      snapshot.forEach((doc) => {
        demoList.push({ id: doc.id, ...doc.data() } as DemoItem);
      });
      setItems(demoList);

      // Seed mock data if completely empty to populate the UI
      if (snapshot.empty) {
        const defaultDemos: Omit<DemoItem, 'id'>[] = [
          {
            sku: 'DM-01',
            name: 'Enterprise Firewall Appliance',
            brand: 'Fortinet',
            model: 'FortiGate 60F',
            serial: 'FGT60FTK21008892',
            status: 'available',
            createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
          },
          {
            sku: 'DM-02',
            name: 'Managed PoE Switch 24-Port',
            brand: 'Cisco Systems',
            model: 'C9200L-24P-4G-E',
            serial: 'FCW2516L08Y',
            status: 'borrowed',
            borrower: 'บริษัท ไซเบอร์ ซิสเต็มส์ จำกัด',
            borrowDate: '2026-07-01',
            expectedReturnDate: '2026-07-15',
            createdAt: new Date(Date.now() - 3600000 * 24 * 10).toISOString()
          },
          {
            sku: 'DM-03',
            name: 'Wi-Fi 6 Access Point',
            brand: 'Aruba Networks',
            model: 'AP-515',
            serial: 'CN89KLD892',
            status: 'available',
            createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
          }
        ];
        defaultDemos.forEach(async (d) => {
          try {
            await addDoc(collection(db, 'demoItems'), d);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'demoItems');
          }
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'demoItems');
    });

    return unsubscribe;
  }, []);

  const handleAddDemoItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !brand || !model || !serial) {
      alert('กรุณากรอกข้อมูลสินค้า DEMO ให้ครบถ้วน');
      return;
    }

    const newItem: Omit<DemoItem, 'id'> = {
      sku: sku.trim() || `DM-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      brand: brand.trim(),
      model: model.trim(),
      serial: serial.trim(),
      status: 'available',
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      imageUrl: imageUrl.trim() || getFallbackImage(name.trim(), 'demoItems')
    };

    try {
      await addDoc(collection(db, 'demoItems'), newItem);
      setSku('');
      setName('');
      setBrand('');
      setModel('');
      setSerial('');
      setNotes('');
      setImageUrl('');
      alert('เพิ่มสินค้า DEMO สำเร็จ');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'demoItems');
    }
  };

  const handleBorrowItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !borrower) return;

    try {
      await updateDoc(doc(db, 'demoItems', selectedItem.id), {
        status: 'borrowed',
        borrower: borrower.trim(),
        borrowDate,
        expectedReturnDate: returnDate
      });
      setSelectedItem(null);
      setBorrower('');
      setReturnDate('');
      alert('บันทึกการยืมสินค้า DEMO เรียบร้อย');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `demoItems/${selectedItem.id}`);
    }
  };

  const handleReturnItem = async (itemId: string) => {
    if (!confirm('ยืนยันว่าสินค้า DEMO นี้ได้รับคืนเรียบร้อยและพร้อมใช้งาน?')) return;
    try {
      await updateDoc(doc(db, 'demoItems', itemId), {
        status: 'available',
        borrower: null,
        borrowDate: null,
        expectedReturnDate: null,
        actualReturnDate: new Date().toISOString().split('T')[0]
      });
      alert('บันทึกคืนสินค้า DEMO สำเร็จ');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `demoItems/${itemId}`);
    }
  };

  const handleMarkDamaged = async (itemId: string) => {
    if (!confirm('ต้องการปรับสถานะสินค้า DEMO เป็น "ชำรุดเสียหาย" หรือไม่?')) return;
    try {
      await updateDoc(doc(db, 'demoItems', itemId), {
        status: 'damaged'
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `demoItems/${itemId}`);
    }
  };

  // Filter
  const filtered = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          item.brand.toLowerCase().includes(search.toLowerCase()) ||
                          item.model.toLowerCase().includes(search.toLowerCase()) ||
                          item.serial.toLowerCase().includes(search.toLowerCase()) ||
                          (item.borrower && item.borrower.toLowerCase().includes(search.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Reporting
  const handleExportExcel = () => {
    const headers = ['รหัสสินค้า', 'ชื่ออุปกรณ์ DEMO', 'ยี่ห้อ', 'รุ่น', 'S/N', 'สถานะปัจจุบัน', 'ผู้ยืม / บริษัท', 'วันที่ยืม', 'กำหนดส่งคืน', 'รายละเอียดเพิ่มเติม'];
    const data = filtered.map(item => ({
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      model: item.model,
      serial: item.serial,
      status: item.status === 'available' ? 'พร้อมทดสอบ' : item.status === 'borrowed' ? 'อยู่ระหว่างทดสอบ/ยืม' : 'ชำรุดเสียหาย',
      borrower: item.borrower || '-',
      borrowDate: item.borrowDate || '-',
      expectedReturn: item.expectedReturnDate || '-',
      notes: item.notes || '-'
    }));
    exportToExcel(data, headers, `บัญชีสินค้า_DEMO_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDF = () => {
    const headers = ['รหัส', 'ชื่ออุปกรณ์ DEMO', 'ยี่ห้อ/รุ่น', 'S/N', 'สถานะ', 'ผู้ยืม/รายละเอียด', 'กำหนดส่งคืน'];
    const rows = filtered.map(item => [
      item.sku,
      item.name,
      `${item.brand} / ${item.model}`,
      item.serial,
      item.status === 'available' ? '🟢 พร้อมใช้' : item.status === 'borrowed' ? '🟡 ถูกยืม' : '🔴 ชำรุด',
      item.borrower ? `ยืมโดย: ${item.borrower}` : '-',
      item.expectedReturnDate ? new Date(item.expectedReturnDate).toLocaleDateString('th-TH') : '-'
    ]);
    printReport(
      'บัญชีประวัติและสินค้า DEMO (Demo Account)',
      headers,
      rows,
      `สรุปสินค้า DEMO ทั้งหมด: ${filtered.length} รายการ (พร้อมใช้: ${filtered.filter(x => x.status === 'available').length} | ยืม: ${filtered.filter(x => x.status === 'borrowed').length})`
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to add DEMO item */}
        {isAdmin && (
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">เพิ่มรายการสินค้า DEMO</h2>
              <p className="text-xs text-slate-500 mt-1">บันทึกอุปกรณ์และซอฟต์แวร์ที่ใช้สำหรับทดสอบหรือให้ยืมทดลองใช้</p>
            </div>

            <form onSubmit={handleAddDemoItem} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัส DEMO Code</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="เว้นว่างไว้ระบบจะตั้งให้อัตโนมัติ"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่ออุปกรณ์ DEMO *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น Router Switch L3 24 Port POE"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ยี่ห้อ *</label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="เช่น Cisco"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">รุ่น *</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="เช่น Catalyst 9300"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ซีเรียลนัมเบอร์ (S/N) *</label>
              <input
                type="text"
                required
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="ระบุซีเรียลอย่างละเอียด"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเหตุ / สภาพอุปกรณ์</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น อุปกรณ์มีรอยขีดข่วนเล็กน้อย มีอุปกรณ์กล่องครบ"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
              />
            </div>

            <ImageUploadField 
              label="อัปโหลดรูปตัวอย่างสินค้า DEMO"
              previewUrl={imageUrl}
              onChange={(base64) => setImageUrl(base64)}
              onClear={() => setImageUrl('')}
            />

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มเข้าคลัง DEMO</span>
            </button>
          </form>
        </div>
        )}

        {/* List of DEMO items with state change actions */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between`}>
          <div>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">สต็อคสินค้า DEMO</h2>
                <p className="text-xs text-slate-500 mt-1">คลังอุปกรณ์ตัวอย่างสำหรับการจัดแสดงและยืมทดสอบ</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="available">🟢 ว่าง (พร้อมยืม)</option>
                  <option value="borrowed">🟡 ถูกยืมทดสอบ</option>
                  <option value="damaged">🔴 ชำรุดเสียหาย</option>
                </select>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหา..."
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                />

                <div className="flex gap-1">
                  <button onClick={handleExportExcel} className="p-1.5 border rounded-lg hover:bg-slate-50" title="Excel"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /></button>
                  <button onClick={handlePrintPDF} className="p-1.5 border rounded-lg hover:bg-slate-50" title="PDF"><Printer className="w-4 h-4 text-sky-600" /></button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <Laptop className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <p className="text-sm text-slate-500 mt-2">ไม่มีประวัติหรือรายการสินค้า DEMO ที่ค้นหา</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">DEMO Code</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ยี่ห้อ / ชื่อสินค้า</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ซีเรียล (S/N)</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">สถานะปัจจุบัน</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ผู้ยืม / รายละเอียดยืม</th>
                      {isAdmin && <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase text-center">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((item) => {
                      const displayImg = item.imageUrl || getFallbackImage(item.name, 'demoItems');
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{item.sku}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              {/* Custom image preview thumbnail */}
                              <div 
                                onClick={() => setZoomedImage({ url: displayImg, title: item.name, subtitle: `${item.brand} ${item.model} (${item.sku})` })}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex-shrink-0 cursor-zoom-in relative group shadow-2xs"
                                title="คลิกดูรูปขยาย"
                              >
                                <img 
                                  src={displayImg} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div>
                                <div className="font-bold text-slate-800">{item.name}</div>
                                <div className="text-xxs text-slate-400 mt-0.5">{item.brand} {item.model}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-700">{item.serial}</td>
                          <td className="py-3.5 px-4">
                            {item.status === 'available' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                🟢 ว่าง / พร้อมทดสอบ
                              </span>
                            )}
                            {item.status === 'borrowed' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                🟡 ถูกยืมทดสอบ
                              </span>
                            )}
                            {item.status === 'damaged' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                                🔴 ชำรุด / เสียหาย
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {item.status === 'borrowed' ? (
                              <div className="space-y-0.5">
                                <p className="font-semibold text-slate-700">🏢 {item.borrower}</p>
                                <p className="text-slate-400 font-mono text-xxs">📅 {item.borrowDate} → {item.expectedReturnDate || 'ไม่มีกำหนดคืน'}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-sans">{item.notes || '-'}</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {item.status === 'available' && (
                                  <>
                                    <button
                                      onClick={() => setSelectedItem(item)}
                                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all"
                                    >
                                      บันทึกยืม
                                    </button>
                                    <button
                                      onClick={() => handleMarkDamaged(item.id)}
                                      className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                                      title="ปรับเป็นชำรุด"
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {item.status === 'borrowed' && (
                                  <button
                                    onClick={() => handleReturnItem(item.id)}
                                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-all"
                                  >
                                    รับคืนคลัง
                                  </button>
                                )}
                                {item.status === 'damaged' && (
                                  <span className="text-xs text-slate-400">ชำรุดส่งซ่อม</span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Borrow/Checkout Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSelectedItem(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">บันทึกการยืมสินค้า DEMO</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    อุปกรณ์: {selectedItem.name} ({selectedItem.brand} {selectedItem.model})
                  </p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleBorrowItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ผู้ยืม / ชื่อหน่วยงาน / ลูกค้า *</label>
                  <input
                    type="text"
                    required
                    value={borrower}
                    onChange={(e) => setBorrower(e.target.value)}
                    placeholder="ระบุชื่อบริษัทหรือพนักงานที่ยืม"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่เริ่มยืม *</label>
                    <input
                      type="date"
                      required
                      value={borrowDate}
                      onChange={(e) => setBorrowDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">กำหนดส่งคืน</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>บันทึกส่งมอบ DEMO</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <ImageModal
          imageUrl={zoomedImage.url}
          title={zoomedImage.title}
          subtitle={zoomedImage.subtitle}
          onClose={() => setZoomedImage(null)}
        />
      )}
    </div>
  );
}
