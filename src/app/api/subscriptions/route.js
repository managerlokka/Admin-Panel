import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import crypto from 'crypto';

function generateKey(plan) {
  const prefix = plan === 'lifetime' ? 'LTM' : plan === 'enterprise' ? 'ENT' : plan === 'pro' ? 'PRO' : plan === 'starter' ? 'STR' : 'TRL';
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `MLK-${prefix}-${part1}-${part2}`;
}

// GET /api/subscriptions — list all subscriptions with customer data
export async function GET(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const plan = searchParams.get('plan') || '';

    let query = supabaseAdmin
      .from('subscriptions')
      .select('*, customers(id, full_name, email, phone)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (plan) query = query.eq('plan', plan);

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];

    // Client-side search filter (Supabase doesn't easily do joins + ilike)
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(s =>
        s.customers?.full_name?.toLowerCase().includes(q) ||
        s.customers?.email?.toLowerCase().includes(q) ||
        s.customers?.phone?.includes(q) ||
        s.subscription_key?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}

// POST /api/subscriptions — create new subscription + customer
export async function POST(request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { full_name, email, phone, plan, status, billing_start, billing_end, trial_end, billing_term } = body;

    if (!full_name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Determine billing_term
    let finalBillingTerm = billing_term || 'monthly';
    const finalPlan = plan || 'trial';
    if (finalPlan === 'lifetime') finalBillingTerm = 'lifetime';
    if (!['monthly', 'yearly', 'two_year', 'lifetime'].includes(finalBillingTerm)) finalBillingTerm = 'monthly';

    // Create or find customer
    let customerId;
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        customerId = existing.id;
        // Update name/phone
        await supabaseAdmin.from('customers').update({ full_name, phone }).eq('id', customerId);
      }
    }

    if (!customerId) {
      const { data: newCustomer, error: custErr } = await supabaseAdmin
        .from('customers')
        .insert({ full_name, email, phone })
        .select('id')
        .single();
      if (custErr) throw custErr;
      customerId = newCustomer.id;
    }

    // Generate subscription key
    const subscriptionKey = generateKey(finalPlan);

    const now = new Date();
    const nowISO = now.toISOString();

    // Calculate billing_end based on billing_term
    let calcBillingEnd = billing_end || null;
    if (!calcBillingEnd && finalPlan !== 'trial') {
      if (finalBillingTerm === 'monthly') calcBillingEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      else if (finalBillingTerm === 'yearly') calcBillingEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
      else if (finalBillingTerm === 'two_year') calcBillingEnd = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString();
      // lifetime: stays null
    }

    const subData = {
      customer_id: customerId,
      subscription_key: subscriptionKey,
      plan: finalPlan,
      billing_term: finalBillingTerm,
      status: status || (finalPlan === 'trial' ? 'trial' : 'active'),
      trial_start: finalPlan === 'trial' || !plan ? nowISO : null,
      trial_end: trial_end || (finalPlan === 'trial' || !plan ? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString() : null),
      billing_start: billing_start || (finalPlan !== 'trial' ? nowISO : null),
      billing_end: calcBillingEnd,
    };

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .insert(subData)
      .select('*, customers(id, full_name, email, phone)')
      .single();

    if (subErr) throw subErr;

    // Create initial usage cycle (monthly cycles for all plans)
    if (finalPlan !== 'trial' && subData.billing_start) {
      const cycleEnd = (finalBillingTerm === 'monthly' && calcBillingEnd)
        ? calcBillingEnd
        : new Date(new Date(subData.billing_start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from('usage_cycles').insert({
        subscription_id: sub.id,
        cycle_start: subData.billing_start,
        cycle_end: cycleEnd,
      });
    }

    await supabaseAdmin.from('admin_actions').insert({
      admin_user_id: admin.id,
      subscription_id: sub.id,
      customer_id: customerId,
      action_type: 'subscription_created',
      action_note: `Created ${finalPlan} (${finalBillingTerm}) subscription for ${full_name}`,
    });

    await supabaseAdmin.from('visitor_events').insert({
      event_type: finalPlan === 'trial' ? 'trial_signup' : 'account_created',
      customer_id: customerId,
    });

    return NextResponse.json(sub, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
