import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StockInItem, StockOutItem, ProductCategory, ProductType } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Wrench, 
  Monitor,
  Package,
  Calendar,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function Dashboard() {
  const [stockInItems, setStockInItems] = useState<StockInItem[]>([]);
  const [stockOutItems, setStockOutItems] = useState<StockOutItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats from other collections (optional but good for context)
  const [demoCount, setDemoCount] = useState(0);
  const [materialCount, setMaterialCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);

  useEffect(() => {
    setLoading(true);

    // Subscribe to Stock In Items
    const qStockIn = query(collection(db, 'stockIn'), orderBy('createdAt', 'desc'));
    const unsubscribeStockIn = onSnapshot(qStockIn, (snapshot) => {
      const items: StockInItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as StockInItem);
      });
      setStockInItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stockIn');
    });

    // Subscribe to Stock Out Items
    const qStockOut = query(collection(db, 'stockOut'), orderBy('createdAt', 'desc'));
    const unsubscribeStockOut = onSnapshot(qStockOut, (snapshot) => {
      const items: StockOutItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as StockOutItem);
      });
      setStockOutItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stockOut');
    });

    // Subscribe to Categories
    const qCategories = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const items: ProductCategory[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ProductCategory);
      });
      setCategories(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    // Subscribe to Product Types
    const qTypes = query(collection(db, 'productTypes'), orderBy('name', 'asc'));
    const unsubscribeTypes = onSnapshot(qTypes, (snapshot) => {
      const items: ProductType[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ProductType);
      });
      setProductTypes(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'productTypes');
    });

    // Subscribe to demo items count
    const unsubscribeDemo = onSnapshot(collection(db, 'demo'), (snapshot) => {
      setDemoCount(snapshot.size);
    });

    // Subscribe to materials count
    const unsubscribeMaterials = onSnapshot(collection(db, 'materials'), (snapshot) => {
      setMaterialCount(snapshot.size);
    });

    // Subscribe to assets count
    const unsubscribeAssets = onSnapshot(collection(db, 'assets'), (snapshot) => {
      setAssetCount(snapshot.size);
    });

    setLoading(false);

    return () => {
      unsubscribeStockIn();
      unsubscribeStockOut();
      unsubscribeCategories();
      unsubscribeTypes();
      unsubscribeDemo();
      unsubscribeMaterials();
      unsubscribeAssets();
    };
  }, []);

  // Format Helper for Currency
  const formatBaht = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Process data for charts
  // 1. Monthly Summary (last 6 months)
  const getMonthlyData = () => {
    const monthlyMap: { [key: string]: { month: string; stockIn: number; stockOut: number; stockInValue: number; stockOutValue: number } } = {};
    const monthsThai = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

    // Initialize last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthsThai[d.getMonth()]} ${String(d.getFullYear() + 543).substring(2)}`;
      monthlyMap[key] = { month: label, stockIn: 0, stockOut: 0, stockInValue: 0, stockOutValue: 0 };
    }

    // Process Stock In
    stockInItems.forEach(item => {
      if (!item.createdAt) return;
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].stockIn += item.initialQty;
        monthlyMap[key].stockInValue += item.initialQty * item.price;
      }
    });

    // Process Stock Out
    stockOutItems.forEach(item => {
      if (!item.createdAt) return;
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].stockOut += item.quantity;
        monthlyMap[key].stockOutValue += item.quantity * item.price;
      }
    });

    return Object.values(monthlyMap);
  };

  // 2. Stock distribution by Category (name is the Category Name in StockInItem)
  const getCategoryData = () => {
    const catMap: { [key: string]: { name: string; qty: number; value: number } } = {};
    
    stockInItems.forEach(item => {
      const catName = item.name || "ทั่วไป / ไม่ระบุ";
      if (!catMap[catName]) {
        catMap[catName] = { name: catName, qty: 0, value: 0 };
      }
      catMap[catName].qty += item.currentQty;
      catMap[catName].value += item.currentQty * item.price;
    });

    return Object.values(catMap).sort((a, b) => b.value - a.value).slice(0, 5);
  };

  // 3. Top Active Product Types
  const getTypeMovementData = () => {
    const typeMap: { [key: string]: { name: string; stockIn: number; stockOut: number } } = {};

    stockInItems.forEach(item => {
      const typeName = item.type || "อื่นๆ";
      if (!typeMap[typeName]) {
        typeMap[typeName] = { name: typeName, stockIn: 0, stockOut: 0 };
      }
      typeMap[typeName].stockIn += item.initialQty;
    });

    stockOutItems.forEach(item => {
      const typeName = item.sku ? (stockInItems.find(s => s.sku === item.sku)?.type || "อื่นๆ") : "อื่นๆ";
      if (!typeMap[typeName]) {
        typeMap[typeName] = { name: typeName, stockIn: 0, stockOut: 0 };
      }
      typeMap[typeName].stockOut += item.quantity;
    });

    return Object.values(typeMap)
      .map(t => ({ ...t, totalActivity: t.stockIn + t.stockOut }))
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 6);
  };

  const monthlyData = getMonthlyData();
  const categoryData = getCategoryData();
  const typeMovementData = getTypeMovementData();

  // Aggregate stats
  const totalStockInQty = stockInItems.reduce((acc, item) => acc + item.initialQty, 0);
  const totalStockInValue = stockInItems.reduce((acc, item) => acc + (item.initialQty * item.price), 0);
  
  const totalStockOutQty = stockOutItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalStockOutValue = stockOutItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  const currentStockQty = stockInItems.reduce((acc, item) => acc + item.currentQty, 0);
  const currentStockValue = stockInItems.reduce((acc, item) => acc + (item.currentQty * item.price), 0);

  // Warning thresholds
  const lowStockItems = stockInItems.filter(item => item.currentQty > 0 && item.currentQty <= 2);
  const outOfStockItems = stockInItems.filter(item => item.currentQty === 0);

  const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 font-sans">กำลังดึงข้อมูลแดชบอร์ดสรุปแบบเรียลไทม์...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Metric Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Stat Card 1: Total Stock Value */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-xs group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/40 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">มูลค่าสินค้าในคลังปัจจุบัน</span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{formatBaht(currentStockValue)}</h3>
              <span className="inline-flex items-center text-xs font-semibold text-slate-500">
                <Boxes className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                <span>คงเหลือรวม {currentStockQty.toLocaleString()} ชิ้น</span>
              </span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Stat Card 2: Stock In Activity */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-xs group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/40 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">ยอดนำเข้าทั้งหมด (สะสม)</span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{formatBaht(totalStockInValue)}</h3>
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                <span>นำเข้า {totalStockInQty.toLocaleString()} ชิ้น</span>
              </span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Stat Card 3: Stock Out Activity */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-xs group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50/40 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">ยอดจำหน่าย / นำออกสะสม</span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{formatBaht(totalStockOutValue)}</h3>
              <span className="inline-flex items-center text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                <TrendingDown className="w-3.5 h-3.5 mr-1" />
                <span>นำออก {totalStockOutQty.toLocaleString()} ชิ้น</span>
              </span>
            </div>
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Stat Card 4: Inventory Alerts */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-xs group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/40 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">สินค้าเฝ้าระวัง & หมดสต็อก</span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {(lowStockItems.length + outOfStockItems.length).toLocaleString()} <span className="text-xs text-slate-400 font-medium">รายการ</span>
              </h3>
              <span className="inline-flex items-center text-xs font-semibold text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                <span>เหลือน้อย {lowStockItems.length} | หมดสต็อก {outOfStockItems.length}</span>
              </span>
            </div>
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

      </div>

      {/* 2. System Overview Extra Bento Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-100/40 rounded-3xl border border-slate-200/30">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xxs font-bold text-slate-400 uppercase">หมวดหมู่สินค้าทั้งหมด</p>
            <p className="text-sm font-bold text-slate-800">{categories.length} หมวดหมู่</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
          <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xxs font-bold text-slate-400 uppercase">สินค้าเดโม (DEMO)</p>
            <p className="text-sm font-bold text-slate-800">{demoCount} รายการคลัง</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
          <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xxs font-bold text-slate-400 uppercase">วัสดุอุปกรณ์ติดตั้ง</p>
            <p className="text-sm font-bold text-slate-800">{materialCount} รายการอะไหล่</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center space-x-3">
          <div className="p-2 bg-violet-50 rounded-xl text-violet-600">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xxs font-bold text-slate-400 uppercase">ทะเบียนทรัพย์สินบริษัท</p>
            <p className="text-sm font-bold text-slate-800">{assetCount} ทรัพย์สิน</p>
          </div>
        </div>
      </div>

      {/* 3. Primary Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Monthly Trends (2/3 width on desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-indigo-600" />
                <span>วิเคราะห์ความเคลื่อนไหวสินค้าเข้า-ออกรายเดือน</span>
              </h3>
              <p className="text-xxs text-slate-400 mt-0.5">ยอดปริมาณรวม (ชิ้น) สินค้านำเข้าเทียบกับการตัดจำหน่ายสต็อกรายเดือนย้อนหลัง</p>
            </div>
            <span className="text-xxs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
              อัปเดตเรียลไทม์
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorStockIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorStockOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Inter' }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                  labelStyle={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b', fontFamily: 'sans-serif' }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'sans-serif' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'semibold', color: '#475569' }}
                />
                <Area 
                  type="monotone" 
                  name="นำเข้าสินค้า (ชิ้น)" 
                  dataKey="stockIn" 
                  stroke="#10b981" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorStockIn)" 
                />
                <Area 
                  type="monotone" 
                  name="จำหน่ายสินค้า (ชิ้น)" 
                  dataKey="stockOut" 
                  stroke="#f43f5e" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorStockOut)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Distribution (1/3 width on desktop) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <Package className="w-4 h-4 mr-2 text-indigo-600" />
              <span>สัดส่วนมูลค่าสต็อกแยกตามหมวดหมู่</span>
            </h3>
            <p className="text-xxs text-slate-400 mt-0.5">แบ่งตามร้อยละมูลค่าสินค้าคงเหลือ (Top 5)</p>
          </div>

          <div className="h-48 relative flex items-center justify-center">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatBaht(value)}
                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    itemStyle={{ fontSize: '11px', fontFamily: 'sans-serif' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 font-sans">ไม่มีข้อมูลสินค้าในสต็อกหลัก</p>
            )}
            {categoryData.length > 0 && (
              <div className="absolute flex flex-col items-center">
                <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest">มูลค่ารวม</span>
                <span className="text-sm font-black text-slate-700">{formatBaht(currentStockValue)}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-50">
            {categoryData.map((entry, index) => {
              const pct = currentStockValue > 0 ? ((entry.value / currentStockValue) * 100).toFixed(1) : '0.0';
              return (
                <div key={entry.name} className="flex justify-between items-center text-xxs">
                  <div className="flex items-center space-x-1.5 max-w-[70%]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-slate-600 font-semibold truncate" title={entry.name}>{entry.name}</span>
                  </div>
                  <span className="font-bold text-slate-500 font-mono">{pct}% ({entry.qty} ชิ้น)</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. Second Row Charts & Warning Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 3: Active Product Types (Bar Chart) (2/3 width) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-indigo-600" />
              <span>ความเคลื่อนไหวจำแนกตามประเภทสินค้าย่อยสูงสุด (Top 6 Types)</span>
            </h3>
            <p className="text-xxs text-slate-400 mt-0.5">ประเภทที่มีการนำเข้าและนำออกคลังรวมกันสูงสุด สะท้อนถึงการไหลเวียนของสินค้า</p>
          </div>

          <div className="h-64 w-full">
            {typeMovementData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={typeMovementData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                    itemStyle={{ fontSize: '11px', fontFamily: 'sans-serif' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={30} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'semibold', color: '#475569' }}
                  />
                  <Bar dataKey="stockIn" name="ปริมาณนำเข้าสะสม" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={25} />
                  <Bar dataKey="stockOut" name="ปริมาณนำออกจำหน่าย" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                ไม่มีข้อมูลประเภทสินค้าที่เคลื่อนไหว
              </div>
            )}
          </div>
        </div>

        {/* Warning Alerts panel (1/3 width) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 text-rose-500" />
              <span>การแจ้งเตือนระดับคลังวิกฤต</span>
            </h3>
            <p className="text-xxs text-slate-400 mt-0.5">สินค้าที่ต้องรีบจัดซื้อเติมสต็อก ด่วนที่สุด</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-2.5 custom-scrollbar">
            {outOfStockItems.map(item => (
              <div key={item.id} className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl flex justify-between items-center text-xs animate-pulse">
                <div>
                  <p className="font-bold text-rose-800">{item.brand} {item.model}</p>
                  <p className="text-xxs text-rose-500 font-medium">SKU: {item.sku} • {item.name}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-rose-500 text-white font-extrabold text-xxs tracking-wider uppercase">
                  หมดสต็อก
                </span>
              </div>
            ))}

            {lowStockItems.map(item => (
              <div key={item.id} className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-amber-800">{item.brand} {item.model}</p>
                  <p className="text-xxs text-amber-500 font-medium">SKU: {item.sku} • {item.name}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-amber-400 text-white font-extrabold text-xxs tracking-wider uppercase">
                  เหลือ {item.currentQty} ชิ้น
                </span>
              </div>
            ))}

            {outOfStockItems.length === 0 && lowStockItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
                <div className="p-3 bg-emerald-50 rounded-full text-emerald-500">
                  <Sparkles className="w-6 h-6 animate-bounce" />
                </div>
                <p className="text-xs font-bold text-slate-600">สต็อกสินค้าอยู่ในเกณฑ์ปลอดภัยทั้งหมด</p>
                <p className="text-xxs text-slate-400">ยังไม่มีรายการใดหมดหรือเหลือน้อยกว่าค่ากำหนด</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-50 text-xxs text-slate-400 flex items-center justify-between">
            <span className="flex items-center">
              <Clock className="w-3.5 h-3.5 text-slate-300 mr-1" />
              <span>เรียลไทม์ ซิงค์</span>
            </span>
            <span>คลังรวม WinStock</span>
          </div>
        </div>

      </div>

    </div>
  );
}
