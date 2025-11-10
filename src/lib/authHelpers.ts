import { createSupabaseWithToken } from './supabase-server';
import { NextResponse } from 'next/server';

export async function requireAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseWithToken(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { user, supabase, token };
}

export async function requireClientOwnership(request: Request, clientId: string) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const { data: client, error } = await auth.supabase
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .single();

  if (error || !client || client.user_id !== auth.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ...auth, client };
}

export async function requireProjectOwnership(request: Request, projectId: string) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const { data: project, error } = await auth.supabase
    .from('projects')
    .select('id, client:clients!inner(user_id)')
    .eq('id', projectId)
    .single();

  if (error || !project || project.client.user_id !== auth.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ...auth, project };
}

export async function requirePostOwnership(request: Request, postId: string) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const { data: post, error } = await auth.supabase
    .from('posts')
    .select('id, client:clients!inner(user_id)')
    .eq('id', postId)
    .single();

  if (error || !post || post.client.user_id !== auth.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ...auth, post };
}

