// Minimal SpeechRecognition ambient types for TS
// Covers standard and webkit implementations

declare interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare interface SpeechRecognitionResult extends ArrayLike<SpeechRecognitionAlternative> {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

declare interface SpeechRecognitionResultList extends ArrayLike<SpeechRecognitionResult> {
  [index: number]: SpeechRecognitionResult;
}

declare interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onaudioend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult?: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart?: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart?: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare var SpeechRecognition: {
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};
