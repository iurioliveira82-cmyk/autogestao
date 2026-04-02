import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
  empresaId?: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    // In a real SaaS, we'd fetch the user's empresaId from Firestore or custom claims
    // For now, we'll assume it's passed in headers or we'll fetch it in the controller
    req.empresaId = req.headers['x-empresa-id'] as string;
    
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    const userRole = req.user.role as string || 'user';
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
};
