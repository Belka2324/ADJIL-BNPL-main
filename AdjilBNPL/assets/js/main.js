
// Tailwind Configuration
window.tailwind = window.tailwind || {};
window.tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#10b981',
                secondary: '#065f46',
                accent: '#10b981',
                dark: {
                    50: '#f8fafc',
                    200: '#94a3b8',
                    800: '#0a192f',
                    900: '#020617'
                },
                card: '#112240'
            }
        }
    }
}

if (!window.AuthService) {
    window.AuthService = {
        async login(identifier, password) {
            // Try Supabase Auth first
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email: identifier,
                    password: password
                });
                
                // If Supabase login succeeds
                if (!error && data.user) {
                    const { data: userData } = await window.supabaseClient
                        .from('users')
                        .select('*')
                        .eq('id', data.user.id)
                        .single();
                    
                    const sessionUser = userData || { 
                        id: data.user.id, 
                        email: data.user.email,
                        role: 'customer'
                    };

                    const allowedRoles = ['customer', 'merchant', 'admin'];
                    if (!allowedRoles.includes(sessionUser.role)) {
                        await window.supabaseClient.auth.signOut();
                        throw new Error('role_not_allowed');
                    }

                    localStorage.setItem('adjil_session', JSON.stringify(sessionUser));
                    return sessionUser;
                }
                
                // If Supabase fails with "Invalid credentials", try localStorage fallback
                // Otherwise, throw the error
                if (error && !error.message.includes('Invalid login credentials')) {
                    throw error;
                }
            }
            
            // Fallback to LocalStorage for offline/demo (seed data users)
            const users = JSON.parse(localStorage.getItem('adjil_users') || '[]');
            const user = users.find(u => (u.email === identifier || u.phone === identifier) && u.password === password);
            if (user) {
                localStorage.setItem('adjil_session', JSON.stringify(user));
                return user;
            }
            return null;
        },
        async signUp(payload) {
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient.auth.signUp({
                    email: payload.email,
                    password: payload.password,
                    options: {
                        data: {
                            name: payload.name,
                            username: payload.username || payload.email,
                            role: payload.role || 'customer',
                            phone: payload.phone || null,
                            pin: payload.pin || null,
                            card_number: payload.card_number || null,
                            wilaya: payload.wilaya || null
                        }
                    }
                });
                if (error) {
                    if (error.message.includes('already registered') || error.message.includes('already exists')) {
                        throw new Error('User already exists');
                    }
                    throw error;
                }
                if (data.user) {
                    if (data.user.identities && data.user.identities.length === 0) {
                        throw new Error('User already exists');
                    }
                    const user = {
                        id: data.user.id,
                        email: data.user.email,
                        ...payload,
                        status: payload.status || 'pending'
                    };
                    const { password, ...safeUserRow } = user;
                    try {
                        await window.supabaseClient
                            .from('users')
                            .upsert([safeUserRow], { onConflict: 'id' });
                    } catch (syncErr) {
                        console.warn('[AuthService.signUp] users upsert failed:', syncErr);
                    }
                    localStorage.setItem('adjil_session', JSON.stringify(user));
                    return { user, mode: 'supabase' };
                }
            }
            // Fallback
            const users = JSON.parse(localStorage.getItem('adjil_users') || '[]');
            if (users.some(u => (u.email && u.email === payload.email) || (u.phone && u.phone === payload.phone))) {
                throw new Error('User already exists');
            }
            const user = {
                ...payload,
                id: (crypto.randomUUID && crypto.randomUUID()) || ('local-' + Date.now()),
                created_at: new Date().toISOString(),
                status: payload.status || 'pending'
            };
            users.push(user);
            localStorage.setItem('adjil_users', JSON.stringify(users));
            localStorage.setItem('adjil_session', JSON.stringify(user));
            return { user, mode: 'local' };
        },
        async signOut() {
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            localStorage.removeItem('adjil_session');
        },
        async signIn(identifier, password) {
            const user = await this.login(identifier, password);
            if (!user) throw new Error('invalid_credentials');
            return user;
        }
    };
}

if (window.AuthService && typeof window.AuthService.signIn !== 'function') {
    window.AuthService.signIn = async (identifier, password) => {
        const user = await window.AuthService.login(identifier, password);
        if (!user) throw new Error('invalid_credentials');
        return user;
    };
}
if (window.AuthService && typeof window.AuthService.demoSignIn !== 'function') {
    window.AuthService.demoSignIn = async (role) => {
        const r = role === 'merchant' ? 'merchant' : 'customer';
        const users = JSON.parse(localStorage.getItem('adjil_users') || '[]');
        let user = users.find(u => u.role === r);
        if (!user) {
            user = {
                id: (crypto.randomUUID && crypto.randomUUID()) || ('local-' + Date.now()),
                created_at: new Date().toISOString(),
                name: r === 'merchant' ? 'متجر تجريبي' : 'مستخدم تجريبي',
                email: `demo_${r}@adjil.dz`,
                password: '123',
                role: r,
                status: 'active',
                balance: r === 'merchant' ? 85000 : 10000,
                outstanding: r === 'merchant' ? 12400 : 0,
                pin: r === 'merchant' ? '0000' : '1234',
                card_number: r === 'merchant' ? null : '5423 0000 0000 0001'
            };
            users.push(user);
            localStorage.setItem('adjil_users', JSON.stringify(users));
        }
        localStorage.setItem('adjil_session', JSON.stringify(user));
        return user;
    };
}
if (window.AuthService && typeof window.AuthService.signUp !== 'function') {
    window.AuthService.signUp = async (payload) => {
        const users = JSON.parse(localStorage.getItem('adjil_users') || '[]');
        if (users.some(u => (u.email && u.email === payload.email) || (u.phone && u.phone === payload.phone))) {
            throw new Error('User already exists');
        }
            const user = {
            ...payload,
            id: (crypto.randomUUID && crypto.randomUUID()) || ('local-' + Date.now()),
            created_at: new Date().toISOString(),
                status: payload.status || 'pending'
        };
        users.push(user);
        localStorage.setItem('adjil_users', JSON.stringify(users));
        localStorage.setItem('adjil_session', JSON.stringify(user));
            return { user, mode: 'local' };
    };
}
if (window.AuthService && typeof window.AuthService.signOut !== 'function') {
    window.AuthService.signOut = async () => {
        localStorage.removeItem('adjil_session');
    };
}

const WILAYAS = [
    "01-أدرار", "02-الشلف", "03-الأغواط", "04-أم البواقي", "05-باتنة", "06-بجاية", "07-بسكرة", "08-بشار", "09-البليدة", "10-البويرة",
    "11-تمنراست", "12-تبسة", "13-تلمسان", "14-تيارت", "15-تيزي وزو", "16-الجزائر", "17-الجلفة", "18-جيجل", "19-سطيف", "20-سعيدة",
    "21-سكيكدة", "22-سيدي بلعباس", "23-عنابة", "24-قالمة", "25-قسنطينة", "26-المدية", "27-مستغانم", "28-المسيلة", "29-معسكر", "30-ورقلة",
    "31-وهران", "32-البيض", "33-إليزي", "34-برج بوعريريج", "35-بومرداس", "36-الطارف", "37-تندوف", "38-تيسمسيلت", "39-الوادي", "40-خنشلة",
    "41-سوق أهراس", "42-تيبازة", "43-ميلة", "44-عين الدفلى", "45-النعامة", "46-عين تموشنت", "47-غرداية", "48-غليزان", "49-تيميمون", "50-برج باجي مختار",
    "51-أولاد جلال", "52-بني عباس", "53-عين صالح", "54-عين قزام", "55-تقرت", "56-جانت", "57-المغير", "58-المنيعة"
];

const DB = {
    get: (key) => JSON.parse(localStorage.getItem('adjil_' + key) || 'null'),
    set: (key, val) => localStorage.setItem('adjil_' + key, JSON.stringify(val)),
    // Supabase Integration Helper
    // Use this to migrate data or switch to remote DB
    supabase: {
        async syncUsers() {
            if (!window.supabaseClient) return console.error('Supabase not initialized');

            // 1. Fetch remote users
            const { data: remoteUsers, error } = await window.supabaseClient.from('users').select('*');

            if (error) {
                console.error('Supabase Sync Error:', error);
                return;
            }

            // 2. If remote is empty, seed with local dummy data
            if (!remoteUsers || remoteUsers.length === 0) {
                const localUsers = DB.get('users') || [];
                if (localUsers.length > 0) {
                    console.log('Seeding Supabase with local data...');
                    const usersForDb = localUsers.map(u => ({
                        id: u.id,
                        name: u.name ?? null,
                        email: u.email ?? null,
                        password: u.password ?? null,
                        phone: u.phone ?? null,
                        role: u.role ?? null,
                        status: u.status ?? null,
                        subscription_plan: u.subscription_plan ?? null,
                        credit_limit: u.credit_limit ?? 0,
                        balance: u.balance ?? 0,
                        outstanding: u.outstanding ?? 0,
                        pin: u.pin ?? null,
                        card_number: u.card_number || u.cardNumber || null,
                        activity: u.activity ?? null,
                        location: u.location ?? null,
                        wilaya: u.wilaya ?? null,
                        coords: u.coords ?? null
                    }));
                    const { error: insertError } = await window.supabaseClient.from('users').insert(usersForDb);
                    if (insertError) console.error('Seeding Error:', insertError);
                    else console.log('Seeding Complete!');
                }
            } else {
                // 3. If remote has data, update local cache
                // This makes the app "Online First" regarding read, but uses LocalStorage as cache
                console.log('Syncing from Supabase to LocalStorage...', remoteUsers.length, 'users found.');

                // We need to preserve the complex objects if any (like txs array might be JSON in SQL or separate table)
                // In SQL schema, 'transactions' is a separate table.
                // But in JS 'user' object, 'txs' is an embedded array.
                // We need to fetch transactions for these users to rebuild the JS object structure.

                const { data: transactions } = await window.supabaseClient.from('transactions').select('*');

                const mergedUsers = remoteUsers.map(u => {
                    // Find transactions where this user is customer or merchant
                    // Note: In JS logic, txs array contains full tx objects.
                    const userTxs = transactions ? transactions.filter(t =>
                        t.customer_id === u.id || t.merchant_id === u.id
                    ).map(t => ({
                        ...t,
                        // Map SQL columns back to JS properties if needed
                        // JS: merchant (name), customerName, customerCard
                        // SQL: merchant_name, customer_name, customer_card
                        merchant: t.merchant_name,
                        customerName: t.customer_name,
                        customerCard: t.customer_card
                    })) : [];

                    const cardNumber = u.cardNumber || u.card_number || null;
                    return { ...u, cardNumber, txs: userTxs };
                });

                DB.set('users', mergedUsers);

                // FIX: Preserve local-only users that don't exist in Supabase
                // This prevents locally-registered users from being wiped during sync
                const existingLocalUsers = JSON.parse(localStorage.getItem('adjil_users') || '[]');
                const localOnlyUsers = existingLocalUsers.filter(localUser => {
                    // A user is local-only if they don't exist in remote users
                    return !mergedUsers.some(remoteUser => 
                        remoteUser.email === localUser.email || 
                        remoteUser.id === localUser.id ||
                        remoteUser.phone === localUser.phone
                    );
                });
                if (localOnlyUsers.length > 0) {
                    console.log('Preserving local-only users during sync:', localOnlyUsers.length);
                    mergedUsers = [...mergedUsers, ...localOnlyUsers];
                    DB.set('users', mergedUsers);
                }

                // Refresh UI if app is running
                if (window.app && app.user) {
                    // Update current user reference
                    const updatedCurrentUser = mergedUsers.find(u => u.id === app.user.id);
                    if (updatedCurrentUser) {
                        app.user = updatedCurrentUser;
                        if (!app.user.cardNumber && app.user.card_number) app.user.cardNumber = app.user.card_number;
                        localStorage.setItem('adjil_session', JSON.stringify(app.user));
                        app.updateDashboardUI();
                    }
                }
            }
        }
    },
    init: () => {
        if (!localStorage.getItem('adjil_users')) {
            DB.set('users', [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'محمد علي',
                    email: 'c@adjil.dz',
                    password: '123',
                    role: 'customer',
                    status: 'active',
                    subscription_plan: 'monthly',
                    credit_limit: 10000,
                    balance: 10000,
                    cardNumber: '5423 0000 0000 0001',
                    txs: [
                        { id: 'T1', merchant: 'سوبر ماركت السلام (مواد غذائية)', amount: 1500, date: '2026-03-20 10:15:30', status: 'completed' },
                        { id: 'T2', merchant: 'محطة نفطال (بنزين)', amount: 2200, date: '2026-03-21 14:45:12', status: 'completed' },
                        { id: 'T3', merchant: 'صيدلية الشفاء', amount: 850, date: '2026-03-22 09:30:05', status: 'completed' },
                        { id: 'T4', merchant: 'فندق الأوراسي (إقامة)', amount: 4500, date: '2026-03-23 18:20:45', status: 'completed' }
                    ],
                    pin: '1234'
                },
                {
                    id: '22222222-2222-4222-8222-222222222222',
                    name: 'متجر الإلكترونيات',
                    email: 'm@adjil.dz',
                    password: '123',
                    role: 'merchant',
                    status: 'active',
                    balance: 85000,
                    outstanding: 12400,
                    activity: 'بيع الأجهزة الإلكترونية والهواتف',
                    location: 'العناصر، الجزائر العاصمة',
                    coords: '36.7456,3.0645',
                    txs: [
                        { id: 'MT1', customerCard: '5423 0000 0000 0001', amount: 12000, date: '2026-03-20 11:00:00', status: 'completed' },
                        { id: 'MT2', customerCard: '5423 0000 0000 0001', amount: 35000, date: '2026-03-21 15:30:00', status: 'completed' },
                        { id: 'MT3', customerCard: '5423 0000 0000 0001', amount: 38000, date: '2026-03-22 10:45:00', status: 'completed' }
                    ],
                    pin: null
                },
                {
                    id: '33333333-3333-4333-8333-333333333333',
                    name: 'سوبر ماركت السلام',
                    email: 'qr@adjil.dz',
                    password: '123',
                    role: 'merchant',
                    status: 'active',
                    balance: 0,
                    outstanding: 0,
                    activity: 'مواد غذائية وعامة',
                    location: 'باب الزوار، الجزائر العاصمة',
                    coords: '36.7111,3.1722',
                    txs: [],
                    pin: null
                },
                {
                    id: '44444444-4444-4444-8444-444444444444',
                    name: 'صيدلية الشفاء',
                    email: 'phones@adjil.dz',
                    password: '123',
                    role: 'merchant',
                    status: 'active',
                    balance: 0,
                    outstanding: 0,
                    activity: 'أدوية ومستلزمات طبية',
                    location: 'دالي ابراهيم، الجزائر العاصمة',
                    coords: '36.7588,2.9833',
                    txs: [],
                    pin: null
                }
            ]);
        }
    }
};

DB.init();

