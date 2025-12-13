import React, { useEffect, useRef } from 'react';
import { SceneController } from '../services/sceneService';
import { HandState, AppMode } from '../types';

interface ExperienceProps {
  handStateRef: React.MutableRefObject<HandState>;
  mode: AppMode;
  onLoaded: () => void;
  photoUrls: string[];
}

const Experience: React.FC<ExperienceProps> = ({ handStateRef, mode, onLoaded, photoUrls }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!canvasRef.current) return;

    const controller = new SceneController(canvasRef.current, handStateRef, onLoaded);
    controllerRef.current = controller;

    const handleResize = () => {
      controller.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      controller.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Mode
  useEffect(() => {
    controllerRef.current?.setMode(mode);
  }, [mode]);

  // Handle Photo URLs from Firebase
  useEffect(() => {
    if (controllerRef.current && photoUrls.length > 0) {
        photoUrls.forEach(url => {
            if (!loadedUrlsRef.current.has(url)) {
                controllerRef.current?.loadPhotoFromUrl(url);
                loadedUrlsRef.current.add(url);
            }
        });
    }
  }, [photoUrls]);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0" />;
};

export default Experience;