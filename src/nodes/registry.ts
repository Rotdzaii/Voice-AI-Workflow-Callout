import type { ComponentType } from 'react';
import type { NodeProps } from 'reactflow';

// Call
import { StartCallNode } from './call/StartCallNode';
import { PlayAudioNode } from './call/PlayAudioNode';
import { CollectSpeechNode } from './call/CollectSpeechNode';
import { EndCallNode } from './call/EndCallNode';

// Speech
import { SpeechToTextNode } from './speech/SpeechToTextNode';
import { TextToSpeechNode } from './speech/TextToSpeechNode';
import { LLMResponseNode } from './speech/LLMResponseNode';
import { SentimentNode } from './speech/SentimentNode';

// Logic
import { ConditionNode } from './logic/ConditionNode';
import { FallbackNode } from './logic/FallbackNode';
import { BreakNode } from './logic/BreakNode';

// Integration
import { HttpNode } from './integration/HttpNode';
import { CRMUpdateNode } from './integration/CRMUpdateNode';
import { WebhookNode } from './integration/WebhookNode';

// Utils
import { LogNode } from './utils/LogNode';

export type RegistryEntry = {
  type: string;
  title: string;
  component: ComponentType<NodeProps>;
  category: 'call' | 'speech' | 'logic' | 'integration' | 'utils';
};

export const NodeRegistry: RegistryEntry[] = [
  // Call
  { type: 'call.start', title: 'Start Call', component: StartCallNode, category: 'call' },
  { type: 'call.playAudio', title: 'Play Audio', component: PlayAudioNode, category: 'call' },
  { type: 'call.collectSpeech', title: 'Collect Speech', component: CollectSpeechNode, category: 'call' },
  { type: 'call.end', title: 'End Call', component: EndCallNode, category: 'call' },

  // Speech
  { type: 'speech.stt', title: 'Speech to Text', component: SpeechToTextNode, category: 'speech' },
  { type: 'speech.tts', title: 'Text to Speech', component: TextToSpeechNode, category: 'speech' },
  { type: 'speech.llm', title: 'LLM Response', component: LLMResponseNode, category: 'speech' },
  { type: 'speech.sentiment', title: 'Sentiment', component: SentimentNode, category: 'speech' },

  // Logic
  { type: 'logic.condition', title: 'Condition', component: ConditionNode, category: 'logic' },
  { type: 'logic.fallback', title: 'Fallback', component: FallbackNode, category: 'logic' },
  { type: 'logic.break', title: 'Break', component: BreakNode, category: 'logic' },

  // Integration
  { type: 'integration.http', title: 'HTTP', component: HttpNode, category: 'integration' },
  { type: 'integration.crmUpdate', title: 'CRM Update', component: CRMUpdateNode, category: 'integration' },
  { type: 'integration.webhook', title: 'Webhook', component: WebhookNode, category: 'integration' },

  // Utils
  { type: 'utils.log', title: 'Log', component: LogNode, category: 'utils' },
];

export function nodeTypesMap() {
  return Object.fromEntries(NodeRegistry.map((r) => [r.type, r.component]));
}
