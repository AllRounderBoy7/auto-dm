// api/auth.js
// Vercel Serverless Function for Authentication

const { createClient } = require('@supabase/supabase-js');

// ══════════════════════════════════════════════════════════════════
// 🔧 SUPABASE CONFIG - YEH AUTOMATICALLY ENVIRONMENT SE LEGA
// ══════════════════════════════════════════════════════════════════
const supabaseUrl = process.env.SUPABASE_URL || 'https://uvnksakgjupnivmfkjcv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bmtzYWtnanVwbml2bWZramN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzM5NzYsImV4cCI6MjA4MTQ0OTk3Nn0.gM5hYGxnUI-n_zM-iut8Dml1T5593YhH5A9HNo8hovA';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    // CORS Headers
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
        const { action, email, password, name, token } = req.body;
        
        switch (action) {
            case 'signup':
                return await handleSignup(res, email, password, name);
            
            case 'login':
                return await handleLogin(res, email, password);
            
            case 'logout':
                return await handleLogout(res, token);
            
            case 'verify':
                return await handleVerifyToken(res, token);
            
            case 'reset-password':
                return await handleResetPassword(res, email);
            
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: error.message });
    }
};

async function handleSignup(res, email, password, name) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });
    
    if (authError) {
        return res.status(400).json({ error: authError.message });
    }
    
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
}

async function handleLogin(res, email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    // Check if user is blocked
    const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .single();
    
    if (profile?.status === 'blocked') {
        await supabase.auth.signOut();
        return res.status(403).json({ error: 'Your account has been blocked. Contact support.' });
    }
    
    return res.status(200).json({
        success: true,
        user: data.user,
        session: data.session
    });
}

async function handleLogout(res, token) {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ success: true });
}

async function handleVerifyToken(res, token) {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    return res.status(200).json({
        success: true,
        user: data.user
    });
}

async function handleResetPassword(res, email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({
        success: true,
        message: 'Password reset email sent'
    });
}
