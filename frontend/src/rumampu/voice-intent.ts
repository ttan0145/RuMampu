export type VoiceIntent =
  | { kind: 'entry'; entryText: string }
  | { kind: 'question'; questionText: string }
  | { kind: 'mixed'; entryText: string; questionText: string }
  | { kind: 'ambiguous'; text: string }
  | { kind: 'unknown'; text: string };

const QUESTION_START = /^(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may|berapa|adakah|boleh|kenapa|apa|bila)\b|^(?:我能|可以|能否|多少|什么|為什麼|为什么)/i;
const QUESTION_AFTER_AND = /\s+and\s+(?=(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may)\b)/gi;
const QUESTION_AFTER_COMMA = /,\s*(?=(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may|berapa|adakah|boleh)\b)/gi;
const ENGLISH_RECORD_REQUEST = /^(?:can|could|would|should|will|may)\s+(?:you|u|i|we)\s+(?:please\s+)?(?:help\s+(?:me\s+)?)?(?:add|record|log|save|enter|set|change|update)\b/i;
const MALAY_RECORD_REQUEST = /^(?:(?:boleh(?:kah)?\s+(?:(?:awak|anda|kamu|saya)\s+)?(?:tolong\s+)?)|(?:tolong\s+))?(?:bantu(?:\s+saya)?\s+)?(?:tambah|masukkan|rekod|catat|simpan|tetapkan|ubah)\b/i;
const CHINESE_RECORD_REQUEST = /^(?:(?:可以|能否|可否|请|請)\s*)?(?:(?:帮|幫)(?:我|忙)?\s*)?(?:添加|新增|记录|記錄|录入|錄入|输入|輸入|设置|設定|更改|修改|保存)/;
const isRecordRequest = (text: string): boolean =>
  ENGLISH_RECORD_REQUEST.test(text) || MALAY_RECORD_REQUEST.test(text) || CHINESE_RECORD_REQUEST.test(text);
const ENTRY_WORDS = /\b(?:spent|spend|paid|pay|earned|earn|income|expense|bought|received|got|add|record|log)\b|\b(?:belanja|beli|bayar|dapat|gaji|terima|rekod|catat)\b|花|收入|赚|買|买|吃|加油/i;
/* Speech services can transcribe "add" as "at". A stated amount and target
   make this a reviewable entry request when a separate question follows. */
const SPOKEN_HELP_ENTRY = /^(?:can|could|would)\s+you\s+(?:please\s+)?help\s+me\s+(?:add|at)\s+(?:rm\s*)?\d+(?:[.,]\d+)?\b.*\b(?:in|for|on)\s+\p{L}/iu;

function partKind(part: string): 'entry' | 'question' | 'ambiguous' | 'unknown' {
  const words = part.trim();
  const startsQuestion = QUESTION_START.test(words);
  const hasQuestionMark = /[?？]\s*$/.test(words);
  const hasEntryWords = ENTRY_WORDS.test(words);
  // A polite request to record something is still an instruction. The entry
  // reader proposes a draft; the user must review it and tap Save afterward.
  if (isRecordRequest(words)) {
    if (/^(?:can|could|would|should|will|may)\s+(?:i|we)\b/i.test(words)) return 'ambiguous';
    return 'entry';
  }
  if (startsQuestion) return 'question';
  if (hasQuestionMark || /吗\s*$/.test(words)) return hasEntryWords ? 'ambiguous' : 'question';
  if (hasEntryWords) return 'entry';
  return 'unknown';
}

/** Keep only clearly separated entries in Say it. Uncertain intent never becomes a saveable draft. */
export function classifyVoiceIntent(text: string): VoiceIntent {
  const said = text.trim();
  const parts = said
    .replace(QUESTION_AFTER_AND, ' | ')
    .replace(QUESTION_AFTER_COMMA, ' | ')
    .replace(/([!?。！？;]|\.(?!\d))\s*/g, '$1 | ')
    .split('|').map(part => part.trim()).filter(Boolean);
  const kinds = parts.map((part, index) => {
    const kind = partKind(part);
    return kind === 'question' && parts.length > 1 && index < parts.length - 1
      && !/[?？]\s*$/.test(part) && SPOKEN_HELP_ENTRY.test(part) ? 'entry' : kind;
  });
  if (kinds.includes('ambiguous')) return { kind: 'ambiguous', text: said };
  const entries = parts.filter((_, index) => kinds[index] === 'entry');
  const questions = parts.filter((_, index) => kinds[index] === 'question');
  if (entries.length && questions.length) {
    if (kinds.includes('unknown')) return { kind: 'ambiguous', text: said };
    return { kind: 'mixed', entryText: entries.join(' and then '), questionText: questions.join(' ') };
  }
  if (questions.length && !entries.length) return { kind: 'question', questionText: said };
  if (entries.length) return { kind: 'entry', entryText: said };
  return { kind: 'unknown', text: said };
}

/** Ask Ruma may answer a question without asking the action reader to propose a write. */
export function isQuestionWithoutRecordInstruction(text: string): boolean {
  const intent = classifyVoiceIntent(text);
  return intent.kind === 'question'
    || (intent.kind === 'ambiguous' && !isRecordRequest(text.trim()));
}