const app = {
    user: null,
    regRole: 'customer',
    regPhase: 1,
    gpsActive: true,
    currentPendingTx: null,
    lang: 'ar',
    translations: {
        ar: {
            home: "الرئيسية",
            how_it_works: "كيف يعمل؟",
            pricing: "الأسعار",
            about: "من نحن",
            developers: "المطورين",
            login: "دخول",
            logout: "خروج",
            invite: "دعوة",
            contact: "تواصل معنا",
            dashboard_customer: "لوحة تحكم الزبون",
            dashboard_merchant: "لوحة تحكم التاجر",
            welcome: "مرحباً بك مجدداً،",
            available_balance: "الرصيد المتاح للاستخدام",
            total_sales: "المبيعات الإجمالية",
            received_amounts: "مبالغ مستلمة",
            outstanding_amounts: "مبالغ مستحقة",
            transactions_board: "بورد المشتريات والمدفوعات",
            manual_payment: "دفع يدوي",
            scan_qr: "مسح QR Code",
            confirm_payment: "تأكيد عملية الدفع",
            merchant_name: "اسم التاجر المستفيد",
            payment_amount: "المبلغ المراد دفعه",
            confirm_deduction: "تأكيد واقتطاع المبلغ",
            success_payment: "تمت عملية الدفع بنجاح!",
            insufficient_balance: "رصيدك غير كافٍ",
            qr_code_title: "كود QR الخاص بك",
            qr_code_desc: "اجعل الزبون يمسح هذا الكود لإتمام عملية الدفع",
            sales_history: "سجل المبيعات والعمليات",
            no_sales: "لا توجد مبيعات حالياً",
            no_transactions: "لا توجد معاملات حالياً",
            card_holder: "حامل البطاقة",
            expiry_date: "الانتهاء",
            premium_card: "بطاقة رقمية مميزة",
            hero_title: "اشترِ ما تريد، وادفع براحتك.",
            hero_subtitle: "منصة آجل تمنحك رصيداً شهرياً يصل إلى 25,000 دج. تسوق من آلاف المتاجر وادفع لاحقاً باشتراك شهري بسيط.",
            new_app: "جديد: تطبيق الهاتف متوفر الآن",
            how_it_works_title: "دليلك لاستخدام آجل",
            how_it_works_subtitle: "خطوات بسيطة تفتح لك آفاقاً جديدة للتسوق",
            step1_title: "سجل حسابك في دقائق",
            step1_desc: "عملية تسجيل سريعة وآمنة. ارفع وثائقك، اختر خطتك، واحصل على رصيدك الفوري لتبدأ رحلة تسوق ذكية.",
            step2_title: "تسوق من مئات المتاجر",
            step2_desc: "تصفح شبكتنا الواسعة من التجار المعتمدين. من الملابس إلى الإلكترونيات، كل ما تحتاجه متوفر الآن وبنظام الدفع الآجل.",
            step3_title: "امسح الكود وادفع فوراً",
            step3_desc: "لا حاجة للنقد أو البطاقات البنكية عند الشراء. ببساطة امسح رمز QR الخاص بالتاجر من خلال تطبيق آجل وأتمم عمليتك في ثوانٍ.",
            step4_title: "ادفع لاحقاً بكل أريحية",
            step4_desc: "تمتع بمشترياتك اليوم وسدد مستحقاتك في نهاية الشهر. نظامنا يضمن لك إدارة مالية مريحة وشفافة دون أي تعقيدات.",
            partners_title: "شركاء الدفع المعتمدون",
            partners_subtitle: "نثق بهم ويثقون بنا",
            about_title: "آجل: ثورة في عالم التجارة الرقمية بالجزائر",
            about_subtitle: "نحن لسنا مجرد تطبيق للدفع، نحن شريكك المالي الذي يسعى لإعادة تشكيل العلاقة بين التاجر والمستهلك في الجزائر من خلال حلول \"اشترِ الآن وادفع لاحقاً\" المبتكرة.",
            start_journey: "ابدأ رحلتك الآن",
            learn_more: "اكتشف المزيد",
            fin_adv_title: "المزايا المالية",
            fin_adv_desc: "إدارة مالية ذكية تناسب ميزانيتك",
            fin_adv_p: "نحن نوفر لك سيولة فورية تمكنك من اقتناء احتياجاتك الأساسية دون الضغط على ميزانيتك الشهرية. مع آجل، يمكنك تقسيط مشترياتك بكل شفافية.",
            fin_item1: "رصيد ائتماني فوري - احصل على رصيد تسوق بمجرد تفعيل حسابك.",
            fin_item2: "جدولة مريحة للدفع - سدد مستحقاتك في نهاية الشهر أو على دفعات ميسرة.",
            fin_item3: "بدون عمولات بنكية - نظام إسلامي وشفاف 100% يخدم مصلحة المواطن.",
            soc_adv_title: "المزايا الاجتماعية",
            soc_adv_desc: "تعزيز الثقة والتكافل في المجتمع الجزائري",
            soc_adv_p: "آجل ليست مجرد أداة مالية، بل هي جسر للثقة بين التاجر والزبون. نحن نسعى لتمكين العائلات الجزائرية من العيش بكرامة وراحة بال.",
            eco_adv_title: "المزايا الاقتصادية",
            eco_adv_desc: "دفع عجلة الاقتصاد الوطني والتحول الرقمي",
            eco_adv_p: "نحن نساهم في خلق بيئة اقتصادية نشطة من خلال زيادة المبيعات للتجار وتسهيل الحركة المالية في السوق المحلي الجزائري.",
            cta_title: "هل أنت مستعد لتجربة المستقبل؟",
            register_customer: "سجل كزبون",
            register_customer_desc: "احصل على رصيد تسوق فوري",
            register_merchant: "انضم كتاجر",
            register_merchant_desc: "ضاعف مبيعاتك اليوم",
            customer: "زبون",
            merchant: "تاجر",
            status_pending: "بانتظار الموافقة",
            status_success: "عملية ناجحة",
            sale_from: "مبيعة من:",
            collecting: "قيد التحصيل",
            footer_slogan: "البيع الآجل - الحل الرقمي الأمثل في الجزائر.",
            quick_links: "روابط سريعة",
            why_adjil: "لماذا آجل؟",
            ethics_title: "مستقبل البيع الآجل الأخلاقي",
            ethics_desc: "نحن نحل أزمة السيولة للأسر الجزائرية باستخدام التكنولوجيا، وليس الفوائد.",
            integrity_title: "النزاهة المالية",
            integrity_desc: "يضمن نظامنا السداد دون تعقيدات بيروقراطية.",
            account_frozen: "حسابك مجمد مؤقتاً",
            frozen_desc: "نأسف، تم تعليق صلاحيات حسابك بسبب وجود مستحقات غير مدفوعة في الآجال المحددة.",
            no_merchants: "لا يوجد تجار مسجلون حالياً",
            merchants_title: "شركاؤنا من التجار",
            merchants_subtitle: "تجدوننا في جميع أنحاء الوطن",
            algiers_algeria: "الجزائر العاصمة، الجزائر",
            change_lang: "تغيير اللغة",
            investor_access: "دخول المستثمرين",
            scan_qr_title: "مسح رمز الاستجابة السريعة",
            logout_confirm: "هل أنت متأكد من تسجيل الخروج؟",
            no_data: "لا توجد بيانات",
            invite_title: "آجل | اشترِ الآن وادفع لاحقاً",
            invite_text: "انضم إلى آجل وتمتع برصيد تسوق فوري يصل إلى 25,000 دج!",
            invite_copied: "تم نسخ رابط التحميل! يمكنك الآن إرساله لأصدقائك.",
            alt_shop: "تسوق",
            alt_scan: "مسح",
            alt_paylater: "دفع لاحق",
            alt_financial: "مالي",
            alt_social: "اجتماعي",
            alt_economic: "اقتصادي",
            investment_opp: "فرصة استثمارية",
            account_suspended: "تم تعليق الحساب",
            contact_support: "تواصل مع الدعم",
            return_login: "العودة لتسجيل الدخول",
            qr_video_title: "كيفية الدفع باستخدام QR Code",
            qr_video_subtitle: "فيديو توضيحي لعملية الشراء والتحقق من الرصيد",
            video_placeholder: "فيديو توضيحي قريباً",
            pay_later_title: "الدفع اللاحق: أمان، سهولة، وراحة بال",
            pay_later_subtitle: "نظامنا مصمم ليمنحك الحرية المالية دون تعقيدات.",
            pay_later_desc: "نحن نستخدم أحدث التقنيات لضمان تجربة دفع سلسة وآمنة. يمكنك الشراء الآن من أي متجر معتمد والدفع في نهاية الشهر بكل أريحية.",
            api_title: "واجهة المطورين (API)",
            api_subtitle: "قريباً: وثائق شاملة لدمج آجل في متجرك الإلكتروني.",
            secure_payment: "عملية دفع آمنة ومشفرة 100%",
            scan_camera_desc: "وجه الكاميرا نحو كود التاجر",
            searching_qr: "يتم البحث عن رمز QR تلقائياً...",
            simulate_qr: "محاكاة مسح كود ناجح",
            online_now: "متصل الآن",
            direct_pay_title: "دفع مباشر",
            enter_due_amount: "أدخل المبلغ المستحق",
            choose_method: "اختر طريقة الدفع",
            method_qr: "تفعيل QR",
            method_id: "اختيار ID Market",
            market_id_label: "رقم ID للتاجر",
            payment_done: "تم الدفع وتحويل المبلغ إلى محفظة التاجر",
            invoice_ready: "تم إنشاء فاتورة رقمية قابلة للتحميل",
            copyright: "© 2026 ADJIL-BNPL. جميع الحقوق محفوظة.",
            auth_login_title: "تسجيل الدخول",
            auth_register_title: "حساب جديد",
            auth_welcome_title: "مرحباً بك في آجل",
            auth_login_subtitle: "سجل الدخول للمتابعة",
            auth_register_subtitle: "انضم إلى عائلة آجل اليوم",
            auth_create_account_title: "إنشاء حساب جديد",
            email_phone: "البريد الإلكتروني أو الهاتف",
            email_phone_placeholder: "example@mail.com / 0550...",
            password_placeholder: "••••••••",
            fill_required: "يرجى ملء كافة الحقول المطلوبة",
            email_registered: "هذا البريد الإلكتروني مسجل مسبقاً",
            phone_registered: "رقم الهاتف هذا مسجل مسبقاً",
            register_success: "تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.",
            login_error: "خطأ في البريد الإلكتروني أو كلمة المرور",
            subscribe_login_required: "يجب تسجيل الدخول أولاً للاشتراك في الخطة",
            forgot_password_sent: "تم إرسال تعليمات استعادة كلمة المرور إلى: ",
            invalid_amount: "يرجى إدخل مبلغ صحيح",
            enter_merchant_name: "يرجى إدخال اسم التاجر",
            merchant_not_found: "خطأ: لم يتم العثور على التاجر بالاسم المدخل",
            system_error_user_not_found: "خطأ في النظام: لم يتم العثور على التاجر أو الزبون",
            payment_success_msg: "تمت عملية الدفع بنجاح!",
            qr_scan_success: "تم مسح الكود بنجاح! يرجى تأكيد الدفع.",
            search_merchant: "ابحث عن متجر",
            search_merchant_placeholder: "اسم المتجر أو نوع النشاط",
            view_on_map: "عرض على الخريطة",
            merchant_activity: "النشاط",
            merchant_location: "الموقع",
            merchant_pin_label: "رمز الدفع",
            copy_pin: "نسخ الرمز",
            copied: "تم النسخ",
            reg_location: "تحديد الموقع على الخريطة",
            reg_location_desc: "حدد موقعك على Google Maps (للتجار والزبائن)",
            select_on_map: "تحديد",
            select_merchant: "اختر التاجر",
            plan_selected: "تم اختيار خطة: ",
            demo_customer: "دخول تجريبي (زبون)",
            demo_merchant: "دخول تجريبي (تاجر)",
            firstname: "الاسم",
            lastname: "اللقب",
            email: "البريد الإلكتروني",
            phone: "رقم الهاتف",
            password: "كلمة المرور",
            optional: "(اختياري)",
            create_account: "إنشاء الحساب",
            next: "التالي",
            back: "رجوع",
            confirm: "تأكيد",
            digital_contract: "العقد الرقمي",
            digital_contract_desc: "قبل تفعيل حسابك، يرجى قراءة العقد الرقمي والموافقة على الشروط.",
            open_contract: "أنقر لقراءة العقد",
            accept_terms: "قرأت ووافقت على شروط عقد آجل",
            must_accept_terms: "يجب الموافقة على شروط العقد قبل إنشاء الحساب",
            id_card: "بطاقة التعريف البيومترية",
            payslip: "شهادة كشف الراتب (PDF)",
            canceled_check: "صورة الشيك المشطوب",
            commercial_register: "نسخة من السجل التجاري",
            activity_wilaya: "ولاية النشاط",
            plan_monthly: "شهري",
            plan_6months: "6 أشهر",
            plan_annual: "سنوي",
            price_suffix: "دج/شهر",
            subscribe_now: "اشترك الآن",
            save_10: "توفير 10%",
            save_25: "توفير 25%",
            price_monthly: "1000",
            price_6months: "900",
            price_annual: "750",
            most_popular: "الأكثر طلباً",
            credit_limit: "رصيد 25,000 دج",
            credit_limit_15: "رصيد يصل إلى 15,000 دج",
            credit_limit_25: "رصيد يصل إلى 25,000 دج",
            pay_30_days: "دفع آجل لمدة 30 يوم",
            no_interest: "بدون فوائد",
            priority_support: "أولوية الدعم الفني",
            increase_limit: "زيادة سقف الرصيد",
            annual_gifts: "هدايا سنوية",
            enter_pin_desc: "أدخل رمز PIN الخاص بك لتأكيد العملية",
            cancel: "إلغاء",
            confirm: "تأكيد",
            payment_success_desc: "تم خصم المبلغ من رصيدك بنجاح، ويمكنك الآن تحميل فاتورتك الرقمية والاحتفاظ بها.",
            amount: "المبلغ",
            merchant: "التاجر",
            transaction_id: "رقم العملية",
            download_invoice: "تحميل الفاتورة",
            return_dashboard: "العودة للوحة التحكم",
            collect_outstanding: "تحصيل المبالغ المستحقة",
            api_settlement_desc: "استخدم محرك التسوية البنكي لسحب مبالغ المبيعات الآجلة مباشرة إلى حسابك البنكي أو CCP.",
            request_payout_api: "طلب تحويل بنكي (API)",
            card_number_label: "رقم البطاقة",
            settlement_simulator: "محاكي محرك التسوية",
            settlement_simulator_sub: "Settlement Engine Simulator (Bank Side)",
            start_auto_scan: "بدء المسح والاقتطاع الآلي",
            console_waiting: "> بانتظار أوامر النظام...",
            adjil_pool: "حساب آجل التجاري (Pool)",
            pending_disbursements: "عمليات قيد التوزيع",
            api_desc_scan: "مسح الحسابات الجارية وتحديد المستحقات المطلوبة.",
            api_desc_debit: "تنفيذ الاقتطاع التلقائي (Prélèvement) من حساب الزبون.",
            api_desc_disburse: "إعادة توزيع الأموال على التجار بمختلف مؤسساتهم المالية.",
            compatible_ccp: "متوافق مع نظام بريد الجزائر (CCP)",
            compatible_cib: "متوافق مع الأنظمة البنكية (CIB/SATIM)",
            ceo_title: "كلمة المدير التنفيذي والمؤسس",
            ceo_message: "في منصة آجل، ننظر إلى المستقبل برؤية ثاقبة تضع الإنسان في قلب الابتكار المالي. هدفنا هو التوسع عالمياً عبر شراكات استراتيجية وتقنيات موثوقة تُبسّط الحياة اليومية وتفتح أبواب الفرص للجميع. نلتزم بمبادرات عملية لتحسين المستوى المعيشي للأفراد، عبر حلول دفع آمنة وشفافة تُحترم خصوصية المستخدم وتمنحه حرية الإدارة المالية دون تعقيد. كل الشكر والتقدير لكل من آمن بمشروع آجل ودعم مسيرته، فبكم نكبر وبثقتكم نخطو بثبات نحو الريادة.",
            contract_intro: "تم إبرام هذا العقد بين منصة آجل من جهة، والمشترك (زبوناً كان أو تاجراً) من جهة أخرى، بهدف تنظيم الاستفادة من خدمة البيع الآجل وفق ضوابط مالية وقانونية واضحة وشفافة.",
            contract_art1_title: "المادة 1 – موضوع العقد",
            contract_art1_desc: "يهدف هذا العقد إلى منح المشترك إمكانية استعمال رصيد ائتماني محدد من طرف المنصة للشراء من التجار المتعاقدين بنظام البيع الآجل، مع التزامه الكامل بسداد المبالغ المستحقة داخل الآجال المحددة.",
            contract_art2_title: "المادة 2 – التزامات المشترك والصرامة في التسديد",
            contract_art2_desc: "يتعهد المشترك بـ: استعمال الحساب والرصيد لأغراض قانونية، التسديد الصارم لجميع المبالغ المستحقة قبل تاريخ 05 من كل شهر كأقصى حد. وفي حالة الإخلال بهذا الموعد، توافق على تجميد حسابك البريدي/البنكي أوتوماتيكياً إشعاراً بتسوية الوضعية.",
            contract_art3_title: "المادة 3 – التزامات التاجر",
            contract_art3_desc: "يلتزم التاجر بتوثيق كل عملية بيع بدقة عبر منصة آجل، وعدم تسجيل أية عمليات صورية أو مضخمة، واحترام الأسعار المعلن عنها، والتعاون مع المنصة في أي عملية تدقيق أو مراجعة.",
            contract_art4_title: "المادة 4 – حقوق المنصة",
            contract_art4_desc: "تحتفظ المنصة بحق مراجعة سقف الرصيد الائتماني، وتعليق أو إيقاف الحساب في حال الاشتباه في استعمال غير مشروع أو عند الإخلال المتكرر بآجال السداد، مع إمكانية اللجوء للإجراءات القانونية عند الضرورة.",
            contract_art5_title: "المادة 5 – القبول الإلكتروني",
            contract_art5_desc: "يعتبر تأشير المشترك على خانة \"قرأت ووافقت على شروط عقد آجل\" قبولاً إلكترونياً تاماً لكل بنود هذا العقد وله نفس الأثر القانوني للتوقيع الخطي.",
            contract_art6_title: "المادة 6 – حماية المعطيات ذات الطابع الشخصي",
            contract_art6_desc: "تلتزم منصة آجل باحترام أحكام القانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في معالجة المعطيات ذات الطابع الشخصي، وباستعمال بيانات المشترك في إطار الخدمة فقط، مع توفير مستوى مناسب من السرية والأمن، ومنح المشترك حق طلب الاطلاع على بياناته أو تصحيحها أو حذفها وفقاً للقانون المعمول به.",
            contract_art7_title: "المادة 7 – تفويض الاقتطاع التلقائي والصرامة المسبقة",
            contract_art7_desc: "بموجب هذا البند، يمنح المشترك تفويضاً صريحاً وغير مشروط لمنصة آجل لاقتطاع الأقساط قبل تاريخ السداد المحدد. في حال تعذر الاقتطاع بسبب نقص الرصيد، يقر المشترك بحق المنصة في تجميد الحساب البريدي/البنكي للمشترك فوراً ودون إشعار إضافي إلى غاية تسوية الوضعية المالية.",
            contract_subscriber_name: "اسم المشترك / Nom du souscripteur",
            contract_signature_date: "تاريخ التوقيع / Date de signature",
            contract_signature_label: "إمضاء المشترك / Signature du souscripteur",
            print_contract: "طباعة العقد",
            download_contract: "تحميل العقد",
            pricing_page_title: "خطط اشتراك مرنة",
            pricing_page_subtitle: "اختر الخطة التي تناسب احتياجاتك وتمتع بالتسوق الفوري",
            about_hero_title: "آجل: ثورة في عالم التجارة الرقمية بالجزائر",
            about_hero_subtitle: "نحن لسنا مجرد تطبيق للدفع، نحن شريكك المالي الذي يسعى لإعادة تشكيل العلاقة بين التاجر والمستهلك في الجزائر من خلال حلول \"اشترِ الآن وادفع لاحقاً\" المبتكرة.",
            no_interest_fees: "0% فائدة أو رسوم خفية",
            empower_families: "تمكين الأسر",
            empower_families_desc: "توفير الاحتياجات الضرورية في الوقت المناسب دون تأخير.",
            security_privacy: "أمان وخصوصية",
            security_privacy_desc: "حماية بياناتك ومعاملاتك بأعلى معايير التشفير الرقمي.",
            support_merchants: "دعم التجار المحليين",
            support_merchants_desc: "زيادة القدرة الشرائية للزبائن تعني مبيعات أكثر ونمو أسرع للمحلات.",
            digitize_finance: "رقمنة التعاملات المالية",
            digitize_finance_desc: "تقليل الاعتماد على السيولة النقدية (الشكارة) والتوجه نحو الدفع الإلكتروني العصري.",
            pos_system: "نظام نقاط البيع (POS)",
            clear: "مسح",
            total_amount_to_pay: "المبلغ الإجمالي للدفع",
            manual_amount_placeholder: "المبلغ يدوي...",
            simulate_barcode: "محاكاة قارئ الباركود:",
            scan_product_500: "مسح منتج بـ 500 دج",
            generate_qr_code: "توليد كود الدفع (QR)",
            scan_merchant_qr: "امسح رمز QR للتاجر",
            point_camera_merchant: "وجه كاميرا هاتفك نحو كود التاجر لإتمام الدفع",
            bank_settings_title: "إعدادات الحساب البنكي / البريدي",
            bank_settings_desc: "أدخل تفاصيل حسابك البنكي لتلقي وسداد المدفوعات.",
            account_type: "نوع الحساب",
            post_account_rip: "بريد الجزائر (RIP) - CCP",
            bank_account_rib: "حساب بنكي (RIB)",
            account_number_label: "رقم الحساب (RIP/RIB)",
            account_number_placeholder: "أدخل 20 رقماً...",
            cancel_back: "إلغاء / رجوع",
            save_changes: "حفظ التغييرات",
            bank_postal_info: "معلومات البنك/البريد",
            bank_account_info_btn: "معلومات الحساب البنكي / البريدي"
        },
        fr: {
            home: "Accueil",
            how_it_works: "Comment ça marche ?",
            pricing: "Tarifs",
            about: "À propos",
            developers: "Développeurs",
            login: "Connexion",
            logout: "Déconnexion",
            invite: "Inviter",
            contact: "Contactez-nous",
            dashboard_customer: "Tableau de bord Client",
            dashboard_merchant: "Tableau de bord Marchand",
            welcome: "Bienvenue,",
            available_balance: "Solde disponible",
            total_sales: "Ventes totales",
            received_amounts: "Montants reçus",
            outstanding_amounts: "Montants à recevoir",
            transactions_board: "Historique des transactions",
            manual_payment: "Paiement manuel",
            scan_qr: "Scanner QR Code",
            confirm_payment: "Confirmer le paiement",
            merchant_name: "Nom du marchand",
            payment_amount: "Montant à payer",
            confirm_deduction: "Confirmer et déduire",
            success_payment: "Paiement effectué avec succès !",
            insufficient_balance: "Solde insuffisant",
            qr_code_title: "Votre code QR",
            qr_code_desc: "Faites scanner ce code par le client pour effectuer le paiement",
            sales_history: "Historique des ventes",
            no_sales: "Aucune vente pour le moment",
            no_transactions: "Aucune transaction pour le moment",
            card_holder: "Titulaire de la carte",
            expiry_date: "Expire",
            premium_card: "Carte numérique Premium",
            hero_title: "Achetez ce que vous voulez, payez à votre aise.",
            hero_subtitle: "Adjil vous offre un crédit mensuel allant jusqu'à 25 000 DZD. Achetez dans des milliers de magasins et payez plus tard avec un simple abonnement mensuel.",
            new_app: "Nouveau : l'application mobile est disponible",
            how_it_works_title: "Votre guide pour utiliser Adjil",
            how_it_works_subtitle: "Des étapes simples qui vous ouvrent de nouveaux horizons de shopping",
            step1_title: "Inscrivez-vous en quelques minutes",
            step1_desc: "Processus d'inscription rapide et sécurisé. Téléchargez vos documents, choisissez votre plan et obtenez votre crédit instantané.",
            step2_title: "Achetez dans des centaines de magasins",
            step2_desc: "Parcourez notre large réseau de marchands agréés. Des vêtements à l'électronique, tout est disponible.",
            step3_title: "Scannez le code et payez instantanément",
            step3_desc: "Pas besoin de cash ou de cartes. Scannez simplement le QR code du marchand via l'application Adjil.",
            step4_title: "Payez plus tard en toute sérénité",
            step4_desc: "Profitez de vos achats aujourd'hui et réglez vos cotisations à la fin du mois.",
            partners_title: "Partenaires de paiement agréés",
            partners_subtitle: "Nous leur faisons confiance et ils nous font confiance",
            about_title: "Adjil : Une révolution dans le commerce numérique en Algérie",
            about_subtitle: "Nous ne sommes pas seulement une application de paiement, nous sommes votre partenaire financier qui s'efforce de redéfinir la relation entre le marchand et le consommateur en Algérie grâce à des solutions innovantes « Achetez maintenant, payez plus tard ».",
            about_hero_title: "Adjil : Une révolution dans le commerce numérique en Algérie",
            about_hero_subtitle: "Nous ne sommes pas seulement une application de paiement, nous sommes votre partenaire financier qui s'efforce de redéfinir la relation entre le marchand et le consommateur en Algérie grâce à des solutions innovantes « Achetez maintenant, payez plus tard ».",
            no_interest_fees: "0% d'intérêt ou frais cachés",
            empower_families: "Autonomisation des familles",
            empower_families_desc: "Répondre aux besoins essentiels à temps sans délai.",
            security_privacy: "Sécurité et confidentialité",
            security_privacy_desc: "Protection de vos données et transactions avec les plus hauts standards de cryptage numérique.",
            support_merchants: "Soutien aux commerçants locaux",
            support_merchants_desc: "L'augmentation du pouvoir d'achat des clients signifie plus de ventes et une croissance plus rapide pour les magasins.",
            digitize_finance: "Numérisation des transactions financières",
            digitize_finance_desc: "Réduction de la dépendance au cash et orientation vers le paiement électronique moderne.",
            pos_system: "Système de Point de Vente (POS)",
            clear: "Effacer",
            total_amount_to_pay: "Montant Total à Payer",
            manual_amount_placeholder: "Montant manuel...",
            simulate_barcode: "Simuler le scanner de codes-barres:",
            scan_product_500: "Scanner un produit à 500 DZD",
            generate_qr_code: "Générer le Code QR de Paiement",
            scan_merchant_qr: "Scanner le QR Code du Marchand",
            point_camera_merchant: "Pointez la caméra vers le code du marchand",
            bank_settings_title: "Paramètres Bancaires / Postaux",
            bank_settings_desc: "Entrez vos coordonnées bancaires pour recevoir et effectuer des paiements.",
            account_type: "Type de Compte",
            post_account_rip: "Algérie Poste (RIP) - CCP",
            bank_account_rib: "Compte Bancaire (RIB)",
            account_number_label: "Numéro de Compte (RIP/RIB)",
            account_number_placeholder: "Entrez 20 chiffres...",
            cancel_back: "Annuler / Retour",
            save_changes: "Enregistrer les modifications",
            bank_postal_info: "Infos Bancaires/Postales",
            bank_account_info_btn: "Informations Bancaires / Postales",
            start_journey: "Commencez votre parcours",
            learn_more: "En savoir plus",
            fin_adv_title: "Avantages Financiers",
            fin_adv_desc: "Une gestion financiere intelligente adaptee a votre budget",
            fin_adv_p: "Nous vous fournissons une liquidite instantanee vous permettant d'acquerir vos besoins essentiels sans pression.",
            fin_item1: "Credit instantane - Obtenez un credit d'achat des l'activation de votre compte.",
            fin_item2: "Paiement flexible - Payez a la fin du mois ou en versements.",
            fin_item3: "Sans commissions bancaires - Systeme transparent 100% au service du citoyen.",
            soc_adv_title: "Avantages Sociaux",
            soc_adv_desc: "Renforcer la confiance et la solidarite",
            soc_adv_p: "Adjil est un pont de confiance entre le commercant et le client.",
            eco_adv_title: "Avantages Economiques",
            eco_adv_desc: "Stimuler l'economie nationale",
            eco_adv_p: "Nous contribuons a creer un environnement economique actif en augmentant les ventes.",
            cta_title: "Pret a decouvrir le futur ?",
            register_customer: "S'inscrire en tant que client",
            register_customer_desc: "Obtenez un credit d'achat instantane",
            register_merchant: "Rejoindre en tant que commercant",
            register_merchant_desc: "Doublez vos ventes aujourd'hui",
            customer: "Client",
            merchant: "Commercant",
            status_pending: "En attente d'approbation",
            status_success: "Succes",
            sale_from: "Vente de :",
            collecting: "Encaissement",
            footer_slogan: "Acheter maintenant, payer plus tard - La solution numerique ideale en Algerie.",
            quick_links: "Liens Rapides",
            why_adjil: "Pourquoi Adjil ?",
            ethics_title: "Avenir du BNPL ethique",
            ethics_desc: "Nous resolvons la crise de liquidite pour les familles algeriennes en utilisant la technologie, pas les interets.",
            integrity_title: "Integrite financiere",
            integrity_desc: "Notre systeme assure le paiement sans complications bureaucratiques.",
            account_frozen: "Compte temporairement gele",
            frozen_desc: "Desole, les privileges de votre compte ont ete suspendus en raison de montants impayes dans les délais impartis.",
            no_merchants: "Aucun commercant enregistre pour le moment",
            merchants_title: "Nos Partenaires Commercants",
            merchants_subtitle: "Trouvez-nous a travers le pays",
            algiers_algeria: "Alger, Algerie",
            change_lang: "Changer de langue",
            investor_access: "Acces Investisseur",
            scan_qr_title: "Scanner le code QR",
            logout_confirm: "Etes-vous sur de vouloir vous deconnecter ?",
            no_data: "Aucune donnee disponible",
            invite_title: "Adjil | Acheter maintenant, payer plus tard",
            invite_text: "Rejoignez Adjil et obtenez un credit instantane jusqu'a 25 000 DZD !",
            invite_copied: "Lien de telechargement copie ! Vous pouvez maintenant l'envoyer a vos amis.",
            alt_shop: "Boutique",
            alt_scan: "Scanner",
            alt_paylater: "Payer plus tard",
            alt_financial: "Financier",
            alt_social: "Social",
            alt_economic: "Economique",
            investment_opp: "Opportunite d'investissement",
            account_suspended: "Compte suspendu",
            contact_support: "Contacter le support",
            return_login: "Retour a la connexion",
            qr_video_title: "Comment payer avec le code QR",
            qr_video_subtitle: "Video explicative sur l'achat et la verification du solde",
            video_placeholder: "Tutoriel video a venir",
            pay_later_title: "Payer plus tard : Securite, Facilité et Tranquillite",
            pay_later_subtitle: "Notre systeme est concu pour vous donner la liberte financiere sans complications.",
            pay_later_desc: "Nous utilisons les dernieres technologies pour garantir une experience de paiement fluide. Achetez maintenant et payez a la fin du mois en toute facilite.",
            api_title: "Interface Developpeur (API)",
            api_subtitle: "Bientot : Documentation complete pour integrer Adjil dans votre boutique en ligne.",
            secure_payment: "Paiement securise et crypte a 100%",
            scan_camera_desc: "Pointez la camera vers le code du commercant",
            searching_qr: "Recherche automatique du code QR...",
            simulate_qr: "Simuler un scan reussi",
            online_now: "En ligne maintenant",
            direct_pay_title: "Paiement direct",
            enter_due_amount: "Entrez le montant du",
            choose_method: "Choisir le mode de paiement",
            method_qr: "Activer QR",
            method_id: "Selectionner l'ID Marchand",
            market_id_label: "ID du Commercant",
            payment_done: "Montant transfere au portefeuille du commercant",
            invoice_ready: "Facture numerique creee et prete a etre telechargee",
            copyright: "© 2026 ADJIL-BNPL. Tous droits reserves.",
            pos_system: "Systeme de Point de Vente (POS)",
            clear: "Effacer",
            total_amount_to_pay: "Montant total a payer",
            manual_amount_placeholder: "Montant manuel...",
            simulate_barcode: "Simuler le scanner de codes-barres :",
            scan_product_500: "Scanner un produit a 500 DZD",
            generate_qr_code: "Generer le Code QR de paiement",
            scan_merchant_qr: "Scanner le QR Code du Commercant",
            point_camera_merchant: "Pointez votre camera vers le code du commercant pour payer",
            auth_login_title: "Connexion",
            auth_register_title: "Creer un compte",
            auth_welcome_title: "Bienvenue chez Adjil",
            auth_login_subtitle: "Connectez-vous pour continuer",
            auth_register_subtitle: "Rejoignez la famille Adjil aujourd'hui",
            auth_create_account_title: "Creer un nouveau compte",
            email_phone: "Email ou telephone",
            email_phone_placeholder: "example@mail.com / 0550...",
            password_placeholder: "••••••••",
            fill_required: "Veuillez remplir tous les champs requis",
            email_registered: "Cette adresse email est deja enregistree",
            phone_registered: "Ce numero de telephone est deja enregistre",
            register_success: "Compte cree avec succes ! Vous pouvez maintenant vous connecter.",
            login_error: "Email ou mot de passe incorrect",
            subscribe_login_required: "Vous devez d'abord vous connecter pour vous abonner au plan",
            forgot_password_sent: "Instructions de recuperation du mot de passe envoyees a : ",
            invalid_amount: "Veuillez entrer un montant valide",
            enter_merchant_name: "Veuillez entrer le nom du commercant",
            merchant_not_found: "Erreur : Commercant introuvable avec le nom entre",
            system_error_user_not_found: "Erreur systeme : Commercant ou client introuvable",
            payment_success_msg: "Paiement effectue avec succes !",
            qr_scan_success: "Code scanne avec succes ! Veuillez confirmer le paiement.",
            search_merchant: "Rechercher un magasin",
            search_merchant_placeholder: "Nom du magasin ou type d'activite",
            view_on_map: "Afficher sur la carte",
            merchant_activity: "Activite",
            merchant_location: "Localisation",
            merchant_pin_label: "Code de paiement",
            copy_pin: "Copier le code",
            copied: "Copie",
            reg_location: "Localiser sur la carte",
            reg_location_desc: "Localisez-vous sur Google Maps (pour marchands et clients)",
            select_on_map: "Selectionner",
            select_merchant: "Choisir le commercant",
            plan_selected: "Plan selectionne : ",
            demo_customer: "Entree demonstration (client)",
            demo_merchant: "Entree demonstration (marchand)",
            firstname: "Prenom",
            lastname: "Nom",
            email: "Email",
            phone: "Numero de telephone",
            password: "Mot de passe",
            optional: "(optionnel)",
            create_account: "Creer un compte",
            next: "Suivant",
            back: "Retour",
            confirm: "Confirmer",
            digital_contract: "Contrat Numerique",
            digital_contract_desc: "Avant d'activer votre compte, veuillez lire et accepter les conditions du contrat numerique.",
            open_contract: "Cliquez pour lire le contrat",
            accept_terms: "J'ai lu et j'accepte les conditions du contrat Adjil",
            must_accept_terms: "Vous devez accepter les conditions du contrat avant de creer un compte",
            id_card: "Carte d'identite biometrique",
            payslip: "Bulletin de salaire (PDF)",
            canceled_check: "Photo du cheque barre",
            commercial_register: "Extrait du Registre de Commerce",
            activity_wilaya: "Wilaya d'activite",
            plan_monthly: "Mensuel",
            plan_6months: "6 mois",
            plan_annual: "Annuel",
            price_suffix: "DZD/mois",
            subscribe_now: "S'abonner maintenant",
            save_10: "Economisez 10%",
            save_25: "Economisez 25%",
            price_monthly: "1000",
            price_6months: "900",
            price_annual: "750",
            most_popular: "Le plus populaire",
            credit_limit: "Credit de 25 000 DZD",
            credit_limit_15: "Credit jusqu'a 15 000 DZD",
            credit_limit_25: "Credit jusqu'a 25 000 DZD",
            pay_30_days: "Paiement differe de 30 jours",
            no_interest: "Sans interets",
            priority_support: "Support technique prioritaire",
            increase_limit: "Augmentation du plafond de credit",
            annual_gifts: "Cadeaux annuels",
            enter_pin_desc: "Entrez votre code PIN pour confirmer l'operation",
            cancel: "Annuler",
            payment_success_desc: "Le montant a ete debite de votre solde avec succes. Vous pouvez maintenant telecharger votre facture numerique.",
            amount: "Montant",
            transaction_id: "Numero de transaction",
            download_invoice: "Telecharger la facture",
            return_dashboard: "Retour au tableau de bord",
            collect_outstanding: "Collecter les montants dus",
            api_settlement_desc: "Utilisez le moteur de reglement bancaire pour retire directement les montants des ventes a terme vers votre compte bancaire ou CCP.",
            request_payout_api: "Demander un virement bancaire (API)",
            card_number_label: "Numero de carte",
            about_hero_title: "Adjil : Une revolution dans le commerce numerique en Algerie",
            about_hero_subtitle: "Nous ne sommes pas seulement une application de paiement, nous sommes votre partenaire financier qui s'efforce de redefinir la relation entre le commercant et le consommateur en Algerie grace a des solutions innovatives Achetez maintenant, payez plus tard.",
            no_interest_fees: "0% d'interets ou frais caches",
            empower_families: "Autonomisation des familles",
            empower_families_desc: "Repondre aux besoins essentiels a temps sans delai.",
            security_privacy: "Securite et confidentialite",
            security_privacy_desc: "Protection de vos donnees et transactions avec les plus hauts standards de cryptage numerique.",
            support_merchants: "Soutien aux commercants locaux",
            support_merchants_desc: "L'augmentation du pouvoir d'achat des clients signifie plus de ventes et une croissance plus rapide pour les magasins.",
            digitize_finance: "Numerisation des transactions financieres",
            digitize_finance_desc: "Reduction de la dependance au cash et orientation vers le paiement electronique moderne.",
            account: "Compte",
            profile_title: "Profil utilisateur",
            profile_subtitle: "Mettez a jour vos informations personnelles et votre photo de profil",
            upload_picture_hint: "Cliquez pour changer la photo",
            location: "Localisation",
            open_map: "Ouvrir la carte",
            bank_details_title: "Parametres du compte de reception et de paiement",
            bank_details_subtitle: "Choisissez le type de compte prefere pour le lier a la plateforme Adjil",
            pricing_page_title: "Plans d'abonnement",
            pricing_page_subtitle: "Choisissez le plan qui vous convient le mieux",
            select_plan: "Selectionner un plan",
            per_month: "/mois",
            settlement_simulator: "Simulateur de moteur de reglement",
            settlement_simulator_sub: "Settlement Engine Simulator (cote banque)",
            start_auto_scan: "Demarrer le scan et le debit automatique",
            console_waiting: "> En attente des commandes systeme...",
            adjil_pool: "Compte commercial Adjil (Pool)",
            pending_disbursements: "Operations en cours de distribution",
            api_desc_scan: "Scanner les comptes courants et identifier les montants dus.",
            api_desc_debit: "Executer le debit automatique (Prelevement) du compte du client.",
            api_desc_disburse: "Redistribuer les fonds aux marchands via leurs institutions financieres.",
            compatible_ccp: "Compatible avec le systeme d'Algerie Poste (CCP)",
            compatible_cib: "Compatible avec les systemes bancaires (CIB/SATIM)",
            ceo_title: "Mot du Directeur Exécutif et Fondateur",
            ceo_message: "Chez Adjil, nous voyons l'avenir avec une vision perspicace qui place l'humain au cœur de l'innovation financiere. Notre objectif est de nous expansionner a travers le monde via des partenariats strategiques et des technologies fiables qui simplifient la vie quotidienne et ouvrent des opportunites pour tous.",
            contract_intro: "Ce contrat est conclu entre la plateforme Adjil d'une part, et l'abonne (client ou commercant) d'autre part, afin de reglementer l'utilisation du service de vente a terme selon des regles financieres et juridiques claires et transparentes.",
            contract_art1_title: "Article 1 - Objet du contrat",
            contract_art1_desc: "Ce contrat vise a permettre a l'abonne d'utiliser un credit limite defini par la plateforme pour effectuer des achats auprès des commercant contractants en systeme de vente a terme, avec l'engagement total de remboursement des montants dus dans les delais impartis.",
            contract_art2_title: "Article 2 - Obligations de l'abonne et rigueur du remboursement",
            contract_art2_desc: "L'abonne s'engage a : utiliser le compte et le credit a des fins legales, rembourse rigoureusement tous les montants dus avant le 05 de chaque mois au plus tard. En cas de non-respect de cette date, vous acceptez de geler automatiquement votre compte postal/bancaire sans preavis pour reglement.",
            contract_art3_title: "Article 3 - Obligations du commercant",
            contract_art3_desc: "Le commercant s'engage a documenter chaque vente avec precision via la plateforme Adjil, a ne pas enregistrer d'operations fictives ou amplifiees, a respecter les prix annonces, et a cooperer avec la plateforme pour toute operation d'audit ou de revision.",
            contract_art4_title: "Article 4 - Droits de la plateforme",
            contract_art4_desc: "La plateforme se reserve le droit de reviser le plafond du credit, de suspendre ou arreter le compte en cas d'utilisation suspecte ou de retard de paiement repete, avec possibilite de recourir aux procedures legales si necessaire.",
            contract_art5_title: "Article 5 - Acceptation electronique",
            contract_art5_desc: "La confirmation de l'abonne sur la case J'ai lu et j'accepte les conditions du contrat Adjil constitue une acceptation electronique complete de tous les articles de ce contrat et a le meme effet juridique qu'une signature manuscrite.",
            contract_art6_title: "Article 6 - Protection des donnees personnelles",
            contract_art6_desc: "La plateforme Adjil s'engage a respecter les dispositions de la loi n18-07 relative a la protection des personnes physiques dans le traitement des donnees personnelles, a utiliser les donnees de l'abonne uniquement dans le cadre du service, a fournir un niveau approprie de confidentialite et de securite, et a permettre a l'abonne de demander l'acces, la correction ou la suppression de ses donnees conformement a la loi en vigueur.",
            contract_art7_title: "Article 7 - Prelevement automatique et rigueur prealable",
            contract_art7_desc: "L'abonne accorde un mandat exprès a Adjil pour prelever les mensualites a la date specifiee. Si le prelevement echoue en raison de fonds insuffisants, la plateforme se reserve le droit de geler immediatement le compte postal/bancaire de l'abonne sans preavis jusqu'au reglement.",
            contract_subscriber_name: "Nom de l'abonne",
            contract_signature_date: "Date de signature",
            contract_signature_label: "Signature",
            print_contract: "Imprimer le contrat",
            download_contract: "Telecharger le contrat"
        },
        en: {
            home: "Home",
            how_it_works: "How it works?",
            pricing: "Pricing",
            about: "About us",
            developers: "Developers",
            login: "Login",
            logout: "Logout",
            invite: "Invite",
            contact: "Contact us",
            dashboard_customer: "Customer Dashboard",
            dashboard_merchant: "Merchant Dashboard",
            welcome: "Welcome back,",
            available_balance: "Available Balance",
            total_sales: "Total Sales",
            received_amounts: "Received Amounts",
            outstanding_amounts: "Outstanding Amounts",
            transactions_board: "Transactions Board",
            manual_payment: "Manual Payment",
            scan_qr: "Scan QR Code",
            confirm_payment: "Confirm Payment",
            merchant_name: "Merchant Name",
            payment_amount: "Amount to pay",
            confirm_deduction: "Confirm & Deduct",
            success_payment: "Payment successful!",
            insufficient_balance: "Insufficient balance",
            qr_code_title: "Your QR Code",
            qr_code_desc: "Let the customer scan this code to complete the payment",
            sales_history: "Sales & Operations History",
            no_sales: "No sales at the moment",
            no_transactions: "No transactions at the moment",
            card_holder: "Card Holder",
            expiry_date: "Expires",
            premium_card: "Premium Digital Card",
            hero_title: "Buy what you want, pay at your ease.",
            hero_subtitle: "Adjil gives you a monthly credit up to 25,000 DZD. Shop from thousands of stores and pay later.",
            new_app: "New: Mobile app available now",
            how_it_works_title: "Your guide to using Adjil",
            how_it_works_subtitle: "Simple steps that open new shopping horizons",
            step1_title: "Register in minutes",
            step1_desc: "Fast and secure registration. Upload documents, choose your plan, and get instant credit.",
            step2_title: "Shop from hundreds of stores",
            step2_desc: "Browse our wide network of authorized merchants. Everything you need is available.",
            step3_title: "Scan the code and pay instantly",
            step3_desc: "No need for cash or cards. Simply scan the merchant's QR code via the Adjil app.",
            step4_title: "Pay later comfortably",
            step4_desc: "Enjoy your purchases today and settle your dues at the end of the month.",
            partners_title: "Authorized Payment Partners",
            partners_subtitle: "We trust them and they trust us",
            about_title: "Adjil: A Revolution in Digital Commerce in Algeria",
            about_subtitle: "We are not just a payment app, we are your financial partner.",
            start_journey: "Start your journey now",
            learn_more: "Learn More",
            fin_adv_title: "Financial Advantages",
            fin_adv_desc: "Smart financial management tailored to your budget",
            fin_adv_p: "We provide instant liquidity allowing you to acquire your essential needs without pressure.",
            fin_item1: "Instant Credit - Get shopping credit as soon as your account is activated.",
            fin_item2: "Flexible Payment - Pay at the end of the month or in easy installments.",
            fin_item3: "No Bank Commissions - 100% transparent system serving the citizen.",
            soc_adv_title: "Social Advantages",
            soc_adv_desc: "Enhancing trust and solidarity",
            soc_adv_p: "Adjil is a bridge of trust between the merchant and the customer.",
            eco_adv_title: "Economic Advantages",
            eco_adv_desc: "Driving the national economy",
            eco_adv_p: "We contribute to creating an active economic environment by increasing sales.",
            cta_title: "Ready to experience the future?",
            register_customer: "Register as customer",
            register_customer_desc: "Get instant shopping credit",
            register_merchant: "Join as merchant",
            register_merchant_desc: "Double your sales today",
            customer: "Customer",
            merchant: "Merchant",
            status_pending: "Pending Approval",
            status_success: "Success",
            sale_from: "Sale from:",
            collecting: "Collecting",
            footer_slogan: "Buy Now Pay Later - The ideal digital solution in Algeria.",
            quick_links: "Quick Links",
            why_adjil: "Why Adjil?",
            ethics_title: "Future of Ethical BNPL",
            ethics_desc: "We solve the liquidity crisis for Algerian families using technology, not interest.",
            integrity_title: "Financial Integrity",
            integrity_desc: "Our system ensures payment without bureaucratic complications.",
            account_frozen: "Account Temporarily Frozen",
            frozen_desc: "Sorry, your account privileges have been suspended due to unpaid dues within the specified deadlines.",
            no_merchants: "No merchants registered at the moment",
            merchants_title: "Our Merchant Partners",
            merchants_subtitle: "Find us across the country",
            algiers_algeria: "Algiers, Algeria",
            change_lang: "Change Language",
            investor_access: "Investor Access",
            scan_qr_title: "Scan QR Code",
            logout_confirm: "Are you sure you want to logout?",
            no_data: "No data available",
            invite_title: "Adjil | Buy Now Pay Later",
            invite_text: "Join Adjil and get instant credit up to 25,000 DZD!",
            invite_copied: "Download link copied! You can now send it to your friends.",
            alt_shop: "Shop",
            alt_scan: "Scan",
            alt_paylater: "Pay Later",
            alt_financial: "Financial",
            alt_social: "Social",
            alt_economic: "Economic",
            investment_opp: "Investment Opportunity",
            account_suspended: "Account Suspended",
            contact_support: "Contact Support",
            return_login: "Return to Login",
            qr_video_title: "How to Pay with QR Code",
            qr_video_subtitle: "Tutorial video on purchasing and balance verification",
            video_placeholder: "Video tutorial coming soon",
            pay_later_title: "Pay Later: Security, Ease, and Peace of Mind",
            pay_later_subtitle: "Our system is designed to give you financial freedom without complications.",
            pay_later_desc: "We use the latest technologies to ensure a seamless payment experience. Buy now and pay at the end of the month with ease.",
            api_title: "Developer Interface (API)",
            api_subtitle: "Soon: Comprehensive documentation to integrate Adjil into your online store.",
            secure_payment: "100% secure and encrypted payment",
            scan_camera_desc: "Point camera at merchant code",
            searching_qr: "Searching for QR code automatically...",
            simulate_qr: "Simulate successful scan",
            online_now: "Online now",
            direct_pay_title: "Direct Payment",
            enter_due_amount: "Enter due amount",
            choose_method: "Choose payment method",
            method_qr: "Activate QR",
            method_id: "Select Market ID",
            market_id_label: "Merchant ID",
            payment_done: "Amount transferred to merchant wallet",
            invoice_ready: "Digital invoice created and ready to download",
            copyright: "© 2026 ADJIL-BNPL. All rights reserved.",
            pos_system: "Point of Sale System (POS)",
            clear: "Clear",
            total_amount_to_pay: "Total Amount to Pay",
            manual_amount_placeholder: "Manual amount...",
            simulate_barcode: "Simulate barcode scanner:",
            scan_product_500: "Scan 500 DZD product",
            generate_qr_code: "Generate Payment QR Code",
            scan_merchant_qr: "Scan Merchant QR Code",
            point_camera_merchant: "Point your camera at the merchant code to pay",
            bank_settings_title: "Bank / Postal Settings",
            bank_settings_desc: "Enter your bank account details to receive and make payments.",
            account_type: "Account Type",
            post_account_rip: "Algerie Poste (RIP) - CCP",
            bank_account_rib: "Bank Account (RIB)",
            account_number_label: "Account Number (RIP/RIB)",
            account_number_placeholder: "Enter 20 digits...",
            cancel_back: "Cancel / Back",
            save_changes: "Save Changes",
            bank_postal_info: "Bank/Postal Info",
            bank_account_info_btn: "Bank / Postal Account Information",
            auth_login_title: "Login",
            auth_register_title: "Register",
            auth_welcome_title: "Welcome to Adjil",
            auth_login_subtitle: "Log in to continue",
            auth_register_subtitle: "Join the Adjil family today",
            auth_create_account_title: "Create a new account",
            email_phone: "Email or phone",
            email_phone_placeholder: "example@mail.com / 0550...",
            password_placeholder: "••••••••",
            fill_required: "Please fill in all required fields",
            email_registered: "Email already registered",
            phone_registered: "Phone number already registered",
            register_success: "Account created successfully! You can now log in.",
            login_error: "Invalid email or password",
            subscribe_login_required: "You must log in first to subscribe to a plan",
            forgot_password_sent: "Reset instructions sent to: ",
            invalid_amount: "Please enter a valid amount",
            enter_merchant_name: "Please enter merchant name",
            merchant_not_found: "Error: Merchant not found",
            system_error_user_not_found: "System error: User not found",
            payment_success_msg: "Payment successful!",
            qr_scan_success: "QR Code scanned successfully! Please confirm payment.",
            search_merchant: "Search for a store",
            search_merchant_placeholder: "Store name or activity",
            view_on_map: "View on Map",
            merchant_activity: "Activity",
            merchant_location: "Location",
            merchant_pin_label: "Payment PIN",
            copy_pin: "Copy PIN",
            copied: "Copied",
            reg_location: "Select Location on Map",
            reg_location_desc: "Select your location on Google Maps",
            select_on_map: "Select",
            select_merchant: "Select Merchant",
            plan_selected: "Plan selected: ",
            demo_customer: "Demo Login (Customer)",
            demo_merchant: "Demo Login (Merchant)",
            firstname: "First Name",
            lastname: "Last Name",
            email: "Email",
            phone: "Phone",
            password: "Password",
            optional: "(Optional)",
            create_account: "Create Account",
            next: "Next",
            back: "Back",
            confirm: "Confirm",
            digital_contract: "Digital Contract",
            digital_contract_desc: "Before activating your account, please read the Adjil contract and accept the terms.",
            open_contract: "Click to read contract",
            accept_terms: "I have read and accept the Adjil contract terms",
            must_accept_terms: "You must accept the contract terms before creating your account",
            id_card: "Biometric ID Card",
            payslip: "Payslip (PDF)",
            canceled_check: "Canceled Check",
            commercial_register: "Commercial Register",
            activity_wilaya: "Activity Wilaya",
            plan_monthly: "Monthly",
            plan_6months: "6 Months",
            plan_annual: "Annual",
            price_suffix: "DZD/month",
            subscribe_now: "Subscribe",
            save_10: "Save 10%",
            save_25: "Save 25%",
            price_monthly: "1000",
            price_6months: "900",
            price_annual: "750",
            most_popular: "Most Popular",
            credit_limit: "25,000 DZD Credit",
            credit_limit_15: "Credit up to 15,000 DZD",
            credit_limit_25: "Credit up to 25,000 DZD",
            pay_30_days: "30-day Payment",
            no_interest: "No Interest",
            priority_support: "Priority Support",
            increase_limit: "Increase Limit",
            annual_gifts: "Annual Gifts",
            enter_pin_desc: "Enter your PIN to confirm the transaction",
            cancel: "Cancel",
            confirm: "Confirm",
            payment_success_desc: "Amount deducted successfully, you can now download your digital invoice.",
            amount: "Amount",
            merchant: "Merchant",
            transaction_id: "Transaction ID",
            download_invoice: "Download Invoice",
            return_dashboard: "Return to Dashboard",
            collect_outstanding: "Collect Outstanding",
            api_settlement_desc: "Use the banking settlement engine to withdraw BNPL sales directly to your Bank or CCP account.",
            request_payout_api: "Request Payout (API)",
            card_number_label: "Card Number",
            settlement_simulator: "Settlement Simulator",
            settlement_simulator_sub: "Settlement Engine Simulator (Bank Side)",
            start_auto_scan: "Start Auto-Scan & Debit",
            console_waiting: "> Waiting for system command...",
            adjil_pool: "Adjil Commercial Pool",
            pending_disbursements: "Pending Disbursements",
            api_desc_scan: "Scan current accounts and identify due amounts.",
            api_desc_debit: "Execute direct debit (Prélèvement) from customer account.",
            api_desc_disburse: "Redistribute funds to merchants across different institutions.",
            compatible_ccp: "Compatible with Algérie Poste (CCP)",
            compatible_cib: "Compatible with Banking Systems (CIB/SATIM)",
            ceo_title: "CEO & Founder Message",
            ceo_message: "At Adjil, we look to the future with a sharp vision that places humans at the heart of financial innovation. Our goal is to expand globally through strategic partnerships and reliable technologies that simplify daily life and open doors of opportunity for everyone. We are committed to practical initiatives to improve individuals' standard of living, through secure and transparent payment solutions that respect user privacy and grant them the freedom of financial management without complexity. All thanks and appreciation to everyone who believed in the Adjil project and supported its journey.",
            contract_intro: "This contract is concluded between Adjil Platform on one hand, and the subscriber (customer or merchant) on the other, to regulate the use of the BNPL service according to clear financial and legal controls.",
            contract_art1_title: "Article 1 – Subject of the Contract",
            contract_art1_desc: "This contract aims to grant the subscriber the possibility of using a credit limit set by the platform for purchases from merchants affiliated with the BNPL system, with their full commitment to repay the due amounts within the specified deadlines.",
            contract_art2_title: "Article 2 – Subscriber Obligations & Strict Payment",
            contract_art2_desc: "The subscriber undertakes to strictly pay all due amounts before the 5th of each month. In case of non-payment by this strict deadline, the subscriber agrees to the automatic freezing of their postal/bank account until the situation is regularized.",
            contract_art3_title: "Article 3 – Merchant Obligations",
            contract_art3_desc: "The merchant undertakes to document each sale accurately via Adjil, not to record any fictitious transactions, to respect the announced prices, and to cooperate with the platform.",
            contract_art4_title: "Article 4 – Platform Rights",
            contract_art4_desc: "The platform reserves the right to review the credit limit, and suspend or terminate the account in case of suspected illegal use or repeated payment defaults.",
            contract_art5_title: "Article 5 – Electronic Acceptance",
            contract_art5_desc: "Ticking the box \"I have read and accept the Adjil contract terms\" constitutes a full electronic acceptance of all terms, having the same legal effect as a handwritten signature.",
            contract_art6_title: "Article 6 – Personal Data Protection",
            contract_art6_desc: "Adjil undertakes to respect Law 18-07 on the protection of natural persons in the processing of personal data, using data only for the service, with appropriate security and confidentiality.",
            contract_art7_title: "Article 7 – Direct Debit Mandate & Penalties",
            contract_art7_desc: "The subscriber grants an express mandate to Adjil to deduct installments on the specified date. If deduction fails due to insufficient funds, the platform reserves the right to immediately freeze the subscriber's postal/bank account without prior notice until settlement.",
            contract_subscriber_name: "Subscriber Name",
            contract_signature_date: "Signature Date",
            contract_signature_label: "Subscriber Signature",
            print_contract: "Print Contract",
            download_contract: "Download Contract",
            pricing_page_title: "Flexible Subscription Plans",
            pricing_page_subtitle: "Choose the plan that suits your needs and enjoy instant shopping",
            about_hero_title: "Adjil: A Revolution in Digital Commerce in Algeria",
            about_hero_subtitle: "We are not just a payment app, we are your financial partner seeking to reshape the relationship between the merchant and the consumer in Algeria through innovative \"Buy Now, Pay Later\" solutions.",
            no_interest_fees: "0% Interest or hidden fees",
            empower_families: "Empowering Families",
            empower_families_desc: "Providing essential needs on time without delay.",
            security_privacy: "Security & Privacy",
            security_privacy_desc: "Protecting your data and transactions with the highest digital encryption standards.",
            support_merchants: "Support Local Merchants",
            support_merchants_desc: "Increased customer purchasing power means more sales and faster growth for stores.",
            digitize_finance: "Digitizing Financial Transactions",
            digitize_finance_desc: "Reducing reliance on cash and moving towards modern electronic payment."
        }
    },
    renderMerchants: () => {
        const users = DB.get('users') || [];
        const merchants = users.filter(u => u.role === 'merchant');
        const container = document.getElementById('dynamic-merchants-container');
        const searchInput = document.getElementById('merchants-search');
        const t = app.translations[app.lang];

        const updateUI = (filtered) => {
            if (filtered.length === 0) {
                container.innerHTML = `<p class="text-center col-span-full py-12 text-slate-500" data-t="no_merchants">${t.no_merchants}</p>`;
                return;
            }
            container.innerHTML = filtered.map(m => `
                <div class="glass-effect p-8 rounded-3xl border border-white/10 tilt-hover space-y-6">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white">${m.name}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs text-primary font-bold uppercase tracking-widest">${m.activity || t.merchant_activity}</span>
                                <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-300 font-mono">ID: ${m.id}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex items-start gap-3 text-sm text-slate-400">
                            <i class="fa-solid fa-location-dot mt-1 text-primary"></i>
                            <span>${m.location || t.merchant_location}</span>
                        </div>
                    </div>

                    <a href="https://www.google.com/maps/search/?api=1&query=${m.coords || m.location}" target="_blank" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-map-location-dot"></i>
                        <span>${t.view_on_map}</span>
                    </a>
                </div>
            `).join('');
        };

        updateUI(merchants);

        if (searchInput) {
            searchInput.oninput = (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = merchants.filter(m =>
                    m.name.toLowerCase().includes(term) ||
                    (m.activity && m.activity.toLowerCase().includes(term))
                );
                updateUI(filtered);
            };
        }
    },
    filterMerchantSuggestions: () => {
        const input = document.getElementById('pay-merchant-name');
        const suggestionsBox = document.getElementById('merchant-suggestions');
        const term = input.value.toLowerCase();
        const users = DB.get('users') || [];
        const merchants = users.filter(u => u.role === 'merchant');

        if (!term) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        const filtered = merchants.filter(m => m.name.toLowerCase().includes(term));

        if (filtered.length > 0) {
            suggestionsBox.classList.remove('hidden');
            suggestionsBox.innerHTML = filtered.map(m => `
                <div onclick="app.selectMerchantSuggestion('${m.name}')" class="p-4 hover:bg-primary/20 cursor-pointer border-b border-slate-800 last:border-0 transition-colors">
                    <div class="font-bold text-white">${m.name}</div>
                    <div class="text-[10px] text-slate-500">${m.activity || ''}</div>
                </div>
            `).join('');
        } else {
            suggestionsBox.classList.add('hidden');
        }
    },
    selectMerchantSuggestion: (name) => {
        document.getElementById('pay-merchant-name').value = name;
        document.getElementById('merchant-suggestions').classList.add('hidden');
    },
    generateCardNumber: (userId) => {
        const base = '54230000';
        const suffix = String(userId).padStart(8, '0');
        const digits = base + suffix.slice(-8);
        return digits.match(/.{1,4}/g).join(' ');
    },
    generateMerchantPin: (pinSet) => {
        const existing = pinSet || new Set((DB.get('users') || []).filter(u => u.role === 'merchant' && u.pin).map(u => String(u.pin).padStart(4, '0')));
        let pin = '';
        let attempts = 0;
        do {
            pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
            attempts += 1;
        } while (existing.has(pin) && attempts < 200);
        if (pinSet) pinSet.add(pin);
        return pin;
    },
    setLanguage: (lang) => {
        app.lang = lang;
        document.getElementById('current-lang-text').textContent = lang.toUpperCase();
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        localStorage.setItem('adjil_lang', lang);

        app.translateUI();
        // Refresh current view if needed
        if (window.location.hash) router.resolve();
    },
    toggleLanguage: () => {
        const langs = ['ar', 'fr', 'en'];
        const nextIdx = (langs.indexOf(app.lang) + 1) % langs.length;
        app.setLanguage(langs[nextIdx]);
    },
    toggleTheme: () => {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('adjil_theme', isLight ? 'light' : 'dark');
        app.updateThemeIcon(isLight);
    },
    updateThemeIcon: (isLight) => {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = isLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        }
    },
    initTheme: () => {
        const saved = localStorage.getItem('adjil_theme');
        const isLight = saved === 'light';
        if (isLight) {
            document.body.classList.add('light-mode');
        }
        app.updateThemeIcon(isLight);
    },
    translateUI: () => {
        const t = app.translations[app.lang];
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            if (t[key]) {
                // Handle standard text content
                if (el.children.length === 0) {
                    el.textContent = t[key];
                }
                // Handle attributes (placeholder, title, alt)
                if (el.hasAttribute('placeholder')) el.placeholder = t[key];
                if (el.hasAttribute('title')) el.setAttribute('title', t[key]);
                if (el.tagName === 'IMG' && el.hasAttribute('alt')) el.setAttribute('alt', t[key]);
            }
        });
        // Update specific elements that might not have children or need special handling
        const navLinks = document.querySelectorAll('nav .hidden.md\\:flex a');
        if (navLinks.length >= 5) {
            navLinks[0].textContent = t.home;
            navLinks[1].textContent = t.how_it_works;
            navLinks[2].textContent = t.pricing;
            navLinks[3].textContent = t.about;
            navLinks[4].textContent = t.developers;
        }
        const authBtnText = document.getElementById('auth-btn-text');
        if (authBtnText && !app.user) authBtnText.textContent = t.login;

        // Toggle current lang indicator
        const currentLangText = document.getElementById('current-lang-text');
        if (currentLangText) currentLangText.textContent = app.lang.toUpperCase();

        // Adjust eye icon position based on direction
        const eyeBtns = [document.getElementById('auth-pass-btn'), document.getElementById('reg-pass-btn')];
        eyeBtns.forEach(btn => {
            if (btn) {
                if (app.lang === 'ar') {
                    btn.classList.remove('right-3');
                    btn.classList.add('left-3');
                } else {
                    btn.classList.remove('left-3');
                    btn.classList.add('right-3');
                }
            }
        });

        // Adjust contract text alignment
        const contractContent = document.getElementById('contract-modal-content');
        if (contractContent) {
            contractContent.dir = app.lang === 'ar' ? 'rtl' : 'ltr';
            contractContent.style.textAlign = app.lang === 'ar' ? 'right' : 'left';
        }
    },
    animateValue: (id, start, end, duration) => {
        if (start === end) return;
        const obj = document.getElementById(id);
        if (!obj) return;
        const range = end - start;
        let current = start;
        const increment = end > start ? Math.ceil(range / (duration / 16)) : Math.floor(range / (duration / 16));
        const step = () => {
            current += increment;
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                obj.textContent = end.toLocaleString();
            } else {
                obj.textContent = current.toLocaleString();
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    },
    togglePassword: (id) => {
        const input = document.getElementById(id);
        const eye = document.getElementById(id + '-eye');
        if (input.type === 'password') {
            input.type = 'text';
            eye.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            eye.classList.replace('fa-eye-slash', 'fa-eye');
        }
    },
    forgotPassword: () => {
        const t = app.translations[app.lang];
        const email = prompt(app.lang === 'ar' ? 'يرجى إدخال بريدك الإلكتروني أو رقم هاتفك لاستعادة كلمة المرور:' : 'Please enter your email or phone to reset password:');
        if (email) {
            alert(t.forgot_password_sent + email);
        }
    },
    init: () => {
        const savedLang = localStorage.getItem('adjil_lang');
        if (savedLang) app.setLanguage(savedLang);

        // Initialize theme
        app.initTheme();

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    console.log('Service Worker Registered!', reg);
                    console.log('Service Worker scope:', reg.scope);
                    console.log('Service Worker state:', reg.active ? 'active' : 'installing');
                })
                .catch(err => console.log('SW Registration Failed:', err));
        } else {
            console.log('Service Worker not supported');
        }
        
        // Debug: Check if running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App is running in standalone mode (installed)');
        } else {
            console.log('App is running in browser mode (not installed)');
        }
        
        // Debug: Check if beforeinstallprompt is supported
        if ('onbeforeinstallprompt' in window) {
            console.log('beforeinstallprompt event is supported');
        } else {
            console.log('beforeinstallprompt event is NOT supported');
        }


        

        

        
        // Debug: Log service worker status
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                console.log('Service Worker is ready:', reg);
            });
        }
        


        setTimeout(() => DB.supabase.syncUsers(), 1000);
        setTimeout(() => window.AuthService?.migrateLocalToCloud?.(), 1500);
        window.addEventListener('online', () => {
            window.SyncService?.syncPendingWrites?.();
            if (app.user?.role === 'merchant') {
                window.SyncService?.fetchMerchantTransactionsFromSupabase?.(app.user.id);
            }
        });

        // Real-time Sync between Customer and Merchant
        window.addEventListener('storage', (e) => {
            if (e.key === 'adjil_users' || e.key === 'adjil_session') {
                const session = localStorage.getItem('adjil_session');
                if (session) {
                    const latestUsers = DB.get('users') || [];
                    const currentUser = JSON.parse(session);
                    const updatedUser = latestUsers.find(u => u.id === currentUser.id);

                    if (updatedUser) {
                        // Check if it's a new transaction for merchant notification
                        const oldTxCount = (app.user?.txs || []).length;
                        const newTxCount = (updatedUser.txs || []).length;

                        app.user = updatedUser;
                        localStorage.setItem('adjil_session', JSON.stringify(app.user));
                        app.updateDashboardUI();

                        if (app.user.role === 'merchant' && newTxCount > oldTxCount) {
                            app.showPaymentNotification();
                        }
                    }
                }
            }
        });

        // Migration: Ensure card numbers exist for all users
        const usersDB = DB.get('users');
        if (usersDB) {
            let changed = false;
            usersDB.forEach(u => {
                if (!u.cardNumber) {
                    u.cardNumber = app.generateCardNumber(u.id);
                    changed = true;
                }
            });
            if (changed) DB.set('users', usersDB);
        }
        if (usersDB) {
            let changed = false;
            usersDB.forEach(u => {
                if (u.role === 'customer') {
                    if (u.status == null) {
                        u.status = (u.balance || 0) > 0 ? 'active' : 'inactive';
                        changed = true;
                    }
                    if (u.credit_limit == null) {
                        u.credit_limit = (u.balance || 0) > 0 ? u.balance : 0;
                        changed = true;
                    }
                    if (u.subscription_plan === undefined) {
                        u.subscription_plan = null;
                        changed = true;
                    }
                    if ((u.balance || 0) < 0) {
                        u.balance = 0;
                        changed = true;
                    }
                    if ((u.credit_limit || 0) < 0) {
                        u.credit_limit = 0;
                        changed = true;
                    }
                } else {
                    if (u.status == null) {
                        u.status = 'active';
                        changed = true;
                    }
                    if (u.credit_limit == null) {
                        u.credit_limit = 0;
                        changed = true;
                    }
                    if (u.subscription_plan === undefined) {
                        u.subscription_plan = null;
                        changed = true;
                    }
                }
            });
            if (changed) DB.set('users', usersDB);
        }
        if (usersDB) {
            const regenFlag = localStorage.getItem('adjil_pins_regenerated');
            if (!regenFlag) {
                const pinSetAll = new Set();
                let pinsChanged = false;
                usersDB.forEach(u => {
                    if (u.role === 'merchant') {
                        u.pin = app.generateMerchantPin(pinSetAll);
                        pinsChanged = true;
                        if (window.SyncService) window.SyncService.updateMerchantProfile(u.id, { pin: u.pin });
                    }
                });
                if (pinsChanged) {
                    DB.set('users', usersDB);
                    localStorage.setItem('adjil_pins_regenerated', '1');
                }
            }
        }
        if (usersDB) {
            const pinSet = new Set(usersDB.filter(u => u.role === 'merchant' && u.pin).map(u => String(u.pin).padStart(4, '0')));
            let pinChanged = false;
            usersDB.forEach(u => {
                if (u.role === 'merchant' && (!u.pin || String(u.pin).length !== 4)) {
                    u.pin = app.generateMerchantPin(pinSet);
                    pinChanged = true;
                    if (window.SyncService) window.SyncService.updateMerchantProfile(u.id, { pin: u.pin });
                }
            });
            if (pinChanged) DB.set('users', usersDB);
        }

        if (window.AuthService) {
            window.AuthService.subscribe((user) => {
                app.user = user;
                const authBtnText = document.getElementById('auth-btn-text');
                if (authBtnText && user?.name) authBtnText.textContent = user.name;

                if (app.user) {
                    const users = DB.get('users') || [];
                    const updated = users.find(u => u.id === app.user.id);
                    if (updated) {
                        app.user = updated;
                        localStorage.setItem('adjil_session', JSON.stringify(app.user));
                    }
                }

                if (!app.user && window.location.hash.slice(1) === '/dashboard') {
                    router.navigate('/auth');
                }
            });
        } else {
            const session = localStorage.getItem('adjil_session');
            if (session) {
                app.user = JSON.parse(session);
                const authBtnText = document.getElementById('auth-btn-text');
                if (authBtnText) authBtnText.textContent = app.user.name;
            }
            // Refresh session from DB to get latest balance/txs
            if (app.user) {
                const users = DB.get('users');
                const updated = users.find(u => u.id === app.user.id);
                if (updated) {
                    app.user = updated;
                    localStorage.setItem('adjil_session', JSON.stringify(app.user));
                }
            }
        }
        router.resolve();
        app.startPolling();
    },
    startPolling: () => {
        // Poll for updates every 5 seconds
        setInterval(() => {
            if (app.user) {
                // Refresh data from DB
                const users = DB.get('users');
                const updated = users.find(u => u.id === app.user.id);
                if (updated) {
                    const oldBalance = app.user.balance;
                    app.user = updated;
                    localStorage.setItem('adjil_session', JSON.stringify(app.user));

                    // Visual feedback if balance changed (e.g. approved while merchant was away)
                    if (oldBalance !== app.user.balance) {
                        app.updateDashboardUI();
                        app.notifyLowBalance(app.user);
                    }
                }

                // If merchant, specifically refresh pending list
                if (app.user.role === 'merchant') {
                    app.updateDashboardUI();
                }
            }
            if (navigator.onLine && window.SyncService) {
                window.SyncService.syncPendingWrites();
                if (app.user?.role === 'merchant') {
                    window.SyncService.fetchMerchantTransactionsFromSupabase(app.user.id);
                }
            }
        }, 5000);
    },
    notifyTransaction: (tx) => {
        if (!app.user) return;
        const isCustomer = app.user.role === 'customer';
        const title = isCustomer ? 'تم الدفع بنجاح' : 'استلام دفعة جديدة';
        const body = isCustomer
            ? `تم دفع ${tx.amount} دج لمتجر ${tx.merchant}`
            : `استلمت ${tx.amount} دج من زبون آجل`;

        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon: 'assets/A.svg' });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => {
                    if (p === 'granted') new Notification(title, { body, icon: 'assets/A.svg' });
                });
            }
        }
        app.logToApiConsole(`${title} - ${body}`, 'success');
    },
    submitCashCollection: async (txId) => {
        if (!app.user || app.user.role !== 'merchant') return;
        const users = DB.get('users') || [];
        const merchantIdx = users.findIndex(u => u.id === app.user.id);
        if (merchantIdx === -1) return;
        const sourceTx = (users[merchantIdx].txs || []).find(t => t.id === txId);
        if (!sourceTx) return;
        if (sourceTx.method === 'BNPL_CASH_COLLECTION') {
            alert(app.lang === 'ar' ? 'هذه الفاتورة محصلة نقداً مسبقاً' : 'This invoice was already collected in cash');
            return;
        }
        if (sourceTx.cashCollectionSubmitted) {
            alert(app.lang === 'ar' ? 'تم إرسال طلب التحصيل النقدي مسبقاً' : 'Cash collection request already submitted');
            return;
        }
        const invoiceNumber = `CASH-INV-${Date.now()}`;
        const storeNumber = app.user.pin ? String(app.user.pin).padStart(4, '0') : String(app.user.id || '').slice(0, 8);
        const createdAt = new Date().toISOString();
        const cashTx = {
            id: `CASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: Number(sourceTx.amount || 0),
            merchant: app.lang === 'ar' ? 'تحصيل نقدي من الزبون' : 'Cash Collection from Customer',
            merchantPin: storeNumber,
            merchantActivity: app.user.activity || '',
            merchantLocation: app.user.location || app.user.wilaya || '',
            customerName: sourceTx.customerName || '',
            customerCard: sourceTx.customerCard || '',
            date: new Date(createdAt).toLocaleString(app.lang === 'ar' ? 'ar-DZ' : 'en-US'),
            status: 'pending',
            method: 'BNPL_CASH_COLLECTION',
            invoiceNumber,
            storeNumber,
            linkedTxId: sourceTx.id,
            paymentChannel: 'cash',
            cashCollected: true,
            cashCollectedAt: createdAt,
            cashCollectionStatus: 'submitted_to_admin',
            created_at: createdAt
        };
        sourceTx.cashCollectionSubmitted = true;
        sourceTx.cashCollectionInvoice = invoiceNumber;
        sourceTx.cashCollectionAt = createdAt;
        users[merchantIdx].txs = users[merchantIdx].txs || [];
        users[merchantIdx].txs.push(cashTx);
        users[merchantIdx].outstanding = Math.max(0, Number(users[merchantIdx].outstanding || 0) - Number(sourceTx.amount || 0));
        DB.set('users', users);
        app.user = users[merchantIdx];
        localStorage.setItem('adjil_session', JSON.stringify(app.user));
        const cashRequests = JSON.parse(localStorage.getItem('adjil_cash_collection_requests') || '[]');
        cashRequests.push({
            id: cashTx.id,
            merchantId: app.user.id,
            merchantName: app.user.name,
            amount: cashTx.amount,
            sourceTxId: sourceTx.id,
            invoiceNumber,
            storeNumber,
            created_at: createdAt,
            status: 'pending_admin_review'
        });
        localStorage.setItem('adjil_cash_collection_requests', JSON.stringify(cashRequests));
        SyncService.enqueue({
            type: 'transaction',
            payload: {
                id: cashTx.id,
                created_at: createdAt,
                amount: cashTx.amount,
                status: 'pending',
                method: 'BNPL_CASH_COLLECTION',
                merchant_id: app.user.id,
                customer_id: null,
                merchant_name: app.user.name,
                merchant_pin: storeNumber,
                merchant_activity: app.user.activity || '',
                merchant_location: app.user.location || app.user.wilaya || '',
                customer_name: sourceTx.customerName || '',
                customer_card: sourceTx.customerCard || '',
                idempotency_key: invoiceNumber
            },
            updates: {
                customer: { id: app.user.id, balance: app.user.balance || 0 },
                merchant: { id: app.user.id, balance: app.user.balance || 0, outstanding: app.user.outstanding || 0 }
            }
        });
        SyncService.syncPendingWrites();
        app.updateDashboardUI();
        const modal = document.getElementById('invoice-detail-modal');
        if (modal) modal.classList.add('hidden');
        alert(app.lang === 'ar'
            ? 'تم إرسال فاتورة التحصيل النقدي إلى فريق Adjil بنجاح'
            : 'Cash collection invoice has been sent to Adjil admin team');
    },
    requestApiSettlement: async () => {
        if (!app.user || app.user.role !== 'merchant') return;

        const outstanding = app.user.outstanding || 0;

        if (outstanding <= 0) {
            alert(app.lang === 'ar' ? 'لا توجد مبالغ للتحصيل' : 'No funds to settle');
            return;
        }

        const btn = document.getElementById('merch-settle-btn');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i>`;

            app.logToApiConsole(
                app.lang === 'ar' ? 'جاري تحصيل المبالغ عبر API إلى حساب التاجر...' : 'Processing API Settlement to Merchant Bank/CCP...',
                'info'
            );

            setTimeout(() => {
                const users = DB.get('users') || [];
                const idx = users.findIndex(u => u.id === app.user.id);
                if (idx >= 0) {
                    const totalSettled = users[idx].outstanding || 0;
                    users[idx].balance = 0; // Keeping this 0 just to clean up any legacy bad data
                    users[idx].outstanding = 0;

                    if (!users[idx].txs) users[idx].txs = [];
                    users[idx].txs.push({
                        id: 'STL-' + Date.now(),
                        amount: totalSettled,
                        merchant: 'Bank Transfer (API)',
                        date: new Date().toLocaleString('ar-DZ'),
                        status: 'completed',
                        method: 'API_SETTLEMENT'
                    });

                    DB.set('users', users);
                    app.user = users[idx];
                    localStorage.setItem('adjil_session', JSON.stringify(app.user));

                    app.logToApiConsole(
                        app.lang === 'ar' ? `نجاح التحويل البنكي للمبلغ: ${totalSettled} دج` : `Successful bank transfer of: ${totalSettled} DZD`,
                        'success'
                    );

                    app.updateDashboardUI();
                    alert(app.lang === 'ar' ? 'تم تحصيل المبالغ وتحويلها لحسابكم البنكي/البريدي بنجاح' : 'Funds successfully settled to your bank account');
                }

                btn.disabled = false;
                btn.innerHTML = originalText;
            }, 2000);
        }
    },
    notifyLowBalance: (user) => {
        if (!user || user.role !== 'customer') return;
        if ((user.balance || 0) > 2000) return;
        const key = `adjil_low_balance_${user.id}`;
        const last = parseInt(localStorage.getItem(key) || '0', 10);
        if (Date.now() - last < 6 * 60 * 60 * 1000) return;
        localStorage.setItem(key, String(Date.now()));
        const title = 'تنبيه: رصيدك في آجل قارب على الانتهاء';
        const body = `رصيدك الحالي: ${(user.balance || 0).toLocaleString()} دج`;
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => {
                    if (p === 'granted') new Notification(title, { body });
                });
            }
        }
        app.sendLowBalanceEmail(user);
    },
    sendLowBalanceEmail: async (user) => {
        if (!user?.email || !window.supabaseClient || typeof window.supabaseClient.functions?.invoke !== 'function') return;
        try {
            await window.supabaseClient.functions.invoke('send-support-email', {
                body: {
                    type: 'low_balance',
                    to_email: user.email,
                    user_email: user.email,
                    subject: 'تنبيه: رصيدك في آجل قارب على الانتهاء',
                    description: `رصيدك الحالي: ${(user.balance || 0).toLocaleString()} دج`
                }
            });
        } catch (err) {
        }
    },
    posAmount: 0,
    clearPosAmount: () => {
        app.posAmount = 0;
        app.updatePosDisplay();
        document.getElementById('dynamic-qr-section')?.classList.add('hidden');
    },
    addPosManualAmount: () => {
        const input = document.getElementById('pos-manual-amount');
        if (!input) return;
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            app.posAmount += val;
            app.updatePosDisplay();
            input.value = '';
        } else {
            alert(app.lang === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
        }
    },
    simulateBarcodeScan: () => {
        app.posAmount += 500;
        app.updatePosDisplay();
    },
    updatePosDisplay: () => {
        const display = document.getElementById('pos-total-display');
        if (display) display.innerHTML = `${app.posAmount.toLocaleString()} <span class="text-lg">دج</span>`;
        if (app.posAmount <= 0) {
            document.getElementById('dynamic-qr-section')?.classList.add('hidden');
        }
    },
    generateMerchantQR: () => {
        // Check if user is logged in and is a merchant
        if (!app.user) {
            alert(app.lang === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
            router.navigate('/auth');
            return;
        }
        
        if (app.user.role !== 'merchant') {
            alert(app.lang === 'ar' ? 'هذه الميزة متاحة للتجار فقط' : 'This feature is only for merchants');
            return;
        }
        
        if (app.posAmount <= 0) {
            alert(app.lang === 'ar' ? 'يرجى إدخال مبلغ أكبر من الصفر أولاً' : 'Please enter an amount > 0 first');
            return;
        }
        
        // Try to find elements - look in both document and cloned template
        let container = document.getElementById('merch-qr-container');
        let section = document.getElementById('dynamic-qr-section');
        let amountDisplay = document.getElementById('qr-amount-display');
        
        // If not found in main document, look in template
        if (!container || !section) {
            const template = document.getElementById('tpl-dash-merchant');
            if (template) {
                container = template.content.getElementById('merch-qr-container');
                section = template.content.getElementById('dynamic-qr-section');
            }
        }
        
        // If still not found, try to find in app container
        if (!container || !section) {
            const appContainer = document.getElementById('app');
            if (appContainer) {
                container = appContainer.querySelector('#merch-qr-container');
                section = appContainer.querySelector('#dynamic-qr-section');
                amountDisplay = appContainer.querySelector('#qr-amount-display');
            }
        }
        
        if (!container || !section) {
            console.error('[QR] Container or section not found');
            alert(app.lang === 'ar' ? 'حدث خطأ في عرض QR' : 'Error displaying QR');
            return;
        }

        // Check if QRCode is available - try both QRCode and qrcode
        const QRCodeLib = window.QRCode || window.qrcode;
        if (!QRCodeLib) {
            console.error('[QR] QRCode library not loaded');
            alert('Error: QR Code library not loaded. Please refresh the page.');
            return;
        }

        container.innerHTML = '';
        
        // Create ultra-compact QR data using simple string format instead of JSON
        // Format: ID|AMT|NAME|PIN
        const userId = app.user.id.replace(/-/g, '').substring(0, 12);
        const name = (app.user.name || '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
        const pin = app.user.pin ? String(app.user.pin).padStart(4, '0') : '0000';
        const qrData = `${userId}|${app.posAmount}|${name}|${pin}`;
        
        console.log('[QR] Generating for merchant:', app.user.id, 'amount:', app.posAmount, 'data:', qrData);
        
        console.log('[QR] Generating for merchant:', app.user.id, 'amount:', app.posAmount, 'data length:', qrData.length);

        try {
            new QRCodeLib(container, {
                text: qrData,
                width: 150,
                height: 150,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCodeLib.CorrectLevel ? QRCodeLib.CorrectLevel.H : 'H'
            });
            
            // Show the section
            section.classList.remove('hidden');
            
            // Update amount display
            if (amountDisplay) amountDisplay.textContent = app.posAmount.toLocaleString();
            
            console.log('[QR] Generated successfully');
        } catch (e) {
            console.error('[QR] Generation error:', e);
            alert('Error generating QR: ' + e.message);
        }
    },
    updateDashboardUI: () => {
        const menuContainer = document.getElementById('user-menu-container');
        const dropdown = document.getElementById('user-dropdown-menu');
        if (!app.user) {
            if (menuContainer) {
                menuContainer.onmouseenter = null;
                menuContainer.onmouseleave = null;
            }
            if (dropdown) dropdown.classList.add('hidden');
            return;
        }

        // Add hover effect
        if (menuContainer && dropdown) {
            menuContainer.onmouseenter = () => dropdown.classList.remove('hidden');
            menuContainer.onmouseleave = () => dropdown.classList.add('hidden');
            dropdown.onclick = () => dropdown.classList.add('hidden');
        }

        // Update nav button text
        const authBtnText = document.getElementById('auth-btn-text');
        if (authBtnText) authBtnText.textContent = app.user.name;

        if (window.location.hash !== '#/dashboard') return;

        const balanceEl = document.getElementById('dash-balance');
        const nameEl = document.getElementById('dash-user-name');
        const holderEl = document.getElementById('card-holder-name');
        const cardNumberEl = document.getElementById('card-number');
        const txList = document.getElementById('dash-tx-list');
        const merchNameEl = document.getElementById('merch-user-name');
        const merchSalesEl = document.getElementById('merch-total-sales');
        const merchReceivedEl = document.getElementById('merch-received');
        const merchOutstandingEl = document.getElementById('merch-outstanding');
        const merchTxList = document.getElementById('merch-tx-list');
        const merchActivityEl = document.getElementById('merch-activity');
        const merchLocationEl = document.getElementById('merch-location');
        const merchPinEl = document.getElementById('merch-pin');

        app.translateUI();

        if (balanceEl) balanceEl.textContent = app.user.balance.toLocaleString();
        if (nameEl) nameEl.textContent = app.user.name;
        if (holderEl) holderEl.textContent = app.user.name;
        if (cardNumberEl && app.user.cardNumber) {
            // Show full 16 digits formatted with spaces
            cardNumberEl.textContent = app.user.cardNumber;
        }
        if (merchNameEl) merchNameEl.textContent = app.user.name;
        if (merchActivityEl) merchActivityEl.textContent = app.user.activity || '';
        if (merchLocationEl) {
            const locText = app.user.location || app.user.wilaya || '';
            if (app.user.coords) {
                merchLocationEl.innerHTML = `<a href="https://www.google.com/maps/search/?api=1&query=${app.user.coords}" target="_blank" class="text-primary hover:underline">${locText || app.user.coords}</a>`;
            } else {
                merchLocationEl.textContent = locText;
            }
        }
        if (merchPinEl) merchPinEl.textContent = app.user.pin ? String(app.user.pin).padStart(4, '0') : '';

        // If Customer and No Plan, show CTA
        if (app.user.role === 'customer' && !app.user.subscription_plan) {
            const container = document.getElementById('app');
            const t = app.translations[app.lang];
            const dashHeader = container.querySelector('.flex.flex-col.md\\:flex-row.justify-between');
            if (dashHeader && !document.getElementById('plan-activation-banner')) {
                const banner = document.createElement('div');
                banner.id = 'plan-activation-banner';
                banner.className = 'bg-primary/10 border border-primary/20 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-slide-up';
                banner.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xl">
                            <i class="fa-solid fa-bolt"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">${app.lang === 'ar' ? 'قم بتفعيل رصيدك الآن' : app.lang === 'fr' ? 'Activez votre crédit maintenant' : 'Activate your credit now'}</h3>
                            <p class="text-xs text-slate-400">${app.lang === 'ar' ? 'اختر باقة اشتراك للحصول على رصيدك الائتماني الفوري.' : app.lang === 'fr' ? 'Choisissez un plan d\'abonnement pour obtenir votre crédit instantanément.' : 'Choose a subscription plan to get your instant credit limit.'}</p>
                        </div>
                    </div>
                    <button onclick="router.navigate('/pricing')" class="bg-primary hover:bg-blue-400 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20">
                        ${app.lang === 'ar' ? 'عرض الباقات المتاحة' : app.lang === 'fr' ? 'Voir les plans disponibles' : 'View Available Plans'}
                    </button>
                `;
                dashHeader.parentNode.insertBefore(banner, dashHeader.nextSibling);
            }
        }

        // Check if customer has pending subscription request
        const checkPendingRequest = async () => {
            if (window.supabaseClient && app.user?.id) {
                try {
                    const { data } = await window.supabaseClient
                        .from('subscription_requests')
                        .select('*')
                        .eq('user_id', app.user.id)
                        .eq('status', 'pending')
                        .maybeSingle();
                    
                    if (data) {
                        // Show pending status banner
                        const container = document.getElementById('app');
                        const dashHeader = container.querySelector('.flex.flex-col.md\\:flex-row.justify-between');
                        if (dashHeader && !document.getElementById('pending-request-banner')) {
                            const pendingBanner = document.createElement('div');
                            pendingBanner.id = 'pending-request-banner';
                            pendingBanner.className = 'bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-[2rem] mb-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-slide-up';
                            pendingBanner.innerHTML = `
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xl">
                                        <i class="fa-solid fa-clock"></i>
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-bold text-white">${app.lang === 'ar' ? 'طلبك قيد المراجعة' : app.lang === 'fr' ? 'Votre demande en cours de révision' : 'Your request is under review'}</h3>
                                        <p class="text-xs text-slate-400">${app.lang === 'ar' ? 'طلب اشتراكك قيد الانتظار من طرف الإدارة. سيتم إشعارك فور التأكيد.' : app.lang === 'fr' ? 'Votre demande d\'abonnement est en attente d\'approbation. Vous serez notifié une fois examinée.' : 'Your subscription request is pending approval. You will be notified once reviewed.'}</p>
                                    </div>
                                </div>
                                <button onclick="router.navigate('/dashboard')" class="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-8 py-3 rounded-xl font-bold transition-all border border-yellow-500/30">
                                    ${app.lang === 'ar' ? 'عرض حالتي' : app.lang === 'fr' ? 'Vérifier le statut' : 'Check Status'}
                                </button>
                            `;
                            dashHeader.parentNode.insertBefore(pendingBanner, dashHeader.nextSibling);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to check pending requests:', e);
                }
            }
        };

        // Only check for pending requests if no subscription plan
        if (app.user.role === 'customer' && !app.user.subscription_plan) {
            checkPendingRequest();
        }

        if (app.user.role === 'merchant') {
            const receivedAmount = (app.user.txs || []).filter(tx => tx.method === 'API_SETTLEMENT' || tx.method === 'AUTO_SCAN_SETTLEMENT').reduce((sum, tx) => sum + tx.amount, 0);
            const totalSales = (app.user.txs || []).filter(tx => tx.method !== 'API_SETTLEMENT' && tx.method !== 'AUTO_SCAN_SETTLEMENT').reduce((sum, tx) => sum + tx.amount, 0);

            if (merchSalesEl) merchSalesEl.textContent = totalSales.toLocaleString();
            if (merchReceivedEl) merchReceivedEl.textContent = receivedAmount.toLocaleString();

            // Animate outstanding balance
            if (merchOutstandingEl) {
                const targetVal = app.user.outstanding || 0;
                const currentVal = parseInt(merchOutstandingEl.textContent.replace(/,/g, '')) || 0;
                if (currentVal !== targetVal) {
                    app.animateValue('merch-outstanding', currentVal, targetVal, 1000);
                } else {
                    merchOutstandingEl.textContent = targetVal.toLocaleString();
                }
            }
        }

        if (txList && app.user.role === 'customer' && app.user.txs) {
            const t = app.translations[app.lang];
            if (app.user.txs.length > 0) {
                txList.innerHTML = app.user.txs.map(tx => `
                    <div onclick="app.showInvoiceModal('${tx.id}')" class="flex items-center justify-between p-4 bg-slate-900/30 rounded-2xl border border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 ${tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center">
                                <i class="fa-solid ${tx.status === 'pending' ? 'fa-clock' : (tx.merchant.includes('غذائية') ? 'fa-basket-shopping' : tx.merchant.includes('بنزين') ? 'fa-gas-pump' : tx.merchant.includes('صيدلية') ? 'fa-pills' : tx.merchant.includes('فندق') ? 'fa-hotel' : 'fa-receipt')}"></i>
                            </div>
                            <div>
                                <div class="text-white font-bold text-sm">${tx.merchant}</div>
                                <div class="text-[10px] text-slate-500 font-mono">${tx.date}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-white font-black text-sm">-${tx.amount} دج</div>
                            <div class="text-[8px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 inline-block mt-1">${tx.status === 'pending' ? t.status_pending : t.status_success}</div>
                        </div>
                    </div>
                `).reverse().join('');
            } else {
                txList.innerHTML = `<div class="text-center py-12 text-slate-500"><i class="fa-solid fa-receipt text-4xl mb-4 opacity-20"></i><p>${t.no_transactions}</p></div>`;
            }
        }

        // Handle sub-confirm logic
        if (window.location.hash === '#/sub-confirm' && app.pendingPlan) {
            const planEl = document.getElementById('sub-confirm-plan');
            const amountEl = document.getElementById('sub-confirm-amount');
            if (planEl && amountEl) {
                const plan = app.pendingPlan;
                const price = plan === 'monthly' ? 500 : plan === '6months' ? 400 : 300;
                const creditLimit = plan === 'monthly' ? 10000 : plan === '6months' ? 15000 : 25000;
                const label = app.lang === 'ar' 
                    ? (plan === 'monthly' ? 'شهري' : plan === '6months' ? '6 أشهر' : 'سنوي')
                    : app.lang === 'fr'
                    ? (plan === 'monthly' ? 'Mensuel' : plan === '6months' ? '6 Mois' : 'Annuel')
                    : (plan === 'monthly' ? 'Monthly' : plan === '6months' ? '6 Months' : 'Annual');
                planEl.textContent = label;
                // Show credit limit instead of subscription price
                amountEl.textContent = `${creditLimit.toLocaleString()} دج`;
            }
        }

        // Handle API report logic
        if (window.location.hash === '#/api') {
            app.renderDeductionReport();
        }

        // Animate Customer Balance
        if (balanceEl && app.user.role === 'customer') {
            const targetVal = app.user.balance || 0;
            // Force a re-read of the current displayed value to ensure animation starts from correct point
            const currentText = balanceEl.textContent.replace(/,/g, '');
            const currentVal = parseInt(currentText) || 0;

            if (currentVal !== targetVal) {
                app.animateValue('dash-balance', currentVal, targetVal, 1000);
            } else {
                balanceEl.textContent = targetVal.toLocaleString();
            }
        }

        if (merchTxList && app.user.role === 'merchant') {
            const completedTxs = (app.user.txs || []).slice().sort((a, b) => {
                const da = new Date(a.created_at || a.date || 0).getTime();
                const db = new Date(b.created_at || b.date || 0).getTime();
                return db - da;
            });
            const t = app.translations[app.lang];
            let html = '';

            if (completedTxs.length > 0) {
                html += completedTxs.map(tx => `
                    <div onclick="app.showInvoiceModal('${tx.id}')" class="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 ${tx.method === 'BNPL_CASH_COLLECTION' ? 'bg-amber-500/15 text-amber-400' : (tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-[#10b981]/10 text-[#10b981]')} rounded-full flex items-center justify-center">
                                <i class="fa-solid ${tx.method === 'BNPL_CASH_COLLECTION' ? 'fa-hand-holding-dollar' : 'fa-arrow-down'}"></i>
                            </div>
                            <div>
                                <div class="text-white font-bold">${tx.method === 'BNPL_CASH_COLLECTION' ? (app.lang === 'ar' ? 'فاتورة تحصيل نقدي مرسلة للإدارة' : 'Cash collection invoice sent to admin') : `${t.sale_from || 'Sale from'} ID ${tx.customerCard || ''}`}</div>
                                <div class="text-[10px] text-slate-500 font-mono">${tx.date}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-[#10b981] font-black text-sm drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]">+${tx.amount} دج</div>
                            <div class="text-[8px] px-1.5 py-0.5 rounded ${tx.method === 'BNPL_CASH_COLLECTION' ? 'bg-amber-500/20 text-amber-400' : (tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-[#10b981]/20 text-[#10b981]')} inline-block mt-1">${tx.method === 'BNPL_CASH_COLLECTION' ? (app.lang === 'ar' ? 'محصل نقدًا' : 'Cash Collected') : (tx.status === 'pending' ? (t.collecting || 'Collecting') : (t.status_success || 'Success'))}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                html = `<div class="text-center py-12 text-slate-500"><i class="fa-solid fa-receipt text-4xl mb-4 opacity-20"></i><p>${t.no_sales}</p></div>`;
            }
            merchTxList.innerHTML = html;
        }
    },
    showInvoiceModal: (txId) => {
        if (!app.user || !app.user.txs) return;
        const tx = app.user.txs.find(t => t.id === txId);
        if (!tx) return;

        // Ensure we have a modal container or create one if it doesn't exist
        let modal = document.getElementById('invoice-detail-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'invoice-detail-modal';
            modal.className = 'fixed inset-0 z-[200] hidden items-center justify-center px-4';
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="this.parentElement.classList.add('hidden')"></div>
                <div class="glass-effect bg-slate-900/95 border border-white/10 w-full max-w-md rounded-[2rem] p-6 relative shadow-2xl animate-fade-in-up">
                    <button type="button" onclick="document.getElementById('invoice-detail-modal').classList.add('hidden')" class="absolute top-4 left-4 text-slate-400 hover:text-white">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                    <div class="text-center mb-6 pt-2">
                        <div class="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                            <i class="fa-solid fa-file-invoice"></i>
                        </div>
                        <h2 class="text-xl font-bold text-white">تفاصيل الفاتورة</h2>
                        <p class="text-xs text-slate-400 font-mono mt-1" id="inv-modal-id"></p>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div class="flex justify-between items-center py-3 border-b border-slate-800">
                            <span class="text-slate-400 text-sm">التاريخ</span>
                            <span class="text-white font-medium text-sm" id="inv-modal-date"></span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-slate-800">
                            <span class="text-slate-400 text-sm">الزبون</span>
                            <span class="text-white font-medium text-sm" id="inv-modal-customer"></span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-slate-800">
                            <span class="text-slate-400 text-sm">البطاقة</span>
                            <span class="text-white font-mono text-sm" id="inv-modal-card"></span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-slate-800">
                            <span class="text-slate-400 text-sm">الحالة</span>
                            <span class="text-primary font-medium text-sm" id="inv-modal-status"></span>
                        </div>
                    </div>
                    
                    <div class="bg-slate-900 rounded-xl p-4 flex justify-between items-center mb-6 border border-slate-800">
                        <span class="text-slate-300 font-bold">المبلغ الإجمالي</span>
                        <span class="text-2xl font-black text-white" id="inv-modal-amount"></span>
                    </div>
                    
                    <button id="inv-modal-download-btn" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-download"></i> تحميل الفاتورة
                    </button>
                    <button id="inv-modal-cash-btn" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-3 hidden">
                        <i class="fa-solid fa-file-invoice-dollar"></i> إرسال فاتورة تحصيل نقدي إلى Adjil
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Update modal content
        document.getElementById('inv-modal-id').textContent = tx.id;
        document.getElementById('inv-modal-date').textContent = tx.date;
        document.getElementById('inv-modal-customer').textContent = tx.customerName || (tx.customerCard ? `ID ${tx.customerCard}` : 'Unknown');
        document.getElementById('inv-modal-card').textContent = tx.customerCard || 'N/A';
        document.getElementById('inv-modal-status').textContent = tx.status === 'pending' ? 'قيد التحصيل' : 'مكتملة';
        document.getElementById('inv-modal-status').className = `font-medium text-sm ${tx.status === 'pending' ? 'text-yellow-500' : 'text-[#10b981]'}`;
        document.getElementById('inv-modal-amount').textContent = `${tx.amount.toLocaleString()} دج`;

        document.getElementById('inv-modal-download-btn').onclick = () => app.downloadInvoice(tx);
        const cashBtn = document.getElementById('inv-modal-cash-btn');
        if (cashBtn) {
            const canRequestCash = app.user.role === 'merchant' && tx.method !== 'BNPL_CASH_COLLECTION' && tx.method !== 'API_SETTLEMENT' && tx.method !== 'AUTO_SCAN_SETTLEMENT' && !tx.cashCollectionSubmitted;
            cashBtn.classList.toggle('hidden', !canRequestCash);
            if (canRequestCash) {
                cashBtn.onclick = () => app.submitCashCollection(tx.id);
            }
        }

        modal.classList.remove('hidden');
    },
    qrScannerObj: null,
    startQRScanner: () => {
        // Check if Html5Qrcode is available
        if (typeof Html5Qrcode === 'undefined') {
            console.error('[QR Scanner] Html5Qrcode library not loaded');
            alert(app.lang === 'ar' ? 'خطأ: مكتبة الكاميرا غير محملة' : 'Error: Camera library not loaded');
            return;
        }
        
        const modal = document.getElementById('qr-scanner-modal');
        if (!modal) {
            console.error('[QR Scanner] Modal not found');
            return;
        }
        
        // Show modal properly
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Update text based on language
        const titleEl = document.getElementById('qr-scanner-title');
        const descEl = document.getElementById('qr-scanner-desc');
        const lang = app.lang || 'ar';
        
        if (titleEl) {
            titleEl.textContent = lang === 'ar' ? 'مسح كود التاجر' : lang === 'fr' ? 'Scanner le code Marchand' : 'Scan Merchant QR';
        }
        if (descEl) {
            descEl.textContent = lang === 'ar' ? 'وجّه الكاميرا نحو الكود (QR) لإتمام الدفع' 
                : lang === 'fr' ? 'Pointez la caméra vers le code QR pour effectuer le paiement' 
                : 'Point camera at QR code to complete payment';
        }

        if (!app.qrScannerObj) {
            app.qrScannerObj = new Html5Qrcode("qr-reader");
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

        app.qrScannerObj.start(
            { facingMode: "environment" },
            config,
            (decodedText, result) => {
                console.log('[QR Scanner] Scanned:', decodedText);
                app.onQRScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore continuous scanning errors
            }
        ).catch(err => {
            console.error('[QR Scanner] Camera error:', err);
            const errMsg = app.lang === 'ar' 
                ? "فشل فتح الكاميرا. تحقق من الصلاحيات." 
                : err.message?.includes('Permission')
                ? "تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا."
                : "فشل فتح الكاميرا. تحقق من الصلاحيات.";
            alert(errMsg);
            app.stopQRScanner();
        });
    },
    stopQRScanner: () => {
        const modal = document.getElementById('qr-scanner-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }

        if (app.qrScannerObj && app.qrScannerObj.isScanning) {
            app.qrScannerObj.stop().catch(console.error);
        }
    },
    onQRScanSuccess: (decodedText) => {
        console.log('[QR] Scan result:', decodedText);
        app.stopQRScanner();

        // Try new pipe-separated format first: ID|AMT|NAME|PIN
        const parts = decodedText.split('|');
        if (parts.length >= 2) {
            const merchantIdPart = parts[0];
            const amount = parts[1];
            
            // Check if it looks like our format (first part is hex/ID, second is number)
            if (/^[a-fA-F0-9]+$/.test(merchantIdPart) && /^\d+$/.test(amount)) {
                console.log('[QR] Valid payment QR format:', merchantIdPart, amount);
                setTimeout(() => app.openQRPaymentBoard(merchantIdPart, amount, {
                    n: parts[2] || '',
                    s: parts[3] || ''
                }), 300);
                return;
            }
        }

        // Try JSON format (for backwards compatibility)
        try {
            const data = JSON.parse(decodedText);
            if (data.m && data.a) {
                console.log('[QR] Valid payment QR (JSON):', data.m, data.a);
                setTimeout(() => app.openQRPaymentBoard(data.m, data.a, data), 300);
                return;
            }
        } catch (e) {
            // Not JSON either
        }

        // Try as merchant ID
        if (decodedText.startsWith('adjil-merch-') || decodedText.length > 5) {
            setTimeout(() => app.openQRPaymentBoard(decodedText, ''), 300);
        } else {
            alert(app.lang === 'ar' ? 'رمز QR غير صالح لمعاملة الدفع' : 'Invalid QR Code for payment');
        }
    },

    openQRPaymentBoard: async (merchantId, amount, merchantSnapshot = null) => {
        console.log('[QR Payment] Opening for merchant:', merchantId, 'amount:', amount);
        
        let merchant = null;
        const users = DB.get('users') || [];
        
        // Try to find merchant by exact ID
        merchant = users.find(u => u.role === 'merchant' && u.id === merchantId);
        
        // If not found, try partial ID match (UUID without dashes)
        if (!merchant) {
            merchant = users.find(u => u.role === 'merchant' && u.id.replace(/-/g, '').startsWith(merchantId));
        }
        
        // If still not found, try matching by name from snapshot
        if (!merchant && merchantSnapshot?.n) {
            merchant = users.find(u => u.role === 'merchant' && u.name === merchantSnapshot.n);
        }
        
        // Try to fetch from Supabase if not found locally
        if (!merchant && window.SyncService?.fetchMerchantFromSupabase) {
            console.log('[QR Payment] Fetching merchant from Supabase...');
            await window.SyncService.fetchMerchantFromSupabase(merchantId);
            const refreshedUsers = DB.get('users') || [];
            merchant = refreshedUsers.find(u => u.role === 'merchant' && u.id === merchantId);
            if (!merchant) {
                merchant = refreshedUsers.find(u => u.role === 'merchant' && u.id.replace(/-/g, '').startsWith(merchantId));
            }
        }
        
        // Create merchant from snapshot if available
        if (!merchant && merchantSnapshot?.n) {
            console.log('[QR Payment] Creating merchant from snapshot');
            merchant = {
                id: merchantId,
                role: 'merchant',
                name: merchantSnapshot.n,
                activity: '',
                location: '',
                pin: merchantSnapshot.s || null,
                balance: 0,
                outstanding: 0,
                status: 'active'
            };
            
            // Add to local DB so recordTransaction can find it
            const users = DB.get('users') || [];
            users.push(merchant);
            DB.set('users', users);
            console.log('[QR Payment] Merchant added to local DB');
        }
        
        if (!merchant) {
            console.error('[QR Payment] Merchant not found:', merchantId);
            alert(app.lang === 'ar' ? 'التاجر غير موجود. يرجى التأكد من صحة الكود.' : 'Merchant not found. Please verify the QR code.');
            return;
        }
        
        const paymentAmount = Number(amount);
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            console.error('[QR Payment] Invalid amount:', amount);
            alert(app.lang === 'ar' ? 'قيمة QR غير صالحة: المبلغ غير متوفر' : 'Invalid QR data: amount is missing');
            return;
        }
        
        console.log('[QR Payment] Merchant found:', merchant.name, 'Amount:', paymentAmount);
        const merchantLocation = merchant.location || merchant.wilaya || merchantSnapshot?.loc || '';
        const merchantActivity = merchant.activity || merchantSnapshot?.ac || '';

        // Create QR payment board modal
        let modal = document.getElementById('qr-payment-board-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qr-payment-board-modal';
            modal.className = 'fixed inset-0 z-[200] flex items-center justify-center px-4';
            
            const lang = app.lang || 'ar';
            const confirmText = lang === 'ar' ? 'تأكيد الدفع' : lang === 'fr' ? 'Confirmer le paiement' : 'Confirm Payment';
            const cancelText = lang === 'ar' ? 'إلغاء' : lang === 'fr' ? 'Annuler' : 'Cancel';
            const noticeText = lang === 'ar' 
                ? 'تنبيه: بالضغط على تأكيد الدفع سيتم الخصم مباشرة من رصيدك إلى رصيد التاجر دون طلب PIN.' 
                : lang === 'fr'
                ? 'Attention: en confirmant le paiement, le montant sera débité directement de votre solde vers le solde du commerçant sans code PIN.'
                : 'Notice: by confirming payment, amount will be deducted directly from your balance to merchant balance without PIN.';
            const merchantLabel = lang === 'ar' ? 'التاجر' : lang === 'fr' ? 'Commerçant' : 'Merchant';
            const activityLabel = lang === 'ar' ? 'النشاط' : lang === 'fr' ? 'Activité' : 'Activity';
            const locationLabel = lang === 'ar' ? 'الموقع' : lang === 'fr' ? 'Lieu' : 'Location';
            const storeLabel = lang === 'ar' ? 'رقم المتجر' : lang === 'fr' ? 'Numéro du magasin' : 'Store Number';
            const invoiceLabel = lang === 'ar' ? 'رقم الفاتورة' : lang === 'fr' ? 'Numéro de facture' : 'Invoice Number';
            const totalLabel = lang === 'ar' ? 'المبلغ الإجمالي' : lang === 'fr' ? 'Montant total' : 'Total Amount';
            const subtitle = lang === 'ar' ? 'سيتم خصم المبلغ التالي من رصيدك' : lang === 'fr' ? 'Le montant suivant sera débité de votre solde' : 'The following amount will be deducted from your balance';
            
            modal.innerHTML = `
                <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="app.closeQRPaymentBoard()"></div>
                <div class="glass-effect bg-slate-900/95 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 relative animate-slide-up overflow-hidden shadow-2xl">
                    <button onclick="app.closeQRPaymentBoard()" class="absolute top-6 left-6 text-slate-500 hover:text-white z-10">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                    
                    <div class="text-center mb-8">
                        <div class="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <h3 class="text-2xl font-bold text-white mb-2">${confirmText}</h3>
                        <p class="text-slate-400 text-sm">${subtitle}</p>
                    </div>
                    
                    <div class="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 mb-6">
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-slate-400">${merchantLabel}</span>
                            <span class="text-white font-bold" id="qr-board-merchant-name"></span>
                        </div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-slate-400">${activityLabel}</span>
                            <span class="text-white font-medium" id="qr-board-merchant-activity"></span>
                        </div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-slate-400">${locationLabel}</span>
                            <span class="text-white font-medium" id="qr-board-merchant-location"></span>
                        </div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-slate-400">${storeLabel}</span>
                            <span class="text-white font-medium" id="qr-board-store-number"></span>
                        </div>
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-slate-400">${invoiceLabel}</span>
                            <span class="text-white font-medium font-mono" id="qr-board-invoice-number"></span>
                        </div>
                        <div class="h-px bg-slate-700 my-4"></div>
                        <div class="flex justify-between items-center">
                            <span class="text-slate-300 font-bold">${totalLabel}</span>
                            <span class="text-3xl font-black text-primary" id="qr-board-amount"></span>
                        </div>
                    </div>
                    <p class="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4" id="qr-board-warning-text">${noticeText}</p>
                    
                    <div class="space-y-4">
                        <button onclick="app.confirmQRPayment()" id="qr-confirm-pay-btn" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 flex items-center justify-center gap-2">
                            <i class="fa-solid fa-check-circle"></i>
                            <span>${confirmText}</span>
                        </button>
                        <button onclick="app.closeQRPaymentBoard()" class="w-full text-slate-400 hover:text-white text-sm font-bold transition-all">
                            ${cancelText}
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
        const storeNumber = merchant.pin ? String(merchant.pin).padStart(4, '0') : (merchantSnapshot?.s || String(merchant.id || '').slice(0, 8));
        // Update modal content
        document.getElementById('qr-board-merchant-name').textContent = merchant.name;
        document.getElementById('qr-board-merchant-activity').textContent = merchantActivity;
        document.getElementById('qr-board-merchant-location').textContent = merchantLocation;
        document.getElementById('qr-board-store-number').textContent = storeNumber;
        document.getElementById('qr-board-invoice-number').textContent = invoiceNumber;
        
        const lang = app.lang || 'ar';
        document.getElementById('qr-board-warning-text').textContent = lang === 'ar'
            ? 'تنبيه: بالضغط على تأكيد الدفع سيتم الخصم مباشرة من رصيدك إلى رصيد التاجر دون طلب PIN.'
            : lang === 'fr'
            ? 'Attention: en confirmant le paiement, le montant sera débité directement de votre solde vers le solde du commerçant sans code PIN.'
            : 'Notice: by confirming payment, amount will be deducted directly from your balance to merchant balance without PIN.';
        
        document.getElementById('qr-board-amount').textContent = `${paymentAmount.toLocaleString()} دج`;

        // Store pending transaction
        app.currentPendingTx = {
            amount: paymentAmount,
            merchantId,
            merchantName: merchant.name,
            invoiceNumber,
            storeNumber,
            merchantActivity,
            merchantLocation
        };

        // Show modal - remove hidden class and add flex
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        console.log('[QR Payment] Modal shown, button should be visible');
    },

    closeQRPaymentBoard: () => {
        const modal = document.getElementById('qr-payment-board-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    },

    confirmQRPayment: () => {
        console.log('[QR Payment] confirmQRPayment called');
        
        if (!app.currentPendingTx) {
            alert(app.lang === 'ar' ? 'لا توجد عملية دفع معلّقة' : 'No pending payment found');
            return;
        }
        
        // Check subscription plan for customer
        if (app.user?.role === 'customer' && !app.user.subscription_plan) {
            alert(app.lang === 'ar' ? 'يرجى تفعيل الاشتراك أولاً للدفع' : app.lang === 'fr' ? 'Veuillez activer votre abonnement d\'abord pour effectuer des paiements' : 'Please activate your subscription first to make payments');
            router.navigate('/pricing');
            return;
        }
        
        const { amount, merchantId, merchantName, invoiceNumber, storeNumber, merchantActivity, merchantLocation } = app.currentPendingTx;
        const t = app.translations[app.lang];
        
        const paymentAmount = Number(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            alert(app.lang === 'ar' ? 'مبلغ غير صالح' : 'Invalid amount');
            return;
        }

        if (app.user?.status && app.user.status !== 'active') {
            alert(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');
            return;
        }
        
        if (paymentAmount > app.user.balance) {
            alert(t.insufficient_balance);
            return;
        }

        const btn = document.getElementById('qr-confirm-pay-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i>`;

        setTimeout(async () => {
            let tx;
            try {
                tx = await window.SyncService.recordTransaction({
                    customerId: app.user.id,
                    merchantId,
                    amount: paymentAmount,
                    method: 'BNPL_QR',
                    merchantName,
                    customerName: app.user.name,
                    customerCard: app.user.cardNumber
                });
            } catch (err) {
                alert(err.message || 'Error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }
            app.updateDashboardUI();

            // Show Success
            app.closeQRPaymentBoard();
            tx.invoiceNumber = invoiceNumber;
            tx.storeNumber = storeNumber;
            tx.merchantActivity = tx.merchantActivity || merchantActivity;
            tx.merchantLocation = tx.merchantLocation || merchantLocation;
            document.getElementById('success-amount').textContent = amount.toLocaleString() + ' دج';
            document.getElementById('success-merchant').textContent = merchantName;
            document.getElementById('success-tx-id').textContent = tx.id;

            const downloadBtn = document.getElementById('download-invoice-btn');
            if (downloadBtn) downloadBtn.onclick = () => app.downloadInvoice(tx);

            // Trigger storage event for other tabs
            window.dispatchEvent(new Event('storage'));

            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 1500);
    },
    openPaymentModal: (type = 'manual', merchantId = '', amount = '') => {
        const modal = document.getElementById('payment-modal');
        const manual = document.getElementById('manual-payment-content');

        if (modal) modal.classList.remove('hidden');
        if (manual) manual.classList.remove('hidden');

        // Hide other contents
        const pinContent = document.getElementById('pin-verification-content');
        const successContent = document.getElementById('success-payment-content');
        if (pinContent) pinContent.classList.add('hidden');
        if (successContent) successContent.classList.add('hidden');

        // Reset to Step 1
        const dueBoard = document.getElementById('due-board');
        const methodBoard = document.getElementById('method-board');
        if (dueBoard) dueBoard.classList.remove('hidden');
        if (methodBoard) methodBoard.classList.add('hidden');

        // Reset Inputs
        const amtInput = document.getElementById('due-amount');
        const idInput = document.getElementById('market-id');
        const pinInput = document.getElementById('pay-pin');

        if (amtInput) amtInput.value = amount;
        if (idInput) idInput.value = merchantId;
        if (pinInput) pinInput.value = '';

        // Reset Stepper
        const stepLine = document.getElementById('modal-step-line');
        const s2 = document.getElementById('mstep-2');

        if (stepLine) stepLine.style.width = '0%';
        if (s2) {
            s2.classList.replace('bg-primary', 'bg-slate-800');
            s2.classList.replace('text-white', 'text-slate-500');
        }

        // Auto-advance if QR and data is present
        if (type === 'qr' && merchantId && amount) {
            setTimeout(() => {
                app.dueAmountOk();
            }, 300);
        }
    },

    closePaymentModal: () => {
        const modal = document.getElementById('payment-modal');
        if (modal) modal.classList.add('hidden');
    },

    dueAmountOk: () => {
        const amtInput = document.getElementById('due-amount');
        const amount = parseFloat(amtInput.value);
        const t = app.translations[app.lang];

        if (!amount || amount <= 0) return alert(app.lang === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Invalid Amount');
        if (app.user?.status && app.user.status !== 'active') return alert(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');
        
        // Check subscription plan for customer
        if (app.user?.role === 'customer' && !app.user.subscription_plan) {
            alert(app.lang === 'ar' ? 'يرجى تفعيل الاشتراك أولاً للدفع' : app.lang === 'fr' ? 'Veuillez activer votre abonnement d\'abord pour effectuer des paiements' : 'Please activate your subscription first to make payments');
            router.navigate('/pricing');
            return;
        }
        
        if (amount > app.user.balance) return alert(t.insufficient_balance);

        const idInput = document.getElementById('market-id');
        const merchantId = idInput ? idInput.value : '';

        // If merchantId is a UUID from QR flow, route to QR confirmation board (no customer PIN)
        if (merchantId && merchantId.length > 5) {
            app.closePaymentModal();
            app.openQRPaymentBoard(merchantId, amount);
            return;
        }

        const displayAmount = document.getElementById('method-board-amount-display');
        if (displayAmount) {
            displayAmount.textContent = `${amount.toLocaleString()} دج`;
            displayAmount.classList.remove('hidden');
        }

        // Move to Step 2
        document.getElementById('due-board').classList.add('hidden');
        document.getElementById('method-board').classList.remove('hidden');

        // Update Stepper
        document.getElementById('modal-step-line').style.width = '100%';
        const s2 = document.getElementById('mstep-2');
        if (s2) {
            s2.classList.replace('bg-slate-800', 'bg-primary');
            s2.classList.replace('text-slate-500', 'text-white');
        }
    },

    backToAmount: () => {
        document.getElementById('method-board').classList.add('hidden');
        document.getElementById('due-board').classList.remove('hidden');

        // Update Stepper
        document.getElementById('modal-step-line').style.width = '0%';
        const s2 = document.getElementById('mstep-2');
        if (s2) {
            s2.classList.replace('bg-primary', 'bg-slate-800');
            s2.classList.replace('text-white', 'text-slate-500');
        }
    },

    executeDirectPayment: () => {
        const pinEl = document.getElementById('market-id');
        const mPin = (pinEl?.value || '').trim();
        if (!/^\d{4}$/.test(mPin)) {
            return alert(app.lang === 'ar' ? 'يرجى إدخال رمز تاجر مكوّن من 4 أرقام' : 'Please enter a 4-digit merchant PIN');
        }
        const users = DB.get('users') || [];
        const t = app.translations[app.lang];

        // Validate Merchant PIN
        const merchant = users.find(u => u.role === 'merchant' && String(u.pin).padStart(4, '0') === mPin);

        if (!merchant) return alert(app.lang === 'ar' ? 'رمز PIN التاجر غير صحيح' : 'Incorrect Merchant PIN');
        if (merchant.id === app.user.id) return alert(app.lang === 'ar' ? 'خطأ: لا يمكن الدفع لنفس الحساب' : "Error: Self-payment not allowed");

        const amountInput = document.getElementById('due-amount');
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) return alert(t.invalid_amount);
        
        if (app.user?.status && app.user.status !== 'active') return alert(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');
        if (amount > app.user.balance) return alert(t.insufficient_balance);
        const merchantName = merchant.name;

        const btn = document.getElementById('real-pay-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i>`;

        setTimeout(async () => {
            let tx;
            try {
                tx = await window.SyncService.recordTransaction({
                    customerId: app.user.id,
                    merchantId: merchant.id,
                    amount,
                    method: 'BNPL_MANUAL',
                    merchantName: merchant.name,
                    customerName: app.user.name,
                    customerCard: app.user.cardNumber
                });
            } catch (err) {
                alert(err.message || 'Error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }
            app.updateDashboardUI();

            // Show Success UI
            document.getElementById('manual-payment-content').classList.add('hidden');
            document.getElementById('success-payment-content').classList.remove('hidden');

            document.getElementById('success-amount').textContent = Number(amount).toLocaleString() + ' دج';
            document.getElementById('success-merchant').textContent = merchantName;
            document.getElementById('success-tx-id').textContent = tx.id;

            const downloadBtn = document.getElementById('download-invoice-btn');
            if (downloadBtn) downloadBtn.onclick = () => app.downloadInvoice(tx);

            window.dispatchEvent(new Event('storage'));

            btn.disabled = false;
            btn.innerHTML = originalText;
            
            // Clear inputs
            if (pinEl) pinEl.value = '';
            if (amountInput) amountInput.value = '';
        }, 1500);
    },

    confirmPinPayment: () => {
        const pinInput = document.getElementById('pay-pin').value;
        const t = app.translations[app.lang];

        if (!pinInput) return alert(app.lang === 'ar' ? 'يرجى إدخال رمز PIN' : 'Enter PIN');
        if (pinInput !== app.user.pin) return alert(app.lang === 'ar' ? 'رمز PIN خاطئ' : 'Wrong PIN');
        if (app.user?.status && app.user.status !== 'active') return alert(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');

        const { amount, merchantId, merchantName } = app.currentPendingTx;
        const users = DB.get('users');
        const custIdx = users.findIndex(u => u.id === app.user.id);
        const merchIdx = users.findIndex(u => u.id == merchantId);

        if (custIdx === -1 || merchIdx === -1) return alert("System Error: User not found");

        const btn = document.querySelector('#pin-verification-content button');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i>`;

        setTimeout(async () => {
            let tx;
            try {
                tx = await window.SyncService.recordTransaction({
                    customerId: app.user.id,
                    merchantId,
                    amount,
                    method: 'BNPL_DIRECT',
                    merchantName,
                    customerName: app.user.name,
                    customerCard: app.user.cardNumber
                });
            } catch (err) {
                alert(err.message || 'Error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                return;
            }
            app.updateDashboardUI();

            // Show Success
            document.getElementById('pin-verification-content').classList.add('hidden');
            document.getElementById('success-payment-content').classList.remove('hidden');

            document.getElementById('success-amount').textContent = amount.toLocaleString() + ' دج';
            document.getElementById('success-merchant').textContent = merchantName;
            document.getElementById('success-tx-id').textContent = tx.id;

            const downloadBtn = document.getElementById('download-invoice-btn');
            if (downloadBtn) downloadBtn.onclick = () => app.downloadInvoice(tx);

            // Trigger storage event for other tabs
            window.dispatchEvent(new Event('storage'));

            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 1500);
    },

    downloadInvoice: (tx) => {
        const html = `
            <!DOCTYPE html> <html lang="${app.lang}" dir="${app.lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Invoice ${tx.id}</title>
                <style>body{font - family: sans-serif;padding:20px} .box{border:1px solid #ddd;border-radius:12px;padding:20px;max-width:600px;margin:0 auto} .row{display:flex;justify-content:space-between;margin:10px 0;border-bottom:1px solid #eee;padding-bottom:10px} h1{text - align:center;color:#FF5F00} .logo{text-align:center;margin-bottom:20px} .logo img{height:60px;width:auto}</style></head>
                <body><div class="box">
                    <div class="logo" style="text-align: center; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
    <svg width="30" height="30" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 55 L50 25 L80 55" stroke="#10b981" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 70 L50 55 L65 70" stroke="#111" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size: 24px; font-weight: 900; letter-spacing: -1.2px; color: #111; font-family: sans-serif;">AD<span style="color: #10b981;">JIL</span>-BNPL</span>
</div>
                    <h1>Adjil Invoice / فاتورة</h1>
                    <div class="row"><span>Transaction ID</span><span>${tx.id}</span></div>
                    <div class="row"><span>Customer</span><span>${tx.customerName}</span></div>
                    <div class="row"><span>Merchant</span><span>${tx.merchant}</span></div>
                    <div class="row"><span>Store Number</span><span>${tx.storeNumber || tx.merchantPin || ''}</span></div>
                    <div class="row"><span>Invoice Number</span><span>${tx.invoiceNumber || tx.id}</span></div>
                    <div class="row"><span>Merchant PIN</span><span>${tx.merchantPin || ''}</span></div>
                    <div class="row"><span>Activity</span><span>${tx.merchantActivity || ''}</span></div>
                    <div class="row"><span>Location</span><span>${tx.merchantLocation || ''}</span></div>
                    <div class="row"><span>Date</span><span>${tx.date}</span></div>
                    <div class="row"><span>Amount</span><span style="font-weight:bold">${tx.amount} DZD</span></div>
                    <div style="text-align:center;margin-top:20px;font-size:12px;color:#888">Generated by Adjil Platform</div>
                </div></body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Adjil_Invoice_${tx.id}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
    openDigitalContract: () => {
        const modal = document.getElementById('contract-modal');
        if (modal) modal.classList.remove('hidden');
    },
    closeDigitalContract: () => {
        const modal = document.getElementById('contract-modal');
        if (modal) modal.classList.add('hidden');
    },
    printDigitalContract: () => {
        const content = document.getElementById('contract-modal-content');
        const printArea = document.getElementById('print-area');
        if (!content || !printArea) return;
        const prev = printArea.innerHTML;
        printArea.innerHTML = content.innerHTML;
        window.print();
        setTimeout(() => {
            printArea.innerHTML = prev;
        }, 500);
    },
    downloadDigitalContract: () => {
        const t = app.translations[app.lang];
        const title = t.digital_contract || 'Adjil Digital Contract';
        const desc = t.digital_contract_desc || '';
        const html = `
        <!DOCTYPE html> <html lang="${app.lang}" dir="${app.lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${title}</title>
            <style>
                body{font - family:'Cairo','Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#f3f4f6;color:#111827;margin:0;padding:32px}
                .page{max - width:900px;margin:0 auto;background:#ffffff;border-radius:16px;box-shadow:0 20px 45px rgba(15,23,42,0.25);padding:32px 32px 40px;border:1px solid #e5e7eb}
                h1{font - size:24px;margin:0 0 4px;font-weight:800;color:#111827}
                h2{font - size:18px;margin:20px 0 8px;font-weight:700;color:#111827}
                p{margin:4px 0;font-size:14px;line-height:1.8}
                .subtitle{font - size:12px;color:#6b7280;margin-bottom:16px}
                .section-header{font - weight:700;font-size:14px;margin:12px 0 4px}
                .meta{display:flex;justify-content:space-between;gap:16px;margin:16px 0 24px;font-size:12px;color:#4b5563}
                .meta div span{font - weight:600;color:#111827}
                .signatures{margin - top:28px;border-top:1px solid #e5e7eb;padding-top:20px;font-size:13px}
                .sig-row{display:flex;flex-wrap:wrap;gap:24px;margin-bottom:18px}
                .sig-block{flex:1 1 260px}
                .line{border - bottom:1px dotted #9ca3af;height:20px;margin-top:4px}
                .sig-box{border:1px dashed #9ca3af;border-radius:12px;height:70px;margin-top:6px}
                .footnote{margin - top:24px;font-size:11px;color:#9ca3af;text-align:${app.lang === 'ar' ? 'right' : 'left'}}
                .logo{text-align:center;margin-bottom:24px} .logo img{height:80px;width:auto}
            </style></head>
        <body>
            <div class="page">
                <div class="logo" style="text-align: center; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;">
    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 55 L50 25 L80 55" stroke="#10b981" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M35 70 L50 55 L65 70" stroke="#111" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size: 28px; font-weight: 900; letter-spacing: -1.5px; color: #111; font-family: sans-serif;">AD<span style="color: #10b981;">JIL</span>-BNPL</span>
</div>
                <h1>${title}</h1>
                <div class="subtitle">${desc}</div>
                <div class="meta">
                    <div>${app.lang === 'ar' ? 'الطرف الأول: منصة آجل (Adjil BNPL)' : app.lang === 'fr' ? 'Partie A : Plateforme Adjil BNPL' : 'Party A: Adjil BNPL Platform'}</div>
                    <div>${app.lang === 'ar' ? 'الطرف الثاني: المشترك (زبون / تاجر)' : app.lang === 'fr' ? 'Partie B : Abonné (Client / Marchand)' : 'Party B: Subscriber (Customer / Merchant)'}</div>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art1_title}</div>
                    <p>${t.contract_art1_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art2_title}</div>
                    <p>${t.contract_art2_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art3_title}</div>
                    <p>${t.contract_art3_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art4_title}</div>
                    <p>${t.contract_art4_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art5_title}</div>
                    <p>${t.contract_art5_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art6_title}</div>
                    <p>${t.contract_art6_desc}</p>
                </div>

                <div class="section">
                    <div class="section-header">${t.contract_art7_title}</div>
                    <p>${t.contract_art7_desc}</p>
                </div>

                <div class="signatures">
                    <div class="sig-row">
                        <div class="sig-block">
                            <div>${t.contract_subscriber_name}</div>
                            <div class="line"></div>
                        </div>
                        <div class="sig-block">
                            <div>${t.contract_signature_date}</div>
                            <div class="line"></div>
                        </div>
                    </div>
                    <div class="sig-row">
                        <div class="sig-block">
                            <div>${t.contract_signature_label}</div>
                            <div class="sig-box"></div>
                        </div>
                    </div>
                </div>

                <div class="footnote">
                    ${app.lang === 'ar'
                ? 'تم إنشاء هذا العقد رقمياً عبر منصة آجل BNPL. هذا المستند مخصص للاستعمال القانوني والإداري من طرف المشترك.'
                : app.lang === 'fr'
                    ? 'Ce contrat est généré numériquement par la plateforme Adjil BNPL. Ce document est destiné à l\'usage juridique et administratif par l\'abonné.'
                    : 'This digital contract is generated by Adjil BNPL Platform and is intended for legal and administrative use by the subscriber.'}
                </div>
            </div>
        </body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Adjil_Digital_Contract.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
    setAuthTab: (tab) => {
        const loginForm = document.getElementById('auth-login-form');
        const registerForm = document.getElementById('auth-register-form');
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');

        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            tabLogin.classList.add('bg-primary', 'text-white');
            tabLogin.classList.remove('text-slate-400');
            tabRegister.classList.remove('bg-primary', 'text-white');
            tabRegister.classList.add('text-slate-400');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            tabRegister.classList.add('bg-primary', 'text-white');
            tabRegister.classList.remove('text-slate-400');
            tabLogin.classList.remove('bg-primary', 'text-white');
            tabLogin.classList.add('text-slate-400');

        // Populate wilayas if empty
        const wilayaSelect = document.getElementById('reg-wilaya');
        if (wilayaSelect && wilayaSelect.children.length <= 1) {
            wilayaSelect.innerHTML = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = app.lang === 'ar' ? '-- اختر الولاية --' : (app.lang === 'fr' ? '-- Choisir la Wilaya --' : '-- Select Wilaya --');
            defaultOpt.disabled = true;
            defaultOpt.selected = true;
            wilayaSelect.appendChild(defaultOpt);

            WILAYAS.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = w;
                wilayaSelect.appendChild(opt);
            });
        }
        }
    },
    setRegRole: (role) => {
        app.regRole = role;
        const custFields = document.getElementById('reg-customer-fields');
        const merchFields = document.getElementById('reg-merchant-fields');
        const btnCust = document.getElementById('role-customer');
        const btnMerch = document.getElementById('role-merchant');

        if (role === 'customer') {
            if (custFields) custFields.classList.remove('hidden');
            if (merchFields) merchFields.classList.add('hidden');
            if (btnCust) {
                btnCust.classList.add('bg-primary', 'text-white');
                btnCust.classList.remove('text-slate-400');
            }
            if (btnMerch) {
                btnMerch.classList.remove('bg-primary', 'text-white');
                btnMerch.classList.add('text-slate-400');
            }
        } else {
            if (custFields) custFields.classList.add('hidden');
            if (merchFields) merchFields.classList.remove('hidden');
            if (btnMerch) {
                btnMerch.classList.add('bg-primary', 'text-white');
                btnMerch.classList.remove('text-slate-400');
            }
            if (btnCust) {
                btnCust.classList.remove('bg-primary', 'text-white');
                btnCust.classList.add('text-slate-400');
            }
        }
    },
    goToRegister: (role) => {
        app.regRole = role;
        router.navigate('/auth');
        setTimeout(() => {
            app.setAuthTab('register');
            app.setRegRole(role);
        }, 150);
    },
    nextRegPhase: () => {
        const t = app.translations[app.lang];
        const fname = document.getElementById('reg-firstname').value;
        const lname = document.getElementById('reg-lastname').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const pass = document.getElementById('reg-password').value;

        if (!fname || !lname || !pass) {
            alert(t.fill_required);
            return;
        }

        app.regPhase = 2;
        document.getElementById('reg-phase-1').classList.add('hidden');
        document.getElementById('reg-phase-2').classList.remove('hidden');

        // Update indicators
        document.getElementById('reg-step-line').style.width = '100%';
        document.getElementById('reg-step-2-indicator').classList.replace('bg-slate-800', 'bg-primary');
        document.getElementById('reg-step-2-indicator').classList.replace('text-slate-500', 'text-white');
    },
    prevRegPhase: () => {
        app.regPhase = 1;
        document.getElementById('reg-phase-2').classList.add('hidden');
        document.getElementById('reg-phase-1').classList.remove('hidden');

        // Update indicators
        document.getElementById('reg-step-line').style.width = '0%';
        document.getElementById('reg-step-2-indicator').classList.replace('bg-primary', 'bg-slate-800');
        document.getElementById('reg-step-2-indicator').classList.replace('text-white', 'text-slate-500');
    },
    uploadKYCDocument: async (file, type) => {
        if (!app.user) return null;

        const fileExt = file.name.split('.').pop();
        const fileName = `${app.user.id}/${type}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Try Supabase Storage
        if (window.supabaseClient) {
            try {
                const { error: uploadError } = await window.supabaseClient.storage
                    .from('user-documents')
                    .upload(filePath, file);

                if (!uploadError) {
                    const { data } = window.supabaseClient.storage
                        .from('user-documents')
                        .getPublicUrl(filePath);

                    const publicUrl = data.publicUrl;

                    const updates = {};
                    if (type === 'id_front') updates.doc_id_front = publicUrl;
                    else if (type === 'id_back') updates.doc_id_back = publicUrl;
                    else if (type === 'payslip') updates.doc_payslip = publicUrl;
                    else if (type === 'rib') updates.doc_rib = publicUrl;
                    else if (type === 'commercial_register') updates.doc_commercial_register = publicUrl;

                    const { error: updateError } = await window.supabaseClient
                        .from('users')
                        .update(updates)
                        .eq('id', app.user.id);

                    if (!updateError) {
                        app.user = { ...app.user, ...updates };
                        localStorage.setItem('adjil_session', JSON.stringify(app.user));
                        return publicUrl;
                    }
                }
                console.warn('[KYC] Supabase upload failed, falling back to local:', uploadError);
            } catch (err) {
                console.warn('[KYC] Supabase upload exception, falling back to local:', err);
            }
        }

        // 2. Fallback: Store as base64 in localStorage
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const docKey = `doc_${type}`;
            app.user = { ...app.user, [docKey]: base64 };
            localStorage.setItem('adjil_session', JSON.stringify(app.user));

            // Also update in local users list
            const localUsers = JSON.parse(localStorage.getItem('adjil_users') || '[]');
            const idx = localUsers.findIndex(u => u.id === app.user.id);
            if (idx >= 0) {
                localUsers[idx][docKey] = base64;
                localStorage.setItem('adjil_users', JSON.stringify(localUsers));
            }

            console.log('[KYC] Document saved locally:', type);
            return base64;
        } catch (localErr) {
            console.error('[KYC] Local storage failed:', localErr);
            return null;
        }
    },
    register: async () => {
        const t = app.translations[app.lang];
        const fname = document.getElementById('reg-firstname').value;
        const lname = document.getElementById('reg-lastname').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const pass = document.getElementById('reg-password').value;
        const terms = document.getElementById('reg-terms');

        if (terms && !terms.checked) {
            alert(t.must_accept_terms || 'يجب الموافقة على شروط العقد قبل إنشاء الحساب');
            return;
        }

        const uploads = [];
        if (app.regRole === 'customer') {
            const idFront = document.getElementById('reg-cust-id-front').files[0];
            const idBack = document.getElementById('reg-cust-id-back').files[0];
            const payslip = document.getElementById('reg-cust-payslip').files[0];
            const rib = document.getElementById('reg-common-rib').files[0];

            if (idFront) uploads.push({ file: idFront, type: 'id_front' });
            if (idBack) uploads.push({ file: idBack, type: 'id_back' });
            if (payslip) uploads.push({ file: payslip, type: 'payslip' });
            if (rib) uploads.push({ file: rib, type: 'rib' });
        } else {
            const idFront = document.getElementById('reg-merch-id-front').files[0];
            const idBack = document.getElementById('reg-merch-id-back').files[0];
            const cr = document.getElementById('reg-merch-cr').files[0];
            const rib = document.getElementById('reg-common-rib').files[0];

            if (idFront) uploads.push({ file: idFront, type: 'id_front' });
            if (idBack) uploads.push({ file: idBack, type: 'id_back' });
            if (cr) uploads.push({ file: cr, type: 'commercial_register' });
            if (rib) uploads.push({ file: rib, type: 'rib' });
        }

        const btn = document.querySelector('button[data-t="confirm"]');
        const originalText = btn.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = '...';
        }

        try {
            const newId = crypto.randomUUID ? crypto.randomUUID() : 'user-' + Date.now();
            const regLocation = document.getElementById('reg-location-text')?.value || '';
            const regCoords = document.getElementById('reg-coords')?.value || null;
            const newUser = {
                id: newId,
                name: `${fname} ${lname} `,
                email: email,
                phone: phone,
                password: pass,
                role: app.regRole,
                status: 'pending',
                subscription_plan: null,
                credit_limit: 0,
                balance: 0.00,
                outstanding: 0,
                pin: app.regRole === 'merchant' ? app.generateMerchantPin() : '1234',
                wilaya: app.regRole === 'merchant' ? document.getElementById('reg-wilaya').value : null,
                location: regLocation,
                coords: regCoords,
                card_number: app.generateCardNumber(Date.now())
            };

            const res = await window.AuthService.signUp(newUser);
            
            // Auto-login - handle both wrapped {user, mode} and direct user return
            app.user = newUser;
            if (res) {
                if (res.user && res.user.id) {
                    app.user.id = res.user.id; // Supabase format {user, mode}
                } else if (res.id) {
                    app.user.id = res.id; // Direct user format
                }
            }
            
            // Also update the generated ID on newUser
            newUser.id = app.user.id;
            
            // Sync to Supabase if not already synced
            if (window.supabaseClient && res && res.mode === 'local') {
                try {
                    const syncRow = { ...app.user };
                    delete syncRow.synced;
                    delete syncRow.isLocal;
                    await window.supabaseClient.from('users').upsert([syncRow], { onConflict: 'id' });
                    console.log('[Register] User synced to Supabase');
                } catch (syncErr) {
                    console.warn('[Register] Supabase sync failed, will retry later:', syncErr);
                }
            }
            
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            app.tempBankDetails = null;

            // Add user to the DB users list so admin and other views can see them
            const currentUsers = DB.get('users') || [];
            const existingIdx = currentUsers.findIndex(u => u.id === app.user.id);
            if (existingIdx >= 0) {
                currentUsers[existingIdx] = app.user;
            } else {
                currentUsers.push(app.user);
            }
            DB.set('users', currentUsers);

            // Handle file uploads now that we have a user ID
            for (const item of uploads) {
                await app.uploadKYCDocument(item.file, item.type);
            }

            alert(t.register_success);

            // Clear inputs
            const inputs = ['reg-firstname', 'reg-lastname', 'reg-email', 'reg-phone', 'reg-password'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            router.navigate('/dashboard');
        } catch (err) {
            console.error('Registration error:', err);
            const msg = err.message || err;
            alert(msg.includes('already exists') || msg.includes('already') ? (t.email_registered || 'Error: User already exists') : msg);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    },
    updatePassword: async () => {
        const newPass = document.getElementById('settings-new-password')?.value;
        const confirmPass = document.getElementById('settings-confirm-password')?.value;

        if (!newPass || newPass.length < 6) {
            alert(app.lang === 'ar' ? 'كلمة السر يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
            return;
        }
        if (newPass !== confirmPass) {
            alert(app.lang === 'ar' ? 'كلمات السر غير متطابقة' : 'Passwords do not match');
            return;
        }

        if (window.supabaseClient) {
            try {
                const { error } = await window.supabaseClient.auth.updateUser({
                    password: newPass
                });
                if (error) throw error;
                alert(app.lang === 'ar' ? 'تم تحديث كلمة السر بنجاح' : 'Password updated successfully');
                
                // Clear fields
                document.getElementById('settings-new-password').value = '';
                document.getElementById('settings-confirm-password').value = '';
            } catch (err) {
                console.error(err);
                alert('Error: ' + err.message);
            }
        } else {
            alert(app.lang === 'ar' ? 'الميزة غير متوفرة في وضع عدم الاتصال' : 'Feature not available in offline mode');
        }
    },
    saveBankDetails: () => {
        const rip = document.getElementById('bank-rip')?.value;
        const rib = document.getElementById('bank-rib')?.value;
        const edahabia = document.getElementById('bank-edahabia')?.value;

        // Determine which one is active (we could also check app.selectedBankType)
        const isCcpActive = !document.getElementById('form-ccp-fields')?.classList.contains('hidden');
        const isCibActive = !document.getElementById('form-cib-fields')?.classList.contains('hidden');
        const isEdahabiaActive = !document.getElementById('form-edahabia-fields')?.classList.contains('hidden');

        if (isCcpActive && !rip) {
            alert(app.lang === 'ar' ? 'يرجى إدخال الحساب البريدي.' : 'Please enter your RIP.');
            return;
        }
        if (isCibActive && !rib) {
            alert(app.lang === 'ar' ? 'يرجى إدخال الحساب البنكي.' : 'Please enter your RIB.');
            return;
        }
        if (isEdahabiaActive && !edahabia) {
            alert(app.lang === 'ar' ? 'يرجى إدخال رقم البطاقة الذهبية.' : 'Please enter your Edahabia card number.');
            return;
        }
        if (!isCcpActive && !isCibActive && !isEdahabiaActive) {
            alert(app.lang === 'ar' ? 'يرجى اختيار نوع الحساب أولاً.' : 'Please select an account type first.');
            return;
        }

        const finalRip = isCcpActive ? rip : '';
        const finalRib = isCibActive ? rib : '';
        const finalEdahabia = isEdahabiaActive ? edahabia : '';

        if (app.user) {
            app.user.bank_details = { rip: finalRip, rib: finalRib, edahabia: finalEdahabia, type: isEdahabiaActive ? 'edahabia' : (isCcpActive ? 'ccp' : 'cib') };
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            const users = DB.get('users') || [];
            const idx = users.findIndex(u => u.id === app.user.id);
            if (idx >= 0) {
                users[idx] = { ...users[idx], bank_details: { rip: finalRip, rib: finalRib, edahabia: finalEdahabia, type: isEdahabiaActive ? 'edahabia' : (isCcpActive ? 'ccp' : 'cib') } };
                DB.set('users', users);
            }
            alert(app.lang === 'ar' ? 'تم حفظ بيانات الحساب بنجاح.' : 'Bank details saved successfully.');
            router.navigate('/dashboard');
        } else {
            app.tempBankDetails = { rip: finalRip, rib: finalRib, edahabia: finalEdahabia, type: isEdahabiaActive ? 'edahabia' : (isCcpActive ? 'ccp' : 'cib') };
            alert(app.lang === 'ar' ? 'تم إضافة تفاصيل الحساب إلى طلب التسجيل.' : 'Bank details attached to your registration.');
            router.navigate('/auth');
            setTimeout(() => app.setAuthTab('register'), 100);
        }
    },
    selectBankType: (type) => {
        app.selectedBankType = type;

        const cardCcp = document.getElementById('card-ccp');
        const cardCib = document.getElementById('card-cib');
        const cardEdahabia = document.getElementById('card-edahabia');
        const checkCcp = document.getElementById('check-ccp');
        const checkCib = document.getElementById('check-cib');
        const checkEdahabia = document.getElementById('check-edahabia');
        const formGlobal = document.getElementById('bank-details-form');
        const formCcp = document.getElementById('form-ccp-fields');
        const formCib = document.getElementById('form-cib-fields');
        const formEdahabia = document.getElementById('form-edahabia-fields');
        const formTitleText = document.getElementById('form-title-text');

        // Reset all
        if (cardCcp) {
            cardCcp.classList.remove('border-[#facc15]', 'bg-[#facc15]/5', 'scale-105');
            cardCcp.classList.add('border-slate-700');
            if (checkCcp) checkCcp.classList.replace('opacity-100', 'opacity-0');
        }

        if (cardCib) {
            cardCib.classList.remove('border-blue-400', 'bg-blue-500/5', 'scale-105');
            cardCib.classList.add('border-slate-700');
            if (checkCib) checkCib.classList.replace('opacity-100', 'opacity-0');
        }

        if (cardEdahabia) {
            cardEdahabia.classList.remove('border-green-400', 'bg-green-500/5', 'scale-105');
            cardEdahabia.classList.add('border-slate-700');
            if (checkEdahabia) checkEdahabia.classList.replace('opacity-100', 'opacity-0');
        }

        if (formCcp) formCcp.classList.add('hidden');
        if (formCib) formCib.classList.add('hidden');
        if (formEdahabia) formEdahabia.classList.add('hidden');
        if (formGlobal) formGlobal.classList.remove('hidden');

        if (type === 'ccp') {
            if (cardCcp) {
                cardCcp.classList.replace('border-slate-700', 'border-[#facc15]');
                cardCcp.classList.add('bg-[#facc15]/5', 'scale-105');
            }
            if (checkCcp) checkCcp.classList.replace('opacity-0', 'opacity-100');
            if (formCcp) formCcp.classList.remove('hidden');
            if (formTitleText) formTitleText.textContent = app.lang === 'ar' ? 'بيانات الحساب البريدي (CCP)' : 'Postal Account Details (CCP)';
        } else if (type === 'cib') {
            if (cardCib) {
                cardCib.classList.replace('border-slate-700', 'border-blue-400');
                cardCib.classList.add('bg-blue-500/5', 'scale-105');
            }
            if (checkCib) checkCib.classList.replace('opacity-0', 'opacity-100');
            if (formCib) formCib.classList.remove('hidden');
            if (formTitleText) formTitleText.textContent = app.lang === 'ar' ? 'بيانات الحساب البنكي (CIB)' : 'Bank Account Details (CIB)';
        } else if (type === 'edahabia') {
            if (cardEdahabia) {
                cardEdahabia.classList.replace('border-slate-700', 'border-green-400');
                cardEdahabia.classList.add('bg-green-500/5', 'scale-105');
            }
            if (checkEdahabia) checkEdahabia.classList.replace('opacity-0', 'opacity-100');
            if (formEdahabia) formEdahabia.classList.remove('hidden');
            if (formTitleText) formTitleText.textContent = app.lang === 'ar' ? 'بيانات البطاقة الذهبية (Edahabia)' : 'Gold Card Details (Edahabia)';
        }
    },
    toggleInvestorPage: () => {
        const modal = document.getElementById('investor-modal');
        modal.classList.toggle('hidden');
    },
    login: async () => {
        const t = app.translations[app.lang];
        const identifier = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;

        // Admin CEO login
        if (identifier === 'admin' && pass === 'admin') {
            app.user = {
                id: 'admin-ceo',
                name: 'CEO Admin',
                email: 'admin@adjil.dz',
                role: 'admin',
                status: 'active',
                isCEO: true
            };
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            router.navigate('/admin');
            return;
        }

        const btn = document.querySelector('button[onclick="app.login()"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';

        try {
            await window.AuthService.signIn(identifier, pass);
            router.navigate('/dashboard');
        } catch (err) {
            alert(t.login_error + '\n' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },
    demoLogin: async (role) => {
        try {
            await window.AuthService.demoSignIn(role);
            router.navigate('/dashboard');
        } catch (err) {
            alert('Demo Login Failed: ' + err.message);
        }
    },
    // ==========================================
    // Admin CEO Dashboard CRUD
    // ==========================================
    renderAdminDashboard: () => {
        const users = DB.get('users') || [];
        const customers = users.filter(u => u.role === 'customer');
        const merchants = users.filter(u => u.role === 'merchant');

        const statUsers = document.getElementById('admin-stat-users');
        const statCustomers = document.getElementById('admin-stat-customers');
        const statMerchants = document.getElementById('admin-stat-merchants');
        const statTx = document.getElementById('admin-stat-tx');
        const tbody = document.getElementById('admin-users-tbody');
        const searchInput = document.getElementById('admin-search');

        if (statUsers) statUsers.textContent = users.length;
        if (statCustomers) statCustomers.textContent = customers.length;
        if (statMerchants) statMerchants.textContent = merchants.length;
        if (statTx) {
            const txCount = users.reduce((sum, u) => sum + (u.txs || []).length, 0);
            statTx.textContent = txCount;
        }

        const renderTable = (filter = '') => {
            if (!tbody) return;
            const q = (filter || '').toLowerCase();
            const filtered = users.filter(u =>
                String(u.name || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q) ||
                String(u.phone || '').toLowerCase().includes(q)
            );
            tbody.innerHTML = filtered.map(u => {
                const statusColor = u.status === 'active' ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30' :
                    u.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    u.status === 'suspended' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30';
                return `
                <tr class="border-b border-white/5 hover:bg-white/5">
                    <td class="py-3 px-2 text-white">${u.name || '-'}</td>
                    <td class="py-3 px-2 text-slate-300">${u.email || '-'}</td>
                    <td class="py-3 px-2 text-slate-300">${u.phone || '-'}</td>
                    <td class="py-3 px-2"><span class="px-2 py-0.5 rounded text-xs ${u.role === 'merchant' ? 'bg-accent-orange/20 text-orange-400' : u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'}">${u.role || '-'}</span></td>
                    <td class="py-3 px-2"><span class="px-2 py-0.5 rounded text-xs ${statusColor}">${u.status || '-'}</span></td>
                    <td class="py-3 px-2 text-[#10b981] font-bold">${Number(u.balance || 0).toLocaleString()} دج</td>
                    <td class="py-3 px-2">
                        <div class="flex gap-1">
                            <button onclick="app.showAdminEditModal('${u.id}')" class="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs">تعديل</button>
                            <button onclick="app.handleAdminToggleStatus('${u.id}')" class="${u.status === 'active' ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-[#10b981] hover:bg-[#059669]'} text-white px-2 py-1 rounded text-xs">${u.status === 'active' ? 'توقيف' : 'تفعيل'}</button>
                            <button onclick="app.handleAdminDeleteUser('${u.id}')" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs">حذف</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        };

        renderTable();
        if (searchInput) {
            searchInput.oninput = (e) => renderTable(e.target.value);
        }
    },

    showAdminCreateModal: () => {
        const modal = document.getElementById('admin-create-modal');
        if (modal) modal.classList.remove('hidden');
    },
    closeAdminCreateModal: () => {
        const modal = document.getElementById('admin-create-modal');
        if (modal) modal.classList.add('hidden');
    },
    handleAdminCreateUser: async () => {
        const name = document.getElementById('admin-new-name')?.value?.trim();
        const email = document.getElementById('admin-new-email')?.value?.trim();
        const phone = document.getElementById('admin-new-phone')?.value?.trim();
        const password = document.getElementById('admin-new-password')?.value?.trim();
        const role = document.getElementById('admin-new-role')?.value || 'customer';
        const status = document.getElementById('admin-new-status')?.value || 'active';

        if (!name || !email || !password) {
            alert('يرجى ملء الحقول المطلوبة (الاسم، البريد، كلمة المرور)');
            return;
        }

        const newUser = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'user-' + Date.now(),
            name,
            email,
            phone,
            password,
            role,
            status,
            subscription_plan: null,
            credit_limit: 0,
            balance: 0,
            outstanding: 0,
            pin: role === 'merchant' ? app.generateMerchantPin() : '1234',
            card_number: role === 'customer' ? app.generateCardNumber(Date.now()) : null,
            created_at: new Date().toISOString()
        };

        // Save locally
        const users = DB.get('users') || [];
        users.push(newUser);
        DB.set('users', users);

        // Sync to Supabase
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('users').insert([newUser]);
            } catch (err) {
                console.error('Supabase sync failed:', err);
            }
        }

        // Clear fields
        ['admin-new-name', 'admin-new-email', 'admin-new-phone', 'admin-new-password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        app.closeAdminCreateModal();
        app.renderAdminDashboard();
        alert('تم إنشاء الحساب بنجاح: ' + name);
    },

    showAdminEditModal: (userId) => {
        const users = DB.get('users') || [];
        const user = users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('admin-edit-id').value = user.id;
        document.getElementById('admin-edit-name').value = user.name || '';
        document.getElementById('admin-edit-email').value = user.email || '';
        document.getElementById('admin-edit-phone').value = user.phone || '';
        document.getElementById('admin-edit-role').value = user.role || 'customer';
        document.getElementById('admin-edit-status').value = user.status || 'active';
        document.getElementById('admin-edit-balance').value = user.balance || 0;
        document.getElementById('admin-edit-credit').value = user.credit_limit || 0;

        const modal = document.getElementById('admin-edit-modal');
        if (modal) modal.classList.remove('hidden');
    },
    closeAdminEditModal: () => {
        const modal = document.getElementById('admin-edit-modal');
        if (modal) modal.classList.add('hidden');
    },
    handleAdminUpdateUser: async () => {
        const id = document.getElementById('admin-edit-id')?.value;
        if (!id) return;

        const updates = {
            name: document.getElementById('admin-edit-name')?.value?.trim(),
            email: document.getElementById('admin-edit-email')?.value?.trim(),
            phone: document.getElementById('admin-edit-phone')?.value?.trim(),
            role: document.getElementById('admin-edit-role')?.value,
            status: document.getElementById('admin-edit-status')?.value,
            balance: Number(document.getElementById('admin-edit-balance')?.value || 0),
            credit_limit: Number(document.getElementById('admin-edit-credit')?.value || 0)
        };

        // Update locally
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === id);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            DB.set('users', users);
            // Update session if it's the current user
            if (app.user && app.user.id === id) {
                app.user = users[idx];
                localStorage.setItem('adjil_session', JSON.stringify(app.user));
            }
        }

        // Sync to Supabase
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('users').update(updates).eq('id', id);
            } catch (err) {
                console.error('Supabase update failed:', err);
            }
        }

        app.closeAdminEditModal();
        app.renderAdminDashboard();
        alert('تم تحديث الحساب بنجاح');
    },

    handleAdminToggleStatus: async (userId) => {
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === userId);
        if (idx < 0) return;

        const newStatus = users[idx].status === 'active' ? 'inactive' : 'active';
        users[idx].status = newStatus;
        DB.set('users', users);

        // Sync to Supabase
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('users').update({ status: newStatus }).eq('id', userId);
            } catch (err) {
                console.error('Supabase update failed:', err);
            }
        }

        app.renderAdminDashboard();
    },

    handleAdminDeleteUser: async (userId) => {
        const users = DB.get('users') || [];
        const user = users.find(u => u.id === userId);
        if (!user) return;

        if (!confirm(`هل أنت متأكد من حذف الحساب: ${user.name}؟`)) return;

        // Remove locally
        const filtered = users.filter(u => u.id !== userId);
        DB.set('users', filtered);

        // Sync to Supabase
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('users').delete().eq('id', userId);
            } catch (err) {
                console.error('Supabase delete failed:', err);
            }
        }

        app.renderAdminDashboard();
        alert('تم حذف الحساب بنجاح');
    },

    subscribe: (plan) => {
        const t = app.translations[app.lang];
        if (!app.user) {
            alert(t.subscribe_login_required);
            router.navigate('/auth');
            return;
        }
        
        // If user already has an active subscription, don't allow new request
        if (app.user.subscription_plan && app.user.status === 'active') {
            alert(app.lang === 'ar' ? 'لديك اشتراك نشط بالفعل' : 'You already have an active subscription');
            return;
        }
        
        // Check for pending requests
        if (window.supabaseClient) {
            window.supabaseClient
                .from('subscription_requests')
                .select('*')
                .eq('user_id', app.user.id)
                .in('status', ['pending', 'approved'])
                .maybeSingle()
                .then(({ data }) => {
                    if (data) {
                        if (data.status === 'pending') {
                            alert(app.lang === 'ar' ? 'لديك طلب اشتراك قيد الانتظار' : app.lang === 'fr' ? 'Vous avez une demande d\'abonnement en attente' : 'You have a pending subscription request');
                        } else if (data.status === 'approved') {
                            alert(app.lang === 'ar' ? 'طلبك موافق عليه بالفعل، يرجى التحقق من لوحة التحكم' : app.lang === 'fr' ? 'Votre demande est déjà approuvée, veuillez vérifier votre tableau de bord' : 'Your request is already approved');
                        }
                        return;
                    }
                    // No pending/approved request, proceed
                    app.pendingPlan = plan;
                    router.navigate('/sub-confirm');
                });
        } else {
            // Fallback for local mode
            app.pendingPlan = plan;
            router.navigate('/sub-confirm');
        }
    },
    selectBankTypeForSub: (type) => {
        const btnEdahabia = document.getElementById('sub-btn-edahabia');
        const btnCcp = document.getElementById('sub-btn-ccp');
        const btnCib = document.getElementById('sub-btn-cib');
        const fields = document.getElementById('sub-bank-fields');
        const edahabiaField = document.getElementById('sub-edahabia-fields');
        const ccpField = document.getElementById('sub-ccp-fields');
        const cibField = document.getElementById('sub-cib-fields');
        
        // Reset all buttons
        btnEdahabia?.classList.replace('border-yellow-400', 'border-slate-700');
        btnEdahabia?.classList.replace('text-yellow-400', 'text-slate-400');
        btnCcp?.classList.replace('border-primary', 'border-slate-700');
        btnCcp?.classList.replace('text-primary', 'text-slate-400');
        btnCib?.classList.replace('border-green-400', 'border-slate-700');
        btnCib?.classList.replace('text-green-400', 'text-slate-400');
        
        // Highlight selected
        if (type === 'edahabia') {
            btnEdahabia?.classList.replace('border-slate-700', 'border-yellow-400');
            btnEdahabia?.classList.replace('text-slate-400', 'text-yellow-400');
            edahabiaField?.classList.remove('hidden');
            ccpField?.classList.add('hidden');
            cibField?.classList.add('hidden');
        } else if (type === 'ccp') {
            btnCcp?.classList.replace('border-slate-700', 'border-primary');
            btnCcp?.classList.replace('text-slate-400', 'text-primary');
            edahabiaField?.classList.add('hidden');
            ccpField?.classList.remove('hidden');
            cibField?.classList.add('hidden');
        } else if (type === 'cib') {
            btnCib?.classList.replace('border-slate-700', 'border-green-400');
            btnCib?.classList.replace('text-slate-400', 'text-green-400');
            edahabiaField?.classList.add('hidden');
            ccpField?.classList.add('hidden');
            cibField?.classList.remove('hidden');
        }
        
        fields?.classList.remove('hidden');
        app.selectedBankType = type;
    },
    confirmSubscription: async () => {
        if (!app.user || !app.pendingPlan) return;

        // Validate bank details
        const selectedType = app.selectedBankType;
        if (!selectedType) {
            alert(app.lang === 'ar' ? 'يرجى اختيار نوع الحساب البنكي أولاً' : app.lang === 'fr' ? 'Veuillez sélectionner un type de compte bancaire' : 'Please select a bank account type first');
            return;
        }

        let bankDetails = {};
        if (selectedType === 'edahabia') {
            const edahabia = document.getElementById('sub-edahabia')?.value;
            if (!edahabia || edahabia.length < 16) {
                alert(app.lang === 'ar' ? 'يرجى إدخال رقم البطاقة الذهبية الصحيح' : app.lang === 'fr' ? 'Veuillez entrer le numéro de carte Edahabia correct' : 'Please enter a valid Edahabia card number');
                return;
            }
            bankDetails = { edahabia, type: 'edahabia' };
        } else if (selectedType === 'ccp') {
            const rip = document.getElementById('sub-rip')?.value;
            if (!rip || rip.length < 10) {
                alert(app.lang === 'ar' ? 'يرجى إدخال رقم الحساب البريدي الصحيح' : app.lang === 'fr' ? 'Veuillez entrer le numéro RIP correct' : 'Please enter a valid RIP number');
                return;
            }
            bankDetails = { rip, type: 'ccp' };
        } else if (selectedType === 'cib') {
            const rib = document.getElementById('sub-rib')?.value;
            if (!rib || rib.length < 16) {
                alert(app.lang === 'ar' ? 'يرجى إدخال رقم الحساب البنكي الصحيح' : app.lang === 'fr' ? 'Veuillez entrer le numéro RIB correct' : 'Please enter a valid RIB number');
                return;
            }
            bankDetails = { rib, type: 'cib' };
        }

        const btn = document.getElementById('btn-confirm-sub');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i> ${app.lang === 'ar' ? 'جاري التفعيل...' : app.lang === 'fr' ? 'Activation en cours...' : 'Activating...'}`;

        const plan = app.pendingPlan;
        const limit = plan === 'monthly' ? 10000 : plan === '6months' ? 15000 : 25000;
        
        // Update user with subscription and bank details
        const updates = {
            subscription_plan: plan,
            credit_limit: limit,
            balance: limit,
            status: 'active',
            bank_details: bankDetails
        };
        
        // Update local storage
        app.user = { ...app.user, ...updates };
        localStorage.setItem('adjil_session', JSON.stringify(app.user));
        
        // Update in local DB
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === app.user.id);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            DB.set('users', users);
        }

        // Update in Supabase if available
        if (window.supabaseClient) {
            try {
                // Update user record
                await window.supabaseClient
                    .from('users')
                    .update({
                        subscription_plan: plan,
                        credit_limit: limit,
                        balance: limit,
                        status: 'active',
                        bank_rib: bankDetails.rib || null,
                        doc_rib: bankDetails.edahabia || bankDetails.rip || null
                    })
                    .eq('id', app.user.id);
                
                // Create subscription request record for history
                await window.supabaseClient
                    .from('subscription_requests')
                    .insert({
                        user_id: app.user.id,
                        user_name: app.user.name,
                        user_email: app.user.email,
                        user_phone: app.user.phone,
                        plan: plan,
                        credit_limit: limit,
                        status: 'approved',
                        admin_notes: 'تم التفعيل مباشرة من قبل المستخدم'
                    });
                    
                console.log('[App] Subscription activated in Supabase');
            } catch (err) {
                console.error('[App] Supabase update error:', err);
            }
        }

        app.pendingPlan = null;
        
        // Show success message
        const successMsg = app.lang === 'ar' 
            ? `تم تفعيل اشتراكك بنجاح! رصيدك الآن ${limit.toLocaleString()} دج`
            : app.lang === 'fr'
            ? `Votre abonnement est activé avec succès! Votre solde est maintenant de ${limit} DZD`
            : `Your subscription is activated successfully! Your balance is now ${limit} DZD`;
        alert(successMsg);
        
        router.navigate('/dashboard');
        
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    },
    toggleDashView: (view) => {
        const isMerchant = app.user?.role === 'merchant';
        const prefix = isMerchant ? 'merch-' : 'dash-';
        const listEl = document.getElementById(isMerchant ? 'merch-tx-list' : 'dash-tx-list');
        const agendaEl = document.getElementById(isMerchant ? 'merch-agenda-view' : 'dash-agenda-view');
        const btnList = document.getElementById(isMerchant ? 'merch-btn-view-list' : 'btn-view-list');
        const btnAgenda = document.getElementById(isMerchant ? 'merch-btn-view-agenda' : 'btn-view-agenda');

        if (view === 'list') {
            listEl?.classList.remove('hidden');
            agendaEl?.classList.add('hidden');
            btnList?.classList.replace('bg-slate-800', isMerchant ? 'bg-accent-orange' : 'bg-primary');
            btnList?.classList.replace('text-slate-400', 'text-white');
            btnAgenda?.classList.replace(isMerchant ? 'bg-accent-orange' : 'bg-primary', 'bg-slate-800');
            btnAgenda?.classList.replace('text-white', 'text-slate-400');
        } else {
            listEl?.classList.add('hidden');
            agendaEl?.classList.remove('hidden');
            btnAgenda?.classList.replace('bg-slate-800', isMerchant ? 'bg-accent-orange' : 'bg-primary');
            btnAgenda?.classList.replace('text-slate-400', 'text-white');
            btnList?.classList.replace(isMerchant ? 'bg-accent-orange' : 'bg-primary', 'bg-slate-800');
            btnList?.classList.replace('text-white', 'text-slate-400');
            app.renderAgenda();
        }
    },
    agendaDate: new Date(),
    changeAgendaMonth: (dir) => {
        app.agendaDate.setMonth(app.agendaDate.getMonth() + dir);
        app.renderAgenda();
    },
    renderAgenda: () => {
        const isMerchant = app.user?.role === 'merchant';
        const container = document.getElementById(isMerchant ? 'merch-agenda-calendar' : 'agenda-calendar');
        const monthYearEl = document.getElementById(isMerchant ? 'merch-agenda-month-year' : 'agenda-month-year');
        const detailsEl = document.getElementById(isMerchant ? 'merch-agenda-day-details' : 'agenda-day-details');
        
        if (!container || !monthYearEl) return;

        const year = app.agendaDate.getFullYear();
        const month = app.agendaDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        // Adjust for Arabic week (Sat=0)
        const adjustedFirstDay = (firstDay + 1) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const monthNames = app.lang === 'ar' 
            ? ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
            : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        monthYearEl.textContent = `${monthNames[month]} ${year}`;
        
        let html = '';
        // Empty cells for first week
        for (let i = 0; i < adjustedFirstDay; i++) {
            html += '<div class="h-10"></div>';
        }
        
        const txs = app.user?.txs || [];
        const today = new Date();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasTx = txs.some(tx => (tx.created_at || tx.date).includes(dateStr));
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
            
            html += `
                <button onclick="app.showAgendaDay('${dateStr}')" 
                    class="h-10 rounded-lg flex flex-col items-center justify-center transition-all border
                    ${isToday ? 'bg-primary/20 border-primary text-primary' : 'bg-slate-900 border-white/5 text-slate-400 hover:border-white/20'}
                    ${hasTx ? 'font-black !text-white' : ''} relative">
                    <span class="text-xs">${d}</span>
                    ${hasTx ? '<span class="absolute bottom-1 w-1 h-1 bg-accent-orange rounded-full"></span>' : ''}
                </button>
            `;
        }
        container.innerHTML = html;
        
        // Show today's details by default if not yet shown
        if (!detailsEl.innerHTML || detailsEl.innerHTML.includes('no-tx')) {
            app.showAgendaDay(today.toISOString().split('T')[0]);
        }
    },
    showAgendaDay: (dateStr) => {
        const isMerchant = app.user?.role === 'merchant';
        const detailsEl = document.getElementById(isMerchant ? 'merch-agenda-day-details' : 'agenda-day-details');
        const txs = app.user?.txs || [];
        const dayTxs = txs.filter(tx => (tx.created_at || tx.date).includes(dateStr));
        const t = app.translations[app.lang];

        if (dayTxs.length === 0) {
            detailsEl.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs no-tx">${app.lang === 'ar' ? 'لا توجد عمليات لهذا التاريخ' : 'No transactions for this date'}</div>`;
            return;
        }

        detailsEl.innerHTML = `
            <div class="text-[10px] text-slate-500 font-bold uppercase mb-2">${dateStr}</div>
            ${dayTxs.map(tx => `
                <div onclick="app.showInvoiceModal('${tx.id}')" class="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 ${tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center text-xs">
                            <i class="fa-solid ${isMerchant ? 'fa-arrow-down' : 'fa-receipt'}"></i>
                        </div>
                        <div>
                            <div class="text-white font-bold text-xs">${isMerchant ? (tx.customerName || `ID ${tx.customerCard}`) : tx.merchant}</div>
                            <div class="text-[8px] text-slate-500 font-mono">${new Date(tx.created_at || tx.date).toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-white font-black text-xs">${isMerchant ? '+' : '-'}${tx.amount} دج</div>
                    </div>
                </div>
            `).join('')}
        `;
    },
    renderDeductionReport: () => {
        const users = DB.get('users') || [];
        const customers = users.filter(u => u.role === 'customer' && u.subscription_plan);
        const reportContainer = document.getElementById('deduction-report-list');
        if (!reportContainer) return;

        // Group by deduction date (assuming 1st of next month for current month's spend)
        // Or simply list all customers with their current balance/limit difference
        const today = new Date();
        const nextDeduction = new Date(today.getFullYear(), today.getMonth() + 1, 5); // 5th of next month

        if (customers.length === 0) {
            reportContainer.innerHTML = '<div class="text-center py-12 text-slate-500">No active subscribers found for deduction.</div>';
            return;
        }

        reportContainer.innerHTML = `
            <div class="flex justify-between items-center mb-6 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <div>
                    <div class="text-[10px] text-blue-400 font-black uppercase">Next Global Deduction Date</div>
                    <div class="text-white font-bold">${nextDeduction.toLocaleDateString('ar-DZ')}</div>
                </div>
                <button onclick="app.exportDeductionCSV()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
                    <i class="fa-solid fa-file-csv mr-2"></i> Export for Bank/Poste
                </button>
            </div>
            <div class="space-y-3">
                ${customers.map(c => {
                    const spent = (c.credit_limit || 0) - (c.balance || 0);
                    if (spent <= 0) return '';
                    return `
                        <div class="flex items-center justify-between p-4 bg-slate-900 border border-white/5 rounded-xl">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                                    <i class="fa-solid fa-user"></i>
                                </div>
                                <div>
                                    <div class="text-white font-bold text-sm">${c.name}</div>
                                    <div class="text-[10px] text-slate-500 font-mono">${c.cardNumber}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-white font-black text-sm">${spent.toLocaleString()} دج</div>
                                <div class="text-[8px] text-yellow-500">Pending Collection</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },
    exportDeductionCSV: () => {
        const users = DB.get('users') || [];
        const customers = users.filter(u => u.role === 'customer' && u.subscription_plan);
        
        let csv = "Customer Name,Card Number,Amount to Deduct,Currency,Deduction Date\n";
        customers.forEach(c => {
            const spent = (c.credit_limit || 0) - (c.balance || 0);
            if (spent > 0) {
                csv += `"${c.name}","${c.cardNumber}",${spent},"DZD","${new Date().toLocaleDateString()}"\n`;
            }
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Adjil_Deductions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
    logout: () => {
        const t = app.translations[app.lang];
        app.user = null;

        const menuContainer = document.getElementById('user-menu-container');
        const dropdown = document.getElementById('user-dropdown-menu');
        if (menuContainer) {
            menuContainer.onmouseenter = null;
            menuContainer.onmouseleave = null;
        }
        if (dropdown) dropdown.classList.add('hidden');

        if (window.AuthService) {
            window.AuthService.signOut();
        } else {
            localStorage.removeItem('adjil_session');
        }
        const authBtnText = document.getElementById('auth-btn-text');
        if (authBtnText) authBtnText.textContent = t.login;
        router.navigate('/auth');
    },
    inviteFriend: () => {
        const t = app.translations[app.lang];
        const shareLink = "https://adjil.dz/download";
        if (navigator.share) {
            navigator.share({
                title: t.invite_title,
                text: t.invite_text,
                url: shareLink
            }).catch(err => console.log('Error sharing:', err));
        } else {
            navigator.clipboard.writeText(shareLink).then(() => {
                alert(t.invite_copied);
            });
        }
    },
    copyMerchantPin: () => {
        const t = app.translations[app.lang];
        const pin = app.user?.pin ? String(app.user.pin).padStart(4, '0') : '';
        if (!pin) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(pin).then(() => alert(t.copied || 'Copied'));
        } else {
            const input = document.createElement('input');
            input.value = pin;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
            alert(t.copied || 'Copied');
        }
    },
    contactUs: () => {
        window.location.href = "mailto:Adjil.BNPL@gmail.com?subject=Contact%20from%20Platform";
    },
    showPaymentNotification: () => {
        const lastTx = app.user.txs[app.user.txs.length - 1];
        if (!lastTx) return;

        const toast = document.createElement('div');
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-slide-up';
        toast.innerHTML = `
    <div class="bg-green-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20">
                <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                    <i class="fa-solid fa-bell animate-bounce"></i>
                </div>
                <div>
                    <div class="font-bold text-sm">${app.lang === 'ar' ? 'تم استلام دفعة جديدة!' : 'New Payment Received!'}</div>
                    <div class="text-xs opacity-90">${lastTx.amount.toLocaleString()} دج - ${lastTx.customerName}</div>
                </div>
            </div>
    `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.replace('animate-slide-up', 'animate-fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    },
    // Prototype Logic
    nextProtoStep: (step) => {
        document.querySelectorAll('.proto-step').forEach(s => s.classList.add('hidden'));
        document.getElementById(`proto - step - ${step} `).classList.remove('hidden');

        // Update indicators
        const indicators = [1, 2, 3, 4];
        indicators.forEach(i => {
            const el = document.getElementById(`step - ${i} -indicator`);
            if (i < step) {
                el.classList.replace('bg-slate-800', 'bg-green-500');
                el.classList.replace('text-slate-500', 'text-white');
                el.innerHTML = '<i class="fa-solid fa-check"></i>';
            } else if (i === step) {
                el.classList.replace('bg-slate-800', 'bg-primary');
                el.classList.replace('text-slate-500', 'text-white');
            }
        });

        // Update line
        const progress = ((step - 1) / 3) * 100;
        document.getElementById('step-line').style.width = `${progress}% `;
    },
    runProtoPayment: () => {
        const mid = document.getElementById('proto-mid').value;
        const btn = document.getElementById('proto-pay-btn');

        if (mid !== '1234') {
            alert(app.lang === 'ar' ? 'الرقم التعريفي غير صحيح (جرب 1234)' : 'Invalid ID (Try 1234)');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التأكيد...';

        setTimeout(() => {
            app.nextProtoStep(4);
        }, 1500);
    },
    checkAccountStatus: () => {
        if (window.AuthService) {
            app.user = window.AuthService.getCurrentUser();
        } else {
            const session = localStorage.getItem('adjil_session');
            if (session) app.user = JSON.parse(session);
        }
        const userStatus = String(app.user?.status || '').toLowerCase();
        const frozenAt = app.user?.frozen_at || null;
        const blacklistDueAt = app.user?.blacklist_due_at || null;
        const now = new Date();

        // Only show freeze overlay if:
        // 1. Account was frozen by admin (has frozen_at timestamp)
        // 2. Account is blacklisted due to failed auto-deduction (blacklist_due_at passed)
        let shouldBlock = false;
        let blockReason = '';

        if (userStatus === 'blacklisted') {
            shouldBlock = true;
            blockReason = app.lang === 'ar'
                ? 'تم إدراج حسابك في القائمة السوداء بسبب عدم تسديد المستحقات في الآجال المحددة.'
                : 'Your account has been blacklisted due to non-payment within the specified deadline.';
        } else if (userStatus === 'frozen' && frozenAt) {
            // Only show if frozen by admin (has frozen_at timestamp)
            shouldBlock = true;
            const blacklistDate = blacklistDueAt ? new Date(blacklist_due_at) : null;
            if (blacklistDate && now < blacklistDate) {
                const hoursLeft = Math.ceil((blacklistDate.getTime() - now.getTime()) / (1000 * 60 * 60));
                blockReason = app.lang === 'ar'
                    ? `تم تجميد حسابك بسبب وجود مستحقات غير مدفوعة. تبقى ${hoursLeft} ساعة قبل الإدراج في القائمة السوداء. يرجى التسديد لتفادي الإجراءات القانونية.`
                    : `Your account was frozen due to unpaid dues. ${hoursLeft} hours remaining before blacklisting. Please pay to avoid legal action.`;
            } else {
                blockReason = app.lang === 'ar'
                    ? 'تم تجميد حسابك. يرجى التواصل مع الدعم لتسوية الوضعية.'
                    : 'Your account has been frozen. Please contact support to resolve.';
            }
        }

        const overlay = document.getElementById('freeze-overlay');
        const warningText = document.getElementById('freeze-warning-text');
        if (shouldBlock) {
            if (warningText) {
                warningText.textContent = blockReason;
            }
            if (overlay) overlay.classList.remove('hidden');
        } else {
            if (overlay) overlay.classList.add('hidden');
        }
    },
    // Banking & Settlement API Simulation
    logToApiConsole: (msg, type = 'info') => {
        const consoleEl = document.getElementById('api-console');
        if (!consoleEl) return;
        const color = type === 'success' ? 'text-green-400' : (type === 'error' ? 'text-red-400' : (type === 'warn' ? 'text-yellow-400' : 'text-slate-300'));
        const time = new Date().toLocaleTimeString();
        consoleEl.innerHTML += `<div class="${color}">[${time}] > ${msg}</div>`;
        consoleEl.scrollTop = consoleEl.scrollHeight;
    },
    runBankingAutoScan: async () => {
        const btn = document.getElementById('btn-run-scan');
        const poolEl = document.getElementById('api-pool-amount');
        const pendingEl = document.getElementById('api-pending-disbursements');

        btn.disabled = true;
        app.logToApiConsole('Initiating Auto-Scan for pending settlements...', 'warn');

        // 1. Auto Scan
        await new Promise(r => setTimeout(r, 1500));
        const users = DB.get('users') || [];
        const merchants = users.filter(u => u.role === 'merchant');
        let totalToDisburse = 0;
        let merchantCount = 0;

        merchants.forEach(m => {
            if (m.outstanding > 0) {
                totalToDisburse += m.outstanding;
                merchantCount++;
            }
        });

        app.logToApiConsole(`Scan Complete: Found ${merchantCount} merchants with ${totalToDisburse.toLocaleString()} DZD pending.`);

        // 2. Prélèvement Automatique (Direct Debit)
        app.logToApiConsole('Requesting Direct Debit from linked Banking/Poste accounts...', 'info');
        await new Promise(r => setTimeout(r, 2000));

        // Simulate transfer to Adjil Pool
        app.animateValue('api-pool-amount', 0, totalToDisburse, 1500);
        app.logToApiConsole(`Direct Debit Successful: ${totalToDisburse.toLocaleString()} DZD transferred to Adjil Commercial Pool.`, 'success');

        // 3. Redistribution to Merchants
        await new Promise(r => setTimeout(r, 1000));
        app.logToApiConsole(`Initiating redistribution to ${merchantCount} different financial institutions...`, 'warn');
        pendingEl.textContent = merchantCount;

        for (const m of merchants) {
            if (m.outstanding > 0) {
                const amount = m.outstanding;
                app.logToApiConsole(`Transferring ${amount.toLocaleString()} DZD to ${m.name} (${m.wilaya || 'Algeria'})...`);
                await new Promise(r => setTimeout(r, 800));

                // Update merchant in DB
                const mIdx = users.findIndex(u => u.id === m.id);
                // Users balances handled via sync in prod, doing local simulation here
                users[mIdx].balance = 0; // Legacy cleanup
                users[mIdx].outstanding = 0;

                if (!users[mIdx].txs) users[mIdx].txs = [];
                users[mIdx].txs.push({
                    id: 'AUTO-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    amount: amount,
                    merchant: 'Auto-Debit Settlement',
                    date: new Date().toLocaleString('ar-DZ'),
                    status: 'completed',
                    method: 'AUTO_SCAN_SETTLEMENT'
                });

                app.logToApiConsole(`Settlement confirmed for ${m.name}. Bank: ${Math.random() > 0.5 ? 'BNA' : 'Algérie Poste'} `, 'success');
            }
        }

        // 4. Finalize
        DB.set('users', users);
        app.animateValue('api-pool-amount', totalToDisburse, 0, 1000);
        pendingEl.textContent = '0';
        app.logToApiConsole('Banking Settlement Process Completed Successfully.', 'success');
        btn.disabled = false;

        // Sync if current user is merchant
        if (app.user && app.user.role === 'merchant') {
            const updatedUser = users.find(u => u.id === app.user.id);
            app.user = updatedUser;
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            app.updateDashboardUI();
        }
    },
    // Adding user-menu logic and profile actions here
    toggleUserMenu: () => {
        if (!app.user) {
            router.navigate('/auth');
            return;
        }
        const menu = document.getElementById('user-dropdown-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    },
    handleProfilePicture: async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Preview locally
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profile-picture-preview').src = e.target.result;
        };
        reader.readAsDataURL(file);

        if (window.supabaseClient && app.user) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${app.user.id}/avatar_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await window.supabaseClient.storage
                    .from('user-documents')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data } = window.supabaseClient.storage
                    .from('user-documents')
                    .getPublicUrl(filePath);

                const publicUrl = data.publicUrl;

                // Save to DB
                const { error: updateError } = await window.supabaseClient
                    .from('users')
                    .update({ avatar_url: publicUrl })
                    .eq('id', app.user.id);

                if (updateError) throw updateError;

                app.user.avatar_url = publicUrl;
                app.user.profilePicture = publicUrl; // Keep for UI compatibility
                localStorage.setItem('adjil_session', JSON.stringify(app.user));
                alert(app.lang === 'ar' ? 'تم تحديث صورة الملف الشخصي' : 'Profile picture updated');
            } catch (err) {
                console.error(err);
                alert('Error uploading image: ' + err.message);
            }
        }
    },
    openGoogleMapSelection: () => {
        // Remove any existing map modal
        const existingModal = document.getElementById('map-picker-modal');
        if (existingModal) existingModal.remove();

        const isAr = app.lang === 'ar';
        let selectedCoords = app.user?.coords || '';
        let selectedAddress = app.user?.location || '';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'map-picker-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-dark-900 rounded-3xl border border-slate-700 w-full max-w-2xl mx-4 overflow-hidden shadow-2xl animate-fade-in">
                <div class="flex items-center justify-between p-5 border-b border-slate-700">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-map-location-dot text-primary"></i>
                        ${isAr ? 'تحديد الموقع' : 'Select Location'}
                    </h3>
                    <button onclick="document.getElementById('map-picker-modal').remove()" class="text-slate-400 hover:text-white text-xl">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="p-5 space-y-4">
                    <button id="map-use-my-location" class="w-full bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-location-crosshairs"></i>
                        ${isAr ? 'استخدم موقعي الحالي' : 'Use My Current Location'}
                    </button>
                    <div id="map-status" class="text-sm text-slate-400 text-center hidden"></div>
                    <div class="relative">
                        <div class="absolute inset-0 flex items-center pointer-events-none px-4">
                            <i class="fa-solid fa-map-pin text-slate-500"></i>
                        </div>
                        <input type="text" id="map-coord-input" 
                            class="w-full bg-dark-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:border-primary outline-none transition-all text-sm"
                            placeholder="${isAr ? 'الإحداثيات (مثال: 36.7538,3.0588) أو الصق من Google Maps' : 'Coordinates (e.g. 36.7538,3.0588) or paste from Google Maps'}">
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>${isAr ? 'افتح Google Maps → انسخ الإحداثيات من الرابط أو شارك الموقع' : 'Open Google Maps → Copy coordinates from URL or share location'}</span>
                    </div>
                    <button id="map-open-gmaps" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-brands fa-google"></i>
                        ${isAr ? 'فتح Google Maps' : 'Open Google Maps'}
                    </button>
                    <div id="map-preview" class="hidden rounded-2xl overflow-hidden border border-slate-700">
                        <iframe id="map-iframe" class="w-full h-48 border-0"></iframe>
                    </div>
                    <input type="text" id="map-address-input"
                        class="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all text-sm"
                        placeholder="${isAr ? 'عنوان تفصيلي (الحي، الشارع، المدينة)' : 'Detailed address (neighborhood, street, city)'}"
                        value="${selectedAddress}">
                </div>
                <div class="flex gap-4 p-5 border-t border-slate-700">
                    <button onclick="document.getElementById('map-picker-modal').remove()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                        ${isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button id="map-confirm-btn" class="flex-[2] bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-check"></i>
                        ${isAr ? 'تأكيد الموقع' : 'Confirm Location'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Use My Location
        document.getElementById('map-use-my-location').onclick = () => {
            const statusEl = document.getElementById('map-status');
            statusEl.className = 'text-sm text-yellow-400 text-center';
            statusEl.textContent = isAr ? 'جاري تحديد الموقع...' : 'Getting location...';
            statusEl.classList.remove('hidden');

            if (!navigator.geolocation) {
                statusEl.className = 'text-sm text-red-400 text-center';
                statusEl.textContent = isAr ? 'خدمة تحديد الموقع غير مدعومة' : 'Geolocation not supported';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude.toFixed(6);
                    const lng = pos.coords.longitude.toFixed(6);
                    selectedCoords = `${lat},${lng}`;
                    document.getElementById('map-coord-input').value = selectedCoords;
                    statusEl.className = 'text-sm text-green-400 text-center';
                    statusEl.textContent = isAr ? `تم تحديد الموقع: ${lat}, ${lng}` : `Location found: ${lat}, ${lng}`;
                    app._updateMapPreview(lat, lng);
                    app._reverseGeocode(lat, lng, (addr) => {
                        if (addr) {
                            selectedAddress = addr;
                            document.getElementById('map-address-input').value = addr;
                        }
                    });
                },
                (err) => {
                    statusEl.className = 'text-sm text-red-400 text-center';
                    statusEl.textContent = isAr ? 'فشل تحديد الموقع: تأكد من تفعيل GPS' : 'Location failed: enable GPS';
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        };

        // Open Google Maps
        document.getElementById('map-open-gmaps').onclick = () => {
            const center = selectedCoords || '36.7538,3.0588';
            window.open(`https://www.google.com/maps/@${center},15z`, '_blank');
        };

        // Coordinate input change
        document.getElementById('map-coord-input').oninput = (e) => {
            const val = e.target.value.trim();
            const parts = val.split(',').map(s => s.trim());
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    selectedCoords = `${lat},${lng}`;
                    app._updateMapPreview(lat, lng);
                    app._reverseGeocode(lat, lng, (addr) => {
                        if (addr) {
                            selectedAddress = addr;
                            document.getElementById('map-address-input').value = addr;
                        }
                    });
                }
            }
        };

        // Confirm
        document.getElementById('map-confirm-btn').onclick = () => {
            const addressInput = document.getElementById('map-address-input').value.trim();
            selectedAddress = addressInput || selectedAddress;

            if (!selectedCoords && !selectedAddress) {
                alert(isAr ? 'يرجى تحديد الموقع أولاً' : 'Please select a location first');
                return;
            }

            // Update profile input
            const locInput = document.getElementById('prof-location-text');
            if (locInput) locInput.value = selectedAddress;

            // Store coords temporarily for saveProfile to use
            app._pendingCoords = selectedCoords;
            app._pendingLocation = selectedAddress;

            modal.remove();
        };

        // Show preview if coords exist
        if (selectedCoords) {
            const parts = selectedCoords.split(',');
            if (parts.length === 2) {
                app._updateMapPreview(parseFloat(parts[0]), parseFloat(parts[1]));
            }
        }
    },

    _updateMapPreview: (lat, lng) => {
        const preview = document.getElementById('map-preview');
        const iframe = document.getElementById('map-iframe');
        if (preview && iframe) {
            iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
            preview.classList.remove('hidden');
        }
    },

    _reverseGeocode: (lat, lng, callback) => {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${app.lang === 'ar' ? 'ar' : 'fr'}`)
            .then(r => r.json())
            .then(data => {
                if (data.display_name) callback(data.display_name);
            })
            .catch(() => callback(null));
    },

    openRegMapSelection: () => {
        const existingModal = document.getElementById('map-picker-modal');
        if (existingModal) existingModal.remove();

        const isAr = app.lang === 'ar';
        let selectedCoords = document.getElementById('reg-coords')?.value || '';
        let selectedAddress = document.getElementById('reg-location-text')?.value || '';

        const modal = document.createElement('div');
        modal.id = 'map-picker-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-dark-900 rounded-3xl border border-slate-700 w-full max-w-2xl mx-4 overflow-hidden shadow-2xl animate-fade-in">
                <div class="flex items-center justify-between p-5 border-b border-slate-700">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <i class="fa-solid fa-map-location-dot text-primary"></i>
                        ${isAr ? 'تحديد الموقع' : 'Select Location'}
                    </h3>
                    <button onclick="document.getElementById('map-picker-modal').remove()" class="text-slate-400 hover:text-white text-xl">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="p-5 space-y-4">
                    <button id="map-use-my-location" class="w-full bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-location-crosshairs"></i>
                        ${isAr ? 'استخدم موقعي الحالي' : 'Use My Current Location'}
                    </button>
                    <div id="map-status" class="text-sm text-slate-400 text-center hidden"></div>
                    <div class="relative">
                        <div class="absolute inset-0 flex items-center pointer-events-none px-4">
                            <i class="fa-solid fa-map-pin text-slate-500"></i>
                        </div>
                        <input type="text" id="map-coord-input" 
                            class="w-full bg-dark-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white focus:border-primary outline-none transition-all text-sm"
                            placeholder="${isAr ? 'الإحداثيات (مثال: 36.7538,3.0588)' : 'Coordinates (e.g. 36.7538,3.0588)'}"
                            value="${selectedCoords}">
                    </div>
                    <div class="flex items-center gap-2 text-xs text-slate-500">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>${isAr ? 'افتح Google Maps → انسخ الإحداثيات من الرابط' : 'Open Google Maps → Copy coordinates from URL'}</span>
                    </div>
                    <button id="map-open-gmaps" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-brands fa-google"></i>
                        ${isAr ? 'فتح Google Maps' : 'Open Google Maps'}
                    </button>
                    <div id="map-preview" class="${selectedCoords ? '' : 'hidden'} rounded-2xl overflow-hidden border border-slate-700">
                        <iframe id="map-iframe" class="w-full h-48 border-0" src="${selectedCoords ? 'https://maps.google.com/maps?q=' + selectedCoords + '&z=15&output=embed' : ''}"></iframe>
                    </div>
                    <input type="text" id="map-address-input"
                        class="w-full bg-dark-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-primary outline-none transition-all text-sm"
                        placeholder="${isAr ? 'عنوان تفصيلي (الحي، الشارع، المدينة)' : 'Detailed address'}"
                        value="${selectedAddress}">
                </div>
                <div class="flex gap-4 p-5 border-t border-slate-700">
                    <button onclick="document.getElementById('map-picker-modal').remove()" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all">
                        ${isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button id="map-confirm-btn" class="flex-[2] bg-primary hover:bg-secondary text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        <i class="fa-solid fa-check"></i>
                        ${isAr ? 'تأكيد الموقع' : 'Confirm Location'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('map-use-my-location').onclick = () => {
            const statusEl = document.getElementById('map-status');
            statusEl.className = 'text-sm text-yellow-400 text-center';
            statusEl.textContent = isAr ? 'جاري تحديد الموقع...' : 'Getting location...';
            statusEl.classList.remove('hidden');

            if (!navigator.geolocation) {
                statusEl.className = 'text-sm text-red-400 text-center';
                statusEl.textContent = isAr ? 'خدمة تحديد الموقع غير مدعومة' : 'Geolocation not supported';
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude.toFixed(6);
                    const lng = pos.coords.longitude.toFixed(6);
                    selectedCoords = `${lat},${lng}`;
                    document.getElementById('map-coord-input').value = selectedCoords;
                    statusEl.className = 'text-sm text-green-400 text-center';
                    statusEl.textContent = isAr ? `تم تحديد الموقع: ${lat}, ${lng}` : `Location found: ${lat}, ${lng}`;
                    app._updateMapPreview(lat, lng);
                    app._reverseGeocode(lat, lng, (addr) => {
                        if (addr) {
                            selectedAddress = addr;
                            document.getElementById('map-address-input').value = addr;
                        }
                    });
                },
                () => {
                    statusEl.className = 'text-sm text-red-400 text-center';
                    statusEl.textContent = isAr ? 'فشل تحديد الموقع: تأكد من تفعيل GPS' : 'Location failed: enable GPS';
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        };

        document.getElementById('map-open-gmaps').onclick = () => {
            const center = selectedCoords || '36.7538,3.0588';
            window.open(`https://www.google.com/maps/@${center},15z`, '_blank');
        };

        document.getElementById('map-coord-input').oninput = (e) => {
            const val = e.target.value.trim();
            const parts = val.split(',').map(s => s.trim());
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    selectedCoords = `${lat},${lng}`;
                    app._updateMapPreview(lat, lng);
                    app._reverseGeocode(lat, lng, (addr) => {
                        if (addr) {
                            selectedAddress = addr;
                            document.getElementById('map-address-input').value = addr;
                        }
                    });
                }
            }
        };

        document.getElementById('map-confirm-btn').onclick = () => {
            const addressInput = document.getElementById('map-address-input').value.trim();
            selectedAddress = addressInput || selectedAddress;

            if (!selectedCoords && !selectedAddress) {
                alert(isAr ? 'يرجى تحديد الموقع أولاً' : 'Please select a location first');
                return;
            }

            const regLocInput = document.getElementById('reg-location-text');
            const regCoordsInput = document.getElementById('reg-coords');
            if (regLocInput) regLocInput.value = selectedAddress;
            if (regCoordsInput) regCoordsInput.value = selectedCoords;

            modal.remove();
        };
    },

    saveProfile: async () => {
        if (!app.user) return;

        const loc = document.getElementById('prof-location-text').value;
        const coords = app._pendingCoords || app.user.coords || null;
        const btn = document.querySelector('button[onclick="app.saveProfile()"]');
        const originalText = btn.innerHTML;

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin"></i>`;

        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient
                    .from('users')
                    .update({ location: loc, coords: coords })
                    .eq('id', app.user.id);
                
                if (error) throw error;
            }

            const users = DB.get('users') || [];
            const idx = users.findIndex(u => u.id === app.user.id);
            if (idx >= 0) {
                users[idx].location = loc;
                users[idx].coords = coords;
                DB.set('users', users);
                app.user = users[idx];
                localStorage.setItem('adjil_session', JSON.stringify(app.user));
            }

            app._pendingCoords = null;
            app._pendingLocation = null;

            alert(app.lang === 'ar' ? 'تم حفظ التغييرات بنجاح!' : 'Profile updated successfully!');
            app.updateDashboardUI();
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },
    populateProfileData: () => {
        if (!app.user) return;
        const fn = document.getElementById('prof-firstname');
        const em = document.getElementById('prof-email');
        const loc = document.getElementById('prof-location-text');
        const pic = document.getElementById('profile-picture-preview');

        if (fn) fn.value = app.user.name || '';
        if (em) em.value = app.user.email || '';
        if (loc) loc.value = app.user.location || app.user.wilaya || '';
        if (pic && (app.user.avatar_url || app.user.profilePicture)) {
            pic.src = app.user.avatar_url || app.user.profilePicture;
        } else if (pic) {
            pic.src = 'assets/default-avatar.png';
        }
    },

};

const SyncService = {
    getPendingOps: () => {
        try {
            return JSON.parse(localStorage.getItem('adjil_pending_ops') || '[]');
        } catch {
            return [];
        }
    },
    setPendingOps: (ops) => {
        localStorage.setItem('adjil_pending_ops', JSON.stringify(ops));
    },
    enqueue: (op) => {
        const ops = SyncService.getPendingOps();
        ops.push(op);
        SyncService.setPendingOps(ops);
    },
    getCurrentMerchant: () => {
        const user = window.AuthService?.getCurrentUser?.() || app.user;
        if (user && user.role === 'merchant') return user;
        return null;
    },
    fetchMerchantFromSupabase: async (merchantId) => {
        if (!window.supabaseClient || !merchantId) return null;
        const { data, error } = await window.supabaseClient.from('users').select('*').eq('id', merchantId).maybeSingle();
        if (error || !data) return null;
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === merchantId);
        const cardNumber = data.card_number || data.cardNumber || null;
        const merged = { ...data, cardNumber };
        if (idx >= 0) users[idx] = { ...users[idx], ...merged };
        else users.push(merged);
        DB.set('users', users);
        if (app.user && app.user.id === merchantId) {
            app.user = users.find(u => u.id === merchantId);
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            app.updateDashboardUI();
        }
        return merged;
    },
    fetchMerchantTransactionsFromSupabase: async (merchantId) => {
        if (!window.supabaseClient || !merchantId) return null;
        const { data, error } = await window.supabaseClient
            .from('transactions')
            .select('*')
            .eq('merchant_id', merchantId)
            .order('created_at', { ascending: false });
        if (error) return null;
        const txs = (data || []).map(t => ({
            id: t.id,
            amount: t.amount,
            merchant: t.merchant_name,
            merchantPin: t.merchant_pin || '',
            merchantActivity: t.merchant_activity || '',
            merchantLocation: t.merchant_location || '',
            customerName: t.customer_name,
            customerCard: t.customer_card,
            date: t.created_at ? new Date(t.created_at).toLocaleString(app.lang === 'ar' ? 'ar-DZ' : 'en-US') : '',
            status: t.status,
            method: t.method,
            created_at: t.created_at,
            idempotency_key: t.idempotency_key || null
        }));
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === merchantId);
        if (idx >= 0) {
            users[idx].txs = txs;
            DB.set('users', users);
            if (app.user && app.user.id === merchantId) {
                app.user = users[idx];
                localStorage.setItem('adjil_session', JSON.stringify(app.user));
                app.updateDashboardUI();
            }
        }
        return txs;
    },
    updateMerchantProfile: async (merchantId, updates) => {
        if (!merchantId || !updates) return;
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === merchantId);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            DB.set('users', users);
        }
        SyncService.enqueue({ type: 'user_update', payload: { id: merchantId, updates } });
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient.from('users').update(updates).eq('id', merchantId);
            if (error) SyncService.enqueue({ type: 'user_update', payload: { id: merchantId, updates } });
        }
    },
    updateUserProfile: async (userId, updates) => {
        if (!userId || !updates) return;
        const users = DB.get('users') || [];
        const idx = users.findIndex(u => u.id === userId);
        if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            DB.set('users', users);
            if (app.user && app.user.id === userId) {
                app.user = users[idx];
                localStorage.setItem('adjil_session', JSON.stringify(app.user));
                app.updateDashboardUI();
            }
        }
        SyncService.enqueue({ type: 'user_update', payload: { id: userId, updates } });
        if (window.supabaseClient) {
            const { error } = await window.supabaseClient.from('users').update(updates).eq('id', userId);
            if (error) SyncService.enqueue({ type: 'user_update', payload: { id: userId, updates } });
        }
    },
    recordTransaction: async (input) => {
        const { customerId, merchantId, amount, method, merchantName, customerName, customerCard, invoiceNumber, storeNumber, paymentChannel, cashCollected, cashCollectedAt, cashCollectionStatus } = input;
        
        // Always work with fresh users from DB
        const getUsers = () => DB.get('users') || [];
        let users = getUsers();
        
        // Handle partial ID matching (QR codes use shortened IDs)
        const findUserById = (id) => {
            // Try exact match first
            let idx = users.findIndex(u => u.id === id);
            if (idx !== -1) return idx;
            
            // Try partial match (ID without dashes, first 12 chars)
            const shortId = id.replace(/-/g, '').substring(0, 12);
            idx = users.findIndex(u => u.id.replace(/-/g, '').startsWith(shortId));
            return idx;
        };
        
        let custIdx = findUserById(customerId);
        let merchIdx = findUserById(merchantId);

        // Robust check: ensure current user is in the local users list
        if (custIdx === -1 && app.user && app.user.id === customerId) {
            users.push(app.user);
            DB.set('users', users);
            users = getUsers(); // Refresh reference
            custIdx = findUserById(customerId);
        }

        // If merchant still not found, try to fetch it if we are online
        if (merchIdx === -1 && window.supabaseClient) {
            const remoteMerch = await SyncService.fetchMerchantFromSupabase(merchantId);
            if (remoteMerch) {
                users = getUsers(); // Refresh reference after async fetch
                merchIdx = findUserById(merchantId);
            }
        }
        
        // Last resort: create merchant from name if provided
        if (merchIdx === -1 && merchantName) {
            // Check if merchant exists by name
            merchIdx = users.findIndex(u => u.role === 'merchant' && u.name === merchantName);
            if (merchIdx === -1) {
                // Create temporary merchant entry
                const newMerchant = {
                    id: merchantId,
                    name: merchantName,
                    role: 'merchant',
                    balance: 0,
                    outstanding: 0,
                    status: 'active'
                };
                users.push(newMerchant);
                DB.set('users', users);
                merchIdx = users.length - 1;
            }
        }

        // Final check for existence
        if (custIdx === -1 || merchIdx === -1) {
            console.error('User lookup failed in recordTransaction:', { 
                customerId, merchantId, 
                custFound: custIdx !== -1, 
                merchFound: merchIdx !== -1,
                localUserCount: users.length 
            });
            throw new Error(app.translations[app.lang].system_error_user_not_found || 'System Error: User not found');
        }
        
        const customer = users[custIdx];
        const merchant = users[merchIdx];

        if (customer.status && customer.status !== 'active') throw new Error(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');
        if (amount > customer.balance) throw new Error(app.translations[app.lang].insufficient_balance || 'Insufficient balance');

        const txId = 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
        const idemKey = (crypto.randomUUID ? crypto.randomUUID() : (txId + '-k'));
        const createdAt = new Date().toISOString();
        
        const merchantPin = merchant.pin ? String(merchant.pin).padStart(4, '0') : '';
        const merchantActivity = merchant.activity || '';
        const merchantLocation = merchant.location || merchant.wilaya || '';
        
        const tx = {
            id: txId,
            amount,
            merchant: merchantName,
            merchantPin,
            storeNumber: storeNumber || merchantPin,
            invoiceNumber: invoiceNumber || txId,
            merchantActivity,
            merchantLocation,
            customerName,
            customerCard,
            date: new Date(createdAt).toLocaleString(app.lang === 'ar' ? 'ar-DZ' : 'en-US'),
            status: 'completed',
            method,
            paymentChannel: paymentChannel || 'wallet',
            cashCollected: !!cashCollected,
            cashCollectedAt: cashCollectedAt || null,
            cashCollectionStatus: cashCollectionStatus || null,
            created_at: createdAt,
            idempotency_key: idemKey
        };

        let usedRpc = false;
        if (window.supabaseClient && typeof window.supabaseClient.rpc === 'function') {
            try {
                const { data, error } = await window.supabaseClient.rpc('process_transaction', {
                    p_customer_id: customerId,
                    p_merchant_id: merchantId,
                    p_amount: amount,
                    p_method: method,
                    p_merchant_name: merchantName,
                    p_customer_name: customerName,
                    p_customer_card: customerCard,
                    p_merchant_pin: merchantPin,
                    p_merchant_activity: merchantActivity,
                    p_merchant_location: merchantLocation,
                    p_idempotency_key: idemKey
                });
                if (!error && data && data.success) {
                    usedRpc = true;
                    tx.id = data.tx_id || tx.id;
                    
                    // Update balances from RPC result
                    users[custIdx].balance = data.new_balance ?? (users[custIdx].balance - amount);
                    users[merchIdx].balance = (users[merchIdx].balance || 0) + amount;
                    users[merchIdx].outstanding = (users[merchIdx].outstanding || 0) + amount;
                    
                    if (data.low_balance_alert) {
                        app.notifyLowBalance(users[custIdx]);
                    }
                } else if (data && data.success === false) {
                    throw new Error(data.error || 'RPC Error');
                }
            } catch (rpcErr) {
                console.warn('RPC Transaction failed, falling back to manual sync:', rpcErr);
                usedRpc = false;
            }
        }

        if (!usedRpc) {
            users[custIdx].balance -= amount;
            users[merchIdx].balance = (users[merchIdx].balance || 0) + amount;
            users[merchIdx].outstanding = (users[merchIdx].outstanding || 0) + amount;
        }

        // Add transaction to both histories
        users[custIdx].txs = users[custIdx].txs || [];
        users[merchIdx].txs = users[merchIdx].txs || [];
        users[custIdx].txs.push(tx);
        users[merchIdx].txs.push(tx);

        // Persist changes
        DB.set('users', users);
        
        // Update session if current user is the customer
        if (app.user && app.user.id === customerId) {
            app.user = users[custIdx];
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
            app.notifyLowBalance(app.user);
        }
        
        // Update session if current user is the merchant
        if (app.user && app.user.id === merchantId) {
            app.user = users[merchIdx];
            localStorage.setItem('adjil_session', JSON.stringify(app.user));
        }

        if (!usedRpc) {
            const op = {
                type: 'transaction',
                payload: {
                    id: txId,
                    created_at: createdAt,
                    amount,
                    status: 'completed',
                    method,
                    merchant_id: merchantId,
                    customer_id: customerId,
                    merchant_name: merchantName,
                    merchant_pin: merchantPin,
                    merchant_activity: merchantActivity,
                    merchant_location: merchantLocation,
                    customer_name: customerName,
                    customer_card: customerCard,
                    idempotency_key: idemKey
                },
                updates: {
                    customer: { id: customerId, balance: users[custIdx].balance },
                    merchant: { id: merchantId, balance: users[merchIdx].balance, outstanding: users[merchIdx].outstanding }
                }
            };
            SyncService.enqueue(op);
            SyncService.syncPendingWrites();
        }

        if (typeof app !== 'undefined' && app.notifyTransaction) {
            app.notifyTransaction(tx);
        }

        return tx;
    },
    syncPendingWrites: async () => {
        if (!window.supabaseClient) return;
        let ops = SyncService.getPendingOps();
        if (!ops.length) return;
        const remaining = [];
        for (const op of ops) {
            if (op.type === 'transaction') {
                const { payload, updates } = op;
                const { error } = await window.supabaseClient.from('transactions').insert(payload);
                const msg = String(error?.message || '').toLowerCase();
                const duplicate = msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique');
                if (error && !duplicate) {
                    remaining.push(op);
                    continue;
                }
                await window.supabaseClient.from('users').update({ balance: updates.customer.balance }).eq('id', updates.customer.id);
                await window.supabaseClient.from('users').update({ balance: updates.merchant.balance, outstanding: updates.merchant.outstanding }).eq('id', updates.merchant.id);
            } else if (op.type === 'user_update') {
                const { id, updates } = op.payload || {};
                if (!id || !updates) {
                    continue;
                }
                const { error } = await window.supabaseClient.from('users').update(updates).eq('id', id);
                if (error) remaining.push(op);
            }
        }
        SyncService.setPendingOps(remaining);
    }
};

window.SyncService = SyncService;

const router = {
    routes: {
        '/': 'tpl-home',
        '/auth': 'tpl-auth',
        '/pricing': 'tpl-pricing',
        '/about': 'tpl-about',
        '/api': 'tpl-api',
        '/bank-details': 'tpl-bank-details',
        '/profile': 'tpl-profile',
        '/prototype': 'tpl-prototype',
        '/dashboard': 'tpl-dash',
        '/merchants-list': 'tpl-merchants-list',
        '/process-video': 'tpl-process-video',
        '/pay-later-details': 'tpl-pay-later-details',
        '/how-it-works': 'tpl-home',
        '/sub-confirm': 'tpl-sub-confirm',
        '/admin': 'tpl-admin'
    },
    navigate: (path) => {
        window.location.hash = path;
    },
    resolve: () => {
        app.checkAccountStatus();
        let path = window.location.hash.slice(1) || '/';
        let tplId = router.routes[path] || 'tpl-home';

        // Handle dynamic dashboard templates
        if (path === '/dashboard') {
            if (!app.user) {
                router.navigate('/auth');
                return;
            }
            tplId = app.user.role === 'merchant' ? 'tpl-dash-merchant' : 'tpl-dash-customer';
        }

        // Admin route guard
        if (path === '/admin') {
            if (!app.user || app.user.role !== 'admin') {
                router.navigate('/auth');
                return;
            }
        }

        const tpl = document.getElementById(tplId);
        if (tpl) {
            const appContainer = document.getElementById('app');
            appContainer.innerHTML = '';
            appContainer.appendChild(tpl.content.cloneNode(true));
            app.translateUI(); // Ensure translation after rendering
            app.updateDashboardUI();

            if (path === '/merchants-list') {
                app.renderMerchants();
            }
            if (path === '/profile') {
                app.populateProfileData();
            }
            if (path === '/admin') {
                app.renderAdminDashboard();
            }

            window.scrollTo(0, 0);

            if (path === '/how-it-works') {
                setTimeout(() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }
};

window.addEventListener('hashchange', router.resolve);

// Initialize if DOM is ready
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', app.init);
} else {
    app.init();
}

// Listen for real-time subscription updates
window.addEventListener('adjil:subscription:activated', (e) => {
    console.log('[App] Subscription activated:', e.detail);
    if (app.user && e.detail) {
        app.user = { ...app.user, ...e.detail };
        localStorage.setItem('adjil_session', JSON.stringify(app.user));
        
        // Show success notification
        const lang = app.lang || 'ar';
        const msg = lang === 'ar' ? 'تم تفعيل اشتراكك بنجاح! رصيدك الآن ' + (e.detail.credit_limit || e.detail.balance) + ' دج' 
            : lang === 'fr' ? 'Votre abonnement est maintenant actif! Votre solde est ' + (e.detail.credit_limit || e.detail.balance) + ' DZD'
            : 'Your subscription is now active! Your balance is ' + (e.detail.credit_limit || e.detail.balance) + ' DZD';
        alert(msg);
        
        // Refresh dashboard
        router.navigate('/dashboard');
    }
});

window.addEventListener('adjil:subscription:updated', (e) => {
    console.log('[App] Subscription updated:', e.detail);
    // Could show a toast notification here
});

window.addEventListener('adjil:users:updated', () => {
    console.log('[App] Users updated, refreshing session...');
    if (app.user && window.supabaseClient) {
        window.supabaseClient
            .from('users')
            .select('*')
            .eq('id', app.user.id)
            .single()
            .then(({ data }) => {
                if (data) {
                    app.user = { ...app.user, ...data };
                    localStorage.setItem('adjil_session', JSON.stringify(app.user));
                }
            });
    }
});

window.resetFreeze = () => {
    localStorage.removeItem('adjil_frozen');
    location.reload();
};

// Smart App Banner
(function() {
    const BANNER_SESSION_KEY = 'adjil_app_banner_session_shown';
    const BANNER_DELAY = 1500;

    let deferredPrompt = null;

    // Capture the native install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('Native install prompt captured');
    });

    window.addEventListener('appinstalled', (e) => {
        console.log('App installed successfully');
        deferredPrompt = null;
        // Hide the custom banner since app is now installed
        const banner = document.getElementById('app-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    });

    const STORE_URLS = {
        android: 'https://play.google.com/store/apps/details?id=com.adjil.bnpl',
        ios: 'https://apps.apple.com/app/adjil-bnpl/id123456789'
    };

    function detectOS() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            return 'ios';
        }
        
        if (/android/i.test(userAgent)) {
            return 'android';
        }
        
        return 'other';
    }

    function isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.matchMedia('(display-mode: minimal-ui)').matches ||
               navigator.standalone === true;
    }

    function wasBannerShownInSession() {
        return sessionStorage.getItem(BANNER_SESSION_KEY) === 'true';
    }

    function markBannerShownInSession() {
        sessionStorage.setItem(BANNER_SESSION_KEY, 'true');
    }

    function initBanner() {
        if (isAppInstalled()) {
            return;
        }

        if (wasBannerShownInSession()) {
            return;
        }

        const banner = document.getElementById('app-banner');
        const closeBtn = document.getElementById('app-banner-close');
        const installBtn = document.getElementById('app-banner-btn');

        if (!banner || !closeBtn || !installBtn) {
            console.warn('App Banner elements not found');
            return;
        }

        const userOS = detectOS();
        const storeUrl = userOS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;

        // Use native prompt if available, otherwise open store
        installBtn.addEventListener('click', (e) => {
            if (deferredPrompt) {
                e.preventDefault();
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted native install prompt');
                    }
                    deferredPrompt = null;
                });
            } else {
                // No native prompt - open store link
                window.open(storeUrl, '_blank');
            }
        });

        // If no native support, set the href for manual click
        if (!deferredPrompt) {
            installBtn.href = storeUrl;
        }

        setTimeout(() => {
            banner.style.display = 'block';
            banner.offsetHeight;
            banner.classList.add('visible');
            markBannerShownInSession();
        }, BANNER_DELAY);

        closeBtn.addEventListener('click', () => {
            banner.classList.remove('visible');
            setTimeout(() => {
                banner.style.display = 'none';
            }, 500);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBanner);
    } else {
        initBanner();
    }
});
