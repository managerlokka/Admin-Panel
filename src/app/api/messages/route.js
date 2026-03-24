import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/messages — list all sent messages
export async function GET() {
  try {
    await requireAdmin();
    const { data, error } = await supabaseAdmin
      .from('admin_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}

// POST /api/messages — send a new message to subscribers
export async function POST(request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const { title, message, target_plans, priority } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    // target_plans: ['all'] or ['trial','starter','pro','enterprise']
    const plans = target_plans || ['all'];

    // Count recipients
    let query = supabaseAdmin.from('subscriptions').select('id, customer_id', { count: 'exact' });
    if (!plans.includes('all')) {
      query = query.in('plan', plans);
    }
    const { count: recipientCount } = await query;

    // Store the message
    const { data: msg, error } = await supabaseAdmin.from('admin_messages').insert({
      title,
      message,
      target_plans: plans,
      priority: priority || 'normal',
      sent_by: admin.id,
      sent_by_name: admin.display_name || admin.email,
      recipient_count: recipientCount || 0,
      status: 'sent',
    }).select().single();

    if (error) throw error;

    // Log action
    await supabaseAdmin.from('admin_actions').insert({
      admin_user_id: admin.id,
      action_type: 'send_message',
      action_note: `Sent message "${title}" to ${plans.join(', ')} (${recipientCount} recipients)`,
      metadata: { message_id: msg.id, target_plans: plans, priority },
    });

    return NextResponse.json({ success: true, message_id: msg.id, recipient_count: recipientCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}

// DELETE /api/messages — delete a message
export async function DELETE(request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    await supabaseAdmin.from('admin_messages').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 500 });
  }
}
