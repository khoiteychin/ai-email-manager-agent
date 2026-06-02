export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/verify-token';

export async function DELETE(request: Request, { params }: { params: { provider: string } }) {
  const { searchParams } = new URL(request.url);
  const tokenQuery = searchParams.get('token');
  
  const authHeader = request.headers.get('authorization') || (tokenQuery ? `Bearer ${tokenQuery}` : null);
  const user = await verifyFirebaseToken(authHeader);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provider = params.provider;
  if (!provider) {
    return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
  }

  try {
    const pool = getDbPool();
    await pool.query(
      'DELETE FROM public.user_integrations WHERE user_id = $1 AND provider = $2',
      [user.userId, provider]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DB Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

