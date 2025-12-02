import { useCallback, useEffect, useRef, useState } from 'react';

export type STTResult = {
  transcript: string;
  isFinal: boolean;
};

export default function SpeechToText({ onResult, lang = 'vi-VN' }: { onResult: (r: STTResult) => void; lang?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionImpl: typeof SpeechRecognition | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionImpl) {
      setSupported(true);
      const rec = new SpeechRecognitionImpl();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0].transcript;
          onResult({ transcript, isFinal: res.isFinal });
        }
      };
      rec.onend = () => {
        setListening(false);
      };
      recognitionRef.current = rec as SpeechRecognition;
    }
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, [lang, onResult]);

  const start = useCallback(() => {
    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch {}
  }, []);
  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
      setListening(false);
    } catch {}
  }, []);

  if (!supported) {
    return <div style={{ color: '#ef4444' }}>Trình duyệt không hỗ trợ SpeechRecognition.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={start} disabled={listening} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: 'white' }}>Start</button>
      <button onClick={stop} disabled={!listening} style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: 'white' }}>Stop</button>
      <span>{listening ? 'Listening...' : 'Idle'}</span>
    </div>
  );
}
