// api/webhook.js
// Vercel Serverless Function for Webhooks (Razorpay, Instagram, etc.)

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || 'https://uvnksakgjupnivmfkjcv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bmtzYWtnanVwbml2bWZramN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzM5NzYsImV4cCI6MjA4MTQ0OTk3Nn0.gM5hYGxnUI-n_zM-iut8Dml1T5593YhH5A9HNo8hovA';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const webhookType = req.query.type || 'razorpay';
    
    try {
        switch (webhookType) {
            case 'razorpay':
                return await handleRazorpayWebhook(req, res);
            
            case 'instagram':
                return await handleInstagramWebhook(req, res);
            
            default:
                return res.status(400).json({ error: 'Unknown webhook type' });
        }
        
    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// ══════════════════════════════════════════════════════════════════
// RAZORPAY WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════════════
async function handleRazorpayWebhook(req, res) {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    
    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    
    if (signature !== expectedSignature) {
        console.log('Invalid Razorpay webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
    }
    
    const event = req.body.event;
    const payload = req.body.payload;
    
    console.log('Razorpay webhook received:', event);
    
    switch (event) {
        case 'payment.captured':
            await handlePaymentCaptured(payload.payment.entity);
            break;
        
        case 'payment.failed':
            await handlePaymentFailed(payload.payment.entity);
            break;
        
        case 'subscription.activated':
            await handleSubscriptionActivated(payload.subscription.entity);
            break;
        
        case 'subscription.cancelled':
            await handleSubscriptionCancelled(payload.subscription.entity);
            break;
    }
    
    return res.status(200).json({ received: true });
}

async function handlePaymentCaptured(payment) {
    const { notes, id, amount } = payment;
    
    if (!notes?.userId || !notes?.plan) {
        console.log('Missing payment notes');
        return;
    }
    
    // Get user email
    const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', notes.userId)
        .single();
    
    // Record payment
    await supabase.from('payments').insert({
        user_id: notes.userId,
        user_email: profile?.email,
        plan: notes.plan,
        billing_type: notes.billingType || 'monthly',
        amount: amount / 100,
        method: 'razorpay',
        payment_id: id,
        status: 'completed',
        created_at: new Date().toISOString()
    });
    
    // Update user plan
    const planLimits = { starter: 500, pro: 2000, enterprise: 999999 };
    const expiryDate = new Date();
    
    if (notes.billingType === 'yearly') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
    }
    
    await supabase
        .from('profiles')
        .update({
            plan: notes.plan,
            plan_expiry: expiryDate.toISOString(),
            dms_limit: planLimits[notes.plan] || 100,
            dms_used: 0
        })
        .eq('id', notes.userId);
    
    console.log(`Payment captured for user ${notes.userId}, plan: ${notes.plan}`);
}

async function handlePaymentFailed(payment) {
    const { notes, id, error_description } = payment;
    
    if (!notes?.userId) return;
    
    await supabase.from('payments').insert({
        user_id: notes.userId,
        plan: notes.plan,
        billing_type: notes.billingType,
        amount: payment.amount / 100,
        method: 'razorpay',
        payment_id: id,
        status: 'failed',
        error: error_description,
        created_at: new Date().toISOString()
    });
    
    console.log(`Payment failed for user ${notes.userId}`);
}

async function handleSubscriptionActivated(subscription) {
    console.log('Subscription activated:', subscription.id);
    // Handle subscription activation
}

async function handleSubscriptionCancelled(subscription) {
    console.log('Subscription cancelled:', subscription.id);
    // Handle subscription cancellation
}

// ══════════════════════════════════════════════════════════════════
// INSTAGRAM WEBHOOK HANDLER (For future Instagram Graph API)
// ══════════════════════════════════════════════════════════════════
async function handleInstagramWebhook(req, res) {
    // Verify webhook (Facebook/Instagram verification)
    if (req.query['hub.mode'] === 'subscribe') {
        const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'instabot_verify';
        
        if (req.query['hub.verify_token'] === verifyToken) {
            return res.status(200).send(req.query['hub.challenge']);
        }
        return res.status(403).json({ error: 'Verification failed' });
    }
    
    // Handle webhook events
    const { object, entry } = req.body;
    
    if (object === 'instagram') {
        for (const e of entry) {
            // Handle messaging events
            if (e.messaging) {
                for (const msg of e.messaging) {
                    await handleInstagramMessage(msg);
                }
            }
            
            // Handle changes (comments, mentions, etc.)
            if (e.changes) {
                for (const change of e.changes) {
                    await handleInstagramChange(change);
                }
            }
        }
    }
    
    return res.status(200).json({ received: true });
}

async function handleInstagramMessage(message) {
    console.log('Instagram message received:', message);
    
    // In production:
    // 1. Find the user who owns this Instagram account
    // 2. Check their automation settings
    // 3. Match against keywords
    // 4. Send auto-reply if configured
}

async function handleInstagramChange(change) {
    console.log('Instagram change:', change.field, change.value);
    
    // Handle different change types:
    // - comments
    // - mentions
    // - story_insights
}
