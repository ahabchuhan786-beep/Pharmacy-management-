import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Copy, ExternalLink, X, ShieldCheck, Zap, Monitor, AlertCircle, ArrowUpRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Use the canonical public URL for external installation
  const appUrl = typeof window !== 'undefined' && window.location.origin.includes('run.app')
    ? window.location.origin
    : 'https://ais-pre-v57ngub67gln7zhup5ovg7-437137023086.asia-southeast1.run.app';

  const pwaBuilderUrl = `https://www.pwabuilder.com?url=${encodeURIComponent(appUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDirect = () => {
    window.open(appUrl, '_blank');
  };

  const handleInstallClick = async () => {
    setInstallError(null);
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setInstallError("Browser installation was cancelled or dismissed.");
      }
    } else if (isInIframe) {
      // Browsers disallow install prompts inside iframes
      handleOpenDirect();
    } else {
      setInstallError("Please follow the manual steps below for your browser/phone.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 text-slate-800 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-xl">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Install App &amp; Android APK</h2>
              <p className="text-xs text-emerald-100">AK Pharmacy Management • اینڈروئیڈ ایپ انسٹالیشن</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs sm:text-sm">
          {/* Status Banner */}
          {isInstalled ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">App Already Installed!</p>
                <p className="text-xs text-emerald-700">یہ ایپ آپ کے سسٹم پر کامیابی سے انسٹال شدہ ہے اور فل اسکرین میں کام کر رہی ہے۔</p>
              </div>
            </div>
          ) : isInIframe ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">پریویو موڈ (Preview Mode Notice)</h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    گوگل کروم یا اینڈروئیڈ سیکیورٹی پریویو ونڈو کے اندر براہِ راست انسٹال کرنے کی اجازت نہیں دیتے۔ نیچے دیے گئے بٹن پر کلک کر کے اسے اصلی براؤزر ونڈو میں کھولیں، وہاں 1 کلک میں ایپ انسٹال ہو جائے گی:
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenDirect}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Open in Full Browser to Install (اصلی ونڈو میں کھولیں)</span>
              </button>
            </div>
          ) : null}

          {/* Primary Action Card: 1-Click Install or Direct Action */}
          {!isInstalled && (
            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  Method 1: Direct 1-Click Install
                </span>
                <span className="text-[11px] font-bold text-emerald-700 font-mono">WebAPK / Desktop</span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Instant Standalone Installation (کروم / اینڈروئیڈ انسٹال)
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  یہ ایپ اینڈروئیڈ پر مکمل <strong>WebAPK</strong> کے طور پر انسٹال ہو جاتی ہے جس سے فون کی ہوم اسکرین پر آئیکن اور فل اسکرین آف لائن سپورٹ مل جاتی ہے۔ ڈیسک ٹاپ کروم میں بھی یہ بطور ونڈوز ایپ انسٹال ہوتی ہے۔
                </p>
              </div>

              {isInstallable ? (
                <button
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md cursor-pointer active:scale-[0.99]"
                >
                  <Download className="w-5 h-5" />
                  <span>Install App Now (ابھی انسٹال کریں)</span>
                </button>
              ) : (
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70 space-y-2 text-xs text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>انسٹال کرنے کا آسان طریقہ (Manual Steps):</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <strong className="block text-slate-800 mb-1 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> Android Phone:
                      </strong>
                      1. کروم میں یہ لنک کھولیں<br />
                      2. اوپر <strong>3 ڈاٹس (⋮)</strong> پر ٹیپ کریں<br />
                      3. <strong>"Install app"</strong> یا <strong>"Add to Home screen"</strong> منتخب کریں
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <strong className="block text-slate-800 mb-1 flex items-center gap-1">
                        <Monitor className="w-3.5 h-3.5 text-blue-600" /> Desktop PC / Laptop:
                      </strong>
                      1. کروم کی ایڈریس بار کے دائیں جانب دیکھیں<br />
                      2. <strong>انسٹال آئیکن ⊕ (Install)</strong> نظر آئے گا<br />
                      3. اس پر کلک کریں اور <strong>Install</strong> دبا دیں
                    </div>
                  </div>
                </div>
              )}

              {installError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {installError}
                </p>
              )}
            </div>
          )}

          {/* Live URL Copy Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Live App Link (موبائل یا ڈیسک ٹاپ کے لیے لنک)
              </label>
              {copied && <span className="text-[11px] text-emerald-600 font-bold">Copied to clipboard!</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-mono select-all focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Method 2: Raw Standalone .APK File Generation via PWABuilder */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-xs text-slate-900">
                Method 2: Standalone .APK File Package (براہ راست .apk فائل ڈاؤن لوڈ)
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              اگر آپ کو واٹس ایپ یا USB کے ذریعے شیئر کرنے کے لیے اصل <strong>.apk</strong> فائل چاہیے، تو PWABuilder کی مدد سے صرف 30 سیکنڈ میں ریڈی میڈ APK تیار کی جا سکتی ہے:
            </p>
            <a
              href={pwaBuilderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition mt-1 shadow-xs cursor-pointer"
            >
              <span>Build Signed APK on PWABuilder</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* iOS Note */}
          {isIOS && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              <strong>iPhone / iPad کے لیے:</strong> سفاری براؤزر کے شیئر (Share) بٹن پر ٹیپ کریں، پھر <strong>"Add to Home Screen"</strong> پر کلک کریں۔
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleOpenDirect}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close (بند کریں)
          </button>
        </div>
      </div>
    </div>
  );
};
