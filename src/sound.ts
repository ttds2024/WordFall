import clickedUrl from './audio/clicked.mp3';
import successUrl from './audio/success.mp3';

export type SoundName = 'clicked' | 'success';

const URLS: Record<SoundName, string> = { clicked: clickedUrl, success: successUrl };

/**
 * The game's sound effects (src/audio), played through Web Audio so they start at once, even on
 * phones. The audio context is created on the first sound, which always follows a tap, since
 * browsers only allow audio to start from one. Sounds load on first use; one that fails to load
 * stays silent.
 */
export class Sounds {
  /** Off means silent; set from Settings. */
  enabled = true;
  private context: AudioContext | undefined;
  private readonly buffers = new Map<SoundName, Promise<AudioBuffer | undefined>>();

  play(name: SoundName): void {
    if (!this.enabled || typeof AudioContext === 'undefined') return;
    try {
      this.context ??= new AudioContext();
    } catch {
      return;
    }
    const context = this.context;
    if (context.state === 'suspended') void context.resume();
    void this.buffer(context, name).then((buffer) => {
      if (!buffer || !this.enabled) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    });
  }

  private buffer(context: AudioContext, name: SoundName): Promise<AudioBuffer | undefined> {
    let buffer = this.buffers.get(name);
    if (!buffer) {
      buffer = fetch(URLS[name])
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .catch(() => undefined);
      this.buffers.set(name, buffer);
    }
    return buffer;
  }
}
