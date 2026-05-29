# Sogang GSM Connect (서강대 가상융합전문대학원 멤버 디렉토리)

본 프로젝트는 서강대학교 가상융합전문대학원(Graduate School of Metaverse, GSM) 구성원들의 주요 관심 분야, 연구 과제, 프로젝트 포트폴리오를 탐색하고 서로 소통(개인 방명록 및 추천서)할 수 있도록 설계된 링크드인 스타일의 반응형 웹 멤버 디렉토리입니다.

---

## 1. 주요 제공 기능

*   **대용량 탐색 최적화**: 30명 이상의 다인원도 피로감 없이 탐색하도록 **카드 그리드 뷰**와 **가로형 목록 리스트 뷰** 스위칭을 지원하며, 선택한 뷰 설정은 로컬 브라우저에 자동 보존(캐싱)됩니다.
*   **실시간 통합 검색**: 이름, 소속 전공, 기수(Generation), 태그, 자기소개(`bio`), 자유 서술 내용(`customContent`) 키워드까지 전체 실시간 실시간 검색이 지원됩니다.
*   **프로필 편집 & 사진 업로드**: 자신의 계정으로 로그인한 구성원은 이름, 전공, 기수, 한 줄 헤드라인 및 자유 기재 영역과 프로필 사진을 직접 수정하고 업로드할 수 있습니다.
*   **개인 방명록 (공개/비공개)**: 상세 모달 하단에 멤버별 개인 방명록 폼이 탑재되어 있으며, `비공개` 작성 시 카드 소유자, 작성자 본인, 그리고 관리자(admin)만 읽을 수 있도록 자물쇠 마스킹(`🔒`) 보안 필터링을 지원합니다.

---

## 2. 로컬 실행 방법

본 프로젝트는 순수 정적 웹 에셋(HTML/CSS/JS)으로 구성되어 있습니다. 로컬 보안 정책(CORS)으로 인해 브라우저에서 `index.html` 파일을 더블클릭하여 열면 JS 모듈이 작동하지 않으므로, 아래와 같이 로컬 웹 서버를 구동해 실행해야 합니다.

1. 프로젝트 폴더 경로에서 터미널(PowerShell 또는 CMD)을 엽니다.
2. 아래의 Python 명령어를 실행하여 웹 서버를 켭니다:
   ```bash
   python -m http.server 8080
   ```
3. 웹 브라우저를 열고 `http://localhost:8080`에 접속합니다.

---

## 3. GitHub Pages 무료 배포 방법

본 프로젝트는 백엔드 없이도 동작하도록 설계되었기 때문에 GitHub Pages에 무료 호스팅을 통해 즉시 공개할 수 있습니다.

1. GitHub에 로그인한 후 새로운 **Public Repository**를 만듭니다.
2. 이 프로젝트 폴더 안의 모든 파일(index.html, styles.css, app.js, data.js 등)을 해당 저장소에 업로드(Push)합니다.
3. GitHub 저장소 페이지의 우측 상단 **[Settings]** -> 좌측 메뉴 **[Pages]**로 이동합니다.
4. **Build and deployment** 항목의 Branch를 `main` (또는 `master`)으로 선택하고 `/ (root)` 폴더를 지정한 뒤 **[Save]**를 누릅니다.
5. 약 1~2분 뒤 상단에 생성되는 Public URL(예: `https://username.github.io/repository-name/`)로 전 세계 누구나 접속할 수 있습니다.

---

## 4. Supabase 무료 클라우드 백엔드 연동 & 이관 가이드 (5분 완성)

기본 상태로 배포하면 로컬 브라우저 저장소(`LocalStorage`)를 사용하므로 다른 사용자가 남긴 프로필 사진이나 방명록을 서로 공유할 수 없습니다. 
모든 사용자가 데이터를 실시간으로 완벽하게 공유하고 사진을 정상적으로 올릴 수 있도록, **평생 무료**로 제공되는 클라우드 백엔드 Supabase를 연결하는 방법입니다. 

다음 관리자에게 소유권을 넘겨주거나 이관할 때도 아래의 가이드대로 5분만 설정해 주면 독립적인 백엔드로 이사가 가능합니다.

### 1단계: Supabase 프로젝트 생성
1. [Supabase 공식 홈페이지(supabase.com)](https://supabase.com)에 접속하여 회원가입(무료) 및 로그인을 진행합니다.
2. **[New Project]** 단추를 누르고 프로젝트 이름, 데이터베이스 패스워드를 지정한 뒤 지역을 `Seoul (ap-northeast-2)`로 선택하여 프로젝트를 개설합니다. (생성 완료까지 약 1~2분 소요)

### 2단계: 데이터베이스 테이블 생성
1. 생성된 Supabase 대시보드 좌측 메뉴에서 **[SQL Editor]**를 클릭합니다.
2. **[Create a new query]**를 클릭하여 빈 쿼리창을 엽니다.
3. 아래의 **[Supabase 테이블 및 스토리지 생성 SQL 스크립트]**를 펼쳐서 전체 복사한 뒤 쿼리창에 붙여넣고, 우측 하단의 **[Run]** 버튼을 클릭하여 실행합니다.

   <details>
   <summary><b>🔥 Supabase 테이블 및 스토리지 생성 SQL 스크립트 (클릭하여 펼치기)</b></summary>

   ```sql
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
       replied_by text,
       status text DEFAULT 'pending',
       created_at timestamp with time zone DEFAULT now()
   );
   ALTER TABLE public.inquiries DISABLE ROW LEVEL SECURITY;
   ```
   </details>
   
   * *결과창에 `Success. No rows returned`가 나타나면 멤버 테이블, 방명록 테이블 및 스토리지 접근 정책 생성이 완료된 것입니다.*

### 3단계: 프로필 사진용 스토리지 버킷 생성
1. Supabase 대시보드 좌측 메뉴에서 **[Storage]**를 클릭합니다.
2. **[New bucket]** 단추를 클릭합니다.
3. 버킷 이름에 정확히 **`avatars`**를 입력하고, 아래의 **`Public bucket`** 토글 스위치를 **ON(활성화)**으로 설정한 뒤 **[Save]**를 클릭해 버킷을 생성합니다.
   * *주의: 버킷 이름은 반드시 소문자 `avatars`여야 하며, public이어야 아바타 사진 주소를 누구나 읽을 수 있습니다.*

### 4단계: 소스 코드에 API Key 연결
1. Supabase 대시보드 좌측 메뉴 하단의 **[Project Settings]** -> **[API]** 메뉴로 이동합니다.
2. **Project API keys** 영역에서:
   * `Project URL` 주소를 복사합니다.
   * `anon` `public` API Key 값을 복사합니다.
3. 본 프로젝트의 **[app.js](file:///e:/Works/_Dev/MemberCard/app.js)** 파일을 엽니다.
4. 상단 `// ==================== Supabase 클라우드 설정 ====================` 바로 아래에 있는 두 변수에 복사한 값을 붙여넣고 저장합니다:
   ```javascript
   const SUPABASE_URL = "복사한_Project_URL_붙여넣기";
   const SUPABASE_KEY = "복사한_anon_public_Key_붙여넣기";
   ```
5. 이제 사이트를 새로고침하면 자동으로 Supabase 데이터베이스와 연동이 완료됩니다.
   * *이후부터는 사진 등록, 프로필 변경, 방명록 추가가 전 세계 모든 접속자 브라우저에 실시간 동기화되어 즉각 공유됩니다.*
