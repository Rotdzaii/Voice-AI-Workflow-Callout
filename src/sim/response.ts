import type { NLUResult } from './nlu';

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in vars ? vars[k] : ''));
}

export function generateResponse(nlu: NLUResult, vars: Record<string, string>): string {
  const v = vars || {};
  switch (nlu.intent) {
    case 'greeting':
      return fillTemplate('Chào {{name}}! Mình có thể giúp gì cho bạn?', v);
    case 'ask_support':
      return 'Bạn vui lòng mô tả vấn đề để mình hỗ trợ chi tiết nhé.';
    case 'place_order':
      return 'Bạn muốn đặt sản phẩm nào và số lượng bao nhiêu?';
    case 'cancel_order':
      return 'Mình sẽ hỗ trợ hủy đơn, bạn cung cấp mã đơn giúp mình nhé.';
    case 'return_order':
      return 'Bạn vui lòng cho biết lý do đổi trả và mã đơn hàng.';
    case 'empty':
      return '';
    default:
      return 'Mình chưa hiểu ý bạn, bạn có thể nói rõ hơn không?';
  }
}
