import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#00FF66]/15 border-2 border-[#00FF66] px-4 py-2.5 text-xs font-extrabold tracking-wider text-[#00FF66] hover:bg-[#00FF66] hover:text-[#050811] transition cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>INSTALL APP (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#00E5FF]/15 border-2 border-[#00E5FF] px-4 py-2 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/25 transition cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span>INSTALAR EN IPHONE</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[#0A1124] border-2 border-[#00E5FF] p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold text-[#00E5FF]">Instalar como App (PWA)</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed space-y-2">
                <span>1. Pulsa el botón <strong>Compartir</strong> en la barra de Safari.</span>
                <br />
                <span>2. Selecciona <strong>Añadir a la pantalla de inicio</strong> para jugar a pantalla completa.</span>
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#00E5FF] py-2.5 text-xs font-black text-[#050811] cursor-pointer"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
