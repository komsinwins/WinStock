export interface ProductType {
  id: string;
  name: string;
  categoryId?: string;
  details?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Distributor {
  id: string;
  name: string;
  details?: string;
}

export interface StockInItem {
  id: string;
  sku: string;         // SKU / รหัสสินค้า
  type: string;        // ประเภทสินค้า
  name: string;        // หมวดหมู่สินค้า ( maps to Category Name)
  brand: string;       // ยี่ห้อ
  model: string;       // รุ่น
  serials: string[];   // รายการซีเรียลนัมเบอร์ (S/N)
  warranty: string;    // ระยะประกัน
  distributor: string; // ตัวแทนจำหน่าย
  price: number;       // ราคาที่จัดซื้อ
  initialQty: number;  // จำนวนนำเข้าเริ่มต้น
  currentQty: number;  // จำนวนคงเหลือปัจจุบัน
  createdAt: string;   // วันที่นำเข้า
  details?: string;    // รายละเอียดสินค้า
  invoiceNumber?: string; // หมายเลขใบกำกับสินค้า / Invoice
}

export interface StockOutItem {
  id: string;
  customer: string;        // ชื่อบริษัทลูกค้า
  poNumber: string;        // หมายเลขเอกสาร PO
  sku: string;             // รหัสสินค้า (อ้างอิงรหัสสินค้า Stock In)
  name: string;            // ชื่อสินค้า
  brand: string;           // ยี่ห้อ
  model: string;           // รุ่น
  quantity: number;        // จำนวนที่นำออก
  selectedSerials: string[]; // ซีเรียลนัมเบอร์ที่เลือก (สามารถมีได้หลายรายการ)
  price: number;           // ราคาที่ขาย/นำออก
  createdAt: string;       // วันที่นำออก
  projectName?: string;    // ชื่อโครงการ
}

export interface DemoItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  status: 'available' | 'borrowed' | 'damaged' | 'lost';
  borrower?: string;
  borrowDate?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  notes?: string;
  createdAt: string;
  imageUrl?: string;
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  price: number;
  location: string;
  lastUpdated: string;
  imageUrl?: string;
}

export interface AssetItem {
  id: string;
  code: string;
  name: string;
  category: string;
  serial: string;
  value: number;
  location: string;
  custodian: string;
  purchaseDate: string;
  warrantyExp: string;
  status: 'active' | 'inactive' | 'repair' | 'retired';
  createdAt: string;
  imageUrl?: string;
}
