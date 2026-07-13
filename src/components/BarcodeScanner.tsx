import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export default function BarcodeScanner({ onScan, onClose, title = "สแกนบาร์โค้ด / QR Code" }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "interactive-camera-scanner-view";

  useEffect(() => {
    // 1. Fetch available cameras first
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setError("ไม่พบกล้องถ่ายภาพบนอุปกรณ์นี้");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
        setError("ไม่สามารถเข้าถึงสิทธิ์การใช้งานกล้องได้ กรุณาอนุญาตให้แอปพลิเคชันเข้าถึงกล้อง");
      });

    return () => {
      // Cleanup scanner on unmount
      if (qrCodeInstanceRef.current) {
        if (qrCodeInstanceRef.current.isScanning) {
          qrCodeInstanceRef.current.stop().catch(err => console.error("Error stopping scanner:", err));
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCameraId) return;

    // Wait a brief moment to ensure container DOM element is rendered
    const timeout = setTimeout(() => {
      startScanning(selectedCameraId);
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (qrCodeInstanceRef.current) {
        if (qrCodeInstanceRef.current.isScanning) {
          qrCodeInstanceRef.current.stop()
            .then(() => {
              setIsCameraReady(false);
            })
            .catch(err => console.error("Error stopping camera sequence:", err));
        }
      }
    };
  }, [selectedCameraId]);

  const startScanning = async (cameraId: string) => {
    try {
      setError(null);
      setIsCameraReady(false);

      if (qrCodeInstanceRef.current) {
        if (qrCodeInstanceRef.current.isScanning) {
          await qrCodeInstanceRef.current.stop();
        }
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      qrCodeInstanceRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 15,
          qrbox: (width, height) => {
            // Responsive box size
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size * 0.5 }; // Wide for barcodes
          },
          aspectRatio: 1.777778 // 16:9 for wider camera view
        },
        (decodedText) => {
          // Success callback
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScan(decodedText);
          
          // Stop scanning and close
          html5QrCode.stop()
            .then(() => onClose())
            .catch(err => console.error("Error stopping scanner after success:", err));
        },
        () => {
          // Silent failure callback during standard scanning frames
        }
      );

      setIsCameraReady(true);
    } catch (err: any) {
      console.error("Error starting camera:", err);
      setError(`ไม่สามารถเปิดใช้งานกล้องได้: ${err?.message || err}`);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-slate-100 shadow-2xl flex flex-col animate-scale-up">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{title}</h3>
              <p className="text-xxs text-slate-400 mt-0.5">จัดกึ่งกลางของบาร์โค้ดให้อยู่ในกรอบสแกน</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Stage */}
        <div className="relative bg-slate-950 aspect-4/3 flex items-center justify-center overflow-hidden">
          {/* Spinner when loading */}
          {!isCameraReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 z-10 bg-slate-950 text-white">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xxs font-medium tracking-wider text-slate-400">กำลังเชื่อมต่อและเริ่มต้นกล้อง...</p>
            </div>
          )}

          {/* Scanner view */}
          <div id={scannerId} className="w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

          {/* Overlay Border Focus Frame */}
          {isCameraReady && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
              {/* Wide border for scanning barcodes */}
              <div className="w-[70%] h-[35%] border-2 border-indigo-400 bg-indigo-500/5 rounded-2xl relative shadow-[0_0_0_100vmax_rgba(15,23,42,0.6)]">
                {/* Horizontal scanning red laser line */}
                <div className="absolute left-0 right-0 h-0.5 bg-rose-500 opacity-85 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-bounce" style={{ top: '50%' }} />
                
                {/* Corner markers */}
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-500 rounded-tl-sm"></span>
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-500 rounded-tr-sm"></span>
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-500 rounded-bl-sm"></span>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-500 rounded-br-sm"></span>
              </div>
              <span className="text-xxs font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-full mt-4 shadow-sm opacity-90 tracking-wide">
                ค้นหาบาร์โค้ดแบบกึ่งอัตโนมัติ...
              </span>
            </div>
          )}

          {/* Error View */}
          {error && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white z-20 space-y-4">
              <div className="p-3 bg-rose-500/10 rounded-full text-rose-500">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-400">เกิดข้อผิดพลาดในการเปิดกล้อง</p>
                <p className="text-xxs text-slate-400 max-w-xs mx-auto leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => selectedCameraId && startScanning(selectedCameraId)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xxs font-bold flex items-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองใหม่อีกครั้ง</span>
              </button>
            </div>
          )}
        </div>

        {/* Controls / Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col items-center justify-center space-y-2">
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200/60 rounded-xl text-xs font-bold text-slate-700 flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              <span>สลับกล้อง ({cameras.length})</span>
            </button>
          )}
          <p className="text-xxs text-slate-400 text-center font-sans">
            รองรับการสแกนบาร์โค้ดแนวขวาง เช่น รหัส SKU, รหัสสินค้า, หรือสติ๊กเกอร์อุปกรณ์เครือข่าย
          </p>
        </div>

      </div>
    </div>
  );
}
