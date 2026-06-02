export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT id, user_id as "userId", provider, updated_at as "updatedAt" FROM public.user_integrations'
    );
    return NextResponse.json({
      success: true,
      count: result.rows.length,
      rows: result.rows
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
