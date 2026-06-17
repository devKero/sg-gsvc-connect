-- =========================================================================
-- 서강대 GSVC Connect - Supabase 전체 테이블 RLS 활성화 및 RPC 보안 함수 종합 설정 스크립트
-- =========================================================================
-- 이 스크립트는 Supabase Auth를 사용하지 않으면서도 외부의 Anon Key 직접 DML 공격을
-- 원천 차단하고, 모든 읽기/쓰기 데이터를 DB 내장 보안 함수(RPC)를 통해 안전하게
-- 제어 및 격리하기 위한 종합 패키지 스크립트입니다.
-- Supabase SQL Editor에서 이 스크립트 전체를 실행하시면 됩니다.
-- =========================================================================

-- =========================================================================
-- 0. 기존 데이터 초기화 및 ID 시퀀스 설정 (정식 오픈 전 청소)
-- =========================================================================
TRUNCATE TABLE public.messages CASCADE;
TRUNCATE TABLE public.inquiries CASCADE;
TRUNCATE TABLE public.guestbook CASCADE;
TRUNCATE TABLE public.members CASCADE;
TRUNCATE TABLE public.quick_links CASCADE;

DROP SEQUENCE IF EXISTS public.members_id_seq;
CREATE SEQUENCE public.members_id_seq START WITH 1;

-- -------------------------------------------------------------------------
-- 1. 모든 테이블 RLS 활성화 및 정책 초기화
-- -------------------------------------------------------------------------
-- 0. 누락된 컬럼 마이그레이션 (deleted_at 추가)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;

-- 기존 정책들 전체 삭제 (충돌 방지)
DROP POLICY IF EXISTS "모든 구성원 정보 조회 허용" ON public.members;
DROP POLICY IF EXISTS "본인 정보 수정 허용" ON public.members;
DROP POLICY IF EXISTS "운영진 회원 관리 제어 허용" ON public.members;
DROP POLICY IF EXISTS "전체 원우 조회 허용" ON public.members;

