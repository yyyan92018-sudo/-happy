import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandState, AppMode } from '../types';

interface WebcamFeedProps {
  handStateRef: React.MutableRefObject<HandState>;
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const WebcamFeed: React.FC<WebcamFeedProps> = ({ handStateRef, currentMode, onModeChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const lastVideoTimeRef = useRef(-1);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let animationId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        if (navigator.mediaDevices?.getUserMedia && videoRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
          });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsReady(true);
            predictWebcam();
          };
        }
      } catch (error) {
        console.error('MediaPipe error:', error);
      }
    };

    setupMediaPipe();

    const predictWebcam = () => {
      animationId = requestAnimationFrame(predictWebcam);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!video || !canvas || !ctx) return;

      // Draw Video
      if (video.readyState >= 2) {
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
          ctx.restore();
      }

      if (video.currentTime !== lastVideoTimeRef.current && landmarkerRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const result = landmarkerRef.current.detectForVideo(video, performance.now());
        
        processGestures(result, ctx, canvas.width, canvas.height);
      }
    };

    return () => {
      cancelAnimationFrame(animationId);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once

  const processGestures = (result: any, ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const handState = handStateRef.current;

    if (result.landmarks && result.landmarks.length > 0) {
      handState.detected = true;
      const lm = result.landmarks[0];
      handState.landmarks = lm;

      // Update position
      const newX = (lm[9].x - 0.5) * 2;
      handState.velocityX = (newX - handState.x) * 60; // FPS approx
      handState.x = newX;
      handState.y = (lm[9].y - 0.5) * 2;

      // Draw Skeleton
      drawSkeleton(ctx, lm, w, h);

      // Gesture Logic Variables
      const wrist = lm[0];
      const thumb = lm[4]; 
      const index = lm[8]; 
      const middle = lm[12]; 
      const ring = lm[16]; 
      const pinky = lm[20];

      // Helper: Distance from wrist
      const distToWrist = (point: any) => Math.hypot(point.x - wrist.x, point.y - wrist.y);

      // 1. Pinch Detection (Thumb tip to Index tip)
      const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);

      // 2. Finger Extensions (Distance from wrist)
      const indexDist = distToWrist(index);
      const middleDist = distToWrist(middle);
      const ringDist = distToWrist(ring);
      const pinkyDist = distToWrist(pinky);

      // Peace Sign Logic: Index & Middle Extended, Ring & Pinky Folded
      // Adjusted thresholds: Extended > 0.30, Folded < 0.35 (More lenient)
      const isPeaceSign = 
        indexDist > 0.30 && 
        middleDist > 0.30 && 
        ringDist < 0.35 && 
        pinkyDist < 0.35;

      // Average extension of 4 fingers (excluding thumb) for Open vs Closed hand
      const avgFingerDist = (indexDist + middleDist + ringDist + pinkyDist) / 4;

      let newMode = currentMode;

      // Priority: Peace > Pinch > Fist (Tree) / Open (Scatter)
      if (isPeaceSign) {
        newMode = 'GALLERY';
      } else if (pinchDist < 0.08) { // Increased from 0.05 for easier triggering
        newMode = 'FOCUS';
      } else if (avgFingerDist < 0.28) { // Increased from 0.25 for easier fist detection
        newMode = 'TREE';
      } else if (avgFingerDist > 0.38) { // Decreased from 0.40 for easier open palm detection
        newMode = 'SCATTER';
      }

      if (newMode !== currentMode) {
        onModeChange(newMode);
      }

    } else {
      handState.detected = false;
      handState.landmarks = null;
      handState.velocityX = 0;
    }
  };

  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[], w: number, h: number) => {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';

    connections.forEach(([start, end]) => {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(w - p1.x * w, p1.y * h);
        ctx.lineTo(w - p2.x * w, p2.y * h);
        ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255, 215, 100, 1)';
    landmarks.forEach((lm) => {
        ctx.beginPath();
        ctx.arc(w - lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  return (
    <div className="absolute bottom-28 left-10 w-60 h-44 border-2 border-yellow-500/50 rounded-xl overflow-hidden bg-black/80 shadow-2xl backdrop-blur-md z-20 pointer-events-none transition-opacity duration-500"
         style={{ opacity: isReady ? 1 : 0 }}>
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} width={240} height={180} className="w-full h-full block rounded-lg" />
    </div>
  );
};

export default WebcamFeed;