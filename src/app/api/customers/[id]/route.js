import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Customer
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Subscription
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const subscription = subs?.[0] || null;

    // Current usage cycle
    let usage = null;
    if (subscription) {
      const { data: cycles } = await supabaseAdmin
        .from('usage_cycles')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('cycle_end', { ascending: false })
        .limit(1);
      usage = cycles?.[0] || null;
    }

    // Payments
    let payments = [];
    if (subscription) {
      const { data: pmts } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false });
      payments = pmts || [];
    }

    // Admin actions
    const { data: actions } = await supabaseAdmin
      .from('admin_actions')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      customer,
      subscription,
      usage,
      payments,
      actions: actions || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}

// PUT /api/customers/[id] — update customer profile
export async function PUT(request, { params }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const { full_name, email, phone, notes } = body;

    const updateData = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      admin_user_id: admin.id,
      customer_id: id,
      action_type: 'customer_updated',
      action_note: `Updated profile for ${data.full_name}. Fields: ${Object.keys(body).join(', ')}`,
      metadata: body,
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
