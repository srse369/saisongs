// Export all contexts and hooks for convenient importing
export { SongProvider, useSongs } from './SongContext';
export { SingerProvider, useSingers } from './SingerContext';
export { PitchProvider, usePitches } from './PitchContext';
export { TemplateProvider, useTemplates } from './TemplateContext';
export { ToastProvider, useToast } from './ToastContext';
export type { Toast, ToastType } from './ToastContext';
export { NamedSessionProvider, useNamedSessions } from './NamedSessionContext';
