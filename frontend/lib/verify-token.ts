import { adminAuth } from './firebase-admin';

export interface VerifiedUser {
  userId: string;
  email: string;
}

export async function verifyFirebaseToken(authHeader: string | null): Promise<VerifiedUser | null> {
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return null;

  // Verify signature qua Firebase Admin SDK — xác thực chữ ký với Google public key
  // KHÔNG có fallback decode-only: decode base64 không verify chữ ký, attacker có thể forge token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    if (userId) {
      return {
        userId,
        email: decodedToken.email || ''
      };
    }
  } catch (error: any) {
    console.warn('Firebase token verification failed:', error.message);
  }

  return null;
}
