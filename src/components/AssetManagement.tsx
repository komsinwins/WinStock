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
import { AssetItem } from '../types';
import { formatBaht, exportToExcel, printReport } from '../lib/reports';
import { 
  Plus, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  Monitor, 
  MapPin, 
  Wrench, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  X,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageModal, ImageUploadField, getFallbackImage } from '../lib/imageUtils';

export default function AssetManagement() {
  const savedUser = localStorage.getItem('winstock_user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = loggedInUser?.role === 'admin';

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form States (Add Asset)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('IT Equipment');
  const [serial, setSerial] = useState('');
  const [value, setValue] = useState('');
  const [location, setLocation] = useState('สำนักงานใหญ่');
  const [custodian, setCustodian] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyExp, setWarrantyExp] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Zoomed image modal state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Edit/Update Status Modal State
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'inactive' | 'repair' | 'retired'>('active');
  const [newCustodian, setNewCustodian] = useState('');
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'assets'), orderBy('code', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetList: AssetItem[] = [];
      snapshot.forEach((doc) => {
        assetList.push({ id: doc.id, ...doc.data() } as AssetItem);
      });
      setItems(assetList);

      // Auto-seed if empty to populate with pristine realistic assets
      if (snapshot.empty) {
        const defaultAssets: Omit<AssetItem, 'id'>[] = [
          {
            code: 'AST-IT-MBP01',
            name: 'Apple MacBook Pro M3 Max 14"',
            category: 'IT Equipment',
            serial: 'C02H781LQ05D',
            value: 85900,
            location: 'สำนักงานใหญ่ ชั้น 3',
            custodian: 'สมชาย วิศวกรรมระบบ',
            purchaseDate: '2026-01-15',
            warrantyExp: '2027-01-15',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            code: 'AST-TL-OTDR01',
            name: 'เครื่องวัดสายไฟเบอร์ออฟติก OTDR Smart Tester',
            category: 'Testing Tools',
            serial: 'OTDR-2026-0041',
            value: 32000,
            location: 'ทีมช่างเทคนิคไซด์ A',
            custodian: 'ประเสริฐ ดุสิต',
            purchaseDate: '2026-03-10',
            warrantyExp: '2028-03-10',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            code: 'AST-OF-DESK04',
            name: 'โต๊ะทำงานโครงเหล็กหน้าไม้พรีเมียม 1.6ม.',
            category: 'Office Furniture',
            serial: 'OF-DESK-004',
            value: 4500,
            location: 'แผนกบัญชีและการเงิน',
            custodian: 'วิภา แก้วดี',
            purchaseDate: '2026-05-01',
            warrantyExp: 'ไม่มีประกัน',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ];
        defaultAssets.forEach(async (a) => {
          try {
            await addDoc(collection(db, 'assets'), a);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'assets');
          }
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'assets');
    });

    return unsubscribe;
  }, []);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !value || !custodian) {
      alert('กรุณากรอกรหัสทรัพย์สิน ชื่อ มูลค่า และผู้รับผิดชอบให้ครบถ้วน');
      return;
    }

    if (items.some(x => x.code.toUpperCase() === code.trim().toUpperCase())) {
      alert('มีรหัสทรัพย์สินนี้อยู่ในระบบ WinStock แล้ว');
      return;
    }

    const newItem: Omit<AssetItem, 'id'> = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      serial: serial.trim() || 'N/A',
      value: parseFloat(value) || 0,
      location: location.trim(),
      custodian: custodian.trim(),
      purchaseDate,
      warrantyExp: warrantyExp || 'ไม่มีประกัน',
      status: 'active',
      createdAt: new Date().toISOString(),
      imageUrl: imageUrl.trim() || getFallbackImage(name.trim(), category)
    };

    try {
      await addDoc(collection(db, 'assets'), newItem);
      setCode('');
      setName('');
      setSerial('');
      setValue('');
      setLocation('สำนักงานใหญ่');
      setCustodian('');
      setWarrantyExp('');
      setImageUrl('');
      alert('บันทึกเพิ่มทรัพย์สินสำเร็จ');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'assets');
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      await updateDoc(doc(db, 'assets', selectedAsset.id), {
        status: newStatus,
        custodian: newCustodian.trim() || selectedAsset.custodian,
        location: newLocation.trim() || selectedAsset.location
      });
      setSelectedAsset(null);
      alert('อัปเดตสถานะและข้อมูลทรัพย์สินสำเร็จ');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `assets/${selectedAsset.id}`);
    }
  };

  const handleOpenEditModal = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setNewStatus(asset.status);
    setNewCustodian(asset.custodian);
    setNewLocation(asset.location);
  };

  // Filter
  const filtered = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.code.toLowerCase().includes(search.toLowerCase()) ||
                          item.custodian.toLowerCase().includes(search.toLowerCase()) ||
                          item.serial.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Export
  const handleExportExcel = () => {
    const headers = ['รหัสทรัพย์สิน', 'ชื่อทรัพย์สินบริษัท', 'หมวดหมู่', 'S/N', 'มูลค่าจัดซื้อ (บาท)', 'สถานที่วาง', 'ผู้ครอบครอง/ดูแล', 'วันที่ซื้อ', 'ระยะหมดประกัน', 'สถานะ'];
    const data = filtered.map(item => ({
      code: item.code,
      name: item.name,
      category: item.category,
      serial: item.serial,
      value: item.value,
      location: item.location,
      custodian: item.custodian,
      pDate: item.purchaseDate,
      wExp: item.warrantyExp,
      status: item.status === 'active' ? 'กำลังใช้งาน' : item.status === 'repair' ? 'ส่งซ่อมบำรุง' : item.status === 'retired' ? 'จำหน่าย/ตัดชำรุด' : 'ว่างเว้น'
    }));
    exportToExcel(data, headers, `บัญชีทรัพย์สินบริษัท_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDF = () => {
    const headers = ['รหัสทรัพย์สิน', 'ชื่อทรัพย์สินบริษัท', 'หมวดหมู่', 'มูลค่าประเมิน', 'ผู้ดูแลรับผิดชอบ', 'สถานที่วาง', 'สถานะ'];
    const rows = filtered.map(item => [
      item.code,
      item.name,
      item.category,
      formatBaht(item.value),
      item.custodian,
      item.location,
      item.status === 'active' ? '🟢 ใช้งานอยู่' : item.status === 'repair' ? '🔧 ส่งซ่อม' : item.status === 'retired' ? '❌ ชำรุด/ตัดจ่าย' : '⚪ ว่างเว้น'
    ]);
    const totalVal = filtered.reduce((sum, item) => sum + item.value, 0);
    printReport(
      'บัญชีทรัพย์สินบริษัท (Company Assets)',
      headers,
      rows,
      `รวมรายการทรัพย์สิน: ${filtered.length} รายการ | มูลค่าสินทรัพย์รวมสะสม: ${formatBaht(totalVal)}`
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        {isAdmin && (
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">เพิ่มทรัพย์สินบริษัท</h2>
              <p className="text-xs text-slate-500 mt-1">บันทึกเครื่องมือ อุปกรณ์สำนักงาน เฟอร์นิเจอร์ และเซิร์ฟเวอร์คอมพิวเตอร์ที่เป็นทรัพย์สินถาวร</p>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสทรัพย์สิน / Asset Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น AST-IT-NB009"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อทรัพย์สิน *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น คอมพิวเตอร์พกพา DELL Latitude"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่ทรัพย์สิน</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                >
                  <option value="IT Equipment">IT Equipment (อุปกรณ์คอม)</option>
                  <option value="Office Furniture">Office Furniture (เฟอร์นิเจอร์)</option>
                  <option value="Testing Tools">Testing Tools (เครื่องมือวัด)</option>
                  <option value="Vehicles">Vehicles (ยานพาหนะ)</option>
                  <option value="Network Infrastructure">Network (เซิร์ฟเวอร์/ตู้แร็ค)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ซีเรียล (S/N)</label>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="ถ้ามี"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">มูลค่าจัดซื้อ (บาท) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="มูลค่าตามบัญชี"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ผู้ครอบครองดูแล *</label>
                <input
                  type="text"
                  required
                  value={custodian}
                  onChange={(e) => setCustodian(e.target.value)}
                  placeholder="ชื่อผู้ดูแล หรือ แผนก"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่ซื้อทรัพย์สิน *</label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ระยะประกันหมดอายุ</label>
                <input
                  type="text"
                  value={warrantyExp}
                  onChange={(e) => setWarrantyExp(e.target.value)}
                  placeholder="เช่น 15 ม.ค. 2570 หรือไม่มี"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">สถานที่จัดวางปัจจุบัน</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น ห้องเซิร์ฟเวอร์ ชั้น 4"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
              />
            </div>

            <ImageUploadField 
              label="อัปโหลดรูปภาพทรัพย์สิน"
              previewUrl={imageUrl}
              onChange={(base64) => setImageUrl(base64)}
              onClear={() => setImageUrl('')}
            />

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกบัญชีทรัพย์สิน</span>
            </button>
          </form>
        </div>
        )}

        {/* View list of Assets */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between`}>
          <div>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">บัญชีทรัพย์สินถาวร</h2>
                <p className="text-xs text-slate-500 mt-1">ตรวจสอบสถานะและตำแหน่งและผู้ควบคุมดูแลทรัพย์สินส่วนกลาง</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="all">สถานะทั้งหมด</option>
                  <option value="active">🟢 กำลังใช้งาน (Active)</option>
                  <option value="repair">🔧 ส่งซ่อมบำรุง (Repairing)</option>
                  <option value="retired">❌ ชำรุดตัดจ่าย (Retired)</option>
                </select>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาทรัพย์สิน/ผู้ดูแล..."
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
                <div className="py-24 text-center">
                  <Monitor className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <p className="text-sm text-slate-500 mt-2">ไม่พบทรัพย์สินที่สอดคล้องกับการค้นหา</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Asset ID</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ชื่อทรัพย์สิน / หมวด</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">มูลค่าตามบัญชี</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ผู้ถือครองรับผิดชอบ</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ตำแหน่งวาง</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">สถานะ</th>
                      {isAdmin && <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase text-center">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((item) => {
                      const displayImg = item.imageUrl || getFallbackImage(item.name, item.category);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">{item.code}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              {/* Asset image preview thumbnail */}
                              <div 
                                onClick={() => setZoomedImage({ url: displayImg, title: item.name, subtitle: `${item.category} • รหัส: ${item.code} • S/N: ${item.serial}` })}
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
                                <div className="text-xxs text-slate-500 mt-0.5">{item.category} • S/N: {item.serial}</div>
                              </div>
                            </div>
                          </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">{formatBaht(item.value)}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{item.custodian}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{item.location}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.status === 'active' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                              🟢 พร้อมใช้งาน
                            </span>
                          )}
                          {item.status === 'repair' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                              🔧 ส่งซ่อมบำรุง
                            </span>
                          )}
                          {item.status === 'retired' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                              ❌ จำหน่ายตัดจ่าย
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all"
                            >
                              แก้ไข / ย้าย
                            </button>
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
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-6">
            <span className="text-xs text-slate-500">มูลค่ารวมสินทรัพย์ตามบัญชีคงเหลือ:</span>
            <strong className="text-sm font-bold text-slate-800">{formatBaht(filtered.reduce((sum, item) => sum + item.value, 0))}</strong>
          </div>
        </div>
      </div>

      {/* Edit Custodian/Status Asset Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSelectedAsset(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">ปรับปรุงข้อมูลสินทรัพย์บริษัท</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    รหัสทรัพย์สิน: {selectedAsset.code} - {selectedAsset.name}
                  </p>
                </div>
                <button onClick={() => setSelectedAsset(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleUpdateAsset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">สถานะสินทรัพย์ปัจจุบัน *</label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="active">🟢 ใช้งานอยู่ปกติ (Active)</option>
                    <option value="repair">🔧 อยู่ระหว่างส่งซ่อมแซม (Repairing)</option>
                    <option value="retired">❌ เสียชำรุดตัดบัญชี/ขายทอดตลาด (Retired)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">เปลี่ยนผู้ควบคุมรับผิดชอบ *</label>
                  <input
                    type="text"
                    required
                    value={newCustodian}
                    onChange={(e) => setNewCustodian(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ย้ายตำแหน่งที่ตั้งวาง *</label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-xl text-sm shadow-xs transition-colors"
                >
                  บันทึกการโยกย้ายและสถานะ
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
