import React from 'react';
import { X, ZoomIn } from 'lucide-react';

/**
 * Compresses an image file down to a lightweight JPG Base64 string for safe Firestore storage.
 */
export function compressImageToBase64(
  file: File, 
  maxWidth: number = 320, 
  maxHeight: number = 320, 
  quality: number = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Beautiful default placeholders for items that do not have a custom uploaded image.
 * Uses high-quality, lightweight, optimized unsplash CDNs.
 */
export const DEFAULT_PREVIEWS = {
  // Demo Items
  firewall: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=240&auto=format&fit=crop&q=60',
  switch: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=240&auto=format&fit=crop&q=60',
  ap: 'https://images.unsplash.com/photo-1551703521-6068d690a64e?w=240&auto=format&fit=crop&q=60',
  demoGeneric: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=240&auto=format&fit=crop&q=60',

  // Materials
  cable: 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?w=240&auto=format&fit=crop&q=60',
  connector: 'https://images.unsplash.com/photo-1618519764620-7403abdbfee9?w=240&auto=format&fit=crop&q=60',
  pipe: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=240&auto=format&fit=crop&q=60',
  box: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=240&auto=format&fit=crop&q=60',
  materialGeneric: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=240&auto=format&fit=crop&q=60',

  // Assets
  laptop: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=240&auto=format&fit=crop&q=60',
  tester: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=240&auto=format&fit=crop&q=60',
  desk: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=240&auto=format&fit=crop&q=60',
  assetGeneric: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=240&auto=format&fit=crop&q=60'
};

/**
 * Gets a beautiful fallback image based on the item category/name.
 */
export function getFallbackImage(name: string, category: string = ''): string {
  const normalizedName = name.toLowerCase();
  const normalizedCat = category.toLowerCase();

  // Assets
  if (normalizedName.includes('macbook') || normalizedName.includes('laptop') || normalizedName.includes('notebook') || normalizedName.includes('คอมพิวเตอร์')) {
    return DEFAULT_PREVIEWS.laptop;
  }
  if (normalizedName.includes('otdr') || normalizedName.includes('tester') || normalizedName.includes('วัด') || normalizedName.includes('เครื่องมือ')) {
    return DEFAULT_PREVIEWS.tester;
  }
  if (normalizedName.includes('desk') || normalizedName.includes('โต๊ะ') || normalizedName.includes('เก้าอี้') || normalizedName.includes('furniture')) {
    return DEFAULT_PREVIEWS.desk;
  }

  // Demo
  if (normalizedName.includes('firewall') || normalizedName.includes('fortigate')) {
    return DEFAULT_PREVIEWS.firewall;
  }
  if (normalizedName.includes('switch') || normalizedName.includes('สวิตช์')) {
    return DEFAULT_PREVIEWS.switch;
  }
  if (normalizedName.includes('ap') || normalizedName.includes('access point') || normalizedName.includes('wi-fi') || normalizedName.includes('wifi')) {
    return DEFAULT_PREVIEWS.ap;
  }

  // Materials
  if (normalizedName.includes('cable') || normalizedName.includes('สาย')) {
    return DEFAULT_PREVIEWS.cable;
  }
  if (normalizedName.includes('rj45') || normalizedName.includes('connector') || normalizedName.includes('หัวต่อ') || normalizedName.includes('แจ็ค')) {
    return DEFAULT_PREVIEWS.connector;
  }
  if (normalizedName.includes('pipe') || normalizedName.includes('ท่อ') || normalizedName.includes('ราง')) {
    return DEFAULT_PREVIEWS.pipe;
  }
  if (normalizedName.includes('box') || normalizedName.includes('กล่อง')) {
    return DEFAULT_PREVIEWS.box;
  }

  // Generic lists based on names
  if (normalizedCat.includes('it') || normalizedCat.includes('equipment') || normalizedCat.includes('network')) {
    return DEFAULT_PREVIEWS.demoGeneric;
  }
  if (normalizedCat.includes('material') || normalizedCat.includes('connector') || normalizedCat.includes('cable')) {
    return DEFAULT_PREVIEWS.materialGeneric;
  }

  return DEFAULT_PREVIEWS.assetGeneric;
}

interface ImageModalProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * A beautiful, animated full-screen modal to preview the image in full detail.
 */
export function ImageModal({ imageUrl, title, subtitle, onClose }: ImageModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full z-10 border border-slate-100 dark:border-slate-800 transition-all transform duration-300">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{title}</h4>
            {subtitle && <p className="text-xxs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Image Display */}
        <div className="relative flex items-center justify-center p-6 bg-slate-950 min-h-[280px]">
          <img 
            src={imageUrl} 
            alt={title} 
            className="max-h-[380px] max-w-full object-contain rounded-lg shadow-lg"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-3 right-3 bg-slate-900/60 backdrop-blur-xs text-white/90 text-xxs px-2 py-1 rounded-md flex items-center gap-1">
            <ZoomIn className="w-3 h-3" />
            <span>ภาพขยาย</span>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImageUploadFieldProps {
  label: string;
  previewUrl: string;
  onChange: (base64: string) => void;
  onClear: () => void;
}

/**
 * A beautiful drag-and-drop / select file component for adding custom photos
 */
export function ImageUploadField({ label, previewUrl, onChange, onClear }: ImageUploadFieldProps) {
  const [isCompressing, setIsCompressing] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const base64 = await compressImageToBase64(file);
      onChange(base64);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถอัปโหลดไฟล์ภาพได้ กรุณาลองใช้ไฟล์อื่น');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      
      {previewUrl ? (
        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group shadow-xs">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-white text-slate-800 rounded-lg text-xxs font-semibold shadow-sm hover:bg-slate-100 transition-all"
            >
              เปลี่ยนรูป
            </button>
            <button
              type="button"
              onClick={onClear}
              className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xxs font-semibold shadow-sm hover:bg-rose-700 transition-all"
            >
              ลบรูป
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/10 transition-all h-32 group"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-all mb-2">
            <svg 
              className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-all" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <span className="text-xs font-semibold text-slate-600 group-hover:text-indigo-600 transition-all">
            {isCompressing ? 'กำลังบีบอัดรูป...' : 'คลิกเพื่อเลือกไฟล์รูปถ่าย'}
          </span>
          <span className="text-xxs text-slate-400 mt-1">
            PNG, JPG หรือกล้องถ่ายรูปมือถือ
          </span>
        </div>
      )}
      
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden"
      />
    </div>
  );
}
