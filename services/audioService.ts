import { SOUNDS } from '../constants';

class AudioService {
  private context: AudioContext | null = null;

  constructor() {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  playModeSound(mode: string) {
    if (!this.context) return;
    this.resume();

    const key = mode.toLowerCase() as keyof typeof SOUNDS;
    const sound = SOUNDS[key];
    if (!sound) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = sound.type as OscillatorType;
    oscillator.frequency.value = sound.freq;

    gainNode.gain.setValueAtTime(0.05, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.4);
  }
}

export const audioService = new AudioService();
