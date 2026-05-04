import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // e.g. "2026-05"

    let query = supabaseAdmin
      .from('usage_cycles')
      .select('*, subscriptions(plan, status, billing_term, subscription_key, customer_id, customers(full_name, email, phone))')
      .order('cycle_start', { ascending: false });

    if (month) {
      // Filter cycles that overlap with the given month
      // Month starts at YYYY-MM-01 00:00:00 and ends at the last moment of the month
      const [year, mon] = month.split('-').map(Number);
      const monthStart = new Date(year, mon - 1, 1).toISOString();
      const monthEnd = new Date(year, mon, 0, 23, 59, 59).toISOString();
      // Cycle overlaps if cycle_start <= monthEnd AND cycle_end >= monthStart
      query = query.lte('cycle_start', monthEnd).gte('cycle_end', monthStart);
    }

    const { data: cycles, error } = await query;

    if (error) {
      console.error('Usage query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch plan config
    const { data: planConfig } = await supabaseAdmin.from('plan_config').select('*');
    const plans = {};
    (planConfig || []).forEach(p => { plans[p.plan] = p; });

    // Get all available months from cycles for the month selector
    const monthsSet = new Set();
    (cycles || []).forEach(c => {
      if (c.cycle_start) {
        const d = new Date(c.cycle_start);
        monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });

    const result = (cycles || []).map(c => {
      const plan = c.subscriptions?.plan || 'starter';
      const config = plans[plan] || { order_limit: 0, extra_order_price: 0, hard_stop: true };
      const extra = Math.max(0, (c.orders_used || 0) - config.order_limit);
      return {
        id: c.id,
        subscription_id: c.subscription_id,
        customer_name: c.subscriptions?.customers?.full_name || '—',
        customer_email: c.subscriptions?.customers?.email || '',
        customer_phone: c.subscriptions?.customers?.phone || '',
        subscription_key: c.subscriptions?.subscription_key || '',
        plan,
        status: c.subscriptions?.status || '—',
        billing_term: c.subscriptions?.billing_term || 'monthly',
        cycle_start: c.cycle_start,
        cycle_end: c.cycle_end,
        orders_used: c.orders_used || 0,
        order_limit: config.order_limit,
        hard_stop: config.hard_stop,
        extra_orders: extra,
        extra_charge: extra * (config.extra_order_price || 0),
      };
    });

    return NextResponse.json({
      cycles: result,
      available_months: Array.from(monthsSet).sort().reverse(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
