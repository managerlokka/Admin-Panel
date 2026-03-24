import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/actions — perform admin actions on subscriptions
export async function POST(request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { action, subscription_id, data } = body;

    if (!action || !subscription_id) {
      return NextResponse.json({ error: 'Action and subscription_id required' }, { status: 400 });
    }

    // Fetch current subscription
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*, customers(id, full_name)')
      .eq('id', subscription_id)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    let updateData = { updated_at: new Date().toISOString() };
    let actionNote = '';

    switch (action) {
      case 'change_plan': {
        const newPlan = data.plan;
        if (!['starter', 'pro', 'enterprise'].includes(newPlan)) {
          return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }
        const now = new Date();
        const billingEnd = data.billing_end
          ? new Date(data.billing_end)
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        updateData.plan = newPlan;
        updateData.status = 'active';
        updateData.billing_start = now.toISOString();
        updateData.billing_end = billingEnd.toISOString();

        // Auto-create usage cycle for the new billing period
        await supabaseAdmin.from('usage_cycles').insert({
          subscription_id,
          cycle_start: now.toISOString(),
          cycle_end: billingEnd.toISOString(),
        });

        actionNote = `Plan changed to ${newPlan} for ${sub.customers?.full_name}. Billing: ${now.toLocaleDateString()} → ${billingEnd.toLocaleDateString()}`;
        break;
      }

      case 'extend_trial': {
        if (!data.trial_end) {
          return NextResponse.json({ error: 'New trial_end date required' }, { status: 400 });
        }
        updateData.trial_end = data.trial_end;
        updateData.status = 'trial';
        actionNote = `Trial extended to ${data.trial_end} for ${sub.customers?.full_name}`;
        break;
      }

      case 'extend_billing': {
        if (!data.billing_end) {
          return NextResponse.json({ error: 'New billing_end date required' }, { status: 400 });
        }
        updateData.billing_end = data.billing_end;
        actionNote = `Billing extended to ${data.billing_end} for ${sub.customers?.full_name}`;
        break;
      }

      case 'suspend': {
        updateData.status = 'suspended';
        actionNote = `Subscription suspended for ${sub.customers?.full_name}`;
        break;
      }

      case 'reactivate': {
        updateData.status = sub.plan === 'trial' ? 'trial' : 'active';
        actionNote = `Subscription reactivated for ${sub.customers?.full_name}`;
        break;
      }

      case 'reset_device': {
        // Check reset limit (max 2 per month)
        const lastReset = sub.last_device_reset_at ? new Date(sub.last_device_reset_at) : null;
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (!data.admin_override && sub.device_reset_count >= 2 && lastReset && lastReset > oneMonthAgo) {
          return NextResponse.json({ error: 'Device reset limit reached (max 2 per month). Use admin override.' }, { status: 400 });
        }

        updateData.device_id = null;
        updateData.device_bound_at = null;
        updateData.device_reset_count = (sub.device_reset_count || 0) + 1;
        updateData.last_device_reset_at = new Date().toISOString();
        actionNote = `Device reset for ${sub.customers?.full_name}`;
        break;
      }

      case 'mark_payment': {
        // Create payment record
        await supabaseAdmin.from('payments').insert({
          subscription_id,
          cycle_start: data.cycle_start || sub.billing_start,
          cycle_end: data.cycle_end || sub.billing_end,
          plan_price: data.amount || 0,
          total_due: data.amount || 0,
          payment_status: 'paid',
          paid_at: data.payment_date || new Date().toISOString(),
          note: data.note || '',
        });
        actionNote = `Payment of LKR ${data.amount} marked for ${sub.customers?.full_name}`;
        break;
      }

      case 'adjust_usage': {
        // Manual usage adjustment — the ONLY way to modify usage count
        // Used for exceptional cases (billing errors, test orders, etc.)
        const newCount = parseInt(data.new_count, 10);
        if (isNaN(newCount) || newCount < 0) {
          return NextResponse.json({ error: 'Valid new_count (≥ 0) required' }, { status: 400 });
        }
        if (!data.reason) {
          return NextResponse.json({ error: 'Reason is required for usage adjustments' }, { status: 400 });
        }
        // Find the current usage cycle
        const { data: cycle } = await supabaseAdmin
          .from('usage_cycles')
          .select('*')
          .eq('subscription_id', subscription_id)
          .order('cycle_start', { ascending: false })
          .limit(1)
          .single();
        if (cycle) {
          await supabaseAdmin.from('usage_cycles').update({
            orders_count: newCount,
            updated_at: new Date().toISOString()
          }).eq('id', cycle.id);
        }
        actionNote = `Usage adjusted to ${newCount} for ${sub.customers?.full_name}. Reason: ${data.reason}`;
        break;
      }

      case 'delete_subscription': {
        // Permanently delete unwanted trial/expired signups
        if (!data.confirm) {
          return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
        }

        // Log before deletion
        await supabaseAdmin.from('admin_actions').insert({
          admin_user_id: admin.id,
          subscription_id,
          customer_id: sub.customer_id,
          action_type: 'delete_subscription',
          action_note: `Deleted subscription ${sub.subscription_key} (${sub.plan}) for ${sub.customers?.full_name}. Reason: ${data.reason || 'Unwanted trial signup'}`,
          metadata: { subscription_key: sub.subscription_key, plan: sub.plan },
        });

        // Delete usage cycles
        await supabaseAdmin.from('usage_cycles').delete().eq('subscription_id', subscription_id);

        // Delete the subscription
        await supabaseAdmin.from('subscriptions').delete().eq('id', subscription_id);

        // Delete the customer if they have no other subscriptions
        const { data: otherSubs } = await supabaseAdmin
          .from('subscriptions')
          .select('id')
          .eq('customer_id', sub.customer_id);

        if (!otherSubs || otherSubs.length === 0) {
          await supabaseAdmin.from('customers').delete().eq('id', sub.customer_id);
        }

        return NextResponse.json({ success: true, action: 'delete_subscription', note: `Deleted subscription for ${sub.customers?.full_name}` });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Update subscription
    if (action !== 'mark_payment') {
      await supabaseAdmin.from('subscriptions').update(updateData).eq('id', subscription_id);
    }

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      admin_user_id: admin.id,
      subscription_id,
      customer_id: sub.customer_id,
      action_type: action,
      action_note: data.note ? `${actionNote}. Note: ${data.note}` : actionNote,
      metadata: data,
    });

    // Track conversion event
    if (action === 'change_plan' && sub.plan === 'trial') {
      await supabaseAdmin.from('visitor_events').insert({
        event_type: 'paid_conversion',
        customer_id: sub.customer_id,
        metadata: { from: 'trial', to: data.plan },
      });
    }

    return NextResponse.json({ success: true, action, note: actionNote });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
