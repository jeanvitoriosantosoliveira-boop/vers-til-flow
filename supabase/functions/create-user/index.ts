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

    const jwt = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return json({ error: 'Sessão inválida ou expirada' }, 401);
    }

    // Verify caller is leader or manager
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roles, error: rolesError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    
    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return json({ error: 'Erro ao verificar permissões' }, 500);
    }

    const callerRoles = (roles ?? []).map((r: any) => r.role);
    if (!callerRoles.includes('leader') && !callerRoles.includes('manager')) {
      return json({ error: 'Sem permissão para criar usuários' }, 403);
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

    if (!email || !password || !name) {
      return json({ error: 'Campos obrigatórios: email, password, name' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
    }
    if (!['collaborator', 'manager', 'commercial', 'studio', 'leader'].includes(role)) {
      return json({ error: 'Nível inválido' }, 400);
    }

    // Only leader may create elevated or specialized profiles.
    if ((role === 'leader' || role === 'manager' || role === 'commercial' || role === 'studio') && !callerRoles.includes('leader')) {
      return json({ error: 'Apenas líderes podem criar gerentes, líderes, comerciais ou studio' }, 403);
    }

    // Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'Falha ao criar usuário' }, 400);
    }
    const newUserId = created.user.id;

    // Update profile with additional info
    const { error: profileError } = await admin.from('profiles').update({
      name,
      position,
      phone,
      hourly_rate,
      contract_start,
      contract_end,
    }).eq('id', newUserId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Continue anyway, this is not critical
    }

    // Set role atomically: first delete any existing, then insert the chosen role
    // Note: Due to auth trigger, a default 'collaborator' role might be auto-inserted
    const { error: deleteError } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', newUserId);

    if (deleteError) {
      console.error('Error deleting old roles:', deleteError);
    }

    const { error: insertError } = await admin
      .from('user_roles')
      .insert([{ user_id: newUserId, role }]);

    if (insertError) {
      console.error('Error inserting role:', insertError);
      return json({ error: 'Falha ao atribuir nível de acesso' }, 500);
    }

    // Add to teams if specified
    if (Array.isArray(team_ids) && team_ids.length > 0) {
      const teamRows = team_ids.map((tid: string) => ({
        team_id: tid,
        user_id: newUserId,
        role_in_team: role === 'manager' ? 'manager' : 'member',
      }));
      
      const { error: teamError } = await admin
        .from('team_members')
        .insert(teamRows);

      if (teamError) {
        console.error('Error adding to teams:', teamError);
        // Don't fail the entire operation for this
      }
    }

    return json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    console.error('Unexpected error in create-user:', e);
    return json({ error: e?.message ?? 'Erro interno do servidor' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}