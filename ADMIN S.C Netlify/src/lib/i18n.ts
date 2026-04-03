export type Language = 'ar' | 'fr' | 'en'

export interface Translation {
  // General
  app_name: string
  login: string
  logout: string
  dashboard: string
  settings: string
  cancel: string
  save: string
  delete: string
  edit: string
  add: string
  search: string
  filter: string
  loading: string
  no_results: string
  success: string
  error: string
  warning: string
  info: string
  
  // Auth
  username: string
  password: string
  remember_me: string
  login_button: string
  login_error: string
  
  // Navigation
  home: string
  users: string
  merchants: string
  transactions: string
  blacklist: string
  frozen: string
  complaints: string
  invoices: string
  audit: string
  team: string
  
  // User Management
  user_details: string
  user_status: string
  user_active: string
  user_inactive: string
  user_suspended: string
  
  // Partner Gateway
  select_institution: string
  institution_other: string
}

const ar: Translation = {
  app_name: 'آجل - Buy Now Pay Later',
  login: 'تسجيل الدخول',
  logout: 'خروج',
  dashboard: 'لوحة الإحصائيات',
  settings: 'الإعدادات',
  cancel: 'إلغاء',
  save: 'حفظ',
  delete: 'حذف',
  edit: 'تعديل',
  add: 'إضافة',
  search: 'بحث',
  filter: 'تصفية',
  loading: 'جاري التحميل...',
  no_results: 'لا توجد نتائج',
  success: 'نجاح',
  error: 'خطأ',
  warning: 'تحذير',
  info: 'معلومات',
  
  username: 'اسم المستخدم',
  password: 'كلمة المرور',
  remember_me: 'تذكرني',
  login_button: 'دخول',
  login_error: 'بيانات الدخول غير صحيحة',
  
  home: 'الرئيسية',
  users: 'الزبائن',
  merchants: 'التجار',
  transactions: 'العمليات',
  blacklist: 'القائمة السوداء',
  frozen: 'حسابات مجمدة',
  complaints: 'الشكاوي',
  invoices: 'الفواتير',
  audit: 'سجل النشاط',
  team: 'فريق العمل',
  
  user_details: 'بيانات المستخدم',
  user_status: 'حالة المستخدم',
  user_active: 'نشط',
  user_inactive: 'غير نشط',
  user_suspended: 'معلق',
  
  select_institution: 'اختر مؤسستك',
  institution_other: 'مؤسسة أخرى'
}

const fr: Translation = {
  app_name: 'Adjil - Buy Now Pay Later',
  login: 'Connexion',
  logout: 'Déconnexion',
  dashboard: 'Tableau de bord',
  settings: 'Paramètres',
  cancel: 'Annuler',
  save: 'Enregistrer',
  delete: 'Supprimer',
  edit: 'Modifier',
  add: 'Ajouter',
  search: 'Rechercher',
  filter: 'Filtrer',
  loading: 'Chargement...',
  no_results: 'Aucun résultat',
  success: 'Succès',
  error: 'Erreur',
  warning: 'Avertissement',
  info: 'Information',
  
  username: "Nom d'utilisateur",
  password: 'Mot de passe',
  remember_me: 'Se souvenir de moi',
  login_button: 'Se connecter',
  login_error: 'Identifiants incorrects',
  
  home: 'Accueil',
  users: 'Clients',
  merchants: 'Marchands',
  transactions: 'Transactions',
  blacklist: 'Liste noire',
  frozen: 'Comptes gelés',
  complaints: 'Réclamations',
  invoices: 'Factures',
  audit: 'Journal',
  team: 'Équipe',
  
  user_details: 'Détails utilisateur',
  user_status: 'Statut utilisateur',
  user_active: 'Actif',
  user_inactive: 'Inactif',
  user_suspended: 'Suspendu',
  
  select_institution: 'Sélectionnez votre institution',
  institution_other: 'Autre institution'
}

const en: Translation = {
  app_name: 'Adjil - Buy Now Pay Later',
  login: 'Login',
  logout: 'Logout',
  dashboard: 'Dashboard',
  settings: 'Settings',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add',
  search: 'Search',
  filter: 'Filter',
  loading: 'Loading...',
  no_results: 'No results found',
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  info: 'Information',
  
  username: 'Username',
  password: 'Password',
  remember_me: 'Remember me',
  login_button: 'Login',
  login_error: 'Invalid credentials',
  
  home: 'Home',
  users: 'Customers',
  merchants: 'Merchants',
  transactions: 'Transactions',
  blacklist: 'Blacklist',
  frozen: 'Frozen Accounts',
  complaints: 'Complaints',
  invoices: 'Invoices',
  audit: 'Audit Log',
  team: 'Team',
  
  user_details: 'User Details',
  user_status: 'User Status',
  user_active: 'Active',
  user_inactive: 'Inactive',
  user_suspended: 'Suspended',
  
  select_institution: 'Select your institution',
  institution_other: 'Other institution'
}

const translations: Record<Language, Translation> = {
  ar,
  fr,
  en
}

// Get stored language or default to Arabic
export const getStoredLanguage = (): Language => {
  const stored = localStorage.getItem('language')
  if (stored && ['ar', 'fr', 'en'].includes(stored)) {
    return stored as Language
  }
  return 'ar'
}

// Set language and update document direction
export const setLanguage = (lang: Language) => {
  localStorage.setItem('language', lang)
  
  // Update document direction
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  
  // Update body class for styling
  document.body.classList.remove('lang-ar', 'lang-fr', 'lang-en')
  document.body.classList.add(`lang-${lang}`)
}

// Get translation for current language
export const t = (key: keyof Translation): string => {
  const lang = getStoredLanguage()
  return translations[lang][key]
}

// Get full translation object
export const getTranslations = (): Translation => {
  const lang = getStoredLanguage()
  return translations[lang]
}

// Get language display name
export const getLanguageName = (lang: Language): string => {
  const names: Record<Language, string> = {
    ar: 'العربية',
    fr: 'Français',
    en: 'English'
  }
  return names[lang]
}

// Initialize i18n
export const initI18n = () => {
  const lang = getStoredLanguage()
  setLanguage(lang)
}

export default translations
