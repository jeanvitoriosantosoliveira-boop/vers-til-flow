import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) return json({ error: 'Missing auth' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: 'Invalid session' }, 401);

    // Verify caller is leader or manager
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const callerRoles = (roles ?? []).map((r: any) => r.role);
    if (!callerRoles.includes('leader') && !callerRoles.includes('manager')) {
      return json({ error: 'Sem permissão' }, 403);
    }

    const body = await req.json();
    const {
      email,
      password,
      name,
      role = 'collaborator',
      position,
      phone,
      hourly_rate,
      contract_start,
      contract_end,
      team_ids = [],
    } = body;

    if (!email || !password || !name) return json({ error: 'Campos obrigatórios faltando' }, 400);
    if (password.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    // Only leader may create leaders/managers
    if ((role === 'leader' || role === 'manager' || role === 'commercial') && !callerRoles.includes('leader')) {
      return json({ error: 'Apenas líderes podem criar gerentes, líderes ou comerciais' }, 403);
    }

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? 'Falha ao criar usuário' }, 400);
    const newUserId = created.user.id;

    // Update profile extras
    await admin.from('profiles').update({
      name, position, phone, hourly_rate, contract_start, contract_end,
    }).eq('id', newUserId);

    // Always replace any default role inserted by handle_new_user with the chosen one
    {
      const delRes = await admin.from('user_roles').delete().eq('user_id', newUserId);
      if (delRes.error) console.error('delete role failed', delRes.error);
      const insRes = await admin.from('user_roles').insert({ user_id: newUserId, role });
      if (insRes.error) console.error('insert role failed', insRes.error);
    }

    // Add to teams
    if (Array.isArray(team_ids) && team_ids.length) {
      const rows = team_ids.map((tid: string) => ({ team_id: tid, user_id: newUserId, role_in_team: role === 'manager' ? 'manager' : 'member' }));
      await admin.from('team_members').insert(rows);
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Erro interno' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}