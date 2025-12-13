export const CONFIG = {
  colors: {
    bg: 0x000000,
    champagneGold: 0xffd966,
    deepGreen: 0x03180a,
    accentRed: 0x990000,
  },
  particles: {
    count: 1500,
    dustCount: 2500,
    treeHeight: 24,
    treeRadius: 8
  },
  camera: {
    z: 50
  }
};

export const SOUNDS = {
  tree: { freq: 440, type: 'sine' },
  scatter: { freq: 880, type: 'square' },
  focus: { freq: 660, type: 'triangle' },
  gallery: { freq: 550, type: 'sawtooth' }
} as const;

// IMPORTANT: Add your photo filenames here exactly as they appear in your folder
// You must create a folder named 'photos' in the root directory and put these files there.
export const STATIC_PHOTOS = [
  // Example files - replace these with your actual file names
  // "1.jpg",
  // "christmas_2023.png",
  // "family.jpg"
];