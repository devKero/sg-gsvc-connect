-- ===================================================
-- 서강대 GSVC Connect - Supabase RLS 활성화 및 RPC 보안 함수 설정 스크립트
-- ===================================================
-- 이 스크립트는 프로젝트에 Supabase Auth 대신 데이터 독립성과 이관성을 확보하면서도
-- 외부 쓰기 공격으로부터 DB를 완벽히 보호하기 위해 Supabase SQL Editor에서 실행하는 용도입니다.
-- (실행 시 기존 members 테이블 RLS 정책이 초기화되고 RPC 보안 체계로 전환됩니다.)

-- ---------------------------------------------------
-- 1. members 테이블 RLS 활성화 및 Anon 권한 통제
-- ---------------------------------------------------
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 기존 정책 전체 제거
DROP POLICY IF EXISTS "모든 구성원 정보 조회 허용" ON public.members;
DROP POLICY IF EXISTS "본인 정보 수정 허용" ON public.members;
DROP POLICY IF EXISTS "운영진 회원 관리 제어 허용" ON public.members;
DROP POLICY IF EXISTS "전체 원우 조회 허용" ON public.members;

-- 정책 A: 누구나 원우 정보 조회(SELECT) 가능 (디렉토리 조회용)
CREATE POLICY "전체 원우 조회 허용" ON public.members
FOR SELECT USING (true);

-- 정책 B: 외부 Anon API를 통한 직접 UPDATE, INSERT, DELETE는 전면 차단
-- (기존에 허용했던 직접 UPDATE를 차단하여, 오직 아래의 SECURITY DEFINER 함수로만 데이터 수정이 가능하게 제한)


-- ---------------------------------------------------
-- 2. 일반 원우용 프로필 업데이트 RPC 보안 함수
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_update_member_profile(
    p_request_id text,
    p_member_id text,
    p_password_hash text,
    p_update_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- 함수 생성자(owner/admin) 권한으로 실행되어 RLS를 우회함
AS $$
BEGIN
    -- 1. 본인 또는 어드민 권한 검증
    IF NOT (
        -- 본인 수정 조건 (수정하려는 ID와 로그인한 ID가 같고, 암호 검증 통과)
        (p_member_id = p_request_id AND EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id AND password = p_password_hash))
        OR
        -- 어드민 수정 조건 (로그인한 ID가 관리자이고, 관리자 암호 검증 통과)
        EXISTS (SELECT 1 FROM public.members WHERE id = p_request_id AND password = p_password_hash AND role IN ('admin', 'super_admin'))
    ) THEN
        RAISE EXCEPTION '권한 거부: 프로필을 수정할 권한이 없거나 비밀번호가 올바르지 않습니다.';
    END IF;

    -- 2. 데이터 업데이트 수행 (업데이트 가능 컬럼 엄격하게 한정)
    UPDATE public.members
    SET 
        name = COALESCE(p_update_data->> 'name', name),
        email = COALESCE(p_update_data->> 'email', email),
        class_year = COALESCE(p_update_data->> 'classYear', class_year),
        generation = CASE WHEN p_update_data ? 'generation' THEN (p_update_data->>'generation')::integer ELSE generation END,
        headline = COALESCE(p_update_data->> 'headline', headline),
        sns_links = CASE WHEN p_update_data ? 'snsLinks' THEN p_update_data->'snsLinks' ELSE sns_links END,
        tags = CASE WHEN p_update_data ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text(p_update_data->'tags')) ELSE tags END,
        bio = COALESCE(p_update_data->> 'bio', bio),
        projects = COALESCE(p_update_data->> 'projects', projects),
        custom_content = COALESCE(p_update_data->> 'customContent', custom_content),
        avatar_image = COALESCE(p_update_data->> 'avatarImage', avatar_image),
        degree_process = COALESCE(p_update_data->> 'degreeProcess', degree_process),
        academic_status = COALESCE(p_update_data->> 'academicStatus', academic_status),
        education = COALESCE(p_update_data->> 'education', education),
        experience = COALESCE(p_update_data->> 'experience', experience)
    WHERE id = p_member_id;
END;
$$;


-- ---------------------------------------------------
-- 3. 일반 원우용 비밀번호 변경 RPC 보안 함수
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_change_member_password(
    p_member_id text,
    p_current_password_hash text,
    p_new_password_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. 현재 비밀번호 대조 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_member_id AND password = p_current_password_hash
    ) THEN
        RAISE EXCEPTION '현재 비밀번호가 정확하지 않습니다.';
    END IF;

    -- 2. 새 비밀번호 해시 업데이트
    UPDATE public.members
    SET password = p_new_password_hash
    WHERE id = p_member_id;
END;
$$;


-- ---------------------------------------------------
-- 4. 운영진용 권한 검증 및 비밀번호 초기화 RPC 보안 함수
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_reset_member_password(
    p_admin_id text,
    p_admin_password_hash text,
    p_target_member_id text,
    p_reset_password_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. 요청자가 실제 운영진인지 및 암호 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 요청자가 운영진이 아니거나 어드민 암호 검증에 실패했습니다.';
    END IF;

    -- 2. 대상 멤버 비밀번호 초기화
    UPDATE public.members
    SET password = p_reset_password_hash
    WHERE id = p_target_member_id;
END;
$$;


-- ---------------------------------------------------
-- 5. 운영진용 신규 멤버 추가 RPC 보안 함수 (단일 추가 및 엑셀 루프 연동용)
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_insert_member(
    p_admin_id text,
    p_admin_password_hash text,
    p_new_member jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. 운영진 권한 2차 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진이 아니거나 비밀번호가 틀려 멤버를 추가할 수 없습니다.';
    END IF;

    -- 2. 신규 멤버 삽입
    INSERT INTO public.members (
        id, student_id, password, name, class_year, generation, 
        headline, avatar_color, sns_links, tags, bio, projects, 
        custom_content, avatar_image, degree_process, academic_status, 
        education, experience, role
    ) VALUES (
        p_new_member->>'id',
        p_new_member->>'studentId',
        p_new_member->>'password',
        p_new_member->>'name',
        p_new_member->>'classYear',
        (p_new_member->>'generation')::integer,
        COALESCE(p_new_member->>'headline', '서강대 가상융합전문대학원 원우'),
        COALESCE(p_new_member->>'avatarColor', '#7f8c8d'),
        COALESCE(p_new_member->'snsLinks', '[]'::jsonb),
        COALESCE(p_new_member->'tags', '[]'::jsonb),
        COALESCE(p_new_member->>'bio', ''),
        COALESCE(p_new_member->>'projects', ''),
        COALESCE(p_new_member->>'customContent', ''),
        p_new_member->>'avatarImage',
        COALESCE(p_new_member->>'degreeProcess', '석사'),
        COALESCE(p_new_member->>'academicStatus', ''),
        COALESCE(p_new_member->>'education', ''),
        COALESCE(p_new_member->>'experience', ''),
        COALESCE(p_new_member->>'role', 'member')
    );
END;
$$;