-- 기존 오버로딩된 bigint 버전 함수들 제거 (Multiple Choices 300 및 리턴타입 미매칭 에러 방지)
DROP FUNCTION IF EXISTS public.rpc_like_guestbook(bigint);
DROP FUNCTION IF EXISTS public.rpc_delete_guestbook(text, text, bigint);
DROP FUNCTION IF EXISTS public.rpc_get_my_messages(text, text);
DROP FUNCTION IF EXISTS public.rpc_delete_message_tombstone(text, text, bigint);
DROP FUNCTION IF EXISTS public.rpc_reply_inquiry_admin(text, text, bigint, text, text);
DROP FUNCTION IF EXISTS public.rpc_update_inquiry_status(text, text, bigint, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.rpc_get_my_inquiries(text, text, text);
DROP FUNCTION IF EXISTS public.rpc_get_all_inquiries_admin(text, text);


DROP POLICY IF EXISTS "본인 송수신 쪽지만 조회 허용" ON public.messages;
DROP POLICY IF EXISTS "본인 명의 쪽지 발송 허용" ON public.messages;
DROP POLICY IF EXISTS "수신인 쪽지 읽음 처리 허용" ON public.messages;
DROP POLICY IF EXISTS "발신인 쪽지 수정 허용" ON public.messages;
DROP POLICY IF EXISTS "Anon 쪽지 제어 허용" ON public.messages;

DROP POLICY IF EXISTS "본인 문의사항 조회 허용" ON public.inquiries;
DROP POLICY IF EXISTS "본인 문의사항 등록 허용" ON public.inquiries;
DROP POLICY IF EXISTS "운영진 모든 문의사항 관리 허용" ON public.inquiries;
DROP POLICY IF EXISTS "Anon 문의사항 제어 허용" ON public.inquiries;

DROP POLICY IF EXISTS "모든 방명록 조회 허용" ON public.guestbook;
DROP POLICY IF EXISTS "Anon 방명록 제어 허용" ON public.guestbook;

-- [보안 정책 개방 분기]
-- A. 원우 정보 조회(SELECT)는 디렉토리 뷰를 위해 전면 허용
CREATE POLICY "전체 원우 조회 허용" ON public.members FOR SELECT USING (true);

-- B. 방명록 조회(SELECT)는 프로필 카드 뷰 노출을 위해 전면 허용
CREATE POLICY "모든 방명록 조회 허용" ON public.guestbook FOR SELECT USING (true);

-- C. 그 외의 모든 직접 INSERT, UPDATE, DELETE 및 비공개 테이블(messages, inquiries) SELECT는 RLS로 전면 차단


-- -------------------------------------------------------------------------
-- 2. 회원 정보(members) 제어용 RPC 보안 함수
-- -------------------------------------------------------------------------

-- ① 일반 원우용 프로필 업데이트 RPC 보안 함수
CREATE OR REPLACE FUNCTION public.rpc_update_member_profile(
    p_request_id text,
    p_member_id text,
    p_password_hash text,
    p_update_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 본인 또는 어드민 권한 검증
    IF NOT (
        -- 본인 수정 조건 (수정하려는 ID와 로그인한 ID가 같고, 암호 검증 통과)
        (p_member_id = p_request_id AND EXISTS (SELECT 1 FROM public.members WHERE id = p_member_id AND password = p_password_hash))
        OR
        -- 어드민 수정 조건 (로그인한 ID가 관리자이고, 관리자 암호 검증 통과)
        EXISTS (SELECT 1 FROM public.members WHERE id = p_request_id AND password = p_password_hash AND role IN ('admin', 'super_admin'))
    ) THEN
        RAISE EXCEPTION '권한 거부: 프로필을 수정할 권한이 없거나 비밀번호가 올바르지 않습니다.';
    END IF;

    -- 데이터 업데이트 수행
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

-- ② 일반 원우용 비밀번호 변경 RPC 보안 함수
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
    -- 현재 비밀번호 대조 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_member_id AND password = p_current_password_hash
    ) THEN
        RAISE EXCEPTION '현재 비밀번호가 정확하지 않습니다.';
    END IF;

    -- 새 비밀번호 해시 업데이트
    UPDATE public.members
    SET password = p_new_password_hash
    WHERE id = p_member_id;
END;
$$;

-- ③ 운영진용 비밀번호 강제 초기화 RPC 보안 함수
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
    -- 요청자 어드민 및 암호 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 요청자가 운영진이 아니거나 어드민 암호 검증에 실패했습니다.';
    END IF;

    -- 대상 멤버 비밀번호 초기화
    UPDATE public.members
    SET password = p_reset_password_hash
    WHERE id = p_target_member_id;
END;
$$;

-- ④ 운영진용 신규 멤버 추가 RPC 보안 함수 (단일 가입 및 승인, 엑셀 대량 업로드 통합)
CREATE OR REPLACE FUNCTION public.rpc_insert_member(
    p_admin_id text,
    p_admin_password_hash text,
    p_new_member jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id text;
BEGIN
    -- 운영진 권한 2차 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진이 아니거나 비밀번호가 틀려 멤버를 추가할 수 없습니다.';
    END IF;

    -- 시퀀스를 이용한 고유 순차 ID 발급
    v_member_id := 'pid_' || nextval('public.members_id_seq');

    -- 신규 멤버 삽입
    INSERT INTO public.members (
        id, student_id, password, name, class_year, generation, 
        headline, avatar_color, sns_links, tags, bio, projects, 
        custom_content, avatar_image, degree_process, academic_status, 
        education, experience, role
    ) VALUES (
        v_member_id,
        p_new_member->>'studentId',
        p_new_member->>'password',
        p_new_member->>'name',
        p_new_member->>'classYear',
        (p_new_member->>'generation')::integer,
        COALESCE(p_new_member->>'headline', '서강대 가상융합전문대학원 원우'),
        COALESCE(p_new_member->>'avatarColor', '#7f8c8d'),
        COALESCE(p_new_member->'snsLinks', '[]'::jsonb),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_new_member->'tags')), '{}'::text[]),
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

    RETURN v_member_id;
