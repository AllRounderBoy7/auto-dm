// server.js - Complete Serverless Functions for InstaBot AI
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');

// ══════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION - YAHAN APNE VALUES DALO
// ══════════════════════════════════════════════════════════════════
const supabaseUrl = process.env.SUPABASE_URL || 'https://uvnksakgjupnivmfkjcv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bmtzYWtnanVwbml2bWZramN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzM5NzYsImV4cCI6MjA4MTQ0OTk3Nn0.gM5hYGxnUI-n_zM-iut8Dml1T5593YhH5A9HNo8hovA';

// 🔑 ADMIN CREDENTIALS
const ADMIN_EMAILS = ['sahanapraveen2006@gmail.com', 'admin@instabot.ai'];
const MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'admin123';

// 💰 DEFAULT PLAN PRICES (Admin can change these)
const DEFAULT_PRICES = {
    starter: { monthly: 499, yearly: 4790, dmLimit: 500, accountLimit: 1 },
    pro: { monthly: 999, yearly: 9590, dmLimit: 2000, accountLimit: 3 },
    enterprise: { monthly: 2499, yearly: 23990, dmLimit: 999999, accountLimit: 10 }
};

// 📱 PHONEPE CONFIG - YAHAN APNA PHONEPE MERCHANT DATA DALO
const PHONEPE_CONFIG = {
    merchantId: process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT', // ← APNA MERCHANT ID DALO
    saltKey: process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399', // ← APNA SALT KEY DALO
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1', // ← APNA SALT INDEX DALO
    baseUrl: process.env.NODE_ENV === 'production' 
        ? 'https://api.phonepe.com/apis/pg-sandbox' 
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox'
};

const supabase = createClient(supabaseUrl, supabaseKey);

// ══════════════════════════════════════════════════════════════════
// MAIN SERVER FUNCTION
// ══════════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Master-Key');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        // Route based on path
        const path = req.url.split('?')[0];
        
        if (path === '/api/auth') {
            return await handleAuth(req, res);
        } else if (path === '/api/admin') {
            return await handleAdmin(req, res);
        } else if (path === '/api/payment') {
            return await handlePayment(req, res);
        } else if (path === '/api/webhook') {
            return await handleWebhook(req, res);
        } else if (path === '/api/health') {
            return res.status(200).json({ status: 'ok', message: 'InstaBot AI API is running' });
        } else {
            return res.status(404).json({ error: 'Endpoint not found' });
        }
    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// ══════════════════════════════════════════════════════════════════
