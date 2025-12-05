// Extend Express session types for TypeScript
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userEmail?: string;
    userName?: string;
    userRole?: 'admin' | 'editor' | 'viewer';
    centerIds?: number[];
    editorFor?: number[];
  }
}
