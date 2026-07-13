import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { ProductType, ProductCategory, Distributor, StockInItem, StockOutItem } from '../types';
import { formatBaht, exportToExcel, printReport } from '../lib/reports';
import { 
  Plus, 
  Minus, 
  Search, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  TrendingUp, 
  Boxes, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  Tag, 
  Settings, 
  X,
  AlertCircle,
  Check,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from './BarcodeScanner';

export default function StockManagement() {
  const savedUser = localStorage.getItem('winstock_user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = true; // เปิดใช้งานสิทธิ์เต็มรูปแบบทุกฟังก์ชัน

  // Real-time Firestore States
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [stockInItems, setStockInItems] = useState<StockInItem[]>([]);
  const [stockOutItems, setStockOutItems] = useState<StockOutItem[]>([]);

  // Local UI / Form States
  const [activeTab, setActiveTab] = useState<'remaining' | 'in' | 'out' | 'history'>('remaining');
  const [loading, setLoading] = useState(true);

  // Configuration Modal States
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState('');
  const [newTypeCategoryId, setNewTypeCategoryId] = useState('');
  const [newDistributor, setNewDistributor] = useState('');

  // 1. Stock In Form State
  const [sku, setSku] = useState('');
  const [type, setType] = useState('');
  const [name, setName] = useState(''); // Category Name
  const [selectedCategory, setSelectedCategory] = useState(''); // Category ID
  const [details, setDetails] = useState(''); // Product Details
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [warranty, setWarranty] = useState('');
  const [distributor, setDistributor] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [serialsText, setSerialsText] = useState(''); // Textarea with line-separated or comma-separated serials

  // 3. Stock Out Form State
  const [customer, setCustomer] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [selectedInId, setSelectedInId] = useState(''); // Stock In ID selected to withdraw from
  const [outQuantity, setOutQuantity] = useState(1);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [customOutQty, setCustomOutQty] = useState(false); // Whether to specify qty manually without serials

  // Filters & Searches
  const [skuSearch, setSkuSearch] = useState('');
  const [historySearchPo, setHistorySearchPo] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // Barcode Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'search' | 'sku' | 'stockOut'>('search');

  const handleBarcodeScan = (scannedText: string) => {
    const cleanedText = scannedText.trim();
    if (!cleanedText) return;

    if (scannerTarget === 'search') {
      setSkuSearch(cleanedText);
    } else if (scannerTarget === 'sku') {
      setSku(cleanedText);
    } else if (scannerTarget === 'stockOut') {
      // 1. Try matching with SKU directly
      const matchedBySku = stockInItems.find(
        item => item.sku.toLowerCase() === cleanedText.toLowerCase() && item.currentQty > 0
      );

      if (matchedBySku) {
        setSelectedInId(matchedBySku.id);
        setSelectedSerials([]);
        setOutQuantity(1);
        return;
      }

      // 2. Try matching with serial number
      const matchedBySerial = stockInItems.find(
        item => item.serials && item.serials.some(sn => sn.toLowerCase() === cleanedText.toLowerCase()) && item.currentQty > 0
      );

      if (matchedBySerial) {
        setSelectedInId(matchedBySerial.id);
        const sn = matchedBySerial.serials.find(s => s.toLowerCase() === cleanedText.toLowerCase());
        if (sn) {
          setSelectedSerials([sn]);
          setOutQuantity(1);
        }
        return;
      }

      // If nothing matches
      alert(`ไม่พบรายการสินค้าที่ยังคงเหลือสำหรับ รหัส SKU หรือ หมายเลข S/N: "${cleanedText}"`);
    }
  };

  // Auto-Seeding & Database Sync
  useEffect(() => {
    setLoading(true);

    // Subscribe to Categories
    const qCategories = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(qCategories, async (snapshot) => {
      const categoriesList: ProductCategory[] = [];
      snapshot.forEach((doc) => {
        categoriesList.push({ id: doc.id, ...doc.data() } as ProductCategory);
      });
      setCategories(categoriesList);

      // Auto-seed Categories and subset Product Types if empty
      if (snapshot.empty) {
        try {
          const defaultCats = [
            { name: "อุปกรณ์เครือข่าย (Network)", types: ["Router", "Switch", "Access Point"] },
            { name: "ระบบรักษาความปลอดภัย (Security)", types: ["Camera IP"] },
            { name: "อุปกรณ์แปลงสัญญาณ / อุปกรณ์เสริม", types: ["Fiber Media Converter", "SFP Module"] }
          ];

          for (const cat of defaultCats) {
            const catRef = await addDoc(collection(db, 'categories'), { name: cat.name });
            for (const t of cat.types) {
              await addDoc(collection(db, 'productTypes'), { name: t, categoryId: catRef.id });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'categories');
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    // Subscribe to Product Types
    const qTypes = query(collection(db, 'productTypes'), orderBy('name', 'asc'));
    const unsubscribeTypes = onSnapshot(qTypes, (snapshot) => {
      const typesList: ProductType[] = [];
      snapshot.forEach((doc) => {
        typesList.push({ id: doc.id, ...doc.data() } as ProductType);
      });
      setProductTypes(typesList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'productTypes');
    });

    // Subscribe to Distributors
    const qDistributors = query(collection(db, 'distributors'), orderBy('name', 'asc'));
    const unsubscribeDistributors = onSnapshot(qDistributors, (snapshot) => {
      const distList: Distributor[] = [];
      snapshot.forEach((doc) => {
        distList.push({ id: doc.id, ...doc.data() } as Distributor);
      });
      setDistributors(distList);

      // Auto-seed if empty
      if (snapshot.empty) {
        const defaultDist = ["Synnex", "SiS Distribution", "VST ECS", "Eternal Asia", "Advice"];
        defaultDist.forEach(async (d) => {
          try {
            await addDoc(collection(db, 'distributors'), { name: d });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'distributors');
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'distributors');
    });

    // Subscribe to Stock In Items
    const qStockIn = query(collection(db, 'stockIn'), orderBy('createdAt', 'desc'));
    const unsubscribeStockIn = onSnapshot(qStockIn, (snapshot) => {
      const inList: StockInItem[] = [];
      snapshot.forEach((doc) => {
        inList.push({ id: doc.id, ...doc.data() } as StockInItem);
      });
      setStockInItems(inList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stockIn');
    });

    // Subscribe to Stock Out Items
    const qStockOut = query(collection(db, 'stockOut'), orderBy('createdAt', 'desc'));
    const unsubscribeStockOut = onSnapshot(qStockOut, (snapshot) => {
      const outList: StockOutItem[] = [];
      snapshot.forEach((doc) => {
        outList.push({ id: doc.id, ...doc.data() } as StockOutItem);
      });
      setStockOutItems(outList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stockOut');
    });

    return () => {
      unsubscribeCategories();
      unsubscribeTypes();
      unsubscribeDistributors();
      unsubscribeStockIn();
      unsubscribeStockOut();
    };
  }, []);

  // Form Handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), { name: newCategory.trim() });
      setNewCategory('');
    } catch (err) {
      console.error("Error adding category:", err);
      handleFirestoreError(err, OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      console.error("Error deleting category:", err);
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.trim()) return;
    if (!newTypeCategoryId) {
      alert('กรุณาเลือกหมวดหมู่สินค้าหลักสำหรับประเภทนี้');
      return;
    }
    try {
      await addDoc(collection(db, 'productTypes'), { 
        name: newType.trim(),
        categoryId: newTypeCategoryId
      });
      setNewType('');
    } catch (err) {
      console.error("Error adding product type:", err);
      handleFirestoreError(err, OperationType.CREATE, 'productTypes');
    }
  };

  const handleDeleteType = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'productTypes', id));
    } catch (err) {
      console.error("Error deleting product type:", err);
      handleFirestoreError(err, OperationType.DELETE, `productTypes/${id}`);
    }
  };

  const handleAddDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistributor.trim()) return;
    try {
      await addDoc(collection(db, 'distributors'), { name: newDistributor.trim() });
      setNewDistributor('');
    } catch (err) {
      console.error("Error adding distributor:", err);
      handleFirestoreError(err, OperationType.CREATE, 'distributors');
    }
  };

  const handleDeleteDistributor = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'distributors', id));
    } catch (err) {
      console.error("Error deleting distributor:", err);
      handleFirestoreError(err, OperationType.DELETE, `distributors/${id}`);
    }
  };

  // 1. Submit Stock In (นำเข้าสินค้า)
  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name || !brand || !model || !type || !distributor || !price || !quantity) {
      alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    // Process serial numbers
    const parsedSerials = serialsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const qty = parseInt(quantity);
    
    // Check if the number of serial numbers input is greater than the imported quantity
    if (parsedSerials.length > qty) {
      alert(`ไม่สามารถบันทึกได้: จำนวน ซีเรียลนัมเบอร์ (S/N) ที่กรอก (${parsedSerials.length} รายการ) เกินกว่าจำนวนนำเข้าที่ตั้งไว้ (${qty} ชิ้น)`);
      return;
    }

    let finalQty = qty;
    if (parsedSerials.length > 0 && parsedSerials.length < qty) {
      if (confirm(`คุณระบุจำนวนนำเข้าเป็น ${qty} ชิ้น แต่มีจำนวนซีเรียลนัมเบอร์เพียง ${parsedSerials.length} รายการ ต้องการปรับยอดนำเข้าให้ตรงกับจำนวนซีเรียลนัมเบอร์ (${parsedSerials.length} ชิ้น) หรือไม่?`)) {
        finalQty = parsedSerials.length;
      }
    }

    const newItem: Omit<StockInItem, 'id'> = {
      sku: sku.trim(),
      type,
      name: name.trim(),
      brand: brand.trim(),
      model: model.trim(),
      serials: parsedSerials,
      warranty: warranty.trim() || 'ไม่มีประกัน',
      distributor,
      price: parseFloat(price) || 0,
      initialQty: finalQty,
      currentQty: finalQty,
      createdAt: new Date().toISOString(),
      details: details.trim()
    };

    try {
      await addDoc(collection(db, 'stockIn'), newItem);
      
      // Reset Form
      setSku('');
      setName('');
      setSelectedCategory('');
      setDetails('');
      setType('');
      setBrand('');
      setModel('');
      setWarranty('');
      setPrice('');
      setQuantity('1');
      setSerialsText('');
      alert('บันทึกการนำเข้าสินค้าสำเร็จ');
      setActiveTab('remaining');
    } catch (err) {
      console.error("Error saving stock in:", err);
      alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      handleFirestoreError(err, OperationType.CREATE, 'stockIn');
    }
  };

  // 3. Submit Stock Out (เบิก/นำออกสินค้า)
  const handleStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !poNumber || !selectedInId) {
      alert('กรุณากรอกข้อมูล ลูกค้า, หมายเลข PO และเลือกสินค้าที่จะเบิก');
      return;
    }

    const targetStockIn = stockInItems.find(item => item.id === selectedInId);
    if (!targetStockIn) {
      alert('ไม่พบข้อมูลสินค้าหลักในระบบ');
      return;
    }

    const withdrawQty = customOutQty ? outQuantity : selectedSerials.length;
    if (withdrawQty <= 0) {
      alert('จำนวนนำออกต้องมากกว่า 0');
      return;
    }

    if (withdrawQty > targetStockIn.currentQty) {
      alert(`จำนวนสินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${targetStockIn.currentQty} เครื่อง)`);
      return;
    }

    // Prepare serial updates
    let updatedSerials = [...targetStockIn.serials];
    if (selectedSerials.length > 0) {
      // Remove selected serials from remaining list
      updatedSerials = updatedSerials.filter(s => !selectedSerials.includes(s));
    }

    const outRecord: Omit<StockOutItem, 'id'> = {
      customer: customer.trim(),
      poNumber: poNumber.trim(),
      sku: targetStockIn.sku,
      name: targetStockIn.name,
      brand: targetStockIn.brand,
      model: targetStockIn.model,
      quantity: withdrawQty,
      selectedSerials: selectedSerials,
      price: targetStockIn.price,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Log transaction in stockOut
      await addDoc(collection(db, 'stockOut'), outRecord);
    } catch (err) {
      console.error("Error creating stock out record:", err);
      alert('เกิดข้อผิดพลาดในการบันทึกเอกสารสินค้าออก');
      handleFirestoreError(err, OperationType.CREATE, 'stockOut');
      return;
    }

    try {
      // 2. Update remaining qty and remaining serials in stockIn
      const newRemainingQty = targetStockIn.currentQty - withdrawQty;
      await updateDoc(doc(db, 'stockIn', selectedInId), {
        currentQty: newRemainingQty,
        serials: updatedSerials
      });

      // Reset form
      setCustomer('');
      setPoNumber('');
      setSelectedInId('');
      setSelectedSerials([]);
      setOutQuantity(1);
      
      alert('บันทึกนำเข้าสินค้าสำเร็จ (หักสต็อคสินค้าเรียบร้อย)');
      setActiveTab('history');
    } catch (err) {
      console.error("Error updating stock in inventory:", err);
      alert('เกิดข้อผิดพลาดในการตัดยอดสต็อคสินค้าหลัก');
      handleFirestoreError(err, OperationType.UPDATE, `stockIn/${selectedInId}`);
    }
  };

  // Sync outQuantity when selected serials change
  useEffect(() => {
    if (!customOutQty && selectedSerials.length > 0) {
      setOutQuantity(selectedSerials.length);
    }
  }, [selectedSerials, customOutQty]);

  // Filters for Remaining Stock
  const filteredRemaining = stockInItems.filter(item => {
    const searchLower = skuSearch.toLowerCase().trim();
    if (!searchLower) return item.currentQty > 0;

    const matchesSku = item.sku.toLowerCase().includes(searchLower);
    const matchesName = item.name.toLowerCase().includes(searchLower);
    const matchesBrand = item.brand.toLowerCase().includes(searchLower);
    const matchesModel = item.model.toLowerCase().includes(searchLower);
    const matchesType = item.type.toLowerCase().includes(searchLower);
    const matchesDetails = item.details ? item.details.toLowerCase().includes(searchLower) : false;
    const matchesSerial = item.serials && item.serials.some(sn => sn.toLowerCase().includes(searchLower));

    return (matchesSku || matchesName || matchesBrand || matchesModel || matchesType || matchesDetails || matchesSerial) && item.currentQty > 0;
  });

  // Filters for Dispatched History (ประวัติสินค้าออก)
  const filteredHistory = stockOutItems.filter(item => {
    const matchesPo = item.poNumber.toLowerCase().includes(historySearchPo.toLowerCase()) ||
                      item.customer.toLowerCase().includes(historySearchPo.toLowerCase()) ||
                      item.sku.toLowerCase().includes(historySearchPo.toLowerCase());
    
    let matchesDate = true;
    if (historyStartDate) {
      matchesDate = matchesDate && new Date(item.createdAt) >= new Date(historyStartDate + 'T00:00:00');
    }
    if (historyEndDate) {
      matchesDate = matchesDate && new Date(item.createdAt) <= new Date(historyEndDate + 'T23:59:59');
    }
    
    return matchesPo && matchesDate;
  });

  // Calculate total dispatch value
  const totalDispatchValue = filteredHistory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalDispatchQty = filteredHistory.reduce((sum, item) => sum + item.quantity, 0);

  // Export handlers
  const handleExportExcelRemaining = () => {
    const headers = ['รหัสสินค้า/SKU', 'ประเภทสินค้า', 'ชื่อสินค้า', 'ยี่ห้อ', 'รุ่น', 'จำนวนคงเหลือ', 'ราคาจัดซื้อ (บาท)', 'ระยะประกัน', 'ตัวแทนจำหน่าย', 'ซีเรียลนัมเบอร์คงเหลือ'];
    const data = filteredRemaining.map(item => ({
      sku: item.sku,
      type: item.type,
      name: item.name,
      brand: item.brand,
      model: item.model,
      qty: item.currentQty,
      price: item.price,
      warranty: item.warranty,
      distributor: item.distributor,
      serials: item.serials.join(', ')
    }));
    exportToExcel(data, headers, `สินค้าคงเหลือ_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDFRemaining = () => {
    const headers = ['รหัสสินค้า', 'ชื่อสินค้า', 'ยี่ห้อ/รุ่น', 'จำนวนคงเหลือ', 'ราคาจัดซื้อ', 'ระยะประกัน', 'ตัวแทนจำหน่าย'];
    const rows = filteredRemaining.map(item => [
      item.sku,
      item.name,
      `${item.brand} / ${item.model}`,
      `${item.currentQty} ชิ้น`,
      formatBaht(item.price),
      item.warranty,
      item.distributor
    ]);
    const totalQty = filteredRemaining.reduce((sum, item) => sum + item.currentQty, 0);
    const totalVal = filteredRemaining.reduce((sum, item) => sum + (item.price * item.currentQty), 0);
    
    printReport(
      'รายงานสินค้าคงเหลือ (Remaining Stock)', 
      headers, 
      rows, 
      `ยอดรวมสินค้าคงเหลือทั้งหมด: ${totalQty} ชิ้น | มูลค่ารวมจัดซื้อสินค้าคงเหลือ: ${formatBaht(totalVal)}`
    );
  };

  const handleExportExcelHistory = () => {
    const headers = ['วันที่เบิก', 'หมายเลข PO', 'บริษัทลูกค้า', 'รหัสสินค้า/SKU', 'ชื่อสินค้า', 'ยี่ห้อ/รุ่น', 'จำนวน', 'มูลค่า (บาท)', 'ซีเรียลนัมเบอร์ที่นำออก'];
    const data = filteredHistory.map(item => ({
      date: new Date(item.createdAt).toLocaleDateString('th-TH'),
      po: item.poNumber,
      customer: item.customer,
      sku: item.sku,
      name: item.name,
      model: `${item.brand} ${item.model}`,
      qty: item.quantity,
      value: item.price * item.quantity,
      serials: item.selectedSerials.join(', ')
    }));
    exportToExcel(data, headers, `ประวัติการนำออกสินค้า_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDFHistory = () => {
    const headers = ['วันที่เบิก', 'หมายเลข PO', 'ลูกค้า', 'รหัสสินค้า', 'ชื่อสินค้า/รุ่น', 'จำนวน', 'มูลค่ารวม'];
    const rows = filteredHistory.map(item => [
      new Date(item.createdAt).toLocaleDateString('th-TH'),
      item.poNumber,
      item.customer,
      item.sku,
      `${item.name} (${item.brand} ${item.model})`,
      `${item.quantity} ชิ้น`,
      formatBaht(item.price * item.quantity)
    ]);
    
    printReport(
      'รายงานประวัติการนำออกสินค้า (Dispatched Products History)', 
      headers, 
      rows, 
      `ยอดรวมนำออกในช่วงเวลา: ${totalDispatchQty} ชิ้น | มูลค่ารวมนำออก: ${formatBaht(totalDispatchValue)}`
    );
  };

  return (
    <div className="space-y-6" id="stock-management-section">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4"
        >
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">สินค้าคงคลังปัจจุบัน</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {stockInItems.reduce((sum, item) => sum + item.currentQty, 0)} <span className="text-sm font-normal text-slate-500">ชิ้น</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">มูลค่าจัดซื้อรวม: {formatBaht(stockInItems.reduce((sum, item) => sum + (item.price * item.currentQty), 0))}</p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4"
        >
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">รายการนำเข้าสะสม</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {stockInItems.reduce((sum, item) => sum + item.initialQty, 0)} <span className="text-sm font-normal text-slate-500">ชิ้น</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">ทั้งหมด {stockInItems.length} ล็อตนำเข้า</p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4"
        >
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">รายการจ่ายสินค้าออกสะสม</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {stockOutItems.reduce((sum, item) => sum + item.quantity, 0)} <span className="text-sm font-normal text-slate-500">ชิ้น</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">ทั้งหมด {stockOutItems.length} รายการจ่ายออก</p>
          </div>
        </motion.div>
      </div>

      {/* Sub tabs and config button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('remaining')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'remaining'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            📦 สินค้าคงเหลือ
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('in')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'in'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                ➕ นำสินค้าเข้าคลัง
              </button>
              <button
                onClick={() => setActiveTab('out')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'out'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                📤 บันทึกนำสินค้าออก
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            📋 ประวัติจ่ายสินค้าออก
          </button>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center space-x-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-50 px-3.5 py-2 rounded-lg border border-indigo-100 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>ตั้งค่าประเภท / ผู้แทนจำหน่าย</span>
          </button>
        )}
      </div>

      {/* Main Tab Contents */}
      <AnimatePresence mode="wait">
        {/* T1: Remaining Stock (สินค้าคงเหลือ) */}
        {activeTab === 'remaining' && (
          <motion.div
            key="remaining"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">ตารางสินค้าคงเหลือ</h2>
                <p className="text-xs text-slate-500 mt-1">แสดงรายการสินค้าที่มีพร้อมจำหน่ายและใช้งานในระบบ</p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder="ค้นหาทันที รหัส/ชื่อสินค้า/ยี่ห้อ/รุ่น/ซีเรียล (S/N)..."
                    className="pl-9 pr-10 py-2 w-full sm:w-72 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTarget('search');
                      setIsScannerOpen(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-slate-50/80 transition-all duration-200"
                    title="สแกนบาร์โค้ดผ่านกล้อง"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleExportExcelRemaining}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Export as Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                  <button
                    onClick={handlePrintPDFRemaining}
                    className="flex items-center justify-center space-x-1.5 px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Print / Save PDF"
                  >
                    <Printer className="w-4 h-4 text-sky-600" />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredRemaining.length === 0 ? (
                <div className="py-16 text-center">
                  <Boxes className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                  <p className="text-sm text-slate-500 mt-3">ไม่พบรายการสินค้าคงเหลือในระบบ</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">รหัสสินค้า / SKU</th>
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">หมวดหมู่สินค้า / ประเภท</th>
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">ยี่ห้อ / รุ่น</th>
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">ราคาจัดซื้อ</th>
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider">ระยะประกัน / ผู้จำหน่าย</th>
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">จำนวนคงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRemaining.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-xs font-bold text-indigo-600">{item.sku}</td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-800 text-sm">{item.name}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-medium bg-indigo-50 text-indigo-700">
                              {item.type}
                            </span>
                            {item.details && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-medium bg-slate-100 text-slate-600" title={item.details}>
                                {item.details}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm">
                          <div className="text-slate-800 font-medium">{item.brand}</div>
                          <div className="text-xs text-slate-500">{item.model}</div>
                        </td>
                        <td className="py-4 px-6 text-sm font-semibold text-slate-700">
                          {formatBaht(item.price)}
                        </td>
                        <td className="py-4 px-6 text-xs">
                          <div className="text-slate-700">🛡️ {item.warranty}</div>
                          <div className="text-slate-500 mt-0.5">🏢 {item.distributor}</div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="text-base font-bold text-slate-800">
                            {item.currentQty} <span className="text-xs font-normal text-slate-500">ชิ้น</span>
                          </div>
                          {item.serials.length > 0 && (
                            <div className="text-xxs text-emerald-600 mt-1 font-mono max-w-xs ml-auto line-clamp-1" title={item.serials.join(', ')}>
                              S/N: {item.serials.join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}

        {/* T2: Stock In (นำเข้าสินค้า) */}
        {activeTab === 'in' && (
          <motion.div
            key="in"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form Side */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">ฟอร์มนำเข้าสินค้า</h2>
                <p className="text-xs text-slate-500 mt-1">ระบุรายละเอียดการรับสินค้าเข้าคลัง WinStock</p>
              </div>

              <form onSubmit={handleStockInSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600">รหัสสินค้า / SKU *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget('sku');
                        setIsScannerOpen(true);
                      }}
                      className="text-xxs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>สแกนบาร์โค้ด</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="เช่น NET-RT-001"
                      className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget('sku');
                        setIsScannerOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded-lg transition-colors"
                      title="สแกนรหัสสินค้า"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">หมวดหมู่สินค้า *</label>
                  <select
                    required
                    value={selectedCategory}
                    onChange={(e) => {
                      const catId = e.target.value;
                      setSelectedCategory(catId);
                      const foundCat = categories.find(c => c.id === catId);
                      setName(foundCat ? foundCat.name : '');
                      setType(''); // clear subset product type
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- เลือกหมวดหมู่สินค้า --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ประเภทสินค้า *</label>
                  <select
                    required
                    disabled={!selectedCategory}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {selectedCategory ? "-- เลือกประเภทสินค้า --" : "กรุณาเลือกหมวดหมู่สินค้าก่อน"}
                    </option>
                    {productTypes
                      .filter((t) => t.categoryId === selectedCategory)
                      .map((t) => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รายละเอียดสินค้า (เพิ่มเติม)</label>
                  <input
                    type="text"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="เช่น ระยะประกันเพิ่มพิเศษ, อุปกรณ์ครบกล่อง"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                      placeholder="เช่น MikroTik"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">รุ่น *</label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="เช่น hAP ac2"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ระยะประกัน *</label>
                    <input
                      type="text"
                      required
                      value={warranty}
                      onChange={(e) => setWarranty(e.target.value)}
                      placeholder="เช่น 1 ปี / 3 ปี"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ตัวแทนจำหน่าย *</label>
                    <select
                      required
                      value={distributor}
                      onChange={(e) => setDistributor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="">-- เลือกผู้จำหน่าย --</option>
                      {distributors.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ราคาที่จัดซื้อ (ต่อหน่วย) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="เช่น 1500"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">จำนวนนำเข้า *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="จำนวน"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600">ซีเรียลนัมเบอร์ (S/N)</label>
                    <span className="text-xxs text-indigo-600">เว้นบรรทัดละ 1 ซีเรียล</span>
                  </div>
                  <textarea
                    rows={4}
                    value={serialsText}
                    onChange={(e) => setSerialsText(e.target.value)}
                    placeholder="เช่น&#10;SN-84384938&#10;SN-84384939&#10;SN-84384940"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-xxs text-slate-400 mt-1">ระบบจะตรวจสอบจำนวน S/N ให้สอดคล้องกับฟิลด์จำนวนข้างต้น</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>บันทึกนำเข้าสินค้า</span>
                </button>
              </form>
            </div>

            {/* Recent receipts table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800">ประวัติการนำเข้าล็อตล่าสุด</h2>
                  <p className="text-xs text-slate-500 mt-1 font-sans">แสดงรายการที่คุณเพิ่งบันทึกนำเข้ามาในระบบ WinStock</p>
                </div>

                <div className="overflow-x-auto">
                  {stockInItems.length === 0 ? (
                    <div className="py-24 text-center">
                      <Boxes className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                      <p className="text-sm text-slate-500 mt-3">ยังไม่มีประวัตินำเข้าสินค้า</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100">
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase">วันที่ / เวลา</th>
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase">รหัส SKU</th>
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase">ชื่อสินค้า</th>
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase">ราคาทั้งหมด</th>
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase text-right">จำนวนนำเข้า</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockInItems.slice(0, 10).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 px-6 text-xs text-slate-500 font-mono">
                              {new Date(item.createdAt).toLocaleDateString('th-TH')} {new Date(item.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs font-bold text-slate-700">{item.sku}</td>
                            <td className="py-3.5 px-6 text-sm">
                              <span className="font-medium text-slate-800">{item.name}</span>
                              <div className="text-xxs text-slate-400 mt-0.5">{item.brand} / {item.model}</div>
                            </td>
                            <td className="py-3.5 px-6 text-sm font-semibold text-slate-700">
                              {formatBaht(item.price * item.initialQty)}
                            </td>
                            <td className="py-3.5 px-6 text-right text-sm font-bold text-slate-800">
                              {item.initialQty} ชิ้น
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                <span className="text-xs text-slate-500 font-sans">แสดงสูงสุด 10 ล็อตล่าสุดของบัญชีสินค้าเข้า</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* T3: Stock Out (เบิกจ่ายสินค้า) */}
        {activeTab === 'out' && (
          <motion.div
            key="out"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Form Side */}
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">ฟอร์มจ่ายสินค้าออก (Stock Out)</h2>
                <p className="text-xs text-slate-500 mt-1">เบิกสินค้าจาก Stock นำเข้า เพื่อจำหน่ายหรือใช้งาน</p>
              </div>

              <form onSubmit={handleStockOutSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อบริษัทลูกค้า *</label>
                  <input
                    type="text"
                    required
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="เช่น บริษัท เน็ตเวิร์ค แอดวานซ์ จำกัด"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเลขเอกสาร PO *</label>
                  <input
                    type="text"
                    required
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="เช่น PO-2026-0089"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-slate-600">เลือกสินค้าที่จะจ่ายออก *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget('stockOut');
                        setIsScannerOpen(true);
                      }}
                      className="text-xxs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                      title="สแกน SKU หรือ S/N"
                    >
                      <Camera className="w-3 h-3" />
                      <span>สแกน SKU หรือ S/N</span>
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      required
                      value={selectedInId}
                      onChange={(e) => {
                        setSelectedInId(e.target.value);
                        setSelectedSerials([]);
                        setOutQuantity(1);
                      }}
                      className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none bg-white"
                    >
                      <option value="">-- ค้นหาและเลือกสินค้าคงเหลือ --</option>
                      {stockInItems.filter(item => item.currentQty > 0).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} | {item.name} ({item.brand} {item.model}) - คงเหลือ {item.currentQty}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setScannerTarget('stockOut');
                        setIsScannerOpen(true);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 rounded-lg transition-colors"
                      title="สแกนรหัสสินค้า หรือ ซีเรียล"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* S/N Selection (Multi Select) */}
                {selectedInId && (
                  <div className="space-y-3">
                    {(() => {
                      const selectedProduct = stockInItems.find(x => x.id === selectedInId);
                      if (!selectedProduct) return null;

                      const hasSerials = selectedProduct.serials && selectedProduct.serials.length > 0;

                      return (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-indigo-900">สินค้า: {selectedProduct.name}</span>
                            <span className="text-xs text-slate-500">สต็อคพร้อมจ่าย: <strong className="text-indigo-600">{selectedProduct.currentQty}</strong></span>
                          </div>

                          {hasSerials ? (
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-semibold text-slate-700">ซีเรียลนัมเบอร์พร้อมจ่าย ({selectedProduct.serials.length} รายการ)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedSerials.length === selectedProduct.serials.length) {
                                      setSelectedSerials([]);
                                    } else {
                                      setSelectedSerials([...selectedProduct.serials]);
                                    }
                                  }}
                                  className="text-xxs font-semibold text-indigo-600 hover:underline"
                                >
                                  {selectedSerials.length === selectedProduct.serials.length ? 'ล้างทั้งหมด' : 'เลือกทั้งหมด'}
                                </button>
                              </div>
                              <div className="max-h-40 overflow-y-auto border border-indigo-100/80 bg-white rounded-lg p-2 grid grid-cols-2 gap-1.5 scrollbar-thin">
                                {selectedProduct.serials.map(sn => {
                                  const isSelected = selectedSerials.includes(sn);
                                  return (
                                    <button
                                      type="button"
                                      key={sn}
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedSerials(selectedSerials.filter(x => x !== sn));
                                        } else {
                                          setSelectedSerials([...selectedSerials, sn]);
                                        }
                                      }}
                                      className={`px-2 py-1.5 text-left text-xs font-mono rounded border flex items-center justify-between transition-colors ${
                                        isSelected 
                                          ? 'bg-indigo-600 text-white border-indigo-600' 
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      <span className="truncate mr-1">{sn}</span>
                                      {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="text-xxs text-slate-500 mt-2 flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3 text-indigo-600" />
                                <span>เลือกซีเรียล ได้หลายรายการในครั้งเดียว จำนวนนำออกจะสอดคล้องกับซีเรียลที่เลือก</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>สินค้านี้ไม่มีซีเรียลนัมเบอร์บันทึกไว้ในคลัง</span>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">ระบุจำนวนที่ต้องการจ่ายออก</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={selectedProduct.currentQty}
                                  value={outQuantity}
                                  onChange={(e) => setOutQuantity(parseInt(e.target.value) || 1)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                              </div>
                            </div>
                          )}

                          {hasSerials && (
                            <div className="pt-2 border-t border-indigo-100/80 flex justify-between text-xs font-bold text-indigo-900">
                              <span>สรุปจำนวนนำออก:</span>
                              <span>{selectedSerials.length} ชิ้น</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedInId || (stockInItems.find(x => x.id === selectedInId)?.serials?.length ? selectedSerials.length === 0 : outQuantity <= 0)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-xl text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>ยืนยันจ่ายสินค้าออก (ตัดสต็อค)</span>
                </button>
              </form>
            </div>

            {/* List of current available products helper */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">รายการคลังสินค้าคงเหลือพร้อมเบิกจ่าย</h2>
                <p className="text-xs text-slate-500">เลือกเบิกจ่ายสินค้าผ่านการอ้างอิง SKU และตัดสต็อกคงคลังแบบ Real-time</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-xs font-semibold text-slate-600 uppercase">รหัส SKU</th>
                      <th className="py-2.5 px-4 text-xs font-semibold text-slate-600 uppercase">ชื่อสินค้า</th>
                      <th className="py-2.5 px-4 text-xs font-semibold text-slate-600 uppercase">ผู้จัดจำหน่าย</th>
                      <th className="py-2.5 px-4 text-xs font-semibold text-slate-600 uppercase text-right">คงเหลือพร้อมใช้</th>
                      <th className="py-2.5 px-4 text-xs font-semibold text-slate-600 uppercase text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockInItems.filter(x => x.currentQty > 0).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 text-sm">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-600 font-bold">{item.sku}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          <span className="block text-xxs text-slate-400">{item.brand} {item.model}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{item.distributor}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">{item.currentQty} ชิ้น</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedInId(item.id);
                              setSelectedSerials([]);
                              setOutQuantity(1);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:underline px-2.5 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                          >
                            เลือกตัวนี้
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* T4: Dispatched Products History (ประวัติการนำสินค้าออก) */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filtering & Reporting Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">ค้นหาประวัติย้อนหลังและรายงานจ่ายสินค้าออก</h2>
                <p className="text-xs text-slate-500 mt-1">กำหนดช่วงเวลา รหัส และเอกสาร PO เพื่อวิเคราะห์ยอดเบิกจ่ายสะสม</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่เริ่มต้น</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่สิ้นสุด</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ค้นหาจาก PO / ลูกค้า / SKU</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={historySearchPo}
                      onChange={(e) => setHistorySearchPo(e.target.value)}
                      placeholder="ป้อนหมายเลข PO/ชื่อย่อลูกค้า..."
                      className="pl-9 pr-3 py-2 w-full border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Export actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleExportExcelHistory}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 rounded-xl text-sm font-semibold text-emerald-700 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={handlePrintPDFHistory}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 border border-sky-200 bg-sky-50/50 hover:bg-sky-50 rounded-xl text-sm font-semibold text-sky-700 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    <span>PDF / พิมพ์</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Summaries details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-xs font-medium text-slate-500">รวมจำนวนสินค้าจ่ายออกในช่วงนี้</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">{totalDispatchQty} <span className="text-sm font-normal text-slate-500">ชิ้น</span></div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl text-indigo-600 border border-slate-200/50">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <span className="text-xs font-medium text-slate-500">มูลค่าสะสม (คำนวณตามราคาจัดซื้อ)</span>
                  <div className="text-2xl font-black text-slate-800 mt-1">{formatBaht(totalDispatchValue)}</div>
                </div>
                <div className="p-3 bg-white/80 rounded-xl text-indigo-600 border border-slate-200/50">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Main History Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800">รายการประวัติสินค้าออกคลัง (WinStock Out)</h3>
                <p className="text-xs text-slate-500 mt-0.5">รวมตารางสินค้าออกคลังพร้อมข้อมูลรหัสอ้างอิง PO และเลข S/N</p>
              </div>

              <div className="overflow-x-auto">
                {filteredHistory.length === 0 ? (
                  <div className="py-20 text-center">
                    <Boxes className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                    <p className="text-sm text-slate-500 mt-2">ไม่พบประวัติการจ่ายออกสำหรับตัวเลือกนี้</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">วันที่นำออก</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">หมายเลขเอกสาร PO</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">บริษัทลูกค้า</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">รหัส SKU</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">รายละเอียดสินค้า</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase">มูลค่ารวม</th>
                        <th className="py-3 px-6 text-xs font-semibold text-slate-600 uppercase text-right">จำนวนจ่ายออก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 text-sm">
                          <td className="py-4 px-6 text-xs font-mono text-slate-500">
                            {new Date(item.createdAt).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">{item.poNumber}</td>
                          <td className="py-4 px-6 font-semibold text-slate-800">{item.customer}</td>
                          <td className="py-4 px-6 font-mono text-xs text-indigo-600">{item.sku}</td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="text-xxs text-slate-500 mt-0.5">{item.brand} {item.model}</div>
                            {item.selectedSerials && item.selectedSerials.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.selectedSerials.map(sn => (
                                  <span key={sn} className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-mono text-xxs">
                                    {sn}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-700">
                            {formatBaht(item.price * item.quantity)}
                          </td>
                          <td className="py-4 px-6 text-right font-black text-slate-800 text-base">
                            {item.quantity} <span className="text-xs font-normal text-slate-500">ชิ้น</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Config Settings Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-slate-800">จัดการประเภทสินค้าและตัวแทนจำหน่าย</h3>
                  <p className="text-xs text-slate-500 mt-1">เพิ่มหรือลบตัวเลือกประเภทสินค้าและ Distributor แบบไดนามิก</p>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin">
                {/* 1. Category Setup */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span>จัดการหมวดหมู่สินค้า (Product Categories)</span>
                  </h4>

                  <form onSubmit={handleAddCategory} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="เช่น อุปกรณ์เครือข่าย, ระบบรักษาความปลอดภัย"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors"
                    >
                      เพิ่มหมวดหมู่
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {categories.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center space-x-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700"
                      >
                        <span>{c.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                    {categories.length === 0 && (
                      <span className="text-xs text-slate-400 font-sans py-1">ไม่มีข้อมูลหมวดหมู่สินค้า</span>
                    )}
                  </div>
                </div>

                {/* 2. Product Type Setup (Subset of Categories) */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                    <span>จัดการประเภทสินค้าย่อย (Product Types Subset)</span>
                  </h4>

                  <form onSubmit={handleAddType} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      required
                      value={newTypeCategoryId}
                      onChange={(e) => setNewTypeCategoryId(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="">-- เลือกหมวดหมู่หลัก --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      placeholder="เช่น Router, Camera IP"
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors h-full"
                    >
                      เพิ่มประเภทสินค้า
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {productTypes.map((t) => {
                      const parentCat = categories.find(c => c.id === t.categoryId);
                      return (
                        <span
                          key={t.id}
                          className="inline-flex items-center space-x-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700"
                        >
                          <span>{t.name}</span>
                          {parentCat && (
                            <span className="text-xxs text-slate-400 bg-slate-100 px-1 py-0.5 rounded-xs font-sans">
                              {parentCat.name}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteType(t.id)}
                            className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      );
                    })}
                    {productTypes.length === 0 && (
                      <span className="text-xs text-slate-400 font-sans py-1">ไม่มีข้อมูลประเภทสินค้า</span>
                    )}
                  </div>
                </div>

                {/* 2. Distributor Setup */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1.5">
                    <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                    <span>จัดการผู้แทนจำหน่าย (Distributors)</span>
                  </h4>

                  <form onSubmit={handleAddDistributor} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newDistributor}
                      onChange={(e) => setNewDistributor(e.target.value)}
                      placeholder="เช่น Ingram Micro, Cisco Systems"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors"
                    >
                      เพิ่มตัวแทน
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    {distributors.map((d) => (
                      <span
                        key={d.id}
                        className="inline-flex items-center space-x-1 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700"
                      >
                        <span>{d.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDistributor(d.id)}
                          className="p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                    {distributors.length === 0 && (
                      <span className="text-xs text-slate-400 font-sans py-1">ไม่มีผู้จำหน่ายบันทึกไว้</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 text-right border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors"
                >
                  เสร็จสิ้น / ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner Overlay */}
      {isScannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setIsScannerOpen(false)}
          title={
            scannerTarget === 'search' 
              ? "สแกนค้นหาสินค้าในสต็อก" 
              : scannerTarget === 'sku' 
              ? "สแกนรหัส SKU สินค้าเข้า" 
              : "สแกนรหัส SKU หรือ ซีเรียล (S/N) สำหรับเบิกจ่าย"
          }
        />
      )}
    </div>
  );
}
