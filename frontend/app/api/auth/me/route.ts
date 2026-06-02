export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verify-token';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const user = await verifyFirebaseToken(authHeader);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    userId: user.userId,
    email: user.email,
    valid: true
  });
}

