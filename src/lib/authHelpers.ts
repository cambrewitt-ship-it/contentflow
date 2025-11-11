import { createSupabaseWithToken } from './supabaseServer';
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
    .maybeSingle();

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
    // Ensure we get ONLY ONE project, and clients relationship returns a single object or an array (handle both cases)
    .select('id, clients(id, user_id)')
    .eq('id', projectId)
    .maybeSingle();

  // Defensive: clients may be an array or null or undefined
  let clientUserId: string | undefined;
  if (project && Array.isArray(project.clients) && project.clients.length > 0) {
    // clients is an array of client objects
    clientUserId = project.clients[0].user_id;
  } 

  if (error || !project || clientUserId !== auth.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ...auth, project };
}

export async function requirePostOwnership(request: Request, postId: string) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const { data: post, error } = await auth.supabase
    .from('posts')
    .select('id, clients(id, user_id)')
    .eq('id', postId)
    .maybeSingle();

  let clientUserId: string | undefined;
  if (post && Array.isArray(post.clients) && post.clients.length > 0) {
    clientUserId = post.clients[0].user_id;
  } 

  if (error || !post || clientUserId !== auth.user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ...auth, post };
}
