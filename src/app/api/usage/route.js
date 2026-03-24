import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date().toISOString();

    // Fetch active usage cycles with subscription + customer data
    const { data: cycles } = await supabaseAdmin
      .from('usage_cycles')
      .select('*, subscriptions(plan, status, customer_id, customers(full_name))')
      .gte('cycle_end', now)
      .order('cycle_end', { ascending: true });

    // Fetch plan config
    const { data: planConfig } = await supabaseAdmin.from('plan_config').select('*');
    const plans = {};
    (planConfig || []).forEach(p => { plans[p.plan] = p; });

    const result = (cycles || []).map(c => {
      const plan = c.subscriptions?.plan || 'starter';
      const config = plans[plan] || { order_limit: 0, extra_order_price: 0, hard_stop: true };
      const extra = Math.max(0, c.orders_used - config.order_limit);
      return {
        id: c.id,
        customer_name: c.subscriptions?.customers?.full_name || '—',
        plan,
        cycle_start: c.cycle_start,
        cycle_end: c.cycle_end,
        orders_used: c.orders_used,
        order_limit: config.order_limit,
        hard_stop: config.hard_stop,
        extra_orders: extra,
        extra_charge: extra * (config.extra_order_price || 0),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
