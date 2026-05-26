import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return j({ error: 'Missing auth' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return j({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerRoles } = await admin.from('user_roles').select('role').eq('user_id', caller.id);
    const isLeader = (callerRoles ?? []).some((r: any) => r.role === 'leader');
    if (!isLeader) return j({ error: 'Apenas líderes podem remover colaboradores' }, 403);

    const { user_id } = await req.json();
    if (!user_id) return j({ error: 'user_id obrigatório' }, 400);
    if (user_id === caller.id) return j({ error: 'Você não pode remover a si mesmo' }, 400);

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return j({ error: error.message }, 400);
    return j({ ok: true });
  } catch (e: any) {
    return j({ error: e?.message ?? 'Erro interno' }, 500);
  }
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}