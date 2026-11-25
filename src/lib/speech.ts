/* Browser speech: narration (TTS) and dictation (speech recognition). */
import { useEffect, useState } from 'react';
import type { Lang } from './store';

let voices: SpeechSynthesisVoice[] = [];
const load = () => { try { voices = window.speechSynthesis.getVoices() || []; } catch { voices = []; } };
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  load();
  window.speechSynthesis.onvoiceschanged = load;
}
const pick = (l: Lang) => {
  if (!voices.length) load();
  const m = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(l));
  return m.find((v) => /-IN/i.test(v.lang)) || m[0] || null;
};
const listeners = new Set<(on: boolean) => void>();
const emit = (on: boolean) => listeners.forEach((f) => f(on));

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
  emit(false);
}
export function speak(text: string, lang: Lang, done?: () => void) {
  if (!ttsSupported() || !text) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pick(lang);
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = lang === 'hi' ? 0.96 : 1;
  if (v) u.voice = v;
  u.onend = u.onerror = () => { emit(false); done?.(); };
  emit(true);
  window.speechSynthesis.speak(u);
  return true;
}
export function useSpeaking() {
  const [on, set] = useState(false);
  useEffect(() => { listeners.add(set); return () => { listeners.delete(set); }; }, []);
  return on;
}

type SR = { lang: string; interimResults: boolean; onresult: (e: any) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
export function dictate(lang: Lang, onText: (t: string) => void, onEnd: () => void): (() => void) | null {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: SR = new Ctor();
  r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  r.interimResults = true;
  r.onresult = (e: any) => onText(Array.from(e.results).map((x: any) => x[0].transcript).join(''));
  r.onend = onEnd;
  r.onerror = onEnd;
  try { r.start(); } catch { onEnd(); return null; }
  return () => r.stop();
}
