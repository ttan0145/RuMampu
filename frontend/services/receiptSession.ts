/* Session holder for the most recently picked receipt photo.
   The base64 payload is large, so it lives here instead of in app state
   (which is deep-cloned on every update). Cleared once a scan resolves. */

export interface PickedReceipt {
  base64: string;
  mediaType: string;
}

let picked: PickedReceipt | null = null;

export function setPickedReceipt(value: PickedReceipt | null): void {
  picked = value;
}

export function getPickedReceipt(): PickedReceipt | null {
  return picked;
}
