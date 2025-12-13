import React, { useRef, useState, useEffect } from 'react';
import Experience from './components/Experience';
import WebcamFeed from './components/WebcamFeed';
import UIOverlay from './components/UIOverlay';
import { HandState, AppMode } from './types';
import { audioService } from './services/audioService';
import { uploadPhoto, getAllPhotos } from './services/firebase';
import { STATIC_PHOTOS } from './constants';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<AppMode>('TREE');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  // High-frequency state managed by Ref to avoid React render loop
  const handStateRef = useRef<HandState>({
    detected: false,
    x: 0,
    y: 0,
    velocityX: 0,
    landmarks: null
  });

  // Background Music Setup
  useEffect(() => {
    const bgm = new Audio('./music.mp3');
    bgm.loop = true;
    bgm.volume = 0.5;

    const playMusic = () => {
      bgm.play().then(() => {
        console.log("Background music started");
      }).catch(e => {
        console.log("Waiting for interaction to play music");
      });
      
      // Cleanup listeners once music starts
      window.removeEventListener('click', playMusic);
      window.removeEventListener('keydown', playMusic);
      window.removeEventListener('touchstart', playMusic);
    };

    // Listen for any interaction to start audio (browser policy)
    window.addEventListener('click', playMusic);
    window.addEventListener('keydown', playMusic);
    window.addEventListener('touchstart', playMusic);

    return () => {
      bgm.pause();
      bgm.src = '';
      window.removeEventListener('click', playMusic);
      window.removeEventListener('keydown', playMusic);
      window.removeEventListener('touchstart', playMusic);
    };
  }, []);

  // Fetch existing photos on mount (Both Static and Firebase)
  useEffect(() => {
    // 1. Prepare Static Photos
    // Assumes photos are in a folder named 'photos' at the project root
    const staticUrls = STATIC_PHOTOS.map(filename => `./photos/${filename}`);

    // 2. Fetch Firebase Photos (if configured)
    getAllPhotos().then(firebaseUrls => {
      // Combine unique URLs from both sources
      const allUrls = [...new Set([...staticUrls, ...firebaseUrls])];
      
      if (allUrls.length > 0) {
        setPhotoUrls(allUrls);
      }
    });
  }, []);

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    audioService.playModeSound(newMode);
  };

  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    const promises = Array.from(files).map(file => uploadPhoto(file));
    try {
      const results = await Promise.all(promises);
      const newUrls = results.filter((url): url is string => url !== null);
      if (newUrls.length > 0) {
        setPhotoUrls(prev => [...prev, ...newUrls]);
      }
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-black font-serif">
      {/* Loading Overlay */}
      {(isLoading) && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center transition-opacity duration-1000">
          <div className="w-10 h-10 border border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
          <div className="text-yellow-500 text-sm tracking-[4px] mt-5 uppercase font-light">
            Loading Holiday Magic
          </div>
        </div>
      )}

      {/* Uploading Overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="w-8 h-8 border border-white/20 border-t-white rounded-full animate-spin" />
          <div className="text-white text-xs tracking-[2px] mt-4 uppercase">
            Saving Memories...
          </div>
        </div>
      )}

      <Experience 
        handStateRef={handStateRef} 
        mode={mode} 
        onLoaded={() => setIsLoading(false)}
        photoUrls={photoUrls}
      />
      
      <UIOverlay 
        mode={mode} 
        onFileUpload={handleFileUpload}
      />

      <WebcamFeed 
        handStateRef={handStateRef}
        currentMode={mode}
        onModeChange={handleModeChange}
      />
    </div>
  );
};

export default App;