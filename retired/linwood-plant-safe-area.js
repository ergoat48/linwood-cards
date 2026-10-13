/* Linwood Plant Card · Safe Area v1.0.0 — keeps the humidifier popup clear of the iPhone status bar / Dynamic Island
 * and home indicator. The Home Assistant iOS app draws edge to edge (viewport-fit=cover), so the popup's old fixed
 * 12px margin let its top (and the Close button) slide under the time and battery. The dialog is now laid out inside
 * the safe area: 12px below the status bar, 12px above the home indicator, still centred, same as before on desktop.
 * Adds its CSS to the card's own stylesheet, so it reaches the <dialog> in the card's shadow root.
 * Stands down once the card has this built in (LinwoodPlantCard.lpcSafe >= 1) — fold it in at the next card rebuild. */
(() => {
  const CSS = `<style>
dialog.hx {
  --hx-t: calc(env(safe-area-inset-top, 0px) + 12px);
  --hx-b: calc(env(safe-area-inset-bottom, 0px) + 12px);
  inset: var(--hx-t) 0 var(--hx-b);
  margin: auto;
  width: min(720px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  max-height: calc(100dvh - var(--hx-t) - var(--hx-b));
}
dialog.hx .hxw { max-height: calc(100dvh - var(--hx-t) - var(--hx-b)); }
</style>`;
  const apply = (C) => {
    if (!C || C.lpcSafe >= 1 || C.prototype.__lpcSafe || typeof C.prototype._css !== 'function') return;
    const base = C.prototype._css;
    C.prototype._css = function () { return base.call(this) + CSS; };
    /* a card drawn before this loaded picks the new rules up the moment its popup opens */
    const open = C.prototype._hxOpen;
    if (typeof open === 'function') C.prototype._hxOpen = function (...a) { if (!this.__lpcSafeOk) { this.__lpcSafeOk = 1; this._paint(); } return open.apply(this, a); };
    C.prototype.__lpcSafe = 1;
  };
  const C = customElements.get('linwood-plant-card');
  if (C) apply(C);
  else customElements.whenDefined('linwood-plant-card').then(() => apply(customElements.get('linwood-plant-card')));
})();
