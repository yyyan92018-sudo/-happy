import React, { useState, useEffect } from 'react';
import { AppMode } from '../types';

interface UIOverlayProps {
  mode: AppMode;
  onFileUpload: (files: FileList) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ mode, onFileUpload }) => {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setHidden(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const getStatusInfo = (m: AppMode) => {
    switch (m) {
      case 'TREE': return { text: 'TREE MODE', hint: 'Fist to form tree' };
      case 'SCATTER': return { text: 'SCATTER MODE', hint: 'Open palm to rotate' };
      case 'FOCUS': return { text: 'FOCUS MODE', hint: 'Pinch to view photo' };
      case 'GALLERY': return { text: 'GALLERY MODE', hint: 'Peace sign activated' };
    }
  };

  const status = getStatusInfo(mode);

  return (
    <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none flex flex-col items-center pt-10">
      {/* Title */}
      <h1 className="text-6xl text-yellow-100 font-cinzel font-normal tracking-widest opacity-90 transition-opacity duration-500 text-transparent bg-clip-text bg-gradient-to-b from-white to-yellow-500 drop-shadow-[0_0_50px_rgba(252,238,167,0.6)]">
        Merry Christmas
      </h1>

      {/* Controls */}
      <div className={`mt-8 pointer-events-auto text-center transition-opacity duration-500 ${hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <label className="inline-block bg-neutral-900/60 border border-yellow-500/40 text-yellow-500 px-6 py-2 cursor-pointer uppercase tracking-widest text-xs transition-all duration-300 hover:bg-yellow-500 hover:text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.5)] backdrop-blur-sm">
          Add Memories
          <input 
            type="file" 
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={(e) => e.target.files && onFileUpload(e.target.files)}
          />
        </label>
        <div className="text-yellow-500/50 text-[10px] mt-2 tracking-widest uppercase">
          Press 'H' to Hide Controls
        </div>
      </div>

      {/* Gesture Status */}
      <div className="absolute bottom-10 left-10 pointer-events-none z-20">
        <div className="bg-black/70 border border-yellow-500/50 px-5 py-3 rounded-lg backdrop-blur-md flex items-center gap-3">
          <div className="relative w-6 h-6">
             <div className="absolute w-full h-full rounded-full bg-yellow-500 shadow-[0_0_20px_rgba(212,175,55,0.8)] animate-pulse" />
          </div>
          <div>
            <div className="text-yellow-500 text-[11px] tracking-widest font-light uppercase">
              {status.text}
            </div>
            <div className="text-yellow-500/60 text-[9px] tracking-wider mt-1">
              {status.hint}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;