// AUTHENTICATION FUNCTIONS
// ══════════════════════════════════════════════════════════════════
async function handleAuth(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { action, email, password, name, token } = req.body;
        
        switch (action) {
            case 'signup':
                return await handleSignup(res, email, password, name);
            
            case 'login':
                return await handleLogin(res, email, password);
            
            case 'verify':
                return await handleVerifyToken(res, token);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

async function handleSignup(res, email, password, name) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        });
        
        if (authError) throw authError;
        
        // Create profile
        if (authData.user) {
            await supabase.from('profiles').insert({
                id: authData.user.id,
                email: email,
                full_name: name,
                plan: 'free',
                dms_used: 0,
                dms_limit: 100,
                status: 'active',
                created_at: new Date().toISOString()
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Account created successfully',
            user: authData.user
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function handleLogin(res, email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Check if user is blocked
        const { data: profile } = await supabase
            .from('profiles')
            .select('status')
            .eq('id', data.user.id)
            .single();
        
        if (profile?.status === 'blocked') {
            await supabase.auth.signOut();
            return res.status(403).json({ error: 'Account blocked. Contact support.' });
        }
        
        return res.status(200).json({
            success: true,
            user: data.user,
            session: data.session
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function handleVerifyToken(res, token) {
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            user: data.user
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ══════════════════════════════════════════════════════════════════
// ADMIN FUNCTIONS
// ══════════════════════════════════════════════════════════════════
async function handleAdmin(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Verify admin access
        const isAdmin = await verifyAdmin(req);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { action, ...params } = req.body;
        
        switch (action) {
            case 'get-stats':
                return await getAdminStats(res);
            
            case 'get-users':
                return await getUsers(res, params);
            
            case 'update-user':
                return await updateUser(res, params);
            
            case 'delete-user':
                return await deleteUser(res, params.userId);
            
            case 'get-payments':
                return await getPayments(res, params);
            
            case 'update-payment':
                return await updatePayment(res, params);
            
            case 'update-prices':
                return await updatePrices(res, params.prices);
            
            case 'get-settings':
                return await getSettings(res);
            
            case 'update-settings':
                return await updateSettings(res, params.settings);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Admin Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

async function verifyAdmin(req) {
    try {
        const authHeader = req.headers.authorization;
        const masterKey = req.headers['x-master-key'];
        
        // Check master key
        if (masterKey && masterKey === MASTER_KEY) {
            return true;
        }
        
        // Check auth token
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (!error && user && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

async function getAdminStats(res) {
    try {
        // Total users
        const { count: totalUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
        
        // Active subscriptions
        const { count: activeSubscriptions } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .neq('plan', 'free');
        
        // Total revenue
        const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .eq('status', 'completed');
        
        const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        
        // Total DMs
        const { data: profiles } = await supabase
            .from('profiles')
            .select('dms_used');
        
        const totalDms = profiles?.reduce((sum, p) => sum + (p.dms_used || 0), 0) || 0;
        
        // Instagram accounts
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
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function getUsers(res, { page = 1, limit = 10, filter, search }) {
    try {
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
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            users: data || [],
            total: count || 0,
            page: page,
            limit: limit
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function updateUser(res, { userId, updates }) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function deleteUser(res, userId) {
    try {
        // Delete related data
        await supabase.from('instagram_accounts').delete().eq('user_id', userId);
        await supabase.from('keywords').delete().eq('user_id', userId);
        await supabase.from('payments').delete().eq('user_id', userId);
        
        // Delete profile
        await supabase.from('profiles').delete().eq('id', userId);
        
        return res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function getPayments(res, { status, page = 1, limit = 50 }) {
    try {
        let query = supabase
            .from('payments')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        
        const { data, error } = await query
            .range((page - 1) * limit, page * limit - 1);
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            payments: data || []
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function updatePayment(res, { paymentId, status }) {
    try {
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
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function updatePrices(res, prices) {
    try {
        const { error } = await supabase
            .from('settings')
            .upsert({
                key: 'plan_prices',
                value: prices,
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            message: 'Prices updated successfully'
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function getSettings(res) {
    try {
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
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function updateSettings(res, settings) {
    try {
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
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════
// PAYMENT FUNCTIONS (PHONEPE INTEGRATION)
// ══════════════════════════════════════════════════════════════════
async function handlePayment(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { action, userId, plan, billingType, txnId, phonepeData } = req.body;
        
        switch (action) {
            case 'create-payment':
                return await createPhonePePayment(res, userId, plan, billingType, req);
            
            case 'verify_upi':
                return await verifyUPIPayment(res, userId, plan, billingType, txnId);
            
            case 'get-history':
                return await getPaymentHistory(res, userId);
            
            case 'get-prices':
                return await getPlanPrices(res);
            
            case 'verify-phonepe':
                return await verifyPhonePePayment(res, phonepeData);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Payment Error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// 📱 PHONEPE PAYMENT CREATION FUNCTION
async function createPhonePePayment(res, userId, plan, billingType, req) {
    try {
        // Get prices
        const prices = await getPricesFromDB();
        const planPrices = prices[plan] || DEFAULT_PRICES[plan];
        
        if (!planPrices) {
            return res.status(400).json({ error: 'Invalid plan' });
        }
        
        const amount = planPrices[billingType] * 100; // Convert to paise
        
        // Get user details
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();
        
        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Create unique transaction ID
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        
        // Determine origin for redirect URLs
        const origin = req.headers.origin || req.headers.host || 'http://localhost:3000';
        
        // PhonePe payment payload
        const payload = {
            merchantId: PHONEPE_CONFIG.merchantId,
            merchantTransactionId: transactionId,
            merchantUserId: userId,
            amount: amount,
            redirectUrl: `${origin}/dashboard.html?payment=success`,
            redirectMode: 'REDIRECT',
            callbackUrl: `${origin}/api/webhook?type=phonepe`,
            mobileNumber: '9999999999',
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };
        
        // Convert payload to base64
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        
        // Create checksum
        const checksum = crypto
            .createHash('sha256')
            .update(base64Payload + '/pg/v1/pay' + PHONEPE_CONFIG.saltKey)
            .digest('hex');
        
        const finalChecksum = checksum + '###' + PHONEPE_CONFIG.saltIndex;
        
        // Save payment record
        await supabase.from('payments').insert({
            user_id: userId,
            user_email: profile.email,
            plan: plan,
            billing_type: billingType,
            amount: amount / 100,
            method: 'phonepe',
            payment_id: transactionId,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        
        return res.status(200).json({
            success: true,
            data: {
                base64Payload: base64Payload,
                checksum: finalChecksum,
                merchantId: PHONEPE_CONFIG.merchantId,
                transactionId: transactionId,
                amount: amount / 100
            },
            redirectUrl: `${PHONEPE_CONFIG.baseUrl}/pg/v1/pay`
        });
        
    } catch (error) {
        console.error('PhonePe Payment Error:', error);
        return res.status(400).json({ error: error.message });
    }
}

// 📱 PHONEPE PAYMENT VERIFICATION
async function verifyPhonePePayment(res, phonepeData) {
    try {
        const { transactionId, code } = phonepeData;
        
        // Verify with PhonePe API
        const verifyUrl = `${PHONEPE_CONFIG.baseUrl}/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${transactionId}`;
        
        // Create checksum for verification
        const checksumString = `/pg/v1/status/${PHONEPE_CONFIG.merchantId}/${transactionId}${PHONEPE_CONFIG.saltKey}`;
        const verifyChecksum = crypto
            .createHash('sha256')
            .update(checksumString)
            .digest('hex') + '###' + PHONEPE_CONFIG.saltIndex;
        
        const response = await axios.get(verifyUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': verifyChecksum,
                'X-MERCHANT-ID': PHONEPE_CONFIG.merchantId
            }
        });
        
        const responseData = response.data;
        
        if (responseData.code === 'PAYMENT_SUCCESS') {
            // Find payment record
            const { data: payment } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_id', transactionId)
                .single();
            
            if (payment) {
                // Update payment status
                await supabase
                    .from('payments')
                    .update({ status: 'completed' })
                    .eq('id', payment.id);
                
                // Update user plan
                await updateUserPlan(payment.user_id, payment.plan, payment.billing_type);
                
                return res.status(200).json({
                    success: true,
                    message: 'Payment verified and plan activated'
                });
            }
        }
        
        return res.status(400).json({
            success: false,
            error: 'Payment verification failed'
        });
        
    } catch (error) {
        console.error('PhonePe Verify Error:', error);
        return res.status(400).json({ error: error.message });
    }
}

// UPI PAYMENT VERIFICATION
async function verifyUPIPayment(res, userId, plan, billingType, txnId) {
    try {
        // Get prices
        const prices = await getPricesFromDB();
        const planPrices = prices[plan] || DEFAULT_PRICES[plan];
        const amount = planPrices[billingType];
        
        // Get user email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();
        
        // Record payment as pending (admin will verify)
        await supabase.from('payments').insert({
            user_id: userId,
            user_email: profile?.email,
            plan: plan,
            billing_type: billingType,
            amount: amount,
            method: 'upi',
            payment_id: txnId,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        
        return res.status(200).json({
            success: true,
            message: 'Payment submitted for verification. Your plan will be activated within 24 hours.'
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function getPaymentHistory(res, userId) {
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return res.status(200).json({
            success: true,
            payments: data || []
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

async function getPlanPrices(res) {
    try {
        const prices = await getPricesFromDB();
        
        return res.status(200).json({
            success: true,
            prices: prices
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

// Helper function to update user plan
async function updateUserPlan(userId, plan, billingType) {
    try {
        const prices = await getPricesFromDB();
        const planConfig = prices[plan] || DEFAULT_PRICES[plan];
        
        // Calculate expiry date
        const expiryDate = new Date();
        if (billingType === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }
        
        // Update profile
        await supabase
            .from('profiles')
            .update({
                plan: plan,
                plan_expiry: expiryDate.toISOString(),
                dms_limit: planConfig.dmLimit,
                dms_used: 0, // Reset on plan upgrade
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);
    } catch (error) {
        console.error('Update plan error:', error);
    }
}

// Helper function to get prices from database
async function getPricesFromDB() {
    try {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'plan_prices')
            .single();
        
        return data?.value || DEFAULT_PRICES;
    } catch (error) {
        return DEFAULT_PRICES;
    }
}

// ══════════════════════════════════════════════════════════════════
// WEBHOOK FUNCTIONS
// ══════════════════════════════════════════════════════════════════
async function handleWebhook(req, res) {
    const webhookType = req.query.type || 'phonepe';
    
    if (webhookType === 'phonepe') {
        return await handlePhonePeWebhook(req, res);
    } else if (webhookType === 'instagram') {
        return await handleInstagramWebhook(req, res);
    } else {
        return res.status(400).json({ error: 'Unknown webhook type' });
    }
}

// 📱 PHONEPE WEBHOOK HANDLER
async function handlePhonePeWebhook(req, res) {
    try {
        const responseData = req.body.response || req.body;
        
        if (responseData.code === 'PAYMENT_SUCCESS') {
            const transactionId = responseData.data.merchantTransactionId;
            
            // Find payment record
            const { data: payment } = await supabase
                .from('payments')
                .select('*')
                .eq('payment_id', transactionId)
                .single();
            
            if (payment && payment.status === 'pending') {
                // Update payment status
                await supabase
                    .from('payments')
                    .update({ status: 'completed' })
                    .eq('id', payment.id);
                
                // Update user plan
                await updateUserPlan(payment.user_id, payment.plan, payment.billing_type);
                
                console.log(`Payment successful for user ${payment.user_id}, plan: ${payment.plan}`);
            }
        }
        
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(200).json({ received: true }); // Always return success to webhook
    }
}

// 📸 INSTAGRAM WEBHOOK HANDLER (For future use)
async function handleInstagramWebhook(req, res) {
    try {
        // Instagram webhook verification
        if (req.query['hub.mode'] === 'subscribe') {
            const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || 'instabot_verify';
            
            if (req.query['hub.verify_token'] === verifyToken) {
                return res.status(200).send(req.query['hub.challenge']);
            }
            return res.status(403).json({ error: 'Verification failed' });
        }
        
        // Handle Instagram events
        const { object, entry } = req.body;
        
        if (object === 'instagram') {
            console.log('Instagram webhook received:', entry);
            // Process Instagram events here
        }
        
        return res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Instagram Webhook Error:', error);
        return res.status(200).json({ received: true });
    }
}
