import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/dashboard — fetch all summary stats
export async function GET() {
  try {
    await requireAdmin();

    // Fetch all subscriptions with customer data
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('*, customers(full_name, email)');

    const all = subs || [];

    // Counts
    const total = all.length;
    const trialActive = all.filter(s => s.status === 'trial' && s.trial_end && new Date(s.trial_end) > new Date()).length;
    const trialExpired = all.filter(s => s.status === 'trial' && s.trial_end && new Date(s.trial_end) <= new Date()).length;
    const activeStarter = all.filter(s => s.status === 'active' && s.plan === 'starter').length;
    const activePro = all.filter(s => s.status === 'active' && s.plan === 'pro').length;
    const activeEnterprise = all.filter(s => s.status === 'active' && s.plan === 'enterprise').length;
    const activeLifetime = all.filter(s => s.status === 'active' && s.plan === 'lifetime').length;
    const expired = all.filter(s => s.status === 'expired').length + trialExpired;
    const suspended = all.filter(s => s.status === 'suspended').length;

    // Expiring soon (3 days) — skip lifetime (no billing_end)
    const now = new Date();
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = all.filter(s =>
      s.status === 'active' && s.billing_end &&
      new Date(s.billing_end) <= threeDays && new Date(s.billing_end) > now
    ).length;

    // Plan config for revenue
    const { data: planConfig } = await supabaseAdmin.from('plan_config').select('*');
    const prices = {};
    (planConfig || []).forEach(p => { prices[p.plan] = p; });

    // Revenue estimates — billing_term-aware
    const activePaidSubs = all.filter(s => s.status === 'active' && s.plan !== 'trial');
    let starterRevenue = 0, proRevenue = 0, enterpriseBaseRevenue = 0, lifetimeRevenue = 0;

    activePaidSubs.forEach(s => {
      const pc = prices[s.plan];
      if (!pc) return;
      const term = s.billing_term || 'monthly';

      // Get the correct price based on billing_term
      let price = pc.monthly_price;
      if (term === 'yearly' && pc.yearly_price) price = pc.yearly_price;
      else if (term === 'two_year' && pc.two_year_price) price = pc.two_year_price;

      if (s.plan === 'starter') starterRevenue += Number(price);
      else if (s.plan === 'pro') proRevenue += Number(price);
      else if (s.plan === 'enterprise') enterpriseBaseRevenue += Number(price);
      else if (s.plan === 'lifetime') lifetimeRevenue += Number(price);
    });

    // Fetch usage for enterprise extra orders
    const enterpriseSubs = all.filter(s => s.status === 'active' && s.plan === 'enterprise');
    let enterpriseExtraRevenue = 0;
    if (enterpriseSubs.length > 0) {
      const { data: usageCycles } = await supabaseAdmin
        .from('usage_cycles')
        .select('*')
        .in('subscription_id', enterpriseSubs.map(s => s.id))
        .gte('cycle_end', now.toISOString());

      (usageCycles || []).forEach(u => {
        if (u.extra_orders > 0) {
          enterpriseExtraRevenue += u.extra_orders * (prices.enterprise?.extra_order_price || 5);
        }
      });
    }

    const totalRevenue = starterRevenue + proRevenue + enterpriseBaseRevenue + enterpriseExtraRevenue + lifetimeRevenue;

    // Usage near limit
    const { data: allUsage } = await supabaseAdmin
      .from('usage_cycles')
      .select('*, subscriptions(plan, status)')
      .gte('cycle_end', now.toISOString());

    let nearLimit = 0;
    (allUsage || []).forEach(u => {
      const plan = u.subscriptions?.plan;
      const limit = prices[plan]?.order_limit || 0;
      if (limit > 0 && u.orders_used >= limit * 0.8) nearLimit++;
    });

    // Recent events
    const { data: recentActions } = await supabaseAdmin
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Visitor tracking
    const { data: events } = await supabaseAdmin
      .from('visitor_events')
      .select('event_type');

    const trialSignups = (events || []).filter(e => e.event_type === 'trial_signup').length;
    const paidConversions = (events || []).filter(e => e.event_type === 'paid_conversion').length;
    const conversionRate = trialSignups > 0 ? ((paidConversions / trialSignups) * 100).toFixed(1) : '0';

    return NextResponse.json({
      counts: {
        total,
        trialActive,
        activeStarter,
        activePro,
        activeEnterprise,
        activeLifetime,
        expired,
        suspended,
        expiringSoon,
        nearLimit,
      },
      revenue: {
        starterRevenue,
        proRevenue,
        enterpriseBaseRevenue,
        enterpriseExtraRevenue,
        lifetimeRevenue,
        totalRevenue,
      },
      conversion: {
        trialSignups,
        paidConversions,
        conversionRate,
      },
      recentActions: recentActions || [],
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
