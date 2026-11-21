import React, { useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AndroidApkModal } from './AndroidApkModal';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'sidebar' | 'pill';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'full', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already running inside standalone app, don't show prompt button unless clicked from settings
  if (isInstalled && variant !== 'sidebar') {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-medium text-xs hover:from-emerald-700 hover:to-teal-800 transition shadow-sm ${className}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-200" />
            <span>Install Android App / APK</span>
          </div>
          <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded font-bold">APK</span>
        </button>
        <AndroidApkModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleClick}
          title="Install Android App / APK"
          className={`flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1.5 rounded-lg transition font-medium shadow-sm ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install APK</span>
        </button>
        <AndroidApkModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install Android APK</span>
      </button>
      <AndroidApkModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
