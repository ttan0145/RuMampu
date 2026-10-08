/* Speech recognition events reach every listener in the app. The Ask Ruma
   chat and the Say an entry card both listen, so whichever one started the
   microphone owns the events and the other ignores them. */
export type SpeechOwner = 'assistant' | 'say' | null;

let owner: SpeechOwner = null;

export function getSpeechOwner(): SpeechOwner {
  return owner;
}

/** Claim the single speech-recognition session for one feature.
 *
 * Event ownership alone is not enough: if the other surface is still
 * listening, changing `owner` would merely hide its events while leaving its
 * microphone open. Abort the old recognizer before handing ownership over.
 */
export function claimSpeechOwner(next: Exclude<SpeechOwner, null>, abort: () => void): void {
  if (owner !== null) {
    try { abort(); } catch { /* the previous recognizer had already ended */ }
  }
  owner = next;
}

export function releaseSpeechOwner(current: Exclude<SpeechOwner, null>): void {
  if (owner === current) owner = null;
}

/* Recognition follows the language chosen in RuMampu, not the device's. */
export function speechLocale(lang: 'en' | 'ms' | 'zh'): string {
  if (lang === 'ms') return 'ms-MY';
  if (lang === 'zh') return 'zh-CN';
  return 'en-MY';
}
