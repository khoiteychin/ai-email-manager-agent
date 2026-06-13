export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { verifyFirebaseToken } from '@/lib/verify-token';

export async function DELETE(
  request: Request,
  { params }: { params: { provider: string } }
) {
  // ── 1. Authenticate the request ─────────────────────────────────────────

  const { searchParams } = new URL(request.url);
  const tokenQuery = searchParams.get('token');
  const authHeader =
    request.headers.get('authorization') ||
    (tokenQuery ? `Bearer ${tokenQuery}` : null);

  const user = await verifyFirebaseToken(authHeader);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Validate provider param ───────────────────────────────────────────
  const provider = params.provider; // e.g. "gmail" | "discord" | "telegram"
  if (!provider) {
    return NextResponse.json({ error: 'Missing provider' }, { status: 400 });
  }

  try {
    const pool = getDbPool();

    // ── 3. Remove connection status row ─────────────────────────────────────

    await pool.query(
      'DELETE FROM public.user_integrations WHERE user_id = $1 AND provider = $2',
      [user.userId, provider]
    );

    // ── 4. Clear provider-specific credentials ──────────────────────────────

    if (provider === 'gmail') {

      await pool.query(
        `UPDATE public.gmail_accounts
         SET access_token  = NULL,
             refresh_token = NULL,
             history_id    = NULL,
             watch_expiry  = NULL
         WHERE user_id = $1`,
        [user.userId]
      );

    } else if (provider === 'discord') {

      await pool.query(
        `UPDATE public.discord_accounts
         SET discord_id = NULL,
             channel_id = NULL
         WHERE user_id = $1`,
        [user.userId]
      );
    }

    // ── 5. Respond success ───────────────────────────────────────────────────
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Disconnect DB Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
