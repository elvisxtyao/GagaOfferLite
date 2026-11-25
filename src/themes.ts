export const THEMES = [{ id: 'gaga', label: 'GagaOfferLite', description: 'A calm, light application workspace.' }] as const
export type ThemeId = (typeof THEMES)[number]['id']
export function getActiveTheme(): ThemeId { return 'gaga' }
export function getTheme(_id: string) { return THEMES[0] }
