/** The one external integration used by GagaOfferLite. */
export const integrations: Record<string, { billing: 'developer' | 'user'; anonymous?: boolean }> = {
  openai: { billing: 'developer', anonymous: false },
}
