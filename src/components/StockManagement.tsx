import React, { useState, useEffect, useMemo } from 'react';
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
  Camera,
  Edit,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BarcodeScanner from './BarcodeScanner';

export default function StockManagement() {
  const savedUser = localStorage.getItem('winstock_user');
  const loggedInUser = savedUser ? JSON.parse(savedUser) : null;
  const isAdmin = true; // เปิดใช้งานสิทธิ์เต็มรูปแบบทุกฟังก์ชัน

  // Real-time Firestore States (with local storage fallbacks for bulletproof persistence)
  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    try {
      const saved = localStorage.getItem('winstock_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [productTypes, setProductTypes] = useState<ProductType[]>(() => {
    try {
      const saved = localStorage.getItem('winstock_product_types');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [distributors, setDistributors] = useState<Distributor[]>(() => {
    try {
      const saved = localStorage.getItem('winstock_distributors');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [stockInItems, setStockInItems] = useState<StockInItem[]>([]);
  const [stockOutItems, setStockOutItems] = useState<StockOutItem[]>([]);

  // Local UI / Form States
  const [activeTab, setActiveTab] = useState<'remaining' | 'in' | 'out' | 'history' | 'categories' | 'distributors'>('remaining');
  const [loading, setLoading] = useState(true);
  const [subTypeFilterCategory, setSubTypeFilterCategory] = useState<string>('');

  // Configuration States (Product Categories & Distributors)
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState('');
  const [newTypeCategoryId, setNewTypeCategoryId] = useState('');
  const [newDistributor, setNewDistributor] = useState('');
  const [newDistSalesName, setNewDistSalesName] = useState('');
  const [newDistPhone, setNewDistPhone] = useState('');
  const [newDistPaymentTerms, setNewDistPaymentTerms] = useState('');

  // Inline editing states for categories & productTypes & distributors
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [editingTypeCategoryId, setEditingTypeCategoryId] = useState('');

  const [editingDistributorId, setEditingDistributorId] = useState<string | null>(null);
  const [editingDistName, setEditingDistName] = useState('');
  const [editingDistSales, setEditingDistSales] = useState('');
  const [editingDistPhone, setEditingDistPhone] = useState('');
  const [editingDistPayment, setEditingDistPayment] = useState('');

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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [stockInDate, setStockInDate] = useState(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  });

  // 3. Stock Out Form State
  const [customer, setCustomer] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [projectName, setProjectName] = useState('');
  const [stockOutDate, setStockOutDate] = useState(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  });
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
      
      setCategories(prev => {
        const localOnly = prev.filter(item => item.id.startsWith('local_') && !categoriesList.some(c => c.name === item.name));
        const merged = [...categoriesList, ...localOnly].sort((a, b) => a.name.localeCompare(b.name, 'th'));
        localStorage.setItem('winstock_categories', JSON.stringify(merged));
        return merged;
      });

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
      
      setProductTypes(prev => {
        const localOnly = prev.filter(item => item.id.startsWith('local_') && !typesList.some(t => t.name === item.name && t.categoryId === item.categoryId));
        const merged = [...typesList, ...localOnly].sort((a, b) => a.name.localeCompare(b.name, 'th'));
        localStorage.setItem('winstock_product_types', JSON.stringify(merged));
        return merged;
      });
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
      
      setDistributors(prev => {
        const localOnly = prev.filter(item => item.id.startsWith('local_') && !distList.some(d => d.name === item.name));
        const merged = [...distList, ...localOnly].sort((a, b) => a.name.localeCompare(b.name, 'th'));
        localStorage.setItem('winstock_distributors', JSON.stringify(merged));
        return merged;
      });

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
    const name = newCategory.trim();
    if (!name) return;

    // Generate a temporary ID for instant local display
    const tempId = 'local_' + Date.now();
    const newCatItem = { id: tempId, name };
    
    // Update local state and localStorage immediately
    const updated = [...categories, newCatItem].sort((a, b) => a.name.localeCompare(b.name, 'th'));
    setCategories(updated);
    localStorage.setItem('winstock_categories', JSON.stringify(updated));
    setNewCategory('');

    try {
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'categories'), { name });
      // Replace local ID with the actual Firestore ID
      setCategories(prev => prev.map(item => item.id === tempId ? { id: docRef.id, name } : item));
    } catch (err) {
      console.error("Error adding category to Firestore, keeping locally:", err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // Update local state and localStorage immediately
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    localStorage.setItem('winstock_categories', JSON.stringify(updated));

    // Also cascade delete dependent product types locally
    const updatedTypes = productTypes.filter(t => t.categoryId !== id);
    setProductTypes(updatedTypes);
    localStorage.setItem('winstock_product_types', JSON.stringify(updatedTypes));

    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(db, 'categories', id));
      }
    } catch (err) {
      console.error("Error deleting category from Firestore:", err);
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newType.trim();
    if (!name) return;
    if (!newTypeCategoryId) {
      alert('กรุณาเลือกหมวดหมู่สินค้าหลักสำหรับประเภทนี้');
      return;
    }

    const tempId = 'local_' + Date.now();
    const newTypeItem = { id: tempId, name, categoryId: newTypeCategoryId };

    // Update local state and localStorage immediately
    const updated = [...productTypes, newTypeItem].sort((a, b) => a.name.localeCompare(b.name, 'th'));
    setProductTypes(updated);
    localStorage.setItem('winstock_product_types', JSON.stringify(updated));
    setNewType('');

    try {
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'productTypes'), { 
        name,
        categoryId: newTypeCategoryId
      });
      // Replace local ID with actual Firestore ID
      setProductTypes(prev => prev.map(item => item.id === tempId ? { id: docRef.id, name, categoryId: newTypeCategoryId } : item));
    } catch (err) {
      console.error("Error adding product type to Firestore, keeping locally:", err);
    }
  };

  const handleDeleteType = async (id: string) => {
    // Update local state and localStorage immediately
    const updated = productTypes.filter(t => t.id !== id);
    setProductTypes(updated);
    localStorage.setItem('winstock_product_types', JSON.stringify(updated));

    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(db, 'productTypes', id));
      }
    } catch (err) {
      console.error("Error deleting product type from Firestore:", err);
      handleFirestoreError(err, OperationType.DELETE, `productTypes/${id}`);
    }
  };

  const handleAddDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDistributor.trim();
    if (!name) return;

    const salesName = newDistSalesName.trim();
    const phone = newDistPhone.trim();
    const paymentTerms = newDistPaymentTerms.trim();

    const tempId = 'local_' + Date.now();
    const newDistItem = { id: tempId, name, salesName, phone, paymentTerms };

    // Update local state and localStorage immediately
    const updated = [...distributors, newDistItem].sort((a, b) => a.name.localeCompare(b.name, 'th'));
    setDistributors(updated);
    localStorage.setItem('winstock_distributors', JSON.stringify(updated));
    setNewDistributor('');
    setNewDistSalesName('');
    setNewDistPhone('');
    setNewDistPaymentTerms('');

    try {
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'distributors'), {
        name,
        salesName,
        phone,
        paymentTerms
      });
      // Replace local ID with actual Firestore ID
      setDistributors(prev => prev.map(item => item.id === tempId ? { id: docRef.id, name, salesName, phone, paymentTerms } : item));
    } catch (err) {
      console.error("Error adding distributor to Firestore, keeping locally:", err);
    }
  };

  const handleDeleteDistributor = async (id: string) => {
    // Update local state and localStorage immediately
    const updated = distributors.filter(d => d.id !== id);
    setDistributors(updated);
    localStorage.setItem('winstock_distributors', JSON.stringify(updated));

    try {
      if (!id.startsWith('local_')) {
        await deleteDoc(doc(db, 'distributors', id));
      }
    } catch (err) {
      console.error("Error deleting distributor from Firestore:", err);
      handleFirestoreError(err, OperationType.DELETE, `distributors/${id}`);
    }
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    const updated = categories.map(c => c.id === id ? { ...c, name: cleanName } : c);
    setCategories(updated);
    localStorage.setItem('winstock_categories', JSON.stringify(updated));
    setEditingCategoryId(null);

    try {
      if (!id.startsWith('local_')) {
        await updateDoc(doc(db, 'categories', id), { name: cleanName });
      }
    } catch (err) {
      console.error("Error updating category:", err);
      handleFirestoreError(err, OperationType.UPDATE, `categories/${id}`);
    }
  };

  const handleUpdateType = async (id: string, name: string, categoryId: string) => {
    if (!name.trim() || !categoryId) return;
    const cleanName = name.trim();
    const updated = productTypes.map(t => t.id === id ? { ...t, name: cleanName, categoryId } : t);
    setProductTypes(updated);
    localStorage.setItem('winstock_product_types', JSON.stringify(updated));
    setEditingTypeId(null);

    try {
      if (!id.startsWith('local_')) {
        await updateDoc(doc(db, 'productTypes', id), { name: cleanName, categoryId });
      }
    } catch (err) {
      console.error("Error updating product type:", err);
      handleFirestoreError(err, OperationType.UPDATE, `productTypes/${id}`);
    }
  };

  const handleUpdateDistributor = async (id: string, name: string, salesName: string, phone: string, paymentTerms: string) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    const cleanSales = salesName.trim();
    const cleanPhone = phone.trim();
    const cleanPayment = paymentTerms.trim();

    const updatedItem = { id, name: cleanName, salesName: cleanSales, phone: cleanPhone, paymentTerms: cleanPayment };
    const updated = distributors.map(d => d.id === id ? updatedItem : d);
    setDistributors(updated);
    localStorage.setItem('winstock_distributors', JSON.stringify(updated));
    setEditingDistributorId(null);

    try {
      if (!id.startsWith('local_')) {
        await updateDoc(doc(db, 'distributors', id), {
          name: cleanName,
          salesName: cleanSales,
          phone: cleanPhone,
          paymentTerms: cleanPayment
        });
      }
    } catch (err) {
      console.error("Error updating distributor:", err);
      handleFirestoreError(err, OperationType.UPDATE, `distributors/${id}`);
    }
  };

  const handleDeleteStockIn = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนำเข้านี้? การลบจะทำให้ข้อมูลในคลังสินค้าและประวัติการนำเข้านี้หายไปอย่างถาวร')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'stockIn', id));
      alert('ลบรายการสำเร็จเรียบร้อย');
    } catch (err) {
      console.error("Error deleting stock item:", err);
      handleFirestoreError(err, OperationType.DELETE, `stockIn/${id}`);
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

    const now = new Date();
    const [year, month, day] = stockInDate.split('-').map(Number);
    const createdDateTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

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
      createdAt: createdDateTime.toISOString(),
      details: details.trim(),
      invoiceNumber: invoiceNumber.trim()
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
      setInvoiceNumber('');
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      setStockInDate(new Date(d.getTime() - tzOffset).toISOString().split('T')[0]);
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

    const now = new Date();
    const [year, month, day] = stockOutDate.split('-').map(Number);
    const createdDateTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

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
      createdAt: createdDateTime.toISOString(),
      projectName: projectName.trim()
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
      setProjectName('');
      setSelectedInId('');
      setSelectedSerials([]);
      setOutQuantity(1);
      const d = new Date();
      const tzOffset = d.getTimezoneOffset() * 60000;
      setStockOutDate(new Date(d.getTime() - tzOffset).toISOString().split('T')[0]);
      
      alert('บันทึกจ่ายสินค้าออกสำเร็จ (หักสต็อคสินค้าเรียบร้อย)');
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
    const matchesInvoice = item.invoiceNumber ? item.invoiceNumber.toLowerCase().includes(searchLower) : false;

    return (matchesSku || matchesName || matchesBrand || matchesModel || matchesType || matchesDetails || matchesSerial || matchesInvoice) && item.currentQty > 0;
  });

  // Filters for Dispatched History (ประวัติสินค้าออก)
  const filteredHistory = stockOutItems.filter(item => {
    const matchesPo = item.poNumber.toLowerCase().includes(historySearchPo.toLowerCase()) ||
                      item.customer.toLowerCase().includes(historySearchPo.toLowerCase()) ||
                      item.sku.toLowerCase().includes(historySearchPo.toLowerCase()) ||
                      (item.projectName ? item.projectName.toLowerCase().includes(historySearchPo.toLowerCase()) : false);
    
    let matchesDate = true;
    if (historyStartDate) {
      matchesDate = matchesDate && new Date(item.createdAt) >= new Date(historyStartDate + 'T00:00:00');
    }
    if (historyEndDate) {
      matchesDate = matchesDate && new Date(item.createdAt) <= new Date(historyEndDate + 'T23:59:59');
    }
    
    return matchesPo && matchesDate;
  });

  // Group filtered history by poNumber to display multiple items under 1 PO
  const groupedHistory = useMemo(() => {
    const groups: { [po: string]: { poNumber: string; customer: string; projectName?: string; createdAt: string; items: StockOutItem[] } } = {};
    
    // Sort by date descending first, so the grouping retains chronological order
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    sortedHistory.forEach(item => {
      const po = (item.poNumber || '').trim();
      const poKey = po ? po.toLowerCase() : `no-po-${item.id}`;
      if (!groups[poKey]) {
        groups[poKey] = {
          poNumber: item.poNumber || 'ไม่มี PO',
          customer: item.customer,
          projectName: item.projectName,
          createdAt: item.createdAt,
          items: []
        };
      }
      groups[poKey].items.push(item);
    });
    
    return Object.values(groups).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filteredHistory]);

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
    const headers = ['วันที่เบิก', 'หมายเลข PO', 'บริษัทลูกค้า', 'ชื่อโครงการ', 'รหัสสินค้า/SKU', 'ชื่อสินค้า', 'ยี่ห้อ/รุ่น', 'จำนวน', 'มูลค่า (บาท)', 'ซีเรียลนัมเบอร์ที่นำออก'];
    const data = filteredHistory.map(item => ({
      date: new Date(item.createdAt).toLocaleDateString('th-TH'),
      po: item.poNumber,
      customer: item.customer,
      projectName: item.projectName || '-',
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
    const headers = ['วันที่เบิก', 'หมายเลข PO', 'ลูกค้า / โครงการ', 'รหัสสินค้า', 'ชื่อสินค้า/รุ่น', 'จำนวน', 'มูลค่ารวม'];
    const rows = filteredHistory.map(item => [
      new Date(item.createdAt).toLocaleDateString('th-TH'),
      item.poNumber,
      item.customer + (item.projectName ? ` (${item.projectName})` : ''),
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

  const handleExportExcelRecentImports = () => {
    const headers = ['วันที่นำเข้า', 'รหัสสินค้า/SKU', 'ประเภทสินค้า', 'ชื่อสินค้า', 'ยี่ห้อ', 'รุ่น', 'จำนวนนำเข้า', 'ราคาจัดซื้อต่อชิ้น (บาท)', 'ราคาทั้งหมด (บาท)', 'ใบกำกับภาษี/Invoice', 'ซีเรียลนัมเบอร์'];
    const data = stockInItems.map(item => ({
      date: new Date(item.createdAt).toLocaleDateString('th-TH') + ' ' + new Date(item.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      sku: item.sku,
      type: item.type,
      name: item.name,
      brand: item.brand,
      model: item.model,
      qty: item.initialQty,
      price: item.price,
      totalPrice: item.price * item.initialQty,
      invoice: item.invoiceNumber || '-',
      serials: item.serials ? item.serials.join(', ') : '-'
    }));
    exportToExcel(data, headers, `ประวัติการนำเข้าสินค้า_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDFRecentImports = () => {
    const headers = ['วันที่นำเข้า', 'รหัสสินค้า/SKU', 'ชื่อสินค้า', 'ยี่ห้อ/รุ่น', 'ราคาทั้งหมด', 'จำนวนนำเข้า', 'ใบกำกับภาษี'];
    const rows = stockInItems.map(item => [
      new Date(item.createdAt).toLocaleDateString('th-TH') + ' ' + new Date(item.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      item.sku,
      item.name,
      `${item.brand} / ${item.model}`,
      formatBaht(item.price * item.initialQty),
      `${item.initialQty} ชิ้น`,
      item.invoiceNumber || '-'
    ]);
    const totalQty = stockInItems.reduce((sum, item) => sum + item.initialQty, 0);
    const totalVal = stockInItems.reduce((sum, item) => sum + (item.price * item.initialQty), 0);
    
    printReport(
      'รายงานประวัติการนำเข้าล็อตล่าสุด', 
      headers, 
      rows, 
      `จำนวนนำเข้ารวมทั้งหมด: ${totalQty} ชิ้น | มูลค่ารวมการนำเข้า: ${formatBaht(totalVal)}`
    );
  };

  const handleExportExcelOutRemaining = () => {
    const availableItems = stockInItems.filter(x => x.currentQty > 0);
    const headers = ['รหัสสินค้า/SKU', 'ประเภทสินค้า', 'ชื่อสินค้า', 'ยี่ห้อ', 'รุ่น', 'ผู้จัดจำหน่าย', 'คงเหลือพร้อมใช้'];
    const data = availableItems.map(item => ({
      sku: item.sku,
      type: item.type,
      name: item.name,
      brand: item.brand,
      model: item.model,
      distributor: item.distributor,
      qty: item.currentQty
    }));
    exportToExcel(data, headers, `สินค้าคงเหลือพร้อมเบิกจ่าย_${new Date().toISOString().split('T')[0]}`);
  };

  const handlePrintPDFOutRemaining = () => {
    const availableItems = stockInItems.filter(x => x.currentQty > 0);
    const headers = ['รหัสสินค้า/SKU', 'ชื่อสินค้า', 'ยี่ห้อ/รุ่น', 'ผู้จัดจำหน่าย', 'คงเหลือพร้อมใช้'];
    const rows = availableItems.map(item => [
      item.sku,
      item.name,
      `${item.brand} ${item.model}`,
      item.distributor,
      `${item.currentQty} ชิ้น`
    ]);
    const totalQty = availableItems.reduce((sum, item) => sum + item.currentQty, 0);
    
    printReport(
      'รายงานสินค้าคงเหลือพร้อมเบิกจ่าย', 
      headers, 
      rows, 
      `ยอดคงเหลือพร้อมใช้ทั้งหมด: ${totalQty} ชิ้น`
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
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'categories'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                🗂️ หมวดหมู่และประเภทสินค้าย่อย
              </button>
              <button
                onClick={() => setActiveTab('distributors')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'distributors'
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                🏢 ผู้แทนจำหน่าย
              </button>
            </>
          )}
        </div>
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
                      <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">จัดการ</th>
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
                            {item.invoiceNumber && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100" title={`Invoice: ${item.invoiceNumber}`}>
                                🧾 {item.invoiceNumber}
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
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInId(item.id);
                                setSelectedSerials([]);
                                setOutQuantity(1);
                                setActiveTab('out');
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 rounded-xl text-xs font-bold transition-all shadow-xxs cursor-pointer"
                              title="เลือกเพื่อจ่ายสินค้าออก"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>จ่ายออก</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStockIn(item.id)}
                              className="inline-flex items-center justify-center p-1.5 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-xxs cursor-pointer"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่นำเข้าสินค้า *</label>
                  <input
                    type="date"
                    required
                    value={stockInDate}
                    onChange={(e) => setStockInDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">หมายเลข Invoice / ใบกำกับภาษี</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="เช่น INV-2026-0001"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รายละเอียดสินค้า</label>
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
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">ประวัติการนำเข้าล็อตล่าสุด</h2>
                    <p className="text-xs text-slate-500 mt-1 font-sans">แสดงรายการที่คุณเพิ่งบันทึกนำเข้ามาในระบบ WinStock</p>
                  </div>
                  {stockInItems.length > 0 && (
                    <div className="flex gap-2 self-start sm:self-auto">
                      <button
                        onClick={handleExportExcelRecentImports}
                        className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        title="Export as Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Excel</span>
                      </button>
                      <button
                        onClick={handlePrintPDFRecentImports}
                        className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        title="Print / Save PDF"
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-600" />
                        <span>PDF</span>
                      </button>
                    </div>
                  )}
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
                          <th className="py-3.5 px-6 text-xs font-semibold text-slate-600 uppercase text-center">จัดการ</th>
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
                              <div className="text-xxs text-slate-400 mt-0.5 flex flex-wrap gap-1.5 items-center">
                                <span>{item.brand} / {item.model}</span>
                                {item.invoiceNumber && (
                                  <span className="px-1 py-0.2 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-100">
                                    🧾 {item.invoiceNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-6 text-sm font-semibold text-slate-700">
                              {formatBaht(item.price * item.initialQty)}
                            </td>
                            <td className="py-3.5 px-6 text-right text-sm font-bold text-slate-800">
                              {item.initialQty} ชิ้น
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteStockIn(item.id)}
                                className="inline-flex items-center justify-center p-1.5 bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-600 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-xxs cursor-pointer"
                                title="ลบรายการ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อโครงการ</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="เช่น โครงการติดตั้งเครือข่าย อาคาร A"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่จ่ายสินค้าออก *</label>
                  <input
                    type="date"
                    required
                    value={stockOutDate}
                    onChange={(e) => setStockOutDate(e.target.value)}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">รายการคลังสินค้าคงเหลือพร้อมเบิกจ่าย</h2>
                  <p className="text-xs text-slate-500">เลือกเบิกจ่ายสินค้าผ่านการอ้างอิง SKU และตัดสต็อกคงคลังแบบ Real-time</p>
                </div>
                {stockInItems.filter(x => x.currentQty > 0).length > 0 && (
                  <div className="flex gap-2 self-start sm:self-auto">
                    <button
                      onClick={handleExportExcelOutRemaining}
                      className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      title="Export as Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={handlePrintPDFOutRemaining}
                      className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      title="Print / Save PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-600" />
                      <span>PDF</span>
                    </button>
                  </div>
                )}
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
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-base font-bold text-slate-800">รายการประวัติสินค้าออกคลัง (WinStock Out)</h3>
                <p className="text-xs text-slate-500 mt-0.5">รวมตารางสินค้าออกคลังพร้อมข้อมูลรหัสอ้างอิง PO และเลข S/N จัดกลุ่มตามหมายเลขเอกสาร PO</p>
              </div>

              <div className="space-y-6">
                {groupedHistory.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-20 text-center">
                    <Boxes className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
                    <p className="text-sm text-slate-500 mt-2">ไม่พบประวัติการจ่ายออกสำหรับตัวเลือกนี้</p>
                  </div>
                ) : (
                  groupedHistory.map((poGroup, idx) => (
                    <div key={poGroup.poNumber + '_' + idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-indigo-100 transition-all">
                      {/* Group Header */}
                      <div className="p-5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl font-mono text-xs font-bold border border-indigo-100">
                            PO: {poGroup.poNumber}
                          </span>
                          {poGroup.projectName && (
                            <span className="px-3 py-1.5 bg-indigo-50/50 text-indigo-800 rounded-xl font-semibold text-xs border border-indigo-100/50 flex items-center space-x-1">
                              <span>🏗️</span>
                              <span>โครงการ: {poGroup.projectName}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-500 font-mono flex items-center space-x-2">
                          <span>📅 วันที่จ่ายออก:</span>
                          <span className="font-bold text-slate-700">
                            {new Date(poGroup.createdAt).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="flex items-center space-x-2 mb-4 text-sm">
                          <span className="text-slate-500 font-medium">🏢 บริษัทลูกค้า:</span>
                          <span className="font-bold text-slate-800">{poGroup.customer}</span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold uppercase">
                                <th className="py-2.5 px-4">รหัส SKU</th>
                                <th className="py-2.5 px-4">รายละเอียดสินค้า</th>
                                <th className="py-2.5 px-4 text-right">ราคาต่อหน่วย</th>
                                <th className="py-2.5 px-4 text-center">จำนวนจ่ายออก</th>
                                <th className="py-2.5 px-4 text-right">มูลค่ารวม</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {poGroup.items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/40 text-xs">
                                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">{item.sku}</td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-800">{item.name}</div>
                                    <div className="text-xxs text-slate-500 mt-0.5">{item.brand} {item.model}</div>
                                    {item.selectedSerials && item.selectedSerials.length > 0 && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {item.selectedSerials.map(sn => (
                                          <span key={sn} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xxs border border-slate-200/40">
                                            S/N: {sn}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-600 font-mono">{formatBaht(item.price)}</td>
                                  <td className="py-3 px-4 text-center font-bold text-slate-800 text-sm">
                                    {item.quantity} ชิ้น
                                  </td>
                                  <td className="py-3 px-4 text-right font-black text-slate-700 font-mono">
                                    {formatBaht(item.price * item.quantity)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50/50 font-bold border-t border-slate-100 text-xs text-slate-800">
                                <td colSpan={3} className="py-2.5 px-4 text-right text-slate-500">ยอดรวมของ PO นี้:</td>
                                <td className="py-2.5 px-4 text-center text-slate-800 font-black text-sm">
                                  {poGroup.items.reduce((sum, item) => sum + item.quantity, 0)} ชิ้น
                                </td>
                                <td className="py-2.5 px-4 text-right text-indigo-700 font-black text-sm font-mono">
                                  {formatBaht(poGroup.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* T5: Categories and Product Types (หมวดหมู่และประเภทสินค้า) */}
        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Left Box: Categories */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-600" />
                  <span>จัดการหมวดหมู่สินค้า (Product Categories)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">หมวดหมู่สินค้าหลักสำหรับจัดกลุ่มประเภทสินค้าและประวัติคงเหลือ</p>
              </div>

              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="เพิ่มหมวดหมู่ใหม่ เช่น อุปกรณ์เครือข่าย, คอมพิวเตอร์"
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-all shadow-xs shrink-0"
                >
                  + เพิ่มหมวดหมู่
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-sm"
                  >
                    {editingCategoryId === c.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleUpdateCategory(c.id, editingCategoryName)}
                          className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="px-2.5 py-1 bg-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-400"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-700">{c.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategoryId(c.id);
                              setEditingCategoryName(c.name);
                            }}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="แก้ไขหมวดหมู่"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบหมวดหมู่ "${c.name}"? การลบนี้จะส่งผลต่อการเชื่อมโยงประเภทสินค้าด้วย`)) {
                                handleDeleteCategory(c.id);
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="ลบหมวดหมู่"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 font-sans">ไม่มีข้อมูลหมวดหมู่สินค้าหลัก</div>
                )}
              </div>
            </div>

            {/* Right Box: Product Types (Sub-types) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-indigo-600" />
                  <span>จัดการประเภทสินค้าย่อย (Product Sub-types)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">ประเภทสเปกย่อยของสินค้าแต่ละหมวดหมู่หลัก</p>
              </div>

              <form onSubmit={handleAddType} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <select
                    required
                    value={newTypeCategoryId}
                    onChange={(e) => setNewTypeCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="">-- เลือกหมวดหมู่หลัก --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    placeholder="เช่น Router, Switch, IP Camera"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shrink-0 shadow-xs"
                  >
                    + เพิ่มประเภท
                  </button>
                </div>
              </form>

              {/* Category Filter for Sub-types */}
              <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-600">แสดงตามหมวดหมู่สินค้า:</span>
                <select
                  value={subTypeFilterCategory}
                  onChange={(e) => setSubTypeFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-indigo-500 font-semibold text-slate-700 shadow-xxs cursor-pointer"
                >
                  <option value="">-- แสดงทั้งหมด (แบ่งตามหมวดหมู่) --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 max-h-[450px] overflow-y-auto scrollbar-thin pr-1">
                {(() => {
                  // Filter categories based on selection
                  const filteredCategories = subTypeFilterCategory 
                    ? categories.filter(c => c.id === subTypeFilterCategory)
                    : categories;

                  // Find if there are any uncategorized types
                  const uncategorizedTypes = productTypes.filter(t => !t.categoryId || !categories.some(c => c.id === t.categoryId));

                  // Construct sections to display
                  const sections: { categoryId: string; categoryName: string; types: typeof productTypes }[] = [];

                  filteredCategories.forEach(c => {
                    const types = productTypes.filter(t => t.categoryId === c.id);
                    if (types.length > 0 || subTypeFilterCategory === c.id) {
                      sections.push({
                        categoryId: c.id,
                        categoryName: c.name,
                        types
                      });
                    }
                  });

                  if (uncategorizedTypes.length > 0 && !subTypeFilterCategory) {
                    sections.push({
                      categoryId: 'uncategorized',
                      categoryName: 'ไม่ระบุหมวดหมู่ / อื่นๆ',
                      types: uncategorizedTypes
                    });
                  }

                  if (sections.length === 0) {
                    return (
                      <div className="text-center py-12 text-xs text-slate-400 font-sans italic">
                        ไม่มีข้อมูลประเภทสินค้าย่อยที่ตรงตามเงื่อนไข
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {sections.map(section => (
                        <div key={section.categoryId} className="space-y-2.5">
                          {/* Section Header */}
                          <div className="flex items-center gap-2 bg-slate-50/50 p-2 rounded-lg border border-slate-100/50 sticky top-0 z-10 backdrop-blur-xs">
                            <span className="text-xs font-bold text-indigo-700 font-sans">
                              📁 {section.categoryName}
                            </span>
                            <div className="flex-1 h-px bg-slate-100" />
                            <span className="text-[10px] font-semibold text-slate-400 font-sans px-1.5 py-0.5 bg-slate-100 rounded-md">
                              {section.types.length} รายการ
                            </span>
                          </div>
                          
                          {/* Section Items */}
                          <div className="space-y-1.5 pl-1.5">
                            {section.types.map(t => (
                              <div
                                key={t.id}
                                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-sm hover:bg-slate-100/50 transition-colors"
                              >
                                {editingTypeId === t.id ? (
                                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                                    <select
                                      value={editingTypeCategoryId}
                                      onChange={(e) => setEditingTypeCategoryId(e.target.value)}
                                      className="w-full sm:w-auto px-2 py-1 text-xs border border-slate-300 bg-white rounded-lg outline-none"
                                    >
                                      {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={editingTypeName}
                                      onChange={(e) => setEditingTypeName(e.target.value)}
                                      className="flex-1 w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
                                    />
                                    <div className="flex gap-1.5 mt-2 sm:mt-0 shrink-0">
                                      <button
                                        onClick={() => handleUpdateType(t.id, editingTypeName, editingTypeCategoryId)}
                                        className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                                      >
                                        บันทึก
                                      </button>
                                      <button
                                        onClick={() => setEditingTypeId(null)}
                                        className="px-2.5 py-1 bg-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-400"
                                      >
                                        ยกเลิก
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <span className="font-semibold text-slate-700">{t.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingTypeId(t.id);
                                          setEditingTypeName(t.name);
                                          setEditingTypeCategoryId(t.categoryId || '');
                                        }}
                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="แก้ไขประเภทสินค้าย่อย"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบประเภทสินค้าย่อย "${t.name}"?`)) {
                                            handleDeleteType(t.id);
                                          }
                                        }}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="ลบประเภทสินค้าย่อย"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {section.types.length === 0 && (
                              <div className="text-center py-6 text-xs text-slate-400 font-sans italic bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
                                ยังไม่มีประเภทสินค้าย่อยในหมวดหมู่นี้
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        )}

        {/* T6: Distributors (ผู้แทนจำหน่าย) */}
        {activeTab === 'distributors' && (
          <motion.div
            key="distributors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header and Add Form */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                  <span>จัดการข้อมูลผู้แทนจำหน่าย (Distributor Directory)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">จัดเก็บข้อมูลบริษัทผู้จัดจำหน่าย เบอร์ติดต่อของเซลส์ และเงื่อนไขการชำระเงินเครดิตสำหรับการซื้อขาย</p>
              </div>

              <form onSubmit={handleAddDistributor} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/80">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">ชื่อบริษัท / ผู้จัดจำหน่าย *</label>
                  <input
                    type="text"
                    required
                    value={newDistributor}
                    onChange={(e) => setNewDistributor(e.target.value)}
                    placeholder="เช่น Synnex (Thailand) PCL"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">ชื่อเซลส์ผู้ติดต่อ</label>
                  <input
                    type="text"
                    value={newDistSalesName}
                    onChange={(e) => setNewDistSalesName(e.target.value)}
                    placeholder="เช่น คุณสมศักดิ์ รักดี"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">เบอร์โทรติดต่อ</label>
                  <input
                    type="text"
                    value={newDistPhone}
                    onChange={(e) => setNewDistPhone(e.target.value)}
                    placeholder="เช่น 02-123-4567, 081-234-5678"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">เงื่อนไขชำระเงิน (Credit Term)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDistPaymentTerms}
                      onChange={(e) => setNewDistPaymentTerms(e.target.value)}
                      placeholder="เช่น เครดิต 30 วัน, เงินสด"
                      className="flex-1 min-w-0 px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0 shadow-sm"
                    >
                      + เพิ่มผู้แทน
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* List and Table Grid */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">รายชื่อผู้แทนจำหน่ายทั้งหมด ({distributors.length} รายการ)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 text-xxs font-black text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">ชื่อบริษัท / ผู้แทนจำหน่าย</th>
                      <th className="py-3 px-6">ชื่อเซลส์ที่ติดต่อ</th>
                      <th className="py-3 px-6">เบอร์โทรติดต่อ</th>
                      <th className="py-3 px-6">เงื่อนไขการชำระเงิน</th>
                      <th className="py-3 px-6 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributors.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-slate-100 hover:bg-slate-50/40 text-xs text-slate-700 transition-colors"
                      >
                        {editingDistributorId === d.id ? (
                          <>
                            <td className="py-3 px-6">
                              <input
                                type="text"
                                value={editingDistName}
                                onChange={(e) => setEditingDistName(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
                              />
                            </td>
                            <td className="py-3 px-6">
                              <input
                                type="text"
                                value={editingDistSales}
                                onChange={(e) => setEditingDistSales(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
                              />
                            </td>
                            <td className="py-3 px-6">
                              <input
                                type="text"
                                value={editingDistPhone}
                                onChange={(e) => setEditingDistPhone(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
                              />
                            </td>
                            <td className="py-3 px-6">
                              <input
                                type="text"
                                value={editingDistPayment}
                                onChange={(e) => setEditingDistPayment(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg outline-none"
                              />
                            </td>
                            <td className="py-3 px-6 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateDistributor(d.id, editingDistName, editingDistSales, editingDistPhone, editingDistPayment)}
                                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                                >
                                  บันทึก
                                </button>
                                <button
                                  onClick={() => setEditingDistributorId(null)}
                                  className="px-2.5 py-1 bg-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-400"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 px-6 font-semibold text-slate-800">{d.name}</td>
                            <td className="py-3.5 px-6 text-slate-600">{d.salesName || '-'}</td>
                            <td className="py-3.5 px-6 text-slate-600 font-mono">{d.phone || '-'}</td>
                            <td className="py-3.5 px-6 text-slate-600">
                              {d.paymentTerms ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-100/60 font-semibold font-sans">
                                  {d.paymentTerms}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingDistributorId(d.id);
                                    setEditingDistName(d.name);
                                    setEditingDistSales(d.salesName || '');
                                    setEditingDistPhone(d.phone || '');
                                    setEditingDistPayment(d.paymentTerms || '');
                                  }}
                                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="แก้ไขข้อมูลผู้แทนจำหน่าย"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบผู้จัดจำหน่าย "${d.name}"?`)) {
                                      handleDeleteDistributor(d.id);
                                    }
                                  }}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="ลบผู้จัดจำหน่าย"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {distributors.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-slate-400 font-sans">
                          ไม่มีข้อมูลผู้จัดจำหน่ายที่จัดเก็บไว้ในระบบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

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
