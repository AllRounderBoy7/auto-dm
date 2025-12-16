// api/payment.js
// Vercel Serverless Function for Payment Processing

const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');

const supabaseUrl = process.env.SUPABASE_URL || 'https://uvnksakgjupnivmfkjcv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bmtzYWtnanVwbml2bWZramN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzM5NzYsImV4cCI6MjA4MTQ0OTk3Nn0.gM5hYGxnUI-n_zM-iut8Dml1T5593YhH5A9HNo8hovA';

// ══════════════════════════════════════════════════════════════════
// 💳 RAZORPAY CONFIG - YAHAN APNE KEYS DALO
// ══════════════════════════════════════════════════════════════════
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXX';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXX';

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Razorpay
let razorpay;
try {
    razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    });
} catch (e) {
    console.log('Razorpay not initialized');
}

// ══════════════════════════════════════════════════════════════════
// 💰 PLAN PRICES - DEFAULT VALUES (Admin se change ho sakte hain)
// ══════════════════════════════════════════════════════════════════
const DEFAULT_PRICES = {
    starter: { monthly: 499, yearly: 4790, dmLimit: 500, accountLimit: 1 },
    pro: { monthly: 999, yearly: 9590, dmLimit: 2000, accountLimit: 3 },
    enterprise: { monthly: 2499, yearly: 23990, dmLimit: 999999, accountLimit: 10 }
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { action, userId, plan, billingType, paymentId, txnId, amount } = req.body;
        
        switch (action) {
            case 'create-order':
                return await createOrder(res, userId, plan, billingType);
            
            case 'verify':
                return await verifyRazorpayPayment(res, userId, plan, billingType, paymentId);
            
            case 'verify_upi':
                return await verifyUPIPayment(res, userId, plan, billingType, txnId);
            
            case 'get-history':
                return await getPaymentHistory(res, userId);
            
            case 'get-prices':
                return await getPlanPrices(res);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (error) {
        console.error('Payment Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

// ══════════════════════════════════════════════════════════════════
// CREATE RAZORPAY ORDER
// ══════════════════════════════════════════════════════════════════
async function createOrder(res, userId, plan, billingType) {
    // Get prices from database or use defaults
    const prices = await getPricesFromDB();
    const planPrices = prices[plan] || DEFAULT_PRICES[plan];
    
    if (!planPrices) {
        return res.status(400).json({ error: 'Invalid plan' });
    }
    
    const amount = planPrices[billingType] * 100; // Razorpay uses paise
    
    try {
        const order = await razorpay.orders.create({
            amount: amount,
            currency: 'INR',
            receipt: `order_${userId}_${Date.now()}`,
            notes: {
                userId: userId,
                plan: plan,
                billingType: billingType
            }
        });
        
        return res.status(200).json({
            success: true,
            order: order
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

// ══════════════════════════════════════════════════════════════════
// VERIFY RAZORPAY PAYMENT
// ══════════════════════════════════════════════════════════════════
async function verifyRazorpayPayment(res, userId, plan, billingType, paymentId) {
    try {
        // Verify payment with Razorpay
        const payment = await razorpay.payments.fetch(paymentId);
        
        if (payment.status !== 'captured') {
            return res.status(400).json({
                success: false,
                error: 'Payment not captured'
            });
        }
        
        // Get user email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();
        
        // Record payment
        await supabase.from('payments').insert({
            user_id: userId,
            user_email: profile?.email,
            plan: plan,
            billing_type: billingType,
            amount: payment.amount / 100,
            method: 'razorpay',
            payment_id: paymentId,
            status: 'completed',
            created_at: new Date().toISOString()
        });
        
        // Update user plan
        await updateUserPlan(userId, plan, billingType);
        
        return res.status(200).json({
            success: true,
            message: 'Payment verified and plan updated'
        });
        
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Payment verification failed: ' + error.message
        });
    }
}

// ══════════════════════════════════════════════════════════════════
// VERIFY UPI PAYMENT (Manual verification)
// ══════════════════════════════════════════════════════════════════
async function verifyUPIPayment(res, userId, plan, billingType, txnId) {
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
}

// ══════════════════════════════════════════════════════════════════
// UPDATE USER PLAN
// ══════════════════════════════════════════════════════════════════
async function updateUserPlan(userId, plan, billingType) {
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
}

// ══════════════════════════════════════════════════════════════════
// GET PAYMENT HISTORY
// ══════════════════════════════════════════════════════════════════
async function getPaymentHistory(res, userId) {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        payments: data || []
    });
}

// ══════════════════════════════════════════════════════════════════
// GET PLAN PRICES
// ══════════════════════════════════════════════════════════════════
async function getPlanPrices(res) {
    const prices = await getPricesFromDB();
    
    return res.status(200).json({
        success: true,
        prices: prices
    });
}

// Helper function to get prices from database
async function getPricesFromDB() {
    const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'plan_prices')
        .single();
    
    return data?.value || DEFAULT_PRICES;
}
