// FDI two-digit tooth numbering (frame 12's "Tooth" selector). Purely a UI
// reference grid -- there's no `toothRef` field on charges/course items yet
// (Sec 16.1: dental-beachhead decision is still open), so selection here is
// local UI state, not persisted structured data.
export const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28] as const;
export const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38] as const;
