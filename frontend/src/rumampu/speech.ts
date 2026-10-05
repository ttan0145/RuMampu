/* Speech recognition events reach every listener in the app. The Ask Ruma
   chat and the Say an entry card both listen, so whichever one started the
   microphone owns the events and the other ignores them. */
export type SpeechOwner = 'assistant' | 'say' | null;

let owner: SpeechOwner = null;

export function getSpeechOwner(): SpeechOwner {
  return owner;
}

export function setSpeechOwner(next: SpeechOwner): void {
  owner = next;
}

/* Recognition follows the language chosen in RuMampu, not the device's. */
export function speechLocale(lang: 'en' | 'ms' | 'zh'): string {
  if (lang === 'ms') return 'ms-MY';
  if (lang === 'zh') return 'zh-CN';
  return 'en-MY';
}
