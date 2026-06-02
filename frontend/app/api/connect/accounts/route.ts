export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/verify-token';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenQuery = searchParams.get('token');
  const userIdQuery = searchParams.get('user_id');
  
  const authHeader = request.headers.get('authorization') || (tokenQuery ? `Bearer ${tokenQuery}` : null);
  const user = await verifyFirebaseToken(authHeader);
  
  const finalUserId = user?.userId || userIdQuery;
  
  if (!finalUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT provider, updated_at as "updatedAt" FROM public.user_integrations WHERE user_id = $1',
      [finalUserId]
    );

    const accounts = result.rows.map(r => ({
      provider: r.provider,
      updatedAt: r.updatedAt || new Date().toISOString(),
      metadata: {
        email: r.provider === 'gmail' ? 'Connected' : undefined,
        username: r.provider === 'discord' ? 'Connected' : undefined
      }
    }));

    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error('DB Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

