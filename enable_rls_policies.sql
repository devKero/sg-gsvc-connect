-- ==========================================
-- 서강대 GSVC Connect - Supabase RLS 및 Policy 활성화 스크립트
-- ==========================================
-- 이 스크립트는 프로젝트에 Supabase Auth가 도입되거나 Custom JWT 검증이 
-- 연동된 이후, Supabase 콘솔 SQL Editor에서 실행하는 용도입니다.
-- (실행 전, 데이터 정합성 검증을 완료한 후 적용할 것을 권장합니다.)

-- ------------------------------------------
-- 1. members (원우 정보) 테이블 RLS 설정
-- ------------------------------------------
-- RLS 활성화
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 정책 A: 누구나 모든 회원 정보를 읽을 수 있음 (디렉토리 조회용)
CREATE POLICY "모든 구성원 정보 조회 허용" 
ON public.members 
FOR SELECT 
USING (true);

-- 정책 B: 사용자는 오직 본인의 정보만 수정(업데이트)할 수 있음
CREATE POLICY "본인 정보 수정 허용" 
ON public.members 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 정책 C: 관리자(admin/super_admin)는 모든 회원의 추가, 수정, 삭제(휴지통) 제어가 가능함
CREATE POLICY "운영진 회원 관리 제어 허용" 
ON public.members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
  )
);


-- ------------------------------------------
-- 2. messages (1:1 쪽지함) 테이블 RLS 설정
-- ------------------------------------------
-- RLS 활성화
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 정책 A: 사용자는 본인이 발송하거나 수신한 쪽지만 조회할 수 있음
CREATE POLICY "본인 송수신 쪽지만 조회 허용" 
ON public.messages 
FOR SELECT 
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- 정책 B: 사용자는 본인 명의로만 쪽지를 발송(생성)할 수 있음
CREATE POLICY "본인 명의 쪽지 발송 허용" 
ON public.messages 
FOR INSERT 
WITH CHECK (sender_id = auth.uid());

-- 정책 C: 수신인은 받은 쪽지에 대해 읽음 상태(is_read)를 업데이트할 수 있음
CREATE POLICY "수신인 쪽지 읽음 처리 허용" 
ON public.messages 
FOR UPDATE 
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- 정책 D: 발신인은 자신이 보낸 쪽지에 대해 삭제 흔적 남기기(UPDATE) 또는 나간 시점 업데이트를 할 수 있음
CREATE POLICY "발신인 쪽지 수정 허용" 
ON public.messages 
FOR UPDATE 
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());


-- ------------------------------------------
-- 3. inquiries (건의 및 문의사항) 테이블 RLS 설정
-- ------------------------------------------
-- RLS 활성화
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 정책 A: 일반 회원은 본인이 작성한 건의사항만 조회할 수 있음
CREATE POLICY "본인 문의사항 조회 허용" 
ON public.inquiries 
FOR SELECT 
USING (student_id = (SELECT student_id FROM public.members WHERE id = auth.uid()));

-- 정책 B: 일반 회원은 본인 학번으로 문의사항을 등록(생성)할 수 있음
CREATE POLICY "본인 문의사항 등록 허용" 
ON public.inquiries 
FOR INSERT 
WITH CHECK (student_id = (SELECT student_id FROM public.members WHERE id = auth.uid()));

-- 정책 C: 운영진은 모든 문의사항의 조회 및 답변 업데이트(UPDATE)가 가능함
CREATE POLICY "운영진 모든 문의사항 관리 허용" 
ON public.inquiries 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.members 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
  )
);
