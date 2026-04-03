-- تنظيف الهيكل القديم لضمان بداية نقية
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. جدول الحسابات (Profiles) - "قلب المنصة"
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  email text,
  role text DEFAULT 'customer' CHECK (role IN ('admin', 'support', 'partner', 'merchant', 'customer')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'frozen', 'blacklisted')),
  business_name text,
  business_type text,
  state text, -- الولاية (عنابة، الجزائر، إلخ)
  city text, -- البلدية
  document_urls jsonb DEFAULT '[]', -- روابط الوثائق والصور المرفوعة
  risk_score int DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. جدول العمليات (Transactions) - "تتبع الأموال"
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES public.profiles(id),
  merchant_id uuid REFERENCES public.profiles(id),
  amount numeric NOT NULL,
  installments_count int DEFAULT 3,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- تفعيل الأمان (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);