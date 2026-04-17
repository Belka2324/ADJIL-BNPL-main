/**
 * Adjil BNPL - Supabase Integration Client (v2.0)
 * Unified authentication and data sync with Supabase Auth + Database
 * 
 * Dependencies: @supabase/supabase-js (loaded via CDN in index.html)
 */

(function() {
    // Configuration - Single Source of Truth
    const CONFIG = {
        URL: 'https://znlieqvasitebeyinrxi.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpubGllcXZhc2l0ZWJleWlucnhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDUyMjYsImV4cCI6MjA5MDE4MTIyNn0.AgUEfbPzHRRfi49n2L3c-oY9jOgRkvYGf-qqw6XejB4',
        STORAGE_KEYS: {
            SESSION: 'adjil_session',
            USERS: 'adjil_users',
            TRANSACTIONS: 'adjil_transactions'
        }
    };

    console.log('[Supabase] Initializing with URL:', CONFIG.URL);

    // Initialize Client
    let supabaseClient = null;

    function initClient() {
        if (!CONFIG.URL || !CONFIG.ANON_KEY) {
            console.error('[Supabase] Missing configuration');
            return;
        }
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabaseClient = window.supabase.createClient(CONFIG.URL, CONFIG.ANON_KEY);
            console.log('[Supabase] Client initialized successfully');
        } else if (typeof createClient === 'function') {
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
        _initialized: false,

        subscribe(callback) {
            if (typeof callback === 'function') {
                this._listeners.push(callback);
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
            const session = DataHelper.safeParse(CONFIG.STORAGE_KEYS.SESSION, null);
            return session;
        },

        async login(identifier, password) {
            if (!identifier || !password) return null;
            console.log('[Auth] Login attempt:', identifier);

            if (!supabaseClient) {
                console.warn('[Auth] No supabaseClient - using local fallback');
                return this._localLogin(identifier, password);
            }

            try {
                // Use Supabase Auth
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: identifier,
                    password: password
                });

                if (error) {
                    console.error('[Auth] Supabase auth error:', error.message);
                    // Fall back to local
                    return this._localLogin(identifier, password);
                }

                if (data?.user) {
                    // Get user profile from public.users
                    const { data: profile } = await supabaseClient
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();

                    const user = DataHelper.normalizeUser(profile || {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.email
                    });
                    user.auth_token = data.session.access_token;
                    this._saveSession(user);
                    console.log('[Auth] Login successful via Supabase Auth');
                    return user;
                }
            } catch (err) {
                console.error('[Auth] Login exception:', err);
                return this._localLogin(identifier, password);
            }

            return null;
        },

        async signup(userData) {
            console.log('[Auth] Signup attempt:', userData.email);

            if (!supabaseClient) {
                console.warn('[Auth] No supabaseClient - using local signup');
                return this._localSignup(userData);
            }

            try {
                // Use Supabase Auth
                const { data, error } = await supabaseClient.auth.signUp({
                    email: userData.email,
                    password: userData.password || userData.passwordHash || 'default123',
                    options: {
                        data: {
                            full_name: userData.name || userData.email,
                            role: userData.role || 'customer'
                        }
                    }
                });

                if (error) {
                    console.error('[Auth] Supabase signup error:', error.message);
                    if (error.message.includes('already been registered')) {
                        throw new Error('User already exists');
                    }
                    throw error;
                }

                if (data?.user) {
                    // Upsert user profile with additional data (create if not exists)
                    await supabaseClient
                        .from('users')
                        .upsert({
                            id: data.user.id,
                            email: data.user.email,
                            name: userData.name,
                            phone: userData.phone,
                            role: userData.role || 'customer',
                            activity: userData.activity,
                            location: userData.location,
                            wilaya: userData.wilaya,
                            status: 'pending',
                            balance: 0,
                            credit_limit: 0,
                            outstanding: 0
                        }, { onConflict: 'id' });

                    const user = DataHelper.normalizeUser({
                        id: data.user.id,
                        email: data.user.email,
                        name: userData.name,
                        role: userData.role || 'customer',
                        status: 'pending'
                    });

                    this._saveSession(user);
                    console.log('[Auth] Signup successful via Supabase Auth');
                    return { user, mode: 'online' };
                }
            } catch (err) {
                if (err.message === 'User already exists') throw err;
                console.warn('[Auth] Supabase signup failed, falling back:', err.message);
            }

            return this._localSignup(userData);
        },

        _localLogin(identifier, password) {
            console.warn('[Auth] Using local login');
            const localUsers = DataHelper.safeParse(CONFIG.STORAGE_KEYS.USERS, []);
            const user = localUsers.find(u => 
                (u.email === identifier || u.phone === identifier) && 
                (u.password === password || u.passwordHash === password)
            );
            
            if (user) {
                this._saveSession(user);
                return user;
            }
            return null;
        },

        _localSignup(userData) {
            console.warn('[Auth] Using local signup');
            const localUsers = DataHelper.safeParse(CONFIG.STORAGE_KEYS.USERS, []);
            if (localUsers.some(u => u.email === userData.email)) {
                throw new Error('User already exists');
            }
            const localUser = {
                ...userData,
                id: userData.id || ('local-' + Date.now()),
                created_at: new Date().toISOString(),
                status: 'active'
            };
            localUsers.push(localUser);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(localUsers));
            this._saveSession(localUser);
            return { user: localUser, mode: 'local' };
        },

        logout() {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
            if (supabaseClient?.auth) {
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
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'subscription_requests' },
                    async (payload) => {
                        console.log('[Realtime] Subscription request changed:', payload);
                        // Only react to changes for current user
                        if (app && app.user && payload.new && payload.new.user_id === app.user.id) {
                            window.dispatchEvent(new CustomEvent('adjil:subscription:updated', { detail: payload.new }));
                            
                            // If request was approved, activate subscription
                            if (payload.new.status === 'approved') {
                                const limit = payload.new.credit_limit || 10000;
                                const updates = {
                                    status: 'active',
                                    subscription_plan: payload.new.plan,
                                    credit_limit: limit,
                                    balance: limit
                                };
                                
                                // Update local user
                                if (app && app.user) {
                                    app.user = { ...app.user, ...updates };
                                    localStorage.setItem('adjil_session', JSON.stringify(app.user));
                                    
                                    // Update in DB
                                    const users = DB.get('users') || [];
                                    const idx = users.findIndex(u => u.id === app.user.id);
                                    if (idx >= 0) {
                                        users[idx] = { ...users[idx], ...updates };
                                        DB.set('users', users);
                                    }
                                    
                                    window.dispatchEvent(new CustomEvent('adjil:subscription:activated', { detail: updates }));
                                    
                                    const lang = app.lang || 'ar';
                                    const msg = lang === 'ar' ? 'تم تفعيل اشتراكك! رصيدك الآن ' + limit + ' دج' 
                                        : lang === 'fr' ? 'Votre abonnement est maintenant actif! Votre solde est ' + limit + ' DZD'
                                        : 'Your subscription is now active! Your balance is ' + limit + ' DZD';
                                    alert(msg);
                                    router.navigate('/dashboard');
                                }
                            }
                        }
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
