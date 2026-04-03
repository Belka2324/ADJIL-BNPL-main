/**
 * Adjil BNPL - Supabase Integration Client
 * Handles connection, authentication, and data synchronization with Supabase.
 * 
 * Dependencies: @supabase/supabase-js (loaded via CDN in index.html)
 */

(function() {
    const runtimeEnv = window.__ADJIL_ENV__ || {};
    // Configuration
    const CONFIG = {
        URL: runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || window.NEXT_PUBLIC_SUPABASE_URL || 'https://znlieqvasitebeyinrxi.supabase.co',
        ANON_KEY: runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || window.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubGllcXZhc2l0ZWJleWlucnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDUyMjYsImV4cCI6MjA5MDE4MTIyNn0.AgUEfbPzHRRfi49n2L3c-oY9jOgRkvYGf-qqw6XejB4',
        STORAGE_KEYS: {
            SESSION: 'adjil_session',
            USERS: 'adjil_users',
            TRANSACTIONS: 'adjil_transactions'
        }
    };

    // Initialize Client
    let supabaseClient = null;

    function initClient() {
        if (!CONFIG.URL || !CONFIG.ANON_KEY) {
            console.error('Missing Supabase runtime configuration');
            return;
        }
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                supabaseClient = window.supabase.createClient(CONFIG.URL, CONFIG.ANON_KEY);
                console.log('Supabase Client Initialized Successfully');
            } catch (err) {
                console.error('Failed to initialize Supabase client:', err);
            }
        } else if (typeof createClient === 'function') {
            // Fallback if createClient is global
            supabaseClient = createClient(CONFIG.URL, CONFIG.ANON_KEY);
        } else {
            console.warn('Supabase library not found. Running in offline/local mode.');
        }
        window.supabaseClient = supabaseClient;
    }

    // ==========================================
    // Data Helpers
    // ==========================================

    const DataHelper = {
        /**
         * Normalizes user record from Supabase to match local JS structure
         */
        normalizeUser: (user) => {
            if (!user || typeof user !== 'object') return null;
            const normalized = { ...user };
            
            // Handle snake_case to camelCase mapping for legacy code
            if (user.card_number) normalized.cardNumber = user.card_number;
            if (user.credit_limit) normalized.creditLimit = user.credit_limit;
            if (user.subscription_plan) normalized.subscriptionPlan = user.subscription_plan;
            
            // Ensure status is set
            if (!normalized.status) normalized.status = 'active';
            
            return normalized;
        },

        /**
         * Prepares local user object for Supabase insertion
         */
        serializeUser: (user) => {
            if (!user) return null;
            const row = { ...user };
            
            // Map camelCase to snake_case
            if (row.cardNumber) row.card_number = row.cardNumber;
            if (row.creditLimit) row.credit_limit = row.creditLimit;
            if (row.subscriptionPlan) row.subscription_plan = row.subscriptionPlan;
            
            // Map documents object to individual doc_* columns
            if (row.documents && typeof row.documents === 'object') {
                if (row.documents.id_front) row.doc_id_front = row.documents.id_front;
                if (row.documents.id_back) row.doc_id_back = row.documents.id_back;
                if (row.documents.payslip) row.doc_payslip = row.documents.payslip;
                if (row.documents.rib) row.doc_rib = row.documents.rib;
                if (row.documents.commercial_register) row.doc_commercial_register = row.documents.commercial_register;
                if (row.documents.contract) row.doc_contract = row.documents.contract;
            }
            
            // Remove local-only fields
            delete row.cardNumber;
            delete row.creditLimit;
            delete row.subscriptionPlan;
            delete row.documents;
            delete row.synced;
            delete row.isLocal;
            
            return row;
        },

        safeParse: (key, fallback) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : fallback;
            } catch (e) {
                console.error(`Error parsing ${key}:`, e);
                return fallback;
            }
        }
    };

    // ==========================================
    // Auth Service
    // ==========================================

    const AuthService = {
        _listeners: [],

        subscribe(callback) {
            if (typeof callback === 'function') {
                this._listeners.push(callback);
                // Immediately notify with current user
                const user = this.getCurrentUser();
                if (user) callback(user);
            }
            return () => {
                this._listeners = this._listeners.filter(cb => cb !== callback);
            };
        },

        notify() {
            const user = this.getCurrentUser();
            this._listeners.forEach(cb => {
                try {
                    cb(user);
                } catch (e) {
                    console.error('Auth listener error:', e);
                }
            });
        },

        getCurrentUser() {
            return DataHelper.safeParse(CONFIG.STORAGE_KEYS.SESSION, null);
        },

        async login(identifier, password) {
            if (!identifier || !password) return null;

            console.log('[Auth] Login attempt with identifier:', identifier);

            // 1. Try Supabase Login (Data query for now, since we use custom auth logic in DB)
            if (supabaseClient) {
                try {
                    // Use proper Supabase .or() syntax with filters
                    const { data, error } = await supabaseClient
                        .from('users')
                        .select('*')
                        .or(`email.eq.${encodeURIComponent(identifier)},phone.eq.${encodeURIComponent(identifier)}`)
                        .eq('password', password)
                        .maybeSingle();

                    console.log('[Auth] Supabase query result:', { data, error });

                    if (!error && data) {
                        const user = DataHelper.normalizeUser(data);
                        this._saveSession(user);
                        this._updateLocalCache(user);
                        console.log('[Auth] Login successful via Supabase');
                        return user;
                    } else if (error) {
                        console.error('[Auth] Supabase query error:', error);
                    }
                } catch (err) {
                    console.error('[Auth] Supabase login exception:', err);
                }
            } else {
                console.warn('[Auth] No supabaseClient available');
            }

            console.warn('[Auth] Login failed - user not found');
            return null;
        },

        async signup(userData) {
            console.log('[Auth] Signup attempt with:', userData.email);
            
            // 1. Try Supabase Signup
            if (supabaseClient) {
                try {
                    const dbRow = DataHelper.serializeUser(userData);
                    console.log('[Auth] Serialized user for Supabase:', dbRow);
                    
                    // Note: In a real app, use supabase.auth.signUp()
                    // Here we insert directly into users table as per current architecture
                    const { data, error } = await supabaseClient
                        .from('users')
                        .insert([dbRow])
                        .select()
                        .single();

                    console.log('[Auth] Supabase insert result:', { data, error });

                    if (!error && data) {
                        const user = DataHelper.normalizeUser(data);
                        this._saveSession(user);
                        this._updateLocalCache(user);
                        console.log('[Auth] Signup successful via Supabase');
                        return { user, mode: 'online' };
                    } else if (error) {
                        console.error('[Auth] Supabase signup error:', error);
                        if (error.code === '23505') { // Unique violation
                            throw new Error('User already exists');
                        }
                        // Don't throw here - let it fall through to local
                    }
                } catch (err) {
                    if (err.message === 'User already exists') throw err;
                    console.warn('[Auth] Supabase signup failed, falling back to local:', err);
                }
            }

            // 2. Fallback: LocalStorage signup
            console.warn('[Auth] Falling back to local signup');
            try {
                const localUsers = DataHelper.safeParse(CONFIG.STORAGE_KEYS.USERS, []);
                if (localUsers.some(u => u.email === userData.email || u.phone === userData.phone)) {
                    throw new Error('User already exists');
                }
                const localUser = {
                    ...userData,
                    id: userData.id || (crypto.randomUUID && crypto.randomUUID()) || ('local-' + Date.now()),
                    created_at: new Date().toISOString(),
                    status: 'active'
                };
                localUsers.push(localUser);
                localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(localUsers));
                this._saveSession(localUser);
                console.log('[Auth] Signup successful via local fallback');
                return { user: localUser, mode: 'local' };
            } catch (localErr) {
                if (localErr.message === 'User already exists') throw localErr;
                console.error('[Auth] Local signup also failed:', localErr);
                throw new Error('Signup failed');
            }
        },

        logout() {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
            // Optional: Supabase sign out if using Auth
            if (supabaseClient && supabaseClient.auth) {
                supabaseClient.auth.signOut().catch(console.error);
            }
            this.notify();
            if (window.location.reload) window.location.reload();
        },

        // Helper: Save session and notify
        _saveSession(user) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(user));
            this.notify();
        },

        // Helper: Update local users list cache
        _updateLocalCache(user) {
            const localUsers = DataHelper.safeParse(CONFIG.STORAGE_KEYS.USERS, []);
            const idx = localUsers.findIndex(u => u.id === user.id || u.email === user.email);
            
            if (idx >= 0) {
                localUsers[idx] = { ...localUsers[idx], ...user };
            } else {
                localUsers.push(user);
            }
            localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(localUsers));
        },

        // Backwards compatibility with older UI: signIn(identifier, password)
        async signIn(identifier, password) {
            const user = await this.login(identifier, password);
            if (!user) {
                throw new Error('invalid_credentials');
            }
            return user;
        },

        // Alias for signup used by old UI: signUp(payload)
        async signUp(userData) {
            const res = await this.signup(userData);
            return res;
        },

        // Alias for logout used by old UI: signOut()
        async signOut() {
            return this.logout();
        }
    };


    // ==========================================
    // Transaction Service
    // ==========================================
    
    const TransactionService = {
        async processTransaction(txData) {
            // txData: { customer_id, merchant_id, amount, method, ... }
            
            if (supabaseClient) {
                try {
                    const { data, error } = await supabaseClient
                        .rpc('process_transaction', {
                            p_customer_id: txData.customer_id,
                            p_merchant_id: txData.merchant_id,
                            p_amount: txData.amount,
                            p_method: txData.method || 'BNPL_DIRECT',
                            p_merchant_name: txData.merchant_name,
                            p_customer_name: txData.customer_name,
                            p_customer_card: txData.customer_card,
                            p_merchant_pin: txData.merchant_pin,
                            p_merchant_activity: txData.merchant_activity,
                            p_merchant_location: txData.merchant_location,
                            p_idempotency_key: txData.idempotency_key
                        });

                    if (error) throw error;
                    return data; // { success: true, tx_id: ... }
                } catch (err) {
                    console.error('Supabase transaction failed:', err);
                    return { success: false, error: err.message || 'Transaction failed' };
                }
            }
            
            return { success: false, error: 'Supabase client not connected' };
        }
    };

    // Initialize
    initClient();

    // ==========================================
    // Realtime: keep local caches in sync
    // ==========================================

    function setupRealtime() {
        if (!supabaseClient) return null;

        try {
            const channel = supabaseClient
                .channel('adjil-realtime')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'transactions' },
                    async () => {
                        try {
                            const { data } = await supabaseClient
                                .from('transactions')
                                .select('*')
                                .order('created_at', { ascending: false });
                            if (data) {
                                localStorage.setItem(CONFIG.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(data));
                                window.dispatchEvent(new CustomEvent('adjil:transactions:updated', { detail: data }));
                            }
                        } catch (e) {
                            console.error('[Realtime] transactions refresh failed:', e);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'users' },
                    async () => {
                        window.dispatchEvent(new CustomEvent('adjil:users:updated'));
                    }
                )
                .subscribe((status) => {
                    console.debug('[Realtime] Status:', status);
                    window.dispatchEvent(new CustomEvent('adjil:realtime:status', { detail: status }));
                });

            window.__adjilRealtimeChannel = channel;
            return channel;
        } catch (e) {
            console.error('[Realtime] setup failed:', e);
            return null;
        }
    }

    setupRealtime();

    // Export to Window
    window.AuthService = AuthService;
    window.TransactionService = TransactionService;
    window.DataHelper = DataHelper;
    // Keep window.supabaseClient as is for direct access if needed

})();
