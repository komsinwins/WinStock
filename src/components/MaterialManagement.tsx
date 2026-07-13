import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { MaterialItem } from '../types';
import { formatBaht, exportToExcel, printReport } from '../lib/reports';
import { 
  Plus, 
  Minus, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  AlertTriangle, 
  MapPin, 
  Wrench, 
  Boxes, 
  TrendingDown, 
  ChevronRight,
  X,
  Trash2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageModal, ImageUploadField, getFallbackImage } from '../lib/imageUtils';

export default function MaterialManagement() {
  const savedUser = localStorage.getItem('winstock_user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = true; // เปิดใช้งานสิทธิ์เต็มรูปแบบทุกฟังก์ชัน

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Form States (Add New Material)
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Cables');
  const [unit, setUnit] = useState('เมตร');
  const [quantity, setQuantity] = useState('100');
  const [minQuantity, setMinQuantity] = useState('20');
  const [price, setPrice] = useState('15');
  const [location, setLocation] = useState('โซน A1');
  const [imageUrl, setImageUrl] = useState('');

  // Equipment Locations States
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [isManageLocationsOpen, setIsManageLocationsOpen] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  // Zoomed image modal state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Adjust stock States
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<MaterialItem | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState(10);
  const [adjustNotes, setAdjustNotes] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'materials'), orderBy('code', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matList: MaterialItem[] = [];
      snapshot.forEach((doc) => {
        matList.push({ id: doc.id, ...doc.data() } as MaterialItem);
      });
      setItems(matList);

      // Auto-seed if completely empty to populate the UI with amazing realistic cables and fixtures
      if (snapshot.empty) {
        const defaultMaterials: Omit<MaterialItem, 'id'>[] = [
          {
            code: 'MAT-CB-CAT6',
            name: 'สายสัญญาณ LAN Link CAT6 Outdoor',
            category: 'Cables',
            unit: 'เมตร',
            quantity: 305,
            minQuantity: 100,
            price: 18,
            location: 'ตู้คลังวัสดุ B1',
            lastUpdated: new Date().toISOString()
          },
          {
            code: 'MAT-CON-RJ45',
            name: 'หัวต่อสายแลน RJ45 CAT6 Modular Plug',
            category: 'Connectors',
            unit: 'ตัว',
            quantity: 80,
            minQuantity: 50,
            price: 15,
            location: 'กล่องย่อย C2',
            lastUpdated: new Date().toISOString()
          },
          {
            code: 'MAT-PIPE-PVC34',
            name: 'ท่อร้อยสายไฟ PVC ขาว 3/4 นิ้ว (2.9 เมตร)',
            category: 'Pipes',
            unit: 'เส้น',
            quantity: 12,
            minQuantity: 20, // This will trigger low stock alert
            price: 45,
            location: 'ราวเก็บแนวตั้ง โซน D',
            lastUpdated: new Date().toISOString()
          },
          {
            code: 'MAT-BOX-OUT',
            name: 'กล่องกันน้ำพลาสติก Outdoor 4x4 นิ้ว',
            category: 'Boxes',
            unit: 'กล่อง',
            quantity: 45,
            minQuantity: 15,
            price: 65,
            location: 'ชั้นวางย่อย A3',
            lastUpdated: new Date().toISOString()
          }
        ];
        defaultMaterials.forEach(async (m) => {
          try {
            await addDoc(collection(db, 'materials'), m);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'materials');
          }
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'materials');
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'equipmentLocations'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locList: { id: string; name: string }[] = [];
      snapshot.forEach((doc) => {
        locList.push({ id: doc.id, name: doc.data().name });
      });
      setLocations(locList);

      // Auto-seed if completely empty
      if (snapshot.empty) {
        const defaultLocs = ['โซน A1', 'โซน A2', 'โซน B1', 'โซน B2', 'คลังทั่วไป'];
        defaultLocs.forEach(async (name) => {
          try {
            await addDoc(collection(db, 'equipmentLocations'), { name });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'equipmentLocations');
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipmentLocations');
    });

    return unsubscribe;
  }, []);

  // Set default location selection once locations list is loaded
  useEffect(() => {
    if (locations.length > 0 && (location === 'โซน A1' || !locations.some(loc => loc.name === location))) {
      setLocation(locations[0].name);
    }
  }, [locations]);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !unit) {
      alert('กรุณากรอกข้อมูลวัสดุที่สำคัญให้ครบถ้วน');
      return;
    }

    // Check if code duplicate
    if (items.some(x => x.code.toUpperCase() === code.trim().toUpperCase())) {
      alert('มีรหัสวัสดุนี้อยู่ในระบบแล้ว');
      return;
    }

    const newItem: Omit<MaterialItem, 'id'> = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      unit: unit.trim(),
      quantity: parseFloat(quantity) || 0,
      minQuantity: parseFloat(minQuantity) || 0,
      price: parseFloat(price) || 0,
      location: location.trim() || 'คลังทั่วไป',
      lastUpdated: new Date().toISOString(),
      imageUrl: imageUrl.trim() || getFallbackImage(name.trim(), category)
    };

    try {
      await addDoc(collection(db, 'materials'), newItem);
      setCode('');
      setName('');
      setQuantity('100');
      setMinQuantity('20');
      setPrice('15');
      setLocation(locations[0]?.name || 'คลังทั่วไป');
      setImageUrl('');
      alert('บันทึกเพิ่มวัสดุใหม่สำเร็จ');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'materials');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustItem) return;

    const qtyDiff = adjustType === 'in' ? adjustQty : -adjustQty;
    const finalQty = selectedAdjustItem.quantity + qtyDiff;

    if (finalQty < 0) {
      alert('จำนวนสินค้าไม่เพียงพอสำหรับการนำออก');
      return;
    }

    try {
      await updateDoc(doc(db, 'materials', selectedAdjustItem.id), {
        quantity: finalQty,
        lastUpdated: new Date().toISOString()
      });
      setSelectedAdjustItem(null);
      setAdjustQty(10);
      setAdjustNotes('');
      alert('ปรับปรุงจำนวนวัสดุในคลังเสร็จสิ้น');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `materials/${selectedAdjustItem.id}`);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newLocationName.trim();
    if (!cleanName) return;

    if (locations.some(loc => loc.name.toLowerCase() === cleanName.toLowerCase())) {
      alert('มีชื่อสถานที่จัดเก็บนี้อยู่ในระบบแล้ว');
      return;
    }

    try {
      await addDoc(collection(db, 'equipmentLocations'), { name: cleanName });
      setNewLocationName('');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'equipmentLocations');
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่จัดเก็บ "${name}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'equipmentLocations', id));
      // If the currently selected location was deleted, change it to the first available or empty
      if (location === name) {
        const remaining = locations.filter(loc => loc.id !== id);
        setLocation(remaining[0]?.name || '');
      }
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'equipmentLocations');
    }
  };

  // Filter
  const filtered = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.code.toLowerCase().includes(search.toLowerCase()) ||
                          item.location.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' ? true : item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(items.map(item => item.category)));

  // Reports
  const handleExportExcel = () => {
    const headers = ['รหัสวัสดุ', 'ชื่อวัสดุงานติดตั้ง', 'หมวดหมู่', 'หน่วยนับ', 'จำนวนคงเหลือ', 'เกณฑ์ขั้นต่ำ', 'ราคาจัดซื้อ', 'สถานที่จัดเก็บ', 'อัปเดตล่าสุด'];
    const data = filtered.map(item => ({
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      qty: item.quantity,
      min: item.minQuantity,
      price: item.price,
      location: item.location,
      last: new Date(item.lastUpdated).toLocaleDateString('th-TH')
    }));
    exportToExcel(data, headers, `วัสดุงานติดตั้ง_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDF = () => {
    const headers = ['รหัสวัสดุ', 'ชื่อวัสดุงานติดตั้ง', 'หมวดหมู่', 'คงเหลือ', 'หน่วยนับ', 'ราคา/หน่วย', 'สถานที่จัดเก็บ'];
    const rows = filtered.map(item => [
      item.code,
      item.name,
      item.category,
      item.quantity,
      item.unit,
      formatBaht(item.price),
      item.location
    ]);
    const lowStockCount = filtered.filter(x => x.quantity <= x.minQuantity).length;
    printReport(
      'บัญชีวัสดุงานติดตั้ง (Installation Materials)',
      headers,
      rows,
      `รวมรายการวัสดุ: ${filtered.length} หมวดหมู่ | วัสดุที่ต้องจัดซื้อเพิ่ม (ต่ำกว่าเกณฑ์): ${lowStockCount} รายการ`
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel to register new material */}
        {isAdmin && (
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">เพิ่มประเภทวัสดุงานติดตั้ง</h2>
              <p className="text-xs text-slate-500 mt-1">เพิ่มรหัสพาร์ทวัสดุสิ้นเปลือง สายเคเบิล และอุปกรณ์จับยึดงานเซ็ตอัพ</p>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสวัสดุ / Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น MAT-CAB-FO01"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อเรียกวัสดุ *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น สายไฟเบอร์ออฟติก Flat Drop 1 Core"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                >
                  <option value="Cables">Cables (สายเคเบิล)</option>
                  <option value="Connectors">Connectors (หัวแจ็ค/เต้ารับ)</option>
                  <option value="Pipes">Pipes (ท่อเดินสาย/ราง)</option>
                  <option value="Boxes">Boxes (กล่องพักสาย)</option>
                  <option value="Fasteners">Fasteners (พุก/สกรู/เทป)</option>
                  <option value="Tools">Tools (อุปกรณ์สวม/เครื่องมือ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">หน่วยนับ *</label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="เช่น เมตร / ตัว / เส้น"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 truncate" title="จำนวนเริ่มต้น">จำนวนเริ่มต้น</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 truncate" title="เกณฑ์แจ้งเตือนขั้นต่ำ">เกณฑ์ขั้นต่ำ</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 truncate" title="ราคาจัดซื้อต่อหน่วย">ราคาต่อหน่วย</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-600">สถานที่จัดเก็บอุปกรณ์</label>
                <button
                  type="button"
                  onClick={() => setIsManageLocationsOpen(true)}
                  className="text-xxs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>จัดการรายการ</span>
                </button>
              </div>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-hidden"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
                {locations.length === 0 && (
                  <option value="">ไม่มีสถานที่จัดเก็บ (กรุณาเพิ่ม)</option>
                )}
              </select>
            </div>

            <ImageUploadField 
              label="อัปโหลดรูปตัวอย่างวัสดุ"
              previewUrl={imageUrl}
              onChange={(base64) => setImageUrl(base64)}
              onClear={() => setImageUrl('')}
            />

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มเข้าพอร์ตวัสดุ</span>
            </button>
          </form>
        </div>
        )}

        {/* View list of materials with warning thresholds */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between`}>
          <div>
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">สต็อควัสดุงานติดตั้ง</h2>
                <p className="text-xs text-slate-500 mt-1">แสดงสินค้าพาร์ทวัสดุสิ้นเปลืองพร้อมแจ้งเตือนระดับวิกฤตที่ต้องสั่งซื้อเพิ่ม</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหารหัส หรือชื่อวัสดุ..."
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
                  <Wrench className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <p className="text-sm text-slate-500 mt-2">ไม่พบวัสดุในระบบตามเงื่อนไขค้นหา</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">รหัสพาร์ท</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ชื่อรายการวัสดุ / หมวด</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">ราคาเฉลี่ย</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase">สถานที่จัดเก็บ</th>
                      <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase text-right">จำนวนคงเหลือ</th>
                      {isAdmin && <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase text-center">ทำรายการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((item) => {
                      const isLowStock = item.quantity <= item.minQuantity;
                      const displayImg = item.imageUrl || getFallbackImage(item.name, item.category);

                      return (
                        <tr key={item.id} className={`hover:bg-slate-50/40 transition-all ${isLowStock ? 'bg-rose-50/20' : ''}`}>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">{item.code}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              {/* Material image thumbnail */}
                              <div 
                                onClick={() => setZoomedImage({ url: displayImg, title: item.name, subtitle: `${item.category} • รหัส: ${item.code}` })}
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
                                <span className="inline-block text-xxs text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 mt-1">{item.category}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">{formatBaht(item.price)} <span className="text-xxs text-slate-400">/{item.unit}</span></td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{item.location}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end">
                              <span className={`text-base font-bold ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                                {item.quantity} {item.unit}
                              </span>
                              {isLowStock && (
                                <span className="inline-flex items-center space-x-0.5 text-xxs font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100 mt-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>วิกฤต (ตํ่ากว่า {item.minQuantity})</span>
                                </span>
                              )}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => setSelectedAdjustItem(item)}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all"
                              >
                                เบิก/รับเพิ่ม
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
        </div>
      </div>

      {/* Adjust stock popup Modal */}
      <AnimatePresence>
        {selectedAdjustItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setSelectedAdjustItem(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">ทำรายการ เบิก/รับเพิ่ม วัสดุคลัง</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    วัสดุ: {selectedAdjustItem.name} (คงเหลือ: {selectedAdjustItem.quantity} {selectedAdjustItem.unit})
                  </p>
                </div>
                <button onClick={() => setSelectedAdjustItem(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <form onSubmit={handleAdjustStock} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ประเภทธุรกรรม</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('in')}
                      className={`py-2 text-sm font-semibold rounded-lg border text-center transition-all ${
                        adjustType === 'in' 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ➕ รับของเพิ่มเข้าคลัง (Stock In)
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustType('out')}
                      className={`py-2 text-sm font-semibold rounded-lg border text-center transition-all ${
                        adjustType === 'out' 
                          ? 'bg-rose-600 text-white border-rose-600' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      📤 เบิกจ่ายของออกคลัง (Stock Out)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวนหน่วยที่ต้องการปรับปรุง ({selectedAdjustItem.unit}) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={adjustType === 'out' ? selectedAdjustItem.quantity : 10000}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                  {adjustType === 'out' && (
                    <p className="text-xxs text-slate-500 mt-1">จำนวนที่เบิกจ่ายสูงสุดได้ไม่เกินยอดคงเหลือเดิม ({selectedAdjustItem.quantity} {selectedAdjustItem.unit})</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">บันทึกเพิ่มเติม (ถ้ามี)</label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="เช่น เบิกไปใช้ไซต์งานลูกค้า สยามพารากอน"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full text-white font-semibold py-2.5 rounded-xl text-sm transition-colors ${
                    adjustType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  ยืนยันอัปเดตระดับสินค้าคงเหลือ
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Locations Modal */}
      <AnimatePresence>
        {isManageLocationsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsManageLocationsOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">จัดการสถานที่จัดเก็บอุปกรณ์</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    เพิ่มหรือลบรายการสถานที่เพื่อปรับปรุงตัวเลือกในการจัดเก็บ
                  </p>
                </div>
                <button onClick={() => setIsManageLocationsOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Add New Location Form */}
              <form onSubmit={handleAddLocation} className="flex gap-2 mb-4">
                <input
                  type="text"
                  required
                  placeholder="เช่น ตู้เก็บของ A4, คลังชั้น 3"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่ม</span>
                </button>
              </form>

              {/* Locations List */}
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex justify-between items-center py-2.5 px-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">{loc.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocation(loc.id, loc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="ลบสถานที่นี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {locations.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    ไม่มีรายการสถานที่จัดเก็บในขณะนี้
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsManageLocationsOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-xl text-xs transition-colors"
                >
                  เสร็จสิ้น
                </button>
              </div>
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
