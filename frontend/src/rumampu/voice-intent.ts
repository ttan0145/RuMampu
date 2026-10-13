export type VoiceIntent =
  | { kind: 'entry'; entryText: string }
  | { kind: 'question'; questionText: string }
  | { kind: 'mixed'; entryText: string; questionText: string }
  | { kind: 'ambiguous'; text: string }
  | { kind: 'unknown'; text: string };

const QUESTION_START = /^(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may|berapa|adakah|boleh|kenapa|apa|bila)\b|^(?:我能|可以|能否|多少|什么|為什麼|为什么)/i;
const QUESTION_AFTER_AND = /\s+and\s+(?=(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may)\b)/gi;
const QUESTION_AFTER_COMMA = /,\s*(?=(?:how|what|why|where|when|who|which|is|are|do|did|does|will|can|could|would|should|may|berapa|adakah|boleh)\b)/gi;
const RECORD_REQUEST = /^(?:can|could|would|should|will|may)\s+(?:you|u|i|we)\s+(?:please\s+)?(?:help\s+(?:me\s+)?)?(?:add|record|log|save|enter|set|change|update)\b|^boleh\s+(?:saya|awak)\s+(?:rekod|catat|simpan)\b/i;
const ENTRY_WORDS = /\b(?:spent|spend|paid|pay|earned|earn|income|expense|bought|received|got|add|record|log)\b|\b(?:belanja|beli|bayar|dapat|gaji|terima|rekod|catat)\b|花|收入|赚|買|买|吃|加油/i;

function partKind(part: string): 'entry' | 'question' | 'ambiguous' | 'unknown' {
  const words = part.trim();
  const startsQuestion = QUESTION_START.test(words);
  const hasQuestionMark = /[?？]\s*$/.test(words);
  const hasEntryWords = ENTRY_WORDS.test(words);
  if (RECORD_REQUEST.test(words)) return 'ambiguous';
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
  const kinds = parts.map(partKind);
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
    || (intent.kind === 'ambiguous' && !RECORD_REQUEST.test(text.trim()));
}
