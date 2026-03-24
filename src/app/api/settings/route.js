import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/settings — fetch plan config
export async function GET() {
  try {
    await requireAdmin();
    const { data } = await supabaseAdmin.from('plan_config').select('*').order('monthly_price');
    return NextResponse.json({ plans: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/settings — update a plan config field
export async function PUT(request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { plan, ...updates } = body;

    if (!plan) return NextResponse.json({ error: 'Plan required' }, { status: 400 });

    updates.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from('plan_config').update(updates).eq('plan', plan);
    if (error) throw error;

    // Log
    await supabaseAdmin.from('admin_actions').insert({
      admin_user_id: admin.id,
      action_type: 'plan_config_updated',
      action_note: `Updated ${plan} config: ${JSON.stringify(updates)}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
