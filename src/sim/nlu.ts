export type NLUResult = {
  intent: string;
  entities: Record<string, string>;
  sentiment: 'positive' | 'neutral' | 'negative';
};

const viSentiment = {
  positive: ['tuyệt', 'tốt', 'hài lòng', 'ok', 'ổn'],
  negative: ['tệ', 'không hài lòng', 'bực', 'giận', 'khó chịu', 'chán'],
};

function detectSentimentVi(text: string): NLUResult['sentiment'] {
  const lower = text.toLowerCase();
  if (viSentiment.positive.some((w) => lower.includes(w))) return 'positive';
  if (viSentiment.negative.some((w) => lower.includes(w))) return 'negative';
  return 'neutral';
}

function detectIntentVi(text: string): { intent: string; entities: Record<string, string> } {
  const lower = text.toLowerCase();
  const entities: Record<string, string> = {};

  if (/(xin chào|chào|hello|hi)\b/.test(lower)) return { intent: 'greeting', entities };
  if (/hỗ trợ|giúp|trợ giúp/.test(lower)) return { intent: 'ask_support', entities };
  if (/đặt hàng|mua|order/.test(lower)) return { intent: 'place_order', entities };
  if (/hủy đơn|hủy đặt|cancel/.test(lower)) return { intent: 'cancel_order', entities };
  if (/trả hàng|đổi trả|return/.test(lower)) return { intent: 'return_order', entities };

  const nameMatch = lower.match(/tên (tôi|mình) là\s+([\p{L} ]+)/u);
  if (nameMatch) entities.name = nameMatch[2].trim();
  const phoneMatch = lower.match(/(sdt|số điện thoại)[^\d]*(\d{9,11})/);
  if (phoneMatch) entities.phone = phoneMatch[2];

  return { intent: 'unknown', entities };
}

export function analyze(text: string, lang: 'vi' | 'en' = 'vi'): NLUResult {
  if (!text.trim()) return { intent: 'empty', entities: {}, sentiment: 'neutral' };
  if (lang === 'vi') {
    const { intent, entities } = detectIntentVi(text);
    return { intent, entities, sentiment: detectSentimentVi(text) };
  }
  // simple default
  return { intent: 'unknown', entities: {}, sentiment: 'neutral' };
}
