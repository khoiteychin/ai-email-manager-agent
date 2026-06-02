import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/verify-token';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenQuery = searchParams.get('token');
  
  const authHeader = request.headers.get('authorization') || (tokenQuery ? `Bearer ${tokenQuery}` : null);
  const user = await verifyFirebaseToken(authHeader);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Chú ý: Firebase xử lý Profile, ta chỉ trả về các thông tin cơ bản có trong Token
  return NextResponse.json({
    userId: user.userId,
    email: user.email,
    name: '', // verifyIdToken does not always have name, default to empty
  });
}

export async function PATCH(request: Request) {
  // Frontend cập nhật profile qua Firebase SDK, đây chỉ là endpoint rỗng để không bị lỗi
  return NextResponse.json({ success: true });
}

