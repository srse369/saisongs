// Extend Express Request type for TypeScript
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'admin' | 'editor' | 'viewer';
        centerIds: number[];
        editorFor: number[];
      };
    }
  }
}

export {};
