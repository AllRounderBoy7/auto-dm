// api/admin.js
// Vercel Serverless Function for Admin Operations

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://uvnksakgjupnivmfkjcv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bmtzYWtnanVwbml2bWZramN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzM5NzYsImV4cCI6MjA4MTQ0OTk3Nn0.gM5hYGxnUI-n_zM-iut8Dml1T5593YhH5A9HNo8hovA';

// ══════════════════════════════════════════════════════════════════
// 🔑 ADMIN EMAILS - YAHAN APNE ADMIN EMAILS ADD KARO
// ══════════════════════════════════════════════════════════════════
const ADMIN_EMAILS = ['admin@instabot.ai', 'your-email@example.com'];
const MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'admin123';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Verify admin access
    const authHeader = req.headers.authorization;
    const masterKey = req.headers['x-master-key'];
    
    if (masterKey !== MASTER_KEY) {
        // Verify via auth token
        if (!authHeader) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user || !ADMIN_EMAILS.includes(user.email)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }
    
    try {
        const { action } = req.body;
        
        switch (action) {
            case 'get-stats':
                return await getAdminStats(res);
            
            case 'get-users':
                return await getUsers(res, req.body);
            
            case 'update-user':
                return await updateUser(res, req.body);
            
            case 'delete-user':
                return await deleteUser(res, req.body.userId);
            
            case 'get-payments':
                return await getPayments(res, req.body);
            
            case 'update-payment':
                return await updatePayment(res, req.body);
            
            case 'update-prices':
                return await updatePrices(res, req.body.prices);
            
            case 'get-settings':
                return await getSettings(res);
            
            case 'update-settings':
                return await updateSettings(res, req.body.settings);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (error) {
        console.error('Admin Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// ══════════════════════════════════════════════════════════════════
// GET ADMIN STATS
// ══════════════════════════════════════════════════════════════════
async function getAdminStats(res) {
    // Get total users
    const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
    
    // Get active subscriptions
    const { count: activeSubscriptions } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('plan', 'free');
    
    // Get total revenue
    const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed');
    
    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    
    // Get total DMs
    const { data: profiles } = await supabase
        .from('profiles')
        .select('dms_used');
    
    const totalDms = profiles?.reduce((sum, p) => sum + (p.dms_used || 0), 0) || 0;
    
    // Get Instagram accounts count
    const { count: totalIgAccounts } = await supabase
        .from('instagram_accounts')
        .select('*', { count: 'exact', head: true });
    
    return res.status(200).json({
        success: true,
        stats: {
            totalUsers: totalUsers || 0,
            activeSubscriptions: activeSubscriptions || 0,
            totalRevenue: totalRevenue,
            totalDms: totalDms,
            totalIgAccounts: totalIgAccounts || 0
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// GET USERS
// ══════════════════════════════════════════════════════════════════
async function getUsers(res, { page = 1, limit = 10, filter, search }) {
    let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (filter && filter !== 'all') {
        if (filter === 'blocked') {
            query = query.eq('status', 'blocked');
        } else {
            query = query.eq('plan', filter);
        }
    }
    
    if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    
    const { data, error, count } = await query
        .range((page - 1) * limit, page * limit - 1);
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        users: data || [],
        total: count || 0,
        page: page,
        limit: limit
    });
}

// ══════════════════════════════════════════════════════════════════
// UPDATE USER
// ══════════════════════════════════════════════════════════════════
async function updateUser(res, { userId, updates }) {
    const { error } = await supabase
        .from('profiles')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        message: 'User updated successfully'
    });
}

// ══════════════════════════════════════════════════════════════════
// DELETE USER
// ══════════════════════════════════════════════════════════════════
async function deleteUser(res, userId) {
    // Delete related data
    await supabase.from('instagram_accounts').delete().eq('user_id', userId);
    await supabase.from('keywords').delete().eq('user_id', userId);
    await supabase.from('dm_logs').delete().eq('user_id', userId);
    await supabase.from('payments').delete().eq('user_id', userId);
    
    // Delete profile
    await supabase.from('profiles').delete().eq('id', userId);
    
    return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
}

// ══════════════════════════════════════════════════════════════════
// GET PAYMENTS
// ══════════════════════════════════════════════════════════════════
async function getPayments(res, { status, page = 1, limit = 50 }) {
    let query = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (status && status !== 'all') {
        query = query.eq('status', status);
    }
    
    const { data, error } = await query
        .range((page - 1) * limit, page * limit - 1);
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        payments: data || []
    });
}

// ══════════════════════════════════════════════════════════════════
// UPDATE PAYMENT STATUS
// ══════════════════════════════════════════════════════════════════
async function updatePayment(res, { paymentId, status }) {
    const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();
    
    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Update payment status
    await supabase
        .from('payments')
        .update({ status: status })
        .eq('id', paymentId);
    
    // If approved, update user plan
    if (status === 'completed') {
        const planLimits = {
            starter: 500,
            pro: 2000,
            enterprise: 999999
        };
        
        const expiryDate = new Date();
        if (payment.billing_type === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }
        
        await supabase
            .from('profiles')
            .update({
                plan: payment.plan,
                plan_expiry: expiryDate.toISOString(),
                dms_limit: planLimits[payment.plan] || 100,
                dms_used: 0
            })
            .eq('id', payment.user_id);
    }
    
    return res.status(200).json({
        success: true,
        message: `Payment ${status}`
    });
}

// ══════════════════════════════════════════════════════════════════
// UPDATE PLAN PRICES
// ══════════════════════════════════════════════════════════════════
async function updatePrices(res, prices) {
    const { error } = await supabase
        .from('settings')
        .upsert({
            key: 'plan_prices',
            value: prices,
            updated_at: new Date().toISOString()
        });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        message: 'Prices updated successfully'
    });
}

// ══════════════════════════════════════════════════════════════════
// GET/UPDATE SETTINGS
// ══════════════════════════════════════════════════════════════════
async function getSettings(res) {
    const { data } = await supabase
        .from('settings')
        .select('*');
    
    const settings = {};
    data?.forEach(item => {
        settings[item.key] = item.value;
    });
    
    return res.status(200).json({
        success: true,
        settings: settings
    });
}

async function updateSettings(res, settings) {
    for (const [key, value] of Object.entries(settings)) {
        await supabase
            .from('settings')
            .upsert({
                key: key,
                value: value,
                updated_at: new Date().toISOString()
            });
    }
    
    return res.status(200).json({
        success: true,
        message: 'Settings updated successfully'
    });
}
