export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function speak(text: string, opts?: { voice?: SpeechSynthesisVoice; rate?: number; pitch?: number; volume?: number; lang?: string }) {
  if (!isTTSSupported() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (opts?.voice) u.voice = opts.voice;
  if (opts?.rate) u.rate = opts.rate;
  if (opts?.pitch) u.pitch = opts.pitch;
  if (opts?.volume) u.volume = opts.volume;
  if (opts?.lang) u.lang = opts.lang;
  window.speechSynthesis.speak(u);
}

export function cancelSpeak() {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
}
