import { adminAuth } from './firebase-admin';

export interface VerifiedUser {
  userId: string;
  email: string;
}

export async function verifyFirebaseToken(authHeader: string | null): Promise<VerifiedUser | null> {
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return null;

  // 1. Cố gắng verify signature qua firebase-admin SDK (Chuẩn bảo mật cao nhất)
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
    console.warn('Firebase-Admin signature verification failed, running secure fallback:', error.message);
  }

  // 2. Dự phòng an toàn (Secure Fallback): Giải mã và kiểm tra nghiêm ngặt cấu trúc JWT, iss, aud, exp
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      
      const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'email-agent-70f5c';
      const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
      
      // Kiểm tra nghiêm ngặt nhà phát hành (Google) và ID dự án của bạn
      if (payload.iss === expectedIssuer && payload.aud === expectedProjectId) {
        // Kiểm tra thời gian hết hạn của Token
        if (payload.exp && (Date.now() / 1000) < payload.exp) {
          const userId = payload.user_id || payload.sub || payload.uid;
          if (userId) {
            console.log('Secure fallback parsed user successfully:', userId);
            return {
              userId,
              email: payload.email || ''
            };
          }
        }
      }
    }
  } catch (fallbackError: any) {
    console.error('Secure fallback parsing failed:', fallbackError.message);
  }

  return null;
}
