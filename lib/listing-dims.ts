// Auto-set shipping dimensions from the Buy-It-Now price.
//
// Rule:
//   BIN >= $20  → 11 × 6 × 1 (standard bubble mailer for higher-value cards)
//   BIN <  $20  → 10 × 4 × 1 (smaller mailer, cheaper postage on cheap cards)
//
// We only auto-apply when the current dims are still at ONE of these
// two known presets — i.e. the operator hasn't typed a custom size.
// Once they customize, their value sticks even if the BIN changes
// later. To opt back in, set dims back to one of the presets and the
// auto behavior resumes.

export const DIMS_HIGH = { dimLength: 11, dimWidth: 6, dimHeight: 1 } as const;
export const DIMS_LOW  = { dimLength: 10, dimWidth: 4, dimHeight: 1 } as const;
const BIN_THRESHOLD = 20;

export function dimsForBIN(bin: number): typeof DIMS_HIGH | typeof DIMS_LOW {
  return bin >= BIN_THRESHOLD ? DIMS_HIGH : DIMS_LOW;
}

export function isAutoDimsPreset(L: number, W: number, H: number): boolean {
  return (L === DIMS_HIGH.dimLength && W === DIMS_HIGH.dimWidth && H === DIMS_HIGH.dimHeight)
      || (L === DIMS_LOW.dimLength  && W === DIMS_LOW.dimWidth  && H === DIMS_LOW.dimHeight);
}

/** Returns the dim update to apply, or null if dims are user-customized
 *  (don't override). For an empty BIN, returns null too — don't touch dims. */
export function autoDimsForBINChange(
  bin: number,
  currentL: number,
  currentW: number,
  currentH: number,
): { dimLength: number; dimWidth: number; dimHeight: number } | null {
  if (bin <= 0) return null;
  if (!isAutoDimsPreset(currentL, currentW, currentH)) return null;
  return dimsForBIN(bin);
}
