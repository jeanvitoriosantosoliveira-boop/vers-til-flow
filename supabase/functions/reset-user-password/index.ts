import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Autorização necessária' }, 401);
    }

    const jwt = authHeader.substring(7);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: 'Sessão inválida ou expirada' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerRoles, error: rolesError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return json({ error: 'Erro ao verificar permissões' }, 500);
    }

    const isLeader = (callerRoles ?? []).some((r: any) => r.role === 'leader');
    if (!isLeader) {
      return json({ error: 'Apenas líderes podem alterar senhas de colaboradores' }, 403);
    }

    const { user_id, password } = await req.json();
    if (!user_id || !password) {
      return json({ error: 'user_id e password são obrigatórios' }, 400);
    }

    if (user_id === caller.id) {
      return json({ error: 'Altere sua própria senha pela tela de perfil' }, 400);
    }

    if (typeof password !== 'string' || password.length < 6) {
      return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    }

    const { error } = await admin.auth.admin.updateUserById(user_id, { password });
    if (error) {
      console.error('Error resetting user password:', error);
      return json({ error: error.message || 'Falha ao alterar senha' }, 400);
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error('Unexpected error in reset-user-password:', e);
    return json({ error: e?.message ?? 'Erro interno do servidor' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
