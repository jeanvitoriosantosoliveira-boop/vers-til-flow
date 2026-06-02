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
      return j({ error: 'Autorização necessária' }, 401);
    }

    const jwt = authHeader.substring(7);
    const userClient = createClient(SUPABASE_URL, ANON, { 
      global: { headers: { Authorization: `Bearer ${jwt}` } } 
    });
    
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return j({ error: 'Sessão inválida ou expirada' }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerRoles, error: rolesError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return j({ error: 'Erro ao verificar permissões' }, 500);
    }

    const isLeader = (callerRoles ?? []).some((r: any) => r.role === 'leader');
    if (!isLeader) {
      return j({ error: 'Apenas líderes podem remover colaboradores' }, 403);
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return j({ error: 'user_id é obrigatório' }, 400);
    }
    if (user_id === caller.id) {
      return j({ error: 'Você não pode remover a si mesmo' }, 400);
    }

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) {
      console.error('Error deleting user:', error);
      return j({ error: error.message || 'Falha ao remover usuário' }, 400);
    }

    return j({ ok: true });
  } catch (e: any) {
    console.error('Unexpected error in delete-user:', e);
    return j({ error: e?.message ?? 'Erro interno do servidor' }, 500);
  }
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { 
    status: s, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
}