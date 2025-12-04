import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// NOTE: Set up CORS for local development.
// For production, configure this through the Supabase Dashboard: https://supabase.com/dashboard/project/_/functions/invite-user/details
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // The user's JWT is sent in the Authorization header.
    // The Edge Function needs to be invoked with the Authorization header.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing Authorization header.");
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      throw userError;
    }
    
    // Check if the user has the 'superadmin' or 'admin' role.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !['superadmin', 'admin'].includes(profile?.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { email, name, role } = await req.json();

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'Email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the admin client to invite the user.
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email, 
        { 
            data: {
                name: name || email.split('@')[0],
                role: role,
            },
            redirectTo: `${Deno.env.get('SITE_URL')}/#/`,
        }
    );

    if (error) {
      throw error;
    }

    // Additionally, create an entry in the public.invitations table for tracking.
    const { error: inviteError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email: email,
        role: role,
        name: name || email.split('@')[0],
        status: 'pending',
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (inviteError) {
        // Log the error but don't fail the entire operation, 
        // as the auth invitation was already sent.
        console.error("Failed to create tracking invitation:", inviteError);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
