-- 1. members 테이블 생성
CREATE TABLE IF NOT EXISTS public.members (
    id text PRIMARY KEY,
    student_id text UNIQUE NOT NULL,
    phone_last4 text NOT NULL,
    name text NOT NULL,
    class_year text NOT NULL,
    generation integer,
    headline text NOT NULL,
    avatar_color text DEFAULT '#B30838',
    email text,
    sns_links jsonb DEFAULT '[]'::jsonb,
    tags text[],
    bio text,
    projects text,
    custom_content text,
    avatar_image text,
    degree_process text DEFAULT '석사',
    academic_status text DEFAULT '재학',
    education text DEFAULT '',
    experience text DEFAULT '',
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT now()
);

-- 2. guestbook 테이블 생성
CREATE TABLE IF NOT EXISTS public.guestbook (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_member_id text NOT NULL,
    author text NOT NULL,
    message text NOT NULL,
    tag text NOT NULL,
    is_private boolean DEFAULT false,
    timestamp text NOT NULL,
    likes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 인수인계와 간편한 데모 작동을 위해 테이블 보안(RLS)을 임시 해제합니다.
-- (실제 보안이 강화된 상용 서비스 운영 시에는 Supabase RLS 정책을 활성화할 수 있습니다)
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook DISABLE ROW LEVEL SECURITY;

-- 4. majors 테이블 생성 및 기본 데이터 추가
CREATE TABLE IF NOT EXISTS public.majors (
    id serial PRIMARY KEY,
    name text UNIQUE NOT NULL
);
ALTER TABLE public.majors DISABLE ROW LEVEL SECURITY;

INSERT INTO public.majors (name) VALUES 
('메타버스 전공'), 
('컴퓨터공학 전공'), 
('미디어 테크놀로지'), 
('아트&테크놀로지'), 
('가상융합 시스템'), 
('인공지능 전공')
ON CONFLICT (name) DO NOTHING;

-- 3. Storage 버킷 설정
-- 프로필 사진이 업로드될 'avatars' 버킷을 Public 형태로 생성합니다.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 누구나 프로필 이미지를 다운로드받아 읽을 수 있는 권한 정책 부여
CREATE POLICY "Public Read Access" ON storage.objects 
    FOR SELECT USING (bucket_id = 'avatars');

-- 누구나 프로필 이미지를 업로드할 수 있는 권한 정책 부여
CREATE POLICY "Anyone can Upload" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'avatars');

-- 누구나 자신의 프로필 이미지를 수정할 수 있는 권한 정책 부여
CREATE POLICY "Anyone can Update" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'avatars');

-- 누구나 자신의 프로필 이미지를 삭제할 수 있는 권한 정책 부여
CREATE POLICY "Anyone can Delete" ON storage.objects 
    FOR DELETE USING (bucket_id = 'avatars');

-- 5. inquiries 테이블 생성 (운영진 문의 및 건의 소통)
CREATE TABLE IF NOT EXISTS public.inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id text NOT NULL,
    author text NOT NULL,
    title text,
    message text NOT NULL,
    reply text,
    replied_by text, -- 답변한 운영진 기록 추가
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.inquiries DISABLE ROW LEVEL SECURITY;

-- 기존에 inquiries 테이블을 이미 생성한 경우, 아래 명령어를 실행하여 답변자 컬럼을 추가해 주세요:
-- ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS replied_by text;

