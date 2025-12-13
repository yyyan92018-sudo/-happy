import * as THREE from 'three';

export type AppMode = 'TREE' | 'SCATTER' | 'FOCUS' | 'GALLERY';

export interface HandState {
  detected: boolean;
  x: number;
  y: number;
  velocityX: number;
  landmarks: any; // MediaPipe landmarks
}

export interface AppState {
  mode: AppMode;
  focusTarget: THREE.Object3D | null;
  rotation: {
    x: number;
    y: number;
    velocity: number;
  };
}

export interface ParticleData {
  mesh: THREE.Mesh | THREE.Group;
  type: 'BOX' | 'GOLD_BOX' | 'GOLD_SPHERE' | 'RED' | 'CANE' | 'DUST' | 'SNOWFLAKE' | 'PHOTO';
  isDust: boolean;
  posTree: THREE.Vector3;
  posScatter: THREE.Vector3;
  baseScale: number;
  spinSpeed: THREE.Vector3;
  // Snowflake specific
  userData?: {
    fallSpeed: number;
    swaySpeed: number;
    swayAmount: number;
    initialX: number;
  };
}
