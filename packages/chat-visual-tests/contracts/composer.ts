// Shared behavior cases for the real app composer and Create's simulated data.
export const composerDraftCases = [
  { name: "Empty", draft: "", hasAttachments: false, canSend: false },
  { name: "Whitespace", draft: "  ", hasAttachments: false, canSend: false },
  {
    name: "Text",
    draft: "A native composer message",
    hasAttachments: false,
    canSend: true,
  },
  { name: "Attachment only", draft: "", hasAttachments: true, canSend: true },
  {
    name: "Over limit",
    draft: "x".repeat(16_001),
    hasAttachments: true,
    canSend: false,
  },
] as const;