END;
$$;


-- -------------------------------------------------------------------------
-- 3. 1:1 쪽지(messages) 관련 RPC 보안 함수
-- -------------------------------------------------------------------------

-- ① 쪽지 발송
CREATE OR REPLACE FUNCTION public.rpc_send_message(
    p_sender_id text,
    p_sender_password_hash text,
    p_receiver_id text,
    p_sender_name text,
    p_receiver_name text,
    p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 발신자 자격 검증 (비밀번호 해시 일치 여부)
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_sender_id AND password = p_sender_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 발신자 인증이 실패했습니다.';
    END IF;

    -- 쪽지 등록
    INSERT INTO public.messages (sender_id, receiver_id, sender_name, receiver_name, message, is_read)
    VALUES (p_sender_id, p_receiver_id, p_sender_name, p_receiver_name, p_message, false);
END;
$$;

-- ② 자신의 쪽지 목록 조회 (타인이 조작하는 SELECT 원천 차단)
CREATE OR REPLACE FUNCTION public.rpc_get_my_messages(
    p_user_id text,
    p_password_hash text
)
RETURNS TABLE (
    id uuid,
    sender_id text,
    receiver_id text,
    sender_name text,
    receiver_name text,
    message text,
    is_read boolean,
    created_at timestamp with time zone,
    deleted_by_receiver boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
    -- 회원 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_user_id AND password = p_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    RETURN QUERY
    SELECT m.id, m.sender_id, m.receiver_id, m.sender_name, m.receiver_name, m.message, m.is_read, m.created_at, m.deleted_by_receiver
    FROM public.messages m
    WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
    ORDER BY m.created_at DESC;
END;
$$;

-- ③ 쪽지 읽음 처리 (특정 상대방이 보낸 쪽지 대상)
CREATE OR REPLACE FUNCTION public.rpc_mark_messages_read(
    p_user_id text,
    p_password_hash text,
    p_opponent_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 회원 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_user_id AND password = p_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    -- 읽음 반영
    UPDATE public.messages
    SET is_read = true
    WHERE receiver_id = p_user_id 
      AND (p_opponent_id IS NULL OR p_opponent_id = '' OR sender_id = p_opponent_id) 
      AND is_read = false;
END;
$$;

-- ④ 보낸 쪽지 삭제 (흔적 남기기)
CREATE OR REPLACE FUNCTION public.rpc_delete_message_tombstone(
    p_user_id text,
    p_password_hash text,
    p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 사용자 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_user_id AND password = p_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    -- 발신자 본인 여부 대조
    IF NOT EXISTS (
        SELECT 1 FROM public.messages
        WHERE id = p_message_id AND sender_id = p_user_id
    ) THEN
        RAISE EXCEPTION '권한 거부: 본인이 발송한 쪽지만 삭제할 수 있습니다.';
    END IF;

    UPDATE public.messages
    SET message = '삭제된 쪽지입니다.'
    WHERE id = p_message_id;
END;
$$;

-- ⑤ 오래된 쪽지 영구 삭제 (어드민용 백그라운드 스케줄 정리 대응)
CREATE OR REPLACE FUNCTION public.rpc_purge_old_messages(
    p_admin_id text,
    p_admin_password_hash text,
    p_cutoff_time timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진이 아니거나 비밀번호가 정확하지 않습니다.';
    END IF;

    DELETE FROM public.messages
    WHERE created_at < p_cutoff_time;
END;
$$;


-- -------------------------------------------------------------------------
-- 4. 문의/건의사항(inquiries) 관련 RPC 보안 함수
-- -------------------------------------------------------------------------

-- ① 문의사항 등록
CREATE OR REPLACE FUNCTION public.rpc_create_inquiry(
    p_user_id text,
    p_password_hash text,
    p_student_id text,
    p_author text,
    p_title text,
    p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 회원 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_user_id AND password = p_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    INSERT INTO public.inquiries (student_id, author, title, message, reply, status)
    VALUES (p_student_id, p_author, p_title, p_message, '', 'pending');
END;
$$;

-- ② 일반 원우용 본인 작성 문의 조회
CREATE OR REPLACE FUNCTION public.rpc_get_my_inquiries(
    p_user_id text,
    p_password_hash text,
    p_student_id text
)
RETURNS TABLE (
    id uuid,
    student_id text,
    author text,
    title text,
    message text,
    reply text,
    replied_by text,
    status text,
    created_at timestamp with time zone,
    deleted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
    -- 회원 인증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_user_id AND password = p_password_hash
    ) THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    RETURN QUERY
    SELECT 
        i.id, 
        COALESCE(m.student_id, i.student_id) AS student_id,
        i.author, 
        i.title, 
        i.message, 
        i.reply, 
        i.replied_by, 
        i.status, 
        i.created_at, 
        i.deleted_at
    FROM public.inquiries i
    LEFT JOIN public.members m ON (i.student_id = m.id OR i.student_id = m.student_id)
    WHERE i.student_id = p_student_id OR i.student_id = p_user_id
    ORDER BY i.created_at DESC;
END;
$$;

-- ③ 어드민용 전체 문의사항 조회
CREATE OR REPLACE FUNCTION public.rpc_get_all_inquiries_admin(
    p_admin_id text,
    p_admin_password_hash text
)
RETURNS TABLE (
    id uuid,
    student_id text,
    author text,
    title text,
    message text,
    reply text,
    replied_by text,
    status text,
    created_at timestamp with time zone,
    deleted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    RETURN QUERY
    SELECT 
        i.id, 
        COALESCE(m.student_id, i.student_id) AS student_id,
        i.author, 
        i.title, 
        i.message, 
        i.reply, 
        i.replied_by, 
        i.status, 
        i.created_at, 
        i.deleted_at
    FROM public.inquiries i
    LEFT JOIN public.members m ON (i.student_id = m.id OR i.student_id = m.student_id)
    ORDER BY i.created_at DESC;
END;
$$;

-- ④ 어드민 답변 등록
CREATE OR REPLACE FUNCTION public.rpc_reply_inquiry_admin(
    p_admin_id text,
    p_admin_password_hash text,
    p_inquiry_id uuid,
    p_reply_text text,
    p_replied_by text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 인증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    UPDATE public.inquiries
    SET reply = p_reply_text, replied_by = p_replied_by, status = 'resolved'
    WHERE id = p_inquiry_id;
END;
$$;

-- ⑤ 문의사항 상태 제어 (Soft Delete, 복구, 영구 삭제 통합)
CREATE OR REPLACE FUNCTION public.rpc_update_inquiry_status(
    p_user_id text,
    p_password_hash text,
    p_inquiry_id uuid,
    p_status text,
    p_deleted_at timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
    v_author_student_id text;
    v_user_student_id text;
BEGIN
    -- 사용자 권한 및 학번 조회
    SELECT (role IN ('admin', 'super_admin')), student_id
    INTO v_is_admin, v_user_student_id
    FROM public.members
    WHERE id = p_user_id AND password = p_password_hash;

    IF v_user_student_id IS NULL THEN
        RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
    END IF;

    -- 대상 문의글 작성자 조회
    SELECT student_id INTO v_author_student_id
    FROM public.inquiries
    WHERE id = p_inquiry_id;

    -- 권한 대조: 어드민이거나 글쓴이 본인이어야 함
    IF NOT (v_is_admin OR v_user_student_id = v_author_student_id) THEN
        RAISE EXCEPTION '권한 거부: 해당 문의글을 제어할 권한이 없습니다.';
    END IF;

    -- 영구 삭제 처리 분기
    IF p_status = 'permanently_deleted' THEN
        IF NOT v_is_admin THEN
            RAISE EXCEPTION '권한 거부: 영구 삭제는 운영진만 실행할 수 있습니다.';
        END IF;
        DELETE FROM public.inquiries WHERE id = p_inquiry_id;
    ELSE
        UPDATE public.inquiries
        SET status = p_status, deleted_at = p_deleted_at
        WHERE id = p_inquiry_id;
    END IF;
END;
$$;

-- ⑥ 30일 경과한 문의 및 회원 영구 파기 (어드민용 백그라운드 정리 루틴)
CREATE OR REPLACE FUNCTION public.rpc_purge_deleted_items(
    p_admin_id text,
    p_admin_password_hash text,
    p_cutoff_time timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    -- 30일이 지난 문의사항 파기
    DELETE FROM public.inquiries
    WHERE status = 'deleted' AND deleted_at < p_cutoff_time;

    -- 30일이 지난 탈퇴/비활성 회원 파기
    DELETE FROM public.members
    WHERE role = 'deleted' AND deleted_at < p_cutoff_time;
END;
$$;


-- -------------------------------------------------------------------------
-- 5. 방명록(guestbook) 관련 RPC 보안 함수
-- -------------------------------------------------------------------------

-- ① 방명록 댓글 작성 (게스트 작성 호환 탑재)
CREATE OR REPLACE FUNCTION public.rpc_insert_guestbook(
    p_author_id text,
    p_password_hash text,
    p_guestbook_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 회원이 작성할 경우 자격 대조 수행 (게스트가 작성할 시 검증 우회)
    IF p_author_id <> 'guest' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.members 
            WHERE id = p_author_id AND password = p_password_hash
        ) THEN
            RAISE EXCEPTION '인증 실패: 회원 인증에 실패했습니다.';
        END IF;
    END IF;

    INSERT INTO public.guestbook (target_member_id, author, message, tag, is_private, timestamp, likes)
    VALUES (
        p_guestbook_data->>'targetMemberId',
        p_guestbook_data->>'author',
        p_guestbook_data->>'message',
        COALESCE(p_guestbook_data->>'tag', 'cheer'),
        COALESCE((p_guestbook_data->>'isPrivate')::boolean, false),
        COALESCE(p_guestbook_data->>'timestamp', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
        0
    );
END;
$$;

-- ② 방명록 댓글 삭제
CREATE OR REPLACE FUNCTION public.rpc_delete_guestbook(
    p_request_id text,
    p_password_hash text,
    p_comment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
    v_target_member_id text;
    v_author_name text;
    v_request_name text;
BEGIN
    -- 요청자 신원 확인
    SELECT (role IN ('admin', 'super_admin')), name
    INTO v_is_admin, v_request_name
    FROM public.members
    WHERE id = p_request_id AND password = p_password_hash;

    IF v_request_name IS NULL THEN
        RAISE EXCEPTION '인증 실패: 요청자 인증에 실패했습니다.';
    END IF;

    -- 대상 댓글 정보 추출
    SELECT target_member_id, author
    INTO v_target_member_id, v_author_name
    FROM public.guestbook
    WHERE id = p_comment_id;

    -- 권한 대조: 관리자이거나, 자기 자신 프로필 방명록이거나, 직접 쓴 작성자여야 함
    IF NOT (
        v_is_admin 
        OR p_request_id = v_target_member_id 
        OR v_request_name = v_author_name
    ) THEN
        RAISE EXCEPTION '권한 거부: 해당 방명록을 삭제할 권한이 없습니다.';
    END IF;

    DELETE FROM public.guestbook WHERE id = p_comment_id;
END;
$$;

-- ③ 방명록 좋아요 증가 (비밀번호 검증 미필요)
CREATE OR REPLACE FUNCTION public.rpc_like_guestbook(
    p_comment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.guestbook
    SET likes = COALESCE(likes, 0) + 1
    WHERE id = p_comment_id;
END;
$$;


-- -------------------------------------------------------------------------
-- 6. 추가 보완 RPC 보안 함수 (가입신청, 마이그레이션 및 어드민 멤버 제어)
-- -------------------------------------------------------------------------

-- ① 비로그인 일반 유저 회원 가입 신청 전용 RPC (role: pending 강제 고정)
CREATE OR REPLACE FUNCTION public.rpc_request_signup(
    p_new_member jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_id text;
BEGIN
    -- 학번 중복 검증
    IF EXISTS (SELECT 1 FROM public.members WHERE student_id = p_new_member->>'studentId') THEN
        RAISE EXCEPTION '이미 등록되었거나 신청 중인 학번입니다.';
    END IF;

    -- 시퀀스를 이용한 고유 순차 ID 발급
    v_member_id := 'pid_' || nextval('public.members_id_seq');

    -- 신규 멤버 삽입
    INSERT INTO public.members (
        id, student_id, password, name, email, class_year, generation, 
        headline, avatar_color, sns_links, tags, bio, projects, 
        custom_content, avatar_image, degree_process, academic_status, 
        education, experience, role
    ) VALUES (
        v_member_id,
        p_new_member->>'studentId',
        p_new_member->>'password',
        p_new_member->>'name',
        p_new_member->>'email',
        p_new_member->>'classYear',
        (p_new_member->>'generation')::integer,
        '운영진 승인 대기 중인 가입 신청입니다.', -- 가입신청 기본 헤드라인
        COALESCE(p_new_member->>'avatarColor', '#7f8c8d'),
        COALESCE(p_new_member->'snsLinks', '[]'::jsonb),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_new_member->'tags')), '{}'::text[]),
        COALESCE(p_new_member->>'bio', ''),
        COALESCE(p_new_member->>'projects', ''),
        COALESCE(p_new_member->>'customContent', ''),
        p_new_member->>'avatarImage',
        COALESCE(p_new_member->>'degreeProcess', '석사'),
        COALESCE(p_new_member->>'academicStatus', ''),
        COALESCE(p_new_member->>'education', ''),
        COALESCE(p_new_member->>'experience', ''),
        'pending'  -- role 강제 고정
    );

    RETURN v_member_id;
END;
$$;

-- ② 비밀번호 해시 자동 마이그레이션 전용 RPC (평문 검증 후 해싱 저장)
CREATE OR REPLACE FUNCTION public.rpc_migrate_member_password(
    p_member_id text,
    p_plain_password text,
    p_new_password_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- DB에 저장된 값이 평문 패스워드와 일치하는지 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.members
        WHERE id = p_member_id AND password = p_plain_password
    ) THEN
        RAISE EXCEPTION '인증 실패: 기존 비밀번호가 일치하지 않아 마이그레이션할 수 없습니다.';
    END IF;

    -- 새 해시값으로 업데이트
    UPDATE public.members
    SET password = p_new_password_hash
    WHERE id = p_member_id;
END;
$$;

-- ③ 어드민용 멤버 상태/역할/삭제 정보 제어 RPC
CREATE OR REPLACE FUNCTION public.rpc_update_member_status_admin(
    p_admin_id text,
    p_admin_password_hash text,
    p_target_member_id text,
    p_new_role text,
    p_new_headline text,
    p_deleted_at timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진이 아니거나 비밀번호가 틀려 멤버 상태를 변경할 수 없습니다.';
    END IF;

    -- 대상 멤버가 최고 어드민이면 수정 불가
    IF EXISTS (
        SELECT 1 FROM public.members
        WHERE id = p_target_member_id AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION '권한 거부: 최고 운영진의 상태는 변경할 수 없습니다.';
    END IF;

    -- 상태 수정
    UPDATE public.members
    SET 
        role = p_new_role,
        headline = COALESCE(p_new_headline, headline),
        deleted_at = p_deleted_at
    WHERE id = p_target_member_id;
END;
$$;

-- ④ 어드민용 멤버 데이터 영구 삭제 RPC
CREATE OR REPLACE FUNCTION public.rpc_delete_member_permanent_admin(
    p_admin_id text,
    p_admin_password_hash text,
    p_target_member_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진이 아니거나 비밀번호가 틀려 멤버를 영구 삭제할 수 없습니다.';
    END IF;

    -- 대상 멤버가 최고 어드민이면 삭제 불가
    IF EXISTS (
        SELECT 1 FROM public.members
        WHERE id = p_target_member_id AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION '권한 거부: 최고 운영진은 삭제할 수 없습니다.';
    END IF;

    -- 영구 삭제
    DELETE FROM public.members WHERE id = p_target_member_id;
END;
$$;


-- =========================================================================
-- 5. 빠른 링크 (quick_links) 테이블 RLS 활성화 및 RPC 보안 함수 설정
-- =========================================================================

-- 1) RLS 활성화
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거
DROP POLICY IF EXISTS "Allow public read access on quick_links" ON public.quick_links;
DROP POLICY IF EXISTS "Allow admin write access on quick_links" ON public.quick_links;

-- 2) 누구나 빠른 링크를 조회할 수 있도록 SELECT 허용 정책 추가
CREATE POLICY "Allow public read access on quick_links" ON public.quick_links
FOR SELECT USING (true);

-- 3) 기존 RPC 함수 제거 (오버로딩 충돌 방지)
DROP FUNCTION IF EXISTS public.rpc_insert_quick_link(text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.rpc_update_quick_link(text, text, bigint, text, text);
DROP FUNCTION IF EXISTS public.rpc_delete_quick_link(text, text, bigint);
DROP FUNCTION IF EXISTS public.rpc_swap_quick_links_order(text, text, bigint, integer, bigint, integer);

-- 4) RPC 보안 함수 생성

-- ① 빠른 링크 추가 RPC
CREATE OR REPLACE FUNCTION public.rpc_insert_quick_link(
    p_admin_id text,
    p_admin_password_hash text,
    p_title text,
    p_url text,
    p_sort_order integer
)
RETURNS TABLE (id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id bigint;
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    INSERT INTO public.quick_links (title, url, sort_order)
    VALUES (p_title, p_url, p_sort_order)
    RETURNING public.quick_links.id INTO v_new_id;

    RETURN QUERY SELECT v_new_id;
END;
$$;

-- ② 빠른 링크 수정 RPC
CREATE OR REPLACE FUNCTION public.rpc_update_quick_link(
    p_admin_id text,
    p_admin_password_hash text,
    p_link_id bigint,
    p_title text,
    p_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    UPDATE public.quick_links
    SET title = p_title, url = p_url
    WHERE id = p_link_id;
END;
$$;

-- ③ 빠른 링크 삭제 RPC
CREATE OR REPLACE FUNCTION public.rpc_delete_quick_link(
    p_admin_id text,
    p_admin_password_hash text,
    p_link_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    DELETE FROM public.quick_links
    WHERE id = p_link_id;
END;
$$;

-- ④ 빠른 링크 정렬 순서 스왑 RPC
CREATE OR REPLACE FUNCTION public.rpc_swap_quick_links_order(
    p_admin_id text,
    p_admin_password_hash text,
    p_link1_id bigint,
    p_link1_order integer,
    p_link2_id bigint,
    p_link2_order integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 어드민 자격 검증
    IF NOT EXISTS (
        SELECT 1 FROM public.members 
        WHERE id = p_admin_id AND password = p_admin_password_hash AND role IN ('admin', 'super_admin')
    ) THEN
        RAISE EXCEPTION '권한 거부: 운영진 권한 인증에 실패했습니다.';
    END IF;

    UPDATE public.quick_links SET sort_order = p_link1_order WHERE id = p_link1_id;
    UPDATE public.quick_links SET sort_order = p_link2_order WHERE id = p_link2_id;
END;
$$;

