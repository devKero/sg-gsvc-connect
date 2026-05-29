import { INITIAL_MEMBERS, INITIAL_GUESTBOOK } from './data.js';

// ==================== Supabase 클라우드 설정 ====================
// 무료 클라우드 데이터베이스 및 스토리지 연동 정보입니다.
// 이 프로젝트 폴더를 타인에게 인수인계하거나 본인의 독립 서버로 바꿀 때,
// 아래의 두 값만 자신의 Supabase 정보로 교체하면 5초 만에 독립 구동됩니다.
const SUPABASE_URL = "https://owpvkzjbqrpklaplmeud.supabase.co"; // 예: "https://xyz.supabase.co"
const SUPABASE_KEY = "sb_publishable_k0rvpmep0dFnUPFgTqn5Rw_trad9qNz";                      // Supabase의 anon key 기입
let supabaseClient = null;

if (SUPABASE_URL && !SUPABASE_URL.includes("your-project-id") && typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ==================== 상태 관리 (State) ====================
let state = {
  theme: 'light',          // 다크모드 테마 상태
  members: [],
  guestbook: [],
  currentUser: null,       // { id, name, classYear, isGuest, generation }
  selectedMemberId: null,  // 모달에 열린 멤버 ID
  selectedInquiryId: null, // 모달에 열린 문의 ID
  searchTerm: '',          // 검색어
  adminSearchTerm: '',     // 운영 대시보드 검색어
  adminSelectedGeneration: '', // 운영 대시보드 기수 필터
  adminSelectedRole: '',       // 운영 대시보드 권한 필터
  excelParsedData: [],         // 엑셀 파싱 원본 데이터
  excelConflictsCount: 0,      // 엑셀 내 중복 학번 총합
  excelConflictsResolvedCount: 0, // 해결된 중복 학번 수
  selectedTag: '',         // 선택된 해시태그 필터
  selectedGeneration: '',  // 선택된 기수 필터 ("" 이면 전체 기수)
  selectedMajor: '',       // 선택된 전공 필터 ("" 이면 전체 전공)
  selectedDegree: '',      // 선택된 학위 과정 필터 ("" 이면 전체 과정)
  viewMode: 'grid',        // 'grid' 또는 'list' (대용량 뷰 모드)
  activeMainTab: 'directory', // 'directory' 또는 'feed' (메인 대시보드 탭)
  isAdmin: false,          // 운영진 권한 여부
  isSuperAdmin: false,     // 최고 운영진 권한 여부
  editSnsLinks: [],        // 수정한 소셜 링크 임시 보관
  addSnsLinks: [],          // 추가할 소셜 링크 임시 보관
  tagSearchTerm: '',         // 키워드 자체 검색어
  editCroppedBlob: null,    // 크롭된 에디트 아바타 블롭 임시 보관
  addCroppedBlob: null,      // 크롭된 추가 아바타 블롭 임시 보관
  notifications: [],        // 내 프로필에 달린 알림 목록
  unreadNotifCount: 0,      // 미확인 알림 수
  inquiries: [],           // 문의/건의 데이터
  messages: [],            // 쪽지함 데이터
  quickLinks: [],           // 퀵링크 데이터
  dmUnreadCount: 0,        // 안 읽은 쪽지 개수
  dmActiveSubTab: 'received', // 쪽지함 하위 탭 ('received', 'sent')
  activeDmOpponentId: "",      // 활성화된 1:1 대화방 상대 ID
  leftChats: {},               // 대화방 나간 시점 기록 { opponentId: leftAtIsoString }
  membersLimit: 12,            // 무한 스크롤 한 번에 노출될 회원 카드 개수
  adminActiveTab: 'members', // 어드민 하위 탭 ('members', 'inquiries', 'quick_links')
  adminInquirySubTab: 'active', // 어드민 문의 하위 탭 ('active', 'trash')
  adminMemberSubTab: 'active',  // 어드민 회원 하위 탭 ('active', 'trash')
  editingLinkId: null,          // 수정중인 퀵링크 ID
  dmPollingInterval: null,      // DM 폴링 타이머
  alertedMessageIds: null       // 이미 확인/알림 띄운 쪽지 ID 목록
};

const AVATAR_COLORS = [
  "#B60005", // 서강 스칼렛 크림슨
  "#1d2d44", // 딥 네이비
  "#C5A059", // 서강 골드
  "#2a9d8f", // 틸 그린
  "#7209b7", // 로얄 퍼플
  "#f72585", // 로즈 핑크
  "#4361ee"  // 콘플라워 블루
];

// 무작위 아바타 색상 추출
function getRandomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

const GEN_COLORS = [
  "#B60005", // 서강 크림슨
  "#1d2d44", // 딥 네이비
  "#A8853D", // 서강 골드
  "#2a9d8f", // 틸 그린
  "#7209b7", // 퍼플
  "#f72585", // 로즈 핑크
  "#4361ee", // 블루
  "#f77f00", // 오렌지
  "#00f5d4"  // 민트
];

// 기수별 수동 색상 지정 매핑 객체 (필요 시 특정 기수의 고유 색상 고정 가능)
const CUSTOM_GEN_COLORS = {
  "9": "#B60005",   // 9기: 서강 크림슨
  "10": "#A8853D",  // 10기: 서강 골드
  "11": "#1d2d44"   // 11기: 딥 네이비
};

function getGenerationColor(generation) {
  if (!generation) return "#a0aec0"; // Default gray
  
  // 로그인한 사용자가 있고, 게스트가 아니며, 사용자 기수가 존재하는 경우
  if (state.currentUser && !state.currentUser.isGuest && state.currentUser.generation) {
    if (parseInt(generation) === parseInt(state.currentUser.generation)) {
      return "#B60005"; // 우리 기수는 서강 스칼렛 크림슨 (빨간색)
    }
  }
  
  // 다른 기수 또는 게스트/로그아웃 상태는 회색
  return "#a0aec0";
}

const EMAIL_CONFIG = { label: '이메일', icon: 'fa-solid fa-envelope', colorClass: 'email-color' };

const SNS_TYPES = {
  github: { label: 'GitHub', icon: 'fa-brands fa-github', colorClass: 'github-color' },
  blog: { label: '기술 블로그', icon: 'fa-solid fa-square-rss', colorClass: 'blog-color' },
  linkedin: { label: 'LinkedIn', icon: 'fa-brands fa-linkedin', colorClass: 'linkedin-color' },
  website: { label: '웹사이트/포트폴리오', icon: 'fa-solid fa-globe', colorClass: 'website-color' },
  notion: { label: 'Notion', icon: 'fa-solid fa-book-open', colorClass: 'notion-color' },
  youtube: { label: 'YouTube', icon: 'fa-brands fa-youtube', colorClass: 'youtube-color' },
  other: { label: '기타 링크', icon: 'fa-solid fa-link', colorClass: 'other-color' }
};

function getSnsLinksCardHtml(snsLinks) {
  let html = '';
  if (snsLinks && Array.isArray(snsLinks)) {
    snsLinks.forEach(link => {
      if (!link.value || link.type === 'email') return;
      const config = SNS_TYPES[link.type] || SNS_TYPES.other;
      let url = link.value;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      html += `<a href="${escapeHtml(url)}" target="_blank" class="contact-icon ${config.colorClass}" title="${config.label} 방문"><i class="${config.icon}"></i></a>`;
    });
  }
  return html;
}

function validateEmail(email) {
  if (!email || email.trim() === "") {
    return true; // 빈 값 허용 (선택 사항)
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    alert("올바른 이메일 주소 형식을 입력해 주세요.");
    return false;
  }
  return true;
}

function validateSnsLinks(links) {
  for (const link of links) {
    if (!link.value.trim() || link.type === 'email') continue;
    const val = link.value.trim();
    if (val.includes(' ') || !val.includes('.')) {
      alert(`올바른 웹사이트 URL 주소를 입력해 주세요: ${val}`);
      return false;
    }
  }
  return true;
}

function renderSnsLinksInputArea(containerId, links) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const isEdit = containerId === 'editSnsLinksContainer';
  const addBtnId = isEdit ? 'btnAddEditSnsLink' : 'btnAddAddSnsLink';
  const addBtn = document.getElementById(addBtnId);

  if (!Array.isArray(links)) {
    links = [];
  }

  links.forEach((link, index) => {
    const row = document.createElement('div');
    row.className = 'sns-link-row';
    row.style.marginBottom = '0.5rem';

    let selectOptions = '';
    for (const [type, config] of Object.entries(SNS_TYPES)) {
      const selected = link.type === type ? 'selected' : '';
      selectOptions += `<option value="${type}" ${selected}>${config.label}</option>`;
    }

    row.innerHTML = `
      <select class="form-select select-sns-type admin-filter-select" data-index="${index}" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--color-border); cursor: pointer;">
        ${selectOptions}
      </select>
      <input type="text" class="form-control input-sns-value" data-index="${index}" value="${escapeHtml(link.value || '')}" placeholder="주소 또는 이메일을 입력하세요" style="padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid var(--color-border);">
      <button type="button" class="btn-delete-sns" data-index="${index}" title="삭제">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `;

    row.querySelector('.select-sns-type').addEventListener('change', (e) => {
      links[index].type = e.target.value;
    });

    row.querySelector('.input-sns-value').addEventListener('input', (e) => {
      links[index].value = e.target.value.trim();
    });

    row.querySelector('.btn-delete-sns').addEventListener('click', () => {
      links.splice(index, 1);
      renderSnsLinksInputArea(containerId, links);
    });

    container.appendChild(row);
  });

  if (addBtn) {
    addBtn.disabled = false;
    addBtn.classList.remove('disabled');
    addBtn.title = "";
  }
}

// ==================== 테마 관리 (다크모드) ====================
function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('sogang_unity_theme');
  } catch (e) {
    console.warn("localStorage 읽기 실패:", e);
  }
  
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    state.theme = savedTheme;
  } else {
    state.theme = systemPrefersDark ? 'dark' : 'light';
  }
  
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeSwitchUI();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  try {
    localStorage.setItem('sogang_unity_theme', state.theme);
  } catch (e) {
    console.warn("localStorage 저장 실패:", e);
  }
  updateThemeSwitchUI();
}

function updateThemeSwitchUI() {
  const checkbox = document.getElementById('themeToggleCheckbox');
  if (checkbox) {
    checkbox.checked = (state.theme === 'dark');
  }
}

// ==================== 앱 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initLocalStorage();
  await syncWithSupabase();
  setupEventListeners();
  checkSession();
});

// 로컬 스토리지 데이터 로드 및 초기화
function initLocalStorage() {
  // 캐시 강제 갱신 버전 관리 (김서강, 이알바 등 구버전 테스트 데이터를 완전히 밀어버립니다)
  const CACHE_VERSION = "v20260527_v2";
  const storedVer = localStorage.getItem('sogang_unity_cache_ver');
  if (storedVer !== CACHE_VERSION) {
    localStorage.removeItem('sogang_unity_members');
    localStorage.removeItem('sogang_unity_guestbook');
    localStorage.removeItem('sogang_unity_inquiries');
    localStorage.setItem('sogang_unity_cache_ver', CACHE_VERSION);
  }

  let storedMembers = localStorage.getItem('sogang_unity_members');
  let resetNeeded = false;

  if (storedMembers) {
    try {
      const parsed = JSON.parse(storedMembers);
      // 구버전 캐시 감지 (tags가 없거나, 구버전 ID가 존재하는 경우, 또는 신규 학적/권한 컬럼이 없는 경우)
      if (parsed.some(m => !m.tags || m.id.startsWith('sogang_member_') || m.classYear === undefined || !m.degreeProcess || m.education === undefined || m.role === undefined)) {
        resetNeeded = true;
      }
    } catch (e) {
      resetNeeded = true;
    }
  }

  if (resetNeeded) {
    localStorage.removeItem('sogang_unity_members');
    localStorage.removeItem('sogang_unity_guestbook');
    storedMembers = null;
  }

  if (storedMembers) {
    state.members = JSON.parse(storedMembers);
    
    // 로컬 스토리지에 로드된 구버전 데이터 자동 마이그레이션 (이메일 고정 필드 환원)
    let migrationHappened = false;
    state.members.forEach(m => {
      if (m.email === undefined) {
        if (m.snsLinks && Array.isArray(m.snsLinks)) {
          const emailIdx = m.snsLinks.findIndex(link => link.type === 'email');
          if (emailIdx !== -1) {
            m.email = m.snsLinks[emailIdx].value || "";
            m.snsLinks.splice(emailIdx, 1);
          } else {
            m.email = "";
          }
        } else {
          m.email = "";
        }
        migrationHappened = true;
      }
    });

    // 캐시 복구 로직: 신규 추가된 기본 계정(admin 등)이 캐시에 없다면 자동으로 추가합니다.
    let updated = false;
    INITIAL_MEMBERS.forEach(initialMember => {
      let initEmail = initialMember.email || "";
      let initSnsLinks = initialMember.snsLinks ? JSON.parse(JSON.stringify(initialMember.snsLinks)) : [];
      const emailIdx = initSnsLinks.findIndex(link => link.type === 'email');
      if (emailIdx !== -1) {
        if (!initEmail) initEmail = initSnsLinks[emailIdx].value || "";
        initSnsLinks.splice(emailIdx, 1);
      }

      const matchedIdx = state.members.findIndex(m => m.id === initialMember.id);
      if (matchedIdx === -1) {
        const clonedInit = JSON.parse(JSON.stringify(initialMember));
        clonedInit.email = initEmail;
        clonedInit.snsLinks = initSnsLinks;
        state.members.push(clonedInit);
        updated = true;
      } else {
        const currentMember = state.members[matchedIdx];
        if (initialMember.generation && currentMember.generation !== initialMember.generation) {
          currentMember.generation = initialMember.generation;
          updated = true;
        }
        if (initialMember.role && currentMember.role !== initialMember.role) {
          currentMember.role = initialMember.role;
          updated = true;
        }
        if (initEmail && currentMember.email !== initEmail) {
          currentMember.email = initEmail;
          updated = true;
        }
        if (initSnsLinks && (!currentMember.snsLinks || JSON.stringify(currentMember.snsLinks) !== JSON.stringify(initSnsLinks))) {
          currentMember.snsLinks = initSnsLinks;
          updated = true;
        }
      }
    });

    if (updated || migrationHappened) {
      localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
    }
  } else {
    state.members = INITIAL_MEMBERS.map(initialMember => {
      const clonedInit = JSON.parse(JSON.stringify(initialMember));
      let initEmail = clonedInit.email || "";
      let initSnsLinks = clonedInit.snsLinks ? clonedInit.snsLinks : [];
      const emailIdx = initSnsLinks.findIndex(link => link.type === 'email');
      if (emailIdx !== -1) {
        if (!initEmail) initEmail = initSnsLinks[emailIdx].value || "";
        initSnsLinks.splice(emailIdx, 1);
      }
      clonedInit.email = initEmail;
      clonedInit.snsLinks = initSnsLinks;
      return clonedInit;
    });
    localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
  }

  // 방명록 로드
  const storedGuestbook = localStorage.getItem('sogang_unity_guestbook');
  if (storedGuestbook) {
    state.guestbook = JSON.parse(storedGuestbook);
  } else {
    state.guestbook = [...INITIAL_GUESTBOOK];
    localStorage.setItem('sogang_unity_guestbook', JSON.stringify(state.guestbook));
  }

  // 문의사항 로드
  const storedInquiries = localStorage.getItem('sogang_unity_inquiries');
  if (storedInquiries) {
    state.inquiries = JSON.parse(storedInquiries);
  } else {
    state.inquiries = [];
  }

  // 전공 목록 로드 제거됨

  // 뷰모드 캐시 로드
  const storedViewMode = localStorage.getItem('sogang_unity_viewmode');
  if (storedViewMode) {
    state.viewMode = storedViewMode;
  }
}

// Supabase 클라우드 데이터베이스와 양방향 동기화
async function syncWithSupabase() {
  if (!supabaseClient) {
    console.log("Supabase 설정이 비어있어 로컬 모드로 작동합니다. (README.md 가이드를 참조하여 연동해 보세요)");
    return;
  }

  try {
    // 1. members 테이블 데이터 조회
    const { data: dbMembers, error: mError } = await supabaseClient
      .from('members')
      .select('*')
      .order('created_at', { ascending: true });

    if (mError) throw mError;

    // 2. guestbook 테이블 데이터 조회
    const { data: dbGuestbook, error: gError } = await supabaseClient
      .from('guestbook')
      .select('*')
      .order('created_at', { ascending: true });

    if (gError) throw gError;

    // 3. inquiries 테이블 데이터 조회 (방어막 장착)
    let dbInquiries = [];
    try {
      const { data, error } = await supabaseClient
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      dbInquiries = data || [];
    } catch (err) {
      console.warn("inquiries 테이블 로드 실패 (아직 생성되지 않았거나 마이그레이션 전 단계일 수 있습니다):", err);
    }

    // 3. majors 테이블 데이터 조회 제거됨

    // 만약 클라우드에 멤버 데이터가 아예 없거나 admin만 있다면, 초기 멤버 35인을 클라우드에 벌크 인서트(시드 데이터 주입)
    // 클라우드 데이터로 로컬 메모리 상태 갱신 및 로컬 스토리지 백업 동기화
    state.members = dbMembers.map(m => {
      let snsLinks = [];
      let email = m.email || "";
      if (m.sns_links) {
        snsLinks = typeof m.sns_links === 'string' ? JSON.parse(m.sns_links) : m.sns_links;
        const emailIdx = snsLinks.findIndex(link => link.type === 'email');
        if (emailIdx !== -1) {
          if (!email) email = snsLinks[emailIdx].value || "";
          snsLinks.splice(emailIdx, 1);
        }
      } else {
        if (m.email) email = m.email;
        if (m.github) snsLinks.push({ type: "github", value: m.github });
        if (m.blog) snsLinks.push({ type: "blog", value: m.blog });
      }
      return {
        id: m.id,
        studentId: m.student_id,
        phoneLast4: m.phone_last4,
        name: m.name,
        email: email,
        classYear: m.class_year,
        generation: m.generation,
        headline: m.headline,
        avatarColor: m.avatar_color,
        snsLinks: snsLinks,
        tags: m.tags || [],
        bio: m.bio,
        projects: m.projects,
        customContent: m.custom_content,
        avatarImage: m.avatar_image,
        degreeProcess: m.degree_process || "석사",
        academicStatus: m.academic_status || "재학",
        education: m.education || "",
        experience: m.experience || "",
        role: m.role || "member",
        deletedAt: m.deleted_at
      };
    });
    localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

    state.guestbook = dbGuestbook.map(g => ({
      id: g.id,
      targetMemberId: g.target_member_id,
      author: g.author,
      message: g.message,
      tag: g.tag,
      isPrivate: g.is_private,
      timestamp: g.timestamp,
      likes: g.likes || 0
    }));
    localStorage.setItem('sogang_unity_guestbook', JSON.stringify(state.guestbook));

    // 문의사항 데이터 갱신
    state.inquiries = dbInquiries.map(i => ({
      id: i.id,
      studentId: i.student_id,
      author: i.author,
      title: i.title || "",
      message: i.message,
      reply: i.reply || "",
      repliedBy: i.replied_by || "", // 답변한 운영진 기록 필드 연동
      status: i.status || "pending",
      createdAt: i.created_at,
      deletedAt: i.deleted_at
    }));
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));

    // 4. quick_links 테이블 데이터 조회
    let dbQuickLinks = [];
    try {
      const { data, error } = await supabaseClient
        .from('quick_links')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      dbQuickLinks = data || [];
    } catch (err) {
      console.warn("quick_links 테이블 로드 실패:", err);
      const cached = localStorage.getItem('sogang_unity_quicklinks');
      if (cached) dbQuickLinks = JSON.parse(cached);
    }
    state.quickLinks = dbQuickLinks;
    localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));

    console.log("Supabase 클라우드 데이터베이스와 양방향 동기화 완료.");
  } catch (err) {
    console.error("Supabase 데이터 연동 실패 (로컬 스토리지 오프라인 모드 유지):", err);
    const cachedLinks = localStorage.getItem('sogang_unity_quicklinks');
    if (cachedLinks) {
      state.quickLinks = JSON.parse(cachedLinks);
    } else {
      state.quickLinks = [
        { id: 1, title: '서강대학교', url: 'https://www.sogang.ac.kr', sort_order: 1 },
        { id: 2, title: '세인트 (SAINT)', url: 'https://saint.sogang.ac.kr', sort_order: 2 },
        { id: 3, title: '메타버스전문대학원', url: 'https://gsmeta.sogang.ac.kr', sort_order: 3 }
      ];
      localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
    }
  }

  // 로컬 스토리지 모드 전용 기본 퀵링크 셋업
  if (!supabaseClient) {
    const cachedLinks = localStorage.getItem('sogang_unity_quicklinks');
    if (cachedLinks) {
      state.quickLinks = JSON.parse(cachedLinks);
    } else {
      state.quickLinks = [
        { id: 1, title: '서강대학교', url: 'https://www.sogang.ac.kr', sort_order: 1 },
        { id: 2, title: '세인트 (SAINT)', url: 'https://saint.sogang.ac.kr', sort_order: 2 },
        { id: 3, title: '메타버스전문대학원', url: 'https://gsmeta.sogang.ac.kr', sort_order: 3 }
      ];
      localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
    }
  }

  // 퀵링크 렌더링
  renderQuickLinks();

  // 쪽지 안 읽은 수 알림 갱신
  updateDmUnreadCount();
  
  // 알림 갱신
  updateNotifications();
}

// 휴지통 자동 영구 삭제 처리 (30일 보관 기한 경과 항목 - 어드민 로그인 시 실행)
async function autoPurgeTrash() {
  if (!supabaseClient || !state.isAdmin) return; // 어드민 권한 및 클라우드 연동 상태에서만 자동 삭제 실행

  const purgeCutoff = new Date();
  purgeCutoff.setDate(purgeCutoff.getDate() - 30);

  // 1. 회원 정보 삭제
  const deletedMembersToPurge = state.members.filter(m => {
    if (m.role !== 'deleted') return false;
    const deletedTime = m.deletedAt ? new Date(m.deletedAt) : (m.createdAt ? new Date(m.createdAt) : null);
    return deletedTime && deletedTime < purgeCutoff;
  });

  let membersChanged = false;
  for (const m of deletedMembersToPurge) {
    console.log(`[Auto-Purge] 멤버 영구 삭제 진행: ${m.name} (${m.id})`);
    try {
      const { error } = await supabaseClient.from('members').delete().eq('id', m.id);
      if (!error) {
        state.members = state.members.filter(mem => mem.id !== m.id);
        membersChanged = true;
      }
    } catch (err) {
      console.error(`[Auto-Purge] 멤버 ${m.id} 삭제 실패:`, err);
    }
  }

  if (membersChanged) {
    localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
    renderFilterSelectorsOptions();
    renderMembersGrid();
    renderFilterTags();
    if (state.isAdmin) renderAdminDashboard();
  }

  // 2. 문의사항 삭제
  const deletedInqsToPurge = state.inquiries.filter(i => {
    if (i.status !== 'deleted') return false;
    const deletedTime = i.deletedAt ? new Date(i.deletedAt) : (i.createdAt ? new Date(i.createdAt) : null);
    return deletedTime && deletedTime < purgeCutoff;
  });

  let inquiriesChanged = false;
  for (const inq of deletedInqsToPurge) {
    console.log(`[Auto-Purge] 문의사항 영구 삭제 진행: ${inq.title} (${inq.id})`);
    try {
      const { error } = await supabaseClient.from('inquiries').delete().eq('id', inq.id);
      if (!error) {
        state.inquiries = state.inquiries.filter(i => i.id !== inq.id);
        inquiriesChanged = true;
      }
    } catch (err) {
      console.error(`[Auto-Purge] 문의사항 ${inq.id} 삭제 실패:`, err);
    }
  }

  if (inquiriesChanged) {
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));
    if (state.isAdmin) renderAdminInquiries();
  }

  // 3. 90일 경과한 쪽지(DM) 삭제
  const dmCutoff = new Date();
  dmCutoff.setDate(dmCutoff.getDate() - 90);

  try {
    const { error: dmError } = await supabaseClient
      .from('messages')
      .delete()
      .lt('created_at', dmCutoff.toISOString());
    if (dmError) throw dmError;
    console.log(`[Auto-Purge] 90일 경과한 오래된 쪽지 삭제 정리 완료 (기준일: ${dmCutoff.toISOString().substring(0, 10)})`);
  } catch (err) {
    console.error("[Auto-Purge] 오래된 쪽지 정리 실패:", err);
  }

  // 로컬 캐시도 90일 지난 것 정리
  const localCachedMsgs = localStorage.getItem('sogang_unity_messages');
  if (localCachedMsgs) {
    try {
      const msgs = JSON.parse(localCachedMsgs);
      const filteredMsgs = msgs.filter(m => {
        const msgTime = new Date(m.createdAt || m.created_at);
        return msgTime >= dmCutoff;
      });
      if (filteredMsgs.length !== msgs.length) {
        localStorage.setItem('sogang_unity_messages', JSON.stringify(filteredMsgs));
        state.messages = filteredMsgs;
        console.log(`[Auto-Purge] 로컬 캐시에서 오래된 쪽지 ${msgs.length - filteredMsgs.length}개 삭제 정리 완료`);
      }
    } catch (e) {
      console.error("[Auto-Purge] 로컬 캐시 쪽지 정리 중 에러:", e);
    }
  }
}

// 이미지 업로드 비동기 핸들러 (스토리지 및 오프라인 Base64 분기)
async function uploadAvatarImage(memberId, file) {
  const isSupabaseActive = supabaseClient !== null;
  
  // 오프라인 모드일 때만 150KB 제한을 엄격하게 적용
  if (!isSupabaseActive && file.size > 150 * 1024) {
    alert("로컬 오프라인 모드에서는 브라우저 캐시 한계로 인해 150KB 이하의 이미지만 업로드할 수 있습니다.\n(README.md 가이드를 따라 Supabase를 연동하시면 고화질 이미지 제한이 해제됩니다)");
    return null;
  }

  if (isSupabaseActive) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberId}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Supabase Storage 'avatars' 버킷에 업로드
      const { data, error } = await supabaseClient.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      // Public URL 주소 수집
      const { data: { publicUrl } } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Storage 업로드 실패:", err);
      alert("이미지 업로드에 실패했습니다. Supabase Storage 정책 및 버킷 생성을 확인하세요.");
      return null;
    }
  } else {
    // 오프라인 fallback: Base64 인코딩
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }
}



let cropperInstance = null;
let currentCropCallback = null;

function handleImageFileSelected(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const cropModal = document.getElementById('imageCropModal');
    const cropImg = document.getElementById('cropImageTarget');
    cropImg.src = e.target.result;
    
    cropModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    if (cropperInstance) {
      cropperInstance.destroy();
    }
    
    setTimeout(() => {
      cropperInstance = new Cropper(cropImg, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1.0,
        background: false,
        responsive: true,
        checkOrientation: false
      });
    }, 100);
    
    currentCropCallback = callback;
  };
  reader.readAsDataURL(file);
}

function closeCropModal() {
  const cropModal = document.getElementById('imageCropModal');
  cropModal.classList.add('hidden');
  
  const profileModalOpen = !document.getElementById('profileModal').classList.contains('hidden');
  const addModalOpen = !document.getElementById('memberAddModal').classList.contains('hidden');
  if (!profileModalOpen && !addModalOpen) {
    document.body.style.overflow = '';
  }
  
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  
  document.getElementById('editAvatarFile').value = '';
  document.getElementById('addAvatarFile').value = '';
  currentCropCallback = null;
}

// 세션 상태 체크
function checkSession() {
  const sessionUser = sessionStorage.getItem('sogang_unity_session');
  if (sessionUser) {
    state.currentUser = JSON.parse(sessionUser);
    
    // members에서 로그인된 멤버 객체 찾기
    const userMember = state.members.find(m => m.id === state.currentUser.id);
    if (userMember) {
      state.isAdmin = (userMember.role === "super_admin" || userMember.role === "admin");
      state.isSuperAdmin = (userMember.role === "super_admin");
    } else {
      state.isAdmin = false;
      state.isSuperAdmin = false;
    }
    
    // 이전 필터 세션 복구 또는 기수 기본 세팅
    if (state.currentUser.isGuest || state.isAdmin) {
      state.selectedGeneration = ""; // 전체 노출
    } else {
      // 일반 회원 로그인 시 자신의 기수로 기본 필터링
      state.selectedGeneration = userMember && userMember.generation ? String(userMember.generation) : "";
    }
    
    enterDashboard();
  } else {
    showLoginGate();
    
    // 저장된 로그인 정보(학번 및 비밀번호) 로드 및 주입
    const remembered = localStorage.getItem('sogang_gsvc_remember');
    if (remembered) {
      try {
        const { studentId, phoneLast4 } = JSON.parse(remembered);
        const studentIdEl = document.getElementById('studentId');
        const phoneLast4El = document.getElementById('phoneLast4');
        const rememberMeEl = document.getElementById('rememberMe');
        
        if (studentIdEl) studentIdEl.value = studentId;
        if (phoneLast4El) phoneLast4El.value = phoneLast4;
        if (rememberMeEl) rememberMeEl.checked = true;
      } catch (e) {
        console.error("저장된 로그인 정보 복원 실패:", e);
      }
    }
  }
}

// ==================== 이벤트 리스너 바인딩 ====================
function setupEventListeners() {
  // 로그인 서브밋
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  
  // 게스트 로그인 클릭
  document.getElementById('guestLoginBtn').addEventListener('click', handleGuestLogin);
  
  // 로그아웃 클릭
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // 실시간 검색어 입력
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderMembersGrid(true);
  });

  // 기수 필터 변경
  document.getElementById('generationFilter').addEventListener('change', (e) => {
    state.selectedGeneration = e.target.value;
    state.selectedTag = '';
    const clearBtn = document.getElementById('clearFilterBtn');
    if (clearBtn) {
      if (state.selectedGeneration || state.selectedMajor || state.selectedDegree) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }
    renderFilterTags();
    renderMembersGrid(true);
  });

  // 전공 필터 변경
  const majorFilterEl = document.getElementById('majorFilter');
  if (majorFilterEl) {
    majorFilterEl.addEventListener('change', (e) => {
      state.selectedMajor = e.target.value;
      state.selectedTag = '';
      const clearBtn = document.getElementById('clearFilterBtn');
      if (clearBtn) {
        if (state.selectedGeneration || state.selectedMajor || state.selectedDegree) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      renderFilterTags();
      renderMembersGrid(true);
    });
  }

  // 학위과정 필터 변경
  const degreeFilterEl = document.getElementById('degreeFilter');
  if (degreeFilterEl) {
    degreeFilterEl.addEventListener('change', (e) => {
      state.selectedDegree = e.target.value;
      state.selectedTag = '';
      const clearBtn = document.getElementById('clearFilterBtn');
      if (clearBtn) {
        if (state.selectedGeneration || state.selectedMajor || state.selectedDegree) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }
      renderFilterTags();
      renderMembersGrid(true);
    });
  }

  // 태그 및 상세 필터 초기화 버튼
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    state.selectedTag = '';
    state.tagSearchTerm = '';
    state.selectedGeneration = '';
    state.selectedMajor = '';
    state.selectedDegree = '';
    
    const tagSearchInput = document.getElementById('tagSearchInput');
    if (tagSearchInput) tagSearchInput.value = '';

    const genSelect = document.getElementById('generationFilter');
    if (genSelect) genSelect.value = '';

    const majorSelect = document.getElementById('majorFilter');
    if (majorSelect) majorSelect.value = '';

    const degreeSelect = document.getElementById('degreeFilter');
    if (degreeSelect) degreeSelect.value = '';

    document.getElementById('clearFilterBtn').classList.add('hidden');
    document.querySelectorAll('.btn-tag').forEach(b => b.classList.remove('active'));
    renderFilterTags();
    renderMembersGrid(true);
  });

  // 키워드 자체 실시간 검색 필터링
  const tagSearchInput = document.getElementById('tagSearchInput');
  if (tagSearchInput) {
    tagSearchInput.addEventListener('input', (e) => {
      state.tagSearchTerm = e.target.value.trim().toLowerCase();
      renderFilterTags();
    });
  }

  // 뷰 모드 토글 제어
  document.getElementById('viewToggleGrid').addEventListener('click', () => switchViewMode('grid'));
  document.getElementById('viewToggleList').addEventListener('click', () => switchViewMode('list'));

  // 모달 닫기 버튼
  document.getElementById('closeModalBtn').addEventListener('click', closeProfileModal);
  
  // 모달 외부 영역 클릭 시 닫기
  document.getElementById('profileModal').addEventListener('click', (e) => {
    if (e.target.id === 'profileModal') {
      closeProfileModal();
    }
  });

  // 프로필 편집 버튼 클릭
  document.getElementById('editProfileBtn').addEventListener('click', enableEditMode);
  
  // 편집 취소 버튼 클릭
  document.getElementById('cancelEditBtn').addEventListener('click', cancelEditing);
  
  // 편집 저장 양식 서브밋
  document.getElementById('profileEditForm').addEventListener('submit', saveProfileData);

  // 모달 개인 방명록 작성 서브밋
  document.getElementById('modalCommentForm').addEventListener('submit', handleModalCommentSubmit);

  // --- 운영진 모드 관련 이벤트 ---
  const sidebarEditBtn = document.getElementById('sidebarEditProfileBtn');
  if (sidebarEditBtn) {
    sidebarEditBtn.addEventListener('click', () => {
      if (state.currentUser && !state.currentUser.isGuest) {
        openProfileModal(state.currentUser.id);
        enableEditMode();
      }
    });
  }
  document.getElementById('closeAddModalBtn').addEventListener('click', closeAddMemberModal);
  document.getElementById('cancelAddBtn').addEventListener('click', closeAddMemberModal);
  document.getElementById('memberAddModal').addEventListener('click', (e) => {
    if (e.target.id === 'memberAddModal') {
      closeAddMemberModal();
    }
  });
  document.getElementById('memberAddForm').addEventListener('submit', handleAddMemberSubmit);

  // 관리자 문의 상세 모달 이벤트 바인딩
  const closeAdminInqModalBtn = document.getElementById('closeAdminInquiryModalBtn');
  if (closeAdminInqModalBtn) {
    closeAdminInqModalBtn.addEventListener('click', closeAdminInquiryModal);
  }
  const cancelAdminReplyBtn = document.getElementById('btnCancelAdminReply');
  if (cancelAdminReplyBtn) {
    cancelAdminReplyBtn.addEventListener('click', closeAdminInquiryModal);
  }
  const adminInqModal = document.getElementById('adminInquiryModal');
  if (adminInqModal) {
    adminInqModal.addEventListener('click', (e) => {
      if (e.target.id === 'adminInquiryModal') {
        closeAdminInquiryModal();
      }
    });
  }
  const adminReplyForm = document.getElementById('adminReplyForm');
  if (adminReplyForm) {
    adminReplyForm.addEventListener('submit', handleAdminReplySubmit);
  }
  const adminDeleteInqBtn = document.getElementById('btnAdminDeleteInquiry');
  if (adminDeleteInqBtn) {
    adminDeleteInqBtn.addEventListener('click', () => {
      if (state.selectedInquiryId) {
        deleteInquiry(state.selectedInquiryId);
      }
    });
  }

  // 동적 SNS 링크 추가 버튼 이벤트
  const btnAddEditSnsLink = document.getElementById('btnAddEditSnsLink');
  if (btnAddEditSnsLink) {
    btnAddEditSnsLink.addEventListener('click', () => {
      state.editSnsLinks.push({ type: 'github', value: '' });
      renderSnsLinksInputArea('editSnsLinksContainer', state.editSnsLinks);
    });
  }

  const btnAddAddSnsLink = document.getElementById('btnAddAddSnsLink');
  if (btnAddAddSnsLink) {
    btnAddAddSnsLink.addEventListener('click', () => {
      state.addSnsLinks.push({ type: 'github', value: '' });
      renderSnsLinksInputArea('addSnsLinksContainer', state.addSnsLinks);
    });
  }

  // 운영 대시보드 관련 이벤트
  const navAdminBtn = document.getElementById('navAdminTabBtn');
  if (navAdminBtn) {
    navAdminBtn.addEventListener('click', () => {
      if (state.isAdmin) {
        if (state.activeMainTab === 'directory') {
          switchToAdminDashboard();
        } else {
          switchToDirectory();
        }
      }
    });
  }

  const backToDirBtn = document.getElementById('backToDirectoryBtn');
  if (backToDirBtn) {
    backToDirBtn.addEventListener('click', switchToDirectory);
  }

  const adminAddBtn = document.getElementById('adminAddMemberBtn');
  if (adminAddBtn) {
    adminAddBtn.addEventListener('click', openAddMemberModal);
  }

  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      state.adminSearchTerm = e.target.value.trim().toLowerCase();
      renderAdminDashboard();
    });
  }

  // 운영용 기수 및 권한 필터 이벤트
  const adminGenSelect = document.getElementById('adminGenFilter');
  if (adminGenSelect) {
    adminGenSelect.addEventListener('change', (e) => {
      state.adminSelectedGeneration = e.target.value;
      renderAdminDashboard();
    });
  }

  const adminRoleSelect = document.getElementById('adminRoleFilter');
  if (adminRoleSelect) {
    adminRoleSelect.addEventListener('change', (e) => {
      state.adminSelectedRole = e.target.value;
      renderAdminDashboard();
    });
  }

  // 엑셀 일괄 등록 모달 제어 이벤트
  const excelUploadBtn = document.getElementById('adminExcelUploadBtn');
  if (excelUploadBtn) {
    excelUploadBtn.addEventListener('click', openExcelUploadModal);
  }

  const closeExcelBtn = document.getElementById('closeExcelModalBtn');
  if (closeExcelBtn) {
    closeExcelBtn.addEventListener('click', closeExcelUploadModal);
  }

  const cancelExcelBtn = document.getElementById('cancelExcelBtn');
  if (cancelExcelBtn) {
    cancelExcelBtn.addEventListener('click', closeExcelUploadModal);
  }

  const excelModal = document.getElementById('excelUploadModal');
  if (excelModal) {
    excelModal.addEventListener('click', (e) => {
      if (e.target.id === 'excelUploadModal') {
        closeExcelUploadModal();
      }
    });
  }

  // 템플릿 다운로드 및 파일 선택
  const downloadTemplateBtn = document.getElementById('downloadExcelTemplateBtn');
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', downloadExcelTemplate);
  }

  const excelInput = document.getElementById('excelFileInput');
  if (excelInput) {
    excelInput.addEventListener('change', handleExcelFileSelected);
  }

  const btnSubmitExcel = document.getElementById('btnSubmitExcel');
  if (btnSubmitExcel) {
    btnSubmitExcel.addEventListener('click', submitExcelData);
  }

  // 중복 일괄 제어 버튼 이벤트
  const applyAllSkipBtn = document.getElementById('btnApplyAllSkip');
  if (applyAllSkipBtn) {
    applyAllSkipBtn.addEventListener('click', () => applyAllConflictsAction('skip'));
  }

  const applyAllOverwriteBtn = document.getElementById('btnApplyAllOverwrite');
  if (applyAllOverwriteBtn) {
    applyAllOverwriteBtn.addEventListener('click', () => applyAllConflictsAction('overwrite'));
  }

  // 드롭존 드래그앤드롭 이벤트 바인딩
  const dropzone = document.getElementById('excelDropzone');
  if (dropzone) {
    dropzone.addEventListener('click', () => {
      if (excelInput) excelInput.click();
    });
    
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (excelInput) {
          excelInput.files = e.dataTransfer.files;
          handleExcelFileSelected({ target: excelInput });
        }
      }
    });
  }

  // 이미지 파일 크롭 이벤트 바인딩
  const editAvatarFile = document.getElementById('editAvatarFile');
  if (editAvatarFile) {
    editAvatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImageFileSelected(file, (croppedBlob) => {
        state.editCroppedBlob = croppedBlob;
        
        const editPreview = document.getElementById('editAvatarPreview');
        const editPreviewImg = document.getElementById('editAvatarPreviewImg');
        if (editPreview && editPreviewImg) {
          if (editPreviewImg.src && editPreviewImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(editPreviewImg.src);
          }
          editPreviewImg.src = URL.createObjectURL(croppedBlob);
          editPreview.style.display = 'flex';
        }
      });
    });
  }

  const addAvatarFile = document.getElementById('addAvatarFile');
  if (addAvatarFile) {
    addAvatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      handleImageFileSelected(file, (croppedBlob) => {
        state.addCroppedBlob = croppedBlob;
        
        const addPreview = document.getElementById('addAvatarPreview');
        const addPreviewImg = document.getElementById('addAvatarPreviewImg');
        if (addPreview && addPreviewImg) {
          if (addPreviewImg.src && addPreviewImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(addPreviewImg.src);
          }
          addPreviewImg.src = URL.createObjectURL(croppedBlob);
          addPreview.style.display = 'flex';
        }
      });
    });
  }

  // 크롭 모달 내부 확인/취소 버튼 바인딩
  const btnConfirmCrop = document.getElementById('btnConfirmCrop');
  if (btnConfirmCrop) {
    btnConfirmCrop.addEventListener('click', () => {
      if (cropperInstance && currentCropCallback) {
        const canvas = cropperInstance.getCroppedCanvas({
          width: 200,
          height: 200
        });
        canvas.toBlob((blob) => {
          if (currentCropCallback) {
            currentCropCallback(blob);
          }
          closeCropModal();
        }, 'image/jpeg', 0.85);
      }
    });
  }

  const btnCancelCrop = document.getElementById('btnCancelCrop');
  if (btnCancelCrop) {
    btnCancelCrop.addEventListener('click', closeCropModal);
  }

  const closeCropModalBtn = document.getElementById('closeCropModalBtn');
  if (closeCropModalBtn) {
    closeCropModalBtn.addEventListener('click', closeCropModal);
  }

  const imageCropModal = document.getElementById('imageCropModal');
  if (imageCropModal) {
    imageCropModal.addEventListener('click', (e) => {
      if (e.target.id === 'imageCropModal') {
        closeCropModal();
      }
    });
  }

  // 알림 종 버튼 클릭 토글 및 읽음 처리
  const notifBellBtn = document.getElementById('notifBellBtn');
  if (notifBellBtn) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const popover = document.getElementById('notifPopover');
      if (popover) {
        const isHidden = popover.classList.contains('hidden');
        if (isHidden) {
          popover.classList.remove('hidden');
          // 알림창 여는 순간 읽음 처리
          markNotificationsAsRead();
        } else {
          popover.classList.add('hidden');
        }
      }
    });
  }

  // 알림 모두 읽음 클릭
  const btnMarkAllRead = document.getElementById('btnMarkAllRead');
  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', (e) => {
      e.stopPropagation();
      markNotificationsAsRead();
      const popover = document.getElementById('notifPopover');
      if (popover) popover.classList.add('hidden');
    });
  }

  // 알림창 밖 클릭 시 알림창 닫기
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('notifPopover');
    const container = document.getElementById('notifContainer');
    if (popover && !popover.classList.contains('hidden')) {
      if (container && !container.contains(e.target)) {
        popover.classList.add('hidden');
      }
    }
  });

  // --- 운영진 문의 관련 리스너 ---
  const navInquiryBtn = document.getElementById('navInquiryBtn');
  if (navInquiryBtn) {
    navInquiryBtn.addEventListener('click', openInquiryModal);
  }
  const closeInquiryModalBtn = document.getElementById('closeInquiryModalBtn');
  if (closeInquiryModalBtn) {
    closeInquiryModalBtn.addEventListener('click', closeInquiryModal);
  }
  const btnCancelInquiry = document.getElementById('btnCancelInquiry');
  if (btnCancelInquiry) {
    btnCancelInquiry.addEventListener('click', closeInquiryModal);
  }
  const inquiryModal = document.getElementById('inquiryModal');
  if (inquiryModal) {
    inquiryModal.addEventListener('click', (e) => {
      if (e.target.id === 'inquiryModal') closeInquiryModal();
    });
  }
  const tabInquiryWrite = document.getElementById('tabInquiryWrite');
  if (tabInquiryWrite) {
    tabInquiryWrite.addEventListener('click', () => switchInquiryTab('write'));
  }
  const tabInquiryList = document.getElementById('tabInquiryList');
  if (tabInquiryList) {
    tabInquiryList.addEventListener('click', () => switchInquiryTab('list'));
  }
  const inquiryForm = document.getElementById('inquiryForm');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', handleInquirySubmit);
  }

  // --- 비밀번호 변경 관련 리스너 ---
  const sidebarChangePwBtn = document.getElementById('sidebarChangePwBtn');
  if (sidebarChangePwBtn) {
    sidebarChangePwBtn.addEventListener('click', openChangePwModal);
  }
  const closeChangePwModalBtn = document.getElementById('closeChangePwModalBtn');
  if (closeChangePwModalBtn) {
    closeChangePwModalBtn.addEventListener('click', closeChangePwModal);
  }
  const btnCancelChangePw = document.getElementById('btnCancelChangePw');
  if (btnCancelChangePw) {
    btnCancelChangePw.addEventListener('click', closeChangePwModal);
  }
  const changePwModal = document.getElementById('changePwModal');
  if (changePwModal) {
    changePwModal.addEventListener('click', (e) => {
      if (e.target.id === 'changePwModal') closeChangePwModal();
    });
  }
  const changePwForm = document.getElementById('changePwForm');
  if (changePwForm) {
    changePwForm.addEventListener('submit', handleChangePasswordSubmit);
  }

  // --- 어드민 대시보드 하위 탭 전환 리스너 ---
  const adminTabMembers = document.getElementById('adminTabMembers');
  if (adminTabMembers) {
    adminTabMembers.addEventListener('click', () => switchAdminActiveTab('members'));
  }
  const adminTabInquiries = document.getElementById('adminTabInquiries');
  if (adminTabInquiries) {
    adminTabInquiries.addEventListener('click', () => switchAdminActiveTab('inquiries'));
  }
  const adminInqTabActive = document.getElementById('adminInqTabActive');
  if (adminInqTabActive) {
    adminInqTabActive.addEventListener('click', () => switchAdminInquirySubTab('active'));
  }
  const adminInqTabTrash = document.getElementById('adminInqTabTrash');
  if (adminInqTabTrash) {
    adminInqTabTrash.addEventListener('click', () => switchAdminInquirySubTab('trash'));
  }
  const adminMemTabActive = document.getElementById('adminMemTabActive');
  if (adminMemTabActive) {
    adminMemTabActive.addEventListener('click', () => switchAdminMemberSubTab('active'));
  }
  const adminMemTabTrash = document.getElementById('adminMemTabTrash');
  if (adminMemTabTrash) {
    adminMemTabTrash.addEventListener('click', () => switchAdminMemberSubTab('trash'));
  }

  // --- 빠른 바로가기 및 DM 관련 리스너 ---
  const adminTabQuickLinks = document.getElementById('adminTabQuickLinks');
  if (adminTabQuickLinks) {
    adminTabQuickLinks.addEventListener('click', () => switchAdminActiveTab('quick_links'));
  }
  const adminAddQuickLinkForm = document.getElementById('adminAddQuickLinkForm');
  if (adminAddQuickLinkForm) {
    adminAddQuickLinkForm.addEventListener('submit', handleAddQuickLinkSubmit);
  }

  // 쪽지함 버튼 클릭
  const btnDirectMessageInbox = document.getElementById('btnDirectMessageInbox');
  if (btnDirectMessageInbox) {
    btnDirectMessageInbox.addEventListener('click', () => {
      state.activeDmOpponentId = "";
      openDmInboxModal();
    });
  }
  // 쪽지함 닫기 버튼 클릭
  const closeDmInboxModalBtn = document.getElementById('closeDmInboxModalBtn');
  if (closeDmInboxModalBtn) {
    closeDmInboxModalBtn.addEventListener('click', closeDmInboxModal);
  }
  // 쪽지함 모달 바깥 영역 클릭 시 닫기
  const dmInboxModal = document.getElementById('dmInboxModal');
  if (dmInboxModal) {
    dmInboxModal.addEventListener('click', (e) => {
      if (e.target.id === 'dmInboxModal') closeDmInboxModal();
    });
  }
  // 목록으로 돌아가기 버튼 클릭
  const btnDmBackToList = document.getElementById('btnDmBackToList');
  if (btnDmBackToList) {
    btnDmBackToList.addEventListener('click', () => {
      state.activeDmOpponentId = "";
      renderDmInbox();
    });
  }

  // 답장 작성 textarea 글자수 표기 및 엔터 전송
  const dmChatReplyText = document.getElementById('dmChatReplyText');
  const dmChatCharCount = document.getElementById('dmChatCharCount');
  if (dmChatReplyText) {
    dmChatReplyText.addEventListener('input', () => {
      const len = dmChatReplyText.value.length;
      if (dmChatCharCount) dmChatCharCount.innerText = `${len} / 500자`;
    });

    dmChatReplyText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendDmReply();
      }
    });
  }

  // 답장 전송 버튼 클릭
  const btnDmSendReply = document.getElementById('btnDmSendReply');
  if (btnDmSendReply) {
    btnDmSendReply.addEventListener('click', handleSendDmReply);
  }

  // 쪽지함 새로고침
  const btnRefreshDm = document.getElementById('btnRefreshDm');
  if (btnRefreshDm) {
    btnRefreshDm.addEventListener('click', () => {
      syncDMs().then(renderDmInbox);
    });
  }

  // 대화방 나가기 버튼 클릭
  const btnDmLeaveChat = document.getElementById('btnDmLeaveChat');
  if (btnDmLeaveChat) {
    btnDmLeaveChat.addEventListener('click', handleLeaveChat);
  }
  // 쪽지 작성 모달 닫기
  const closeDmSendModalBtn = document.getElementById('closeDmSendModalBtn');
  if (closeDmSendModalBtn) {
    closeDmSendModalBtn.addEventListener('click', closeDmSendModal);
  }
  const btnCancelSendDm = document.getElementById('btnCancelSendDm');
  if (btnCancelSendDm) {
    btnCancelSendDm.addEventListener('click', closeDmSendModal);
  }

  // 쪽지 받는 사람 검색형 자동완성 드롭다운 이벤트 바인딩
  const dmReceiverSearchInput = document.getElementById('dmReceiverSearchInput');
  const dmReceiverDropdownList = document.getElementById('dmReceiverDropdownList');
  if (dmReceiverSearchInput && dmReceiverDropdownList) {
    dmReceiverSearchInput.addEventListener('focus', () => {
      renderReceiverDropdown(dmReceiverSearchInput.value);
      dmReceiverDropdownList.classList.remove('hidden');
    });
    
    dmReceiverSearchInput.addEventListener('input', (e) => {
      const currentVal = e.target.value;
      const activeMembers = state.members.filter(m => m.id !== 'admin' && m.id !== state.currentUser.id && m.role !== 'deleted');
      const exactMatch = activeMembers.find(m => `${m.generation ? `${m.generation}기 ` : ''}${m.name} (${m.studentId})` === currentVal);
      if (exactMatch) {
        document.getElementById('dmReceiverSelect').value = exactMatch.id;
      } else {
        document.getElementById('dmReceiverSelect').value = "";
      }
      renderReceiverDropdown(currentVal);
      dmReceiverDropdownList.classList.remove('hidden');
    });
    
    dmReceiverSearchInput.addEventListener('blur', () => {
      setTimeout(() => {
        dmReceiverDropdownList.classList.add('hidden');
        if (dmReceiverSearchInput.value.trim() === "") {
          document.getElementById('dmReceiverSelect').value = "";
        }
      }, 200);
    });
  }
  // 쪽지 보내기 서브밋
  const dmSendForm = document.getElementById('dmSendForm');
  if (dmSendForm) {
    dmSendForm.addEventListener('submit', handleSendDmSubmit);
  }
  // 쪽지함 내에서 쓰기 버튼 클릭
  const btnOpenSendDmFromInbox = document.getElementById('btnOpenSendDmFromInbox');
  if (btnOpenSendDmFromInbox) {
    btnOpenSendDmFromInbox.addEventListener('click', () => {
      openDmSendModal();
    });
  }
  // 회원 상세 보기 내 쪽지 보내기 버튼 클릭
  const btnProfileSendDm = document.getElementById('btnProfileSendDm');
  if (btnProfileSendDm) {
    btnProfileSendDm.addEventListener('click', () => {
      if (state.selectedMemberId) {
        const targetMember = state.members.find(m => m.id === state.selectedMemberId);
        if (targetMember) {
          closeProfileModal();
          state.activeDmOpponentId = state.selectedMemberId;
          openDmInboxModal();
        }
      }
    });
  }

  // --- 개인정보 처리방침 모달 관련 리스너 ---
  const btnLoginShowPrivacy = document.getElementById('btnLoginShowPrivacy');
  if (btnLoginShowPrivacy) {
    btnLoginShowPrivacy.addEventListener('click', openPrivacyModal);
  }
  const btnShowPrivacy = document.getElementById('btnShowPrivacy');
  if (btnShowPrivacy) {
    btnShowPrivacy.addEventListener('click', openPrivacyModal);
  }
  const closePrivacyModalBtn = document.getElementById('closePrivacyModalBtn');
  if (closePrivacyModalBtn) {
    closePrivacyModalBtn.addEventListener('click', closePrivacyModal);
  }
  const btnConfirmPrivacy = document.getElementById('btnConfirmPrivacy');
  if (btnConfirmPrivacy) {
    btnConfirmPrivacy.addEventListener('click', closePrivacyModal);
  }
  const privacyModal = document.getElementById('privacyModal');
  if (privacyModal) {
    privacyModal.addEventListener('click', (e) => {
      if (e.target.id === 'privacyModal') {
        closePrivacyModal();
      }
    });
  }

  // 브랜드 로고 클릭 이벤트 바인딩
  const brandLogo = document.getElementById('navBrandLogo');
  if (brandLogo) {
    brandLogo.addEventListener('click', resetFiltersAndShowDirectory);
  }

  // 더 보기 버튼 클릭 이벤트 바인딩
  const btnLoadMore = document.getElementById('btnLoadMoreMembers');
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', loadMoreMembers);
  }

  // 테마 토글 스위치 변경 이벤트
  const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
  if (themeToggleCheckbox) {
    themeToggleCheckbox.checked = (state.theme === 'dark');
    themeToggleCheckbox.addEventListener('change', toggleTheme);
  }

  // 무한 스크롤 설정
  setupInfiniteScroll();
}

// 더보기 버튼 클릭 시 다음 페이지 멤버 추가 로드
function loadMoreMembers() {
  const btnLoadMore = document.getElementById('btnLoadMoreMembers');
  const loadSpinner = document.getElementById('membersLoadSpinner');
  
  if (btnLoadMore) btnLoadMore.classList.add('hidden');
  if (loadSpinner) loadSpinner.classList.remove('hidden');
  
  // 자연스러운 로딩 연출을 위해 250ms의 인위적인 딜레이 적용
  setTimeout(() => {
    state.membersLimit += 12;
    renderMembersGrid();
  }, 250);
}

// 무한 스크롤 이벤트 리스너 바인딩
function setupInfiniteScroll() {
  let isThrottled = false;
  window.addEventListener('scroll', () => {
    // 디렉토리 탭이 활성화 상태일 때만 동작
    if (state.activeMainTab !== 'directory') return;
    if (isThrottled) return;

    // 바닥 근처(바닥에서 150px 이내)에 스크롤 도달 시점 감지
    const threshold = 150;
    const isNearBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - threshold);

    if (isNearBottom) {
      const lazyLoadArea = document.getElementById('membersLazyLoadArea');
      const btnLoadMore = document.getElementById('btnLoadMoreMembers');
      
      // 로드할 더 많은 카드가 남아있고, 현재 로딩중이지 않을 때
      if (lazyLoadArea && lazyLoadArea.style.display !== 'none' && btnLoadMore && !btnLoadMore.classList.contains('hidden')) {
        isThrottled = true;
        loadMoreMembers();
        setTimeout(() => {
          isThrottled = false;
        }, 500); // 500ms 디바운스/쓰로틀링
      }
    }
  });
}

// 필터를 초기화하고 메인 디렉토리 뷰로 이동
function resetFiltersAndShowDirectory() {
  state.selectedTag = '';
  state.tagSearchTerm = '';
  state.selectedGeneration = '';
  state.selectedMajor = '';
  state.selectedDegree = '';
  state.searchTerm = '';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const tagSearchInput = document.getElementById('tagSearchInput');
  if (tagSearchInput) tagSearchInput.value = '';

  const genSelect = document.getElementById('generationFilter');
  if (genSelect) genSelect.value = '';

  const majorSelect = document.getElementById('majorFilter');
  if (majorSelect) majorSelect.value = '';

  const degreeSelect = document.getElementById('degreeFilter');
  if (degreeSelect) degreeSelect.value = '';

  const clearBtn = document.getElementById('clearFilterBtn');
  if (clearBtn) clearBtn.classList.add('hidden');

  document.querySelectorAll('.btn-tag').forEach(b => b.classList.remove('active'));

  switchToDirectory();
  renderFilterTags();
  renderMembersGrid(true);
}

// 개인정보 처리방침 모달 제어 함수
function openPrivacyModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('privacyModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closePrivacyModal() {
  const modal = document.getElementById('privacyModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// ==================== 로그인 및 세션 처리 ====================
function handleLogin(e) {
  e.preventDefault();
  const studentId = document.getElementById('studentId').value.trim();
  const phoneLast4 = document.getElementById('phoneLast4').value.trim();
  const errorEl = document.getElementById('loginError');

  // 대소문자 무관 학번 비교, 뒷자리 비교
  const matchedMember = state.members.find(m => 
    m.studentId.toLowerCase() === studentId.toLowerCase() && 
    m.phoneLast4 === phoneLast4
  );

  if (matchedMember) {
    if (matchedMember.role === 'deleted') {
      errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 삭제되었거나 비활성화된 계정입니다.`;
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');
    
    // 로그인 정보 저장/삭제 처리
    const rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
      localStorage.setItem('sogang_gsvc_remember', JSON.stringify({ studentId, phoneLast4 }));
    } else {
      localStorage.removeItem('sogang_gsvc_remember');
    }

    state.isAdmin = (matchedMember.role === "super_admin" || matchedMember.role === "admin");
    state.isSuperAdmin = (matchedMember.role === "super_admin");
    state.currentUser = {
      id: matchedMember.id,
      name: matchedMember.name,
      classYear: matchedMember.classYear,
      isGuest: false,
      generation: matchedMember.generation || null
    };
    
    sessionStorage.setItem('sogang_unity_session', JSON.stringify(state.currentUser));

    // 일반 회원의 경우 자기 기수를 기본 필터로 세팅
    if (state.isAdmin) {
      state.selectedGeneration = "";
    } else {
      state.selectedGeneration = matchedMember.generation ? String(matchedMember.generation) : "";
    }

    enterDashboard();
  } else {
    errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 학번 또는 비밀번호가 일치하지 않습니다.`;
    errorEl.classList.remove('hidden');
  }
}

function handleGuestLogin() {
  state.isAdmin = false;
  state.isSuperAdmin = false;
  state.currentUser = {
    id: "guest",
    name: "게스트",
    classYear: "외부 방문객",
    isGuest: true,
    generation: null
  };
  sessionStorage.setItem('sogang_unity_session', JSON.stringify(state.currentUser));
  state.selectedGeneration = ""; // 전체 기수 노출
  enterDashboard();
}

function handleLogout() {
  sessionStorage.removeItem('sogang_unity_session');
  state.currentUser = null;
  state.selectedMemberId = null;
  state.searchTerm = '';
  state.adminSearchTerm = '';
  state.selectedTag = '';
  state.selectedGeneration = '';
  state.isAdmin = false;
  state.isSuperAdmin = false;
  state.activeMainTab = 'directory';
  
  // DM 백그라운드 폴링 중단
  if (state.dmPollingInterval) {
    clearInterval(state.dmPollingInterval);
    state.dmPollingInterval = null;
  }
  state.alertedMessageIds = null;

  // 알림 컨테이너 숨김
  updateNotifications();
  
  // 입력 필드 초기화
  document.getElementById('searchInput').value = '';
  const adminSearch = document.getElementById('adminSearchInput');
  if (adminSearch) adminSearch.value = '';
  
  // 뷰 초기화 (운영 대시보드 뷰 숨김, 디렉토리 뷰 노출)
  const dirView = document.getElementById('directoryView');
  const adminView = document.getElementById('adminDashboardView');
  if (dirView) dirView.classList.remove('hidden');
  if (adminView) adminView.classList.add('hidden');
  
  const navAdminBtn = document.getElementById('navAdminTabBtn');
  if (navAdminBtn) navAdminBtn.classList.remove('active');
  
  showLoginGate();
}

function showLoginGate() {
  document.getElementById('mainDashboard').classList.add('hidden');
  document.getElementById('loginGate').classList.remove('hidden');
}

function enterDashboard() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('mainDashboard').classList.remove('hidden');

  // 상단 바 및 사이드바 사용자 표시 업데이트
  updateUserInfoUI();

  // 뷰 초기 상태 매핑
  switchViewMode(state.viewMode);

  // 목록 렌더링
  renderFilterSelectorsOptions();
  renderMembersGrid();
  renderFilterTags();
  
  // 알림 상태 업데이트
  updateNotifications();

  // 어드민 대시보드 진입 시 휴지통 자동 영구 삭제 실행
  if (state.isAdmin) {
    autoPurgeTrash();
  }

  // 실시간 쪽지 폴링 시작
  startDmPolling();
}

// 사용자 로그인 상태에 따른 UI 동기화
function updateUserInfoUI() {
  const user = state.currentUser;
  
  // 나간 대화방 기록 로드
  if (user && !user.isGuest) {
    const cachedLeft = localStorage.getItem('sogang_unity_left_chats_' + user.id);
    state.leftChats = cachedLeft ? JSON.parse(cachedLeft) : {};
  } else {
    state.leftChats = {};
  }
  
  const matchedMember = state.members.find(m => m.id === user.id);
  const userAvatarImg = matchedMember ? matchedMember.avatarImage : null;
  
  // 네비게이션바
  document.getElementById('navUserName').innerText = user.name;
  const navAvatarEl = document.getElementById('navUserAvatar');
  if (userAvatarImg) {
    navAvatarEl.innerHTML = `<img src="${userAvatarImg}" alt="${user.name}">`;
  } else {
    navAvatarEl.innerText = user.name[0];
  }
  navAvatarEl.style.backgroundColor = state.isAdmin ? '#111' : (user.isGuest ? '#777' : '#B60005');

  // 사이드바
  document.getElementById('sidebarName').innerText = user.name;
  
  // 기수 정보 노출 포맷팅
  let classYearDisplay = user.classYear;
  if (!user.isGuest && !state.isAdmin && user.generation) {
    classYearDisplay = `${user.generation}기 / ${user.classYear}`;
  }
  document.getElementById('sidebarClass').innerText = classYearDisplay;
  
  const sidebarAvatarEl = document.getElementById('sidebarAvatar');
  if (userAvatarImg) {
    sidebarAvatarEl.innerHTML = `<img src="${userAvatarImg}" alt="${user.name}">`;
  } else {
    sidebarAvatarEl.innerText = user.name[0];
  }
  sidebarAvatarEl.style.backgroundColor = state.isAdmin ? '#111' : (user.isGuest ? '#777' : '#B60005');

  const headlineEl = document.getElementById('sidebarHeadline');
  const adminPanelEl = document.getElementById('adminConsolePanel');
  const navAdminBtn = document.getElementById('navAdminTabBtn');
  
  if (navAdminBtn) {
    if (state.isAdmin) {
      navAdminBtn.classList.remove('hidden');
    } else {
      navAdminBtn.classList.add('hidden');
    }
  }
  
  if (state.isAdmin) {
    if (state.isSuperAdmin) {
      headlineEl.innerText = "디렉토리 최고 시스템 운영진 계정입니다.";
    } else {
      headlineEl.innerText = "디렉토리 부운영진 계정입니다.";
    }
    if (adminPanelEl) adminPanelEl.classList.remove('hidden');
  } else {
    if (adminPanelEl) adminPanelEl.classList.add('hidden');
    if (user.isGuest) {
      headlineEl.innerText = "프로필을 직접 등록하고 편집하고 싶다면 학번으로 로그인해 주세요.";
    } else {
      headlineEl.innerText = matchedMember ? matchedMember.headline : "서강대 가상융합전문대학원(GSVC)의 정식 구성원입니다.";
    }
  }

  const sidebarEditBtnEl = document.getElementById('sidebarEditProfileBtn');
  const sidebarChangePwBtnEl = document.getElementById('sidebarChangePwBtn');
  if (sidebarEditBtnEl) {
    if (user.isGuest) {
      sidebarEditBtnEl.classList.add('hidden');
    } else {
      sidebarEditBtnEl.classList.remove('hidden');
    }
  }
  if (sidebarChangePwBtnEl) {
    if (user.isGuest) {
      sidebarChangePwBtnEl.classList.add('hidden');
    } else {
      sidebarChangePwBtnEl.classList.remove('hidden');
    }
  }

  // 게스트(isGuest)인 경우 쪽지함 및 운영진 문의 버튼 숨김 처리
  const btnDirectMessageInbox = document.getElementById('btnDirectMessageInbox');
  const navInquiryBtn = document.getElementById('navInquiryBtn');
  
  if (btnDirectMessageInbox) {
    if (user.isGuest) {
      btnDirectMessageInbox.classList.add('hidden');
    } else {
      btnDirectMessageInbox.classList.remove('hidden');
    }
  }
  
  if (navInquiryBtn) {
    if (user.isGuest) {
      navInquiryBtn.classList.add('hidden');
    } else {
      navInquiryBtn.classList.remove('hidden');
    }
  }
}

// ==================== 탭 및 뷰 제어 스위치 ====================

// 카드형/리스트형 뷰 상태 제어
function switchViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('sogang_unity_viewmode', mode);

  const btnGrid = document.getElementById('viewToggleGrid');
  const btnList = document.getElementById('viewToggleList');
  const gridContainer = document.getElementById('membersGrid');

  if (mode === 'list') {
    btnList.classList.add('active');
    btnGrid.classList.remove('active');
    
    gridContainer.classList.remove('grid-view');
    gridContainer.classList.add('list-view');
  } else {
    btnGrid.classList.add('active');
    btnList.classList.remove('active');
    
    gridContainer.classList.remove('list-view');
    gridContainer.classList.add('grid-view');
  }
  
  renderMembersGrid();
}

// ==================== 운영 관리 뷰 전환 및 기능 처리 ====================

// 디렉토리 뷰로 화면 전환
function switchToDirectory() {
  state.activeMainTab = 'directory';
  
  const navAdminBtn = document.getElementById('navAdminTabBtn');
  if (navAdminBtn) navAdminBtn.classList.remove('active');
  
  const dirView = document.getElementById('directoryView');
  const adminView = document.getElementById('adminDashboardView');
  
  if (dirView) dirView.classList.remove('hidden');
  if (adminView) adminView.classList.add('hidden');
  
  // 디렉토리 복귀 시 목록 갱신
  renderMembersGrid();
}

// 운영 관리 대시보드 뷰로 화면 전환
function switchToAdminDashboard() {
  if (!state.isAdmin) return;
  state.activeMainTab = 'admin';
  
  const navAdminBtn = document.getElementById('navAdminTabBtn');
  if (navAdminBtn) navAdminBtn.classList.add('active');
  
  const dirView = document.getElementById('directoryView');
  const adminView = document.getElementById('adminDashboardView');
  
  if (dirView) dirView.classList.add('hidden');
  if (adminView) adminView.classList.remove('hidden');
  
  renderAdminDashboard();
}

// 운영 관리 대시보드 데이터 및 테이블 렌더링
function renderAdminDashboard() {
  if (!state.isAdmin) return;

  const nonAdminMembers = state.members.filter(m => m.id !== 'admin');
  
  // 활성 회원 및 휴지통 회원 분리
  const activeMembers = nonAdminMembers.filter(m => m.role !== 'deleted');
  const trashMembers = nonAdminMembers.filter(m => m.role === 'deleted');

  // 활성/휴지통 서브탭 뱃지 개수 업데이트
  const activeCountEl = document.getElementById('adminActiveMemCount');
  const trashCountEl = document.getElementById('adminTrashMemCount');
  if (activeCountEl) activeCountEl.innerText = String(activeMembers.length);
  if (trashCountEl) trashCountEl.innerText = String(trashMembers.length);

  // 운영 기수 필터 드롭다운 동적 갱신 (선택 상태 보존, 활성 회원 기준)
  const adminGenSelect = document.getElementById('adminGenFilter');
  if (adminGenSelect) {
    const prevVal = state.adminSelectedGeneration;
    adminGenSelect.innerHTML = '<option value="">모든 기수</option>';
    const gens = [...new Set(activeMembers
      .filter(m => m.generation)
      .map(m => m.generation)
    )].sort((a, b) => a - b);
    gens.forEach(gen => {
      const opt = document.createElement('option');
      opt.value = String(gen);
      opt.innerText = `${gen}기`;
      adminGenSelect.appendChild(opt);
    });
    adminGenSelect.value = prevVal;
  }

  // 1. 통계 수치 업데이트 (활성 회원 기준)
  const totalCount = activeMembers.length;
  
  const adminCount = activeMembers.filter(m => 
    m.role === 'super_admin' || m.role === 'admin'
  ).length;
  
  const generations = [...new Set(activeMembers
    .filter(m => m.generation)
    .map(m => m.generation)
  )];
  const genCount = generations.length;

  document.getElementById('statTotalMembers').innerText = String(totalCount);
  document.getElementById('statAdminCount').innerText = String(adminCount);
  document.getElementById('statGenCount').innerText = String(genCount);

  // 2. 멤버 목록 테이블 렌더링
  const tbody = document.getElementById('adminMemberTableBody');
  if (!tbody) return;
  tbody.innerHTML = "";

  // 현재 활성화된 서브탭에 따른 회원 소스 정의
  const currentMembersSource = (state.adminMemberSubTab === 'trash') ? trashMembers : activeMembers;

  // 실시간 검색어, 기수 필터, 권한 필터 AND 조건 적용
  const filtered = currentMembersSource.filter(m => {
    // 1) 이름 또는 학번 검색어 매칭
    let matchesSearch = true;
    if (state.adminSearchTerm) {
      const term = state.adminSearchTerm;
      matchesSearch = (m.name || "").toLowerCase().includes(term) ||
                      (m.studentId || "").toLowerCase().includes(term);
    }

    // 2) 기수 매칭
    let matchesGen = true;
    if (state.adminSelectedGeneration) {
      matchesGen = String(m.generation) === state.adminSelectedGeneration;
    }

    // 3) 권한 매칭
    let matchesRole = true;
    if (state.adminMemberSubTab !== 'trash' && state.adminSelectedRole) {
      const role = state.adminSelectedRole;
      if (role === 'super_admin') {
        matchesRole = m.role === 'super_admin';
      } else if (role === 'admin') {
        matchesRole = m.role === 'admin';
      } else if (role === 'member') {
        matchesRole = m.role === 'member' || !m.role;
      }
    }

    return matchesSearch && matchesGen && matchesRole;
  });

  // 학번 오름차순 정렬
  filtered.sort((a, b) => {
    const idA = (a.studentId || "").toLowerCase();
    const idB = (b.studentId || "").toLowerCase();
    return idA.localeCompare(idB);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--color-text-dim); padding: 2rem;">
          검색 결과가 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(member => {
    const tr = document.createElement('tr');

    // 뱃지 및 토글 상태 결정
    let roleBadgeHtml = "";
    if (member.role === "super_admin") {
      roleBadgeHtml = `<span class="admin-role-badge super-admin"><i class="fa-solid fa-crown"></i> 시스템 관리</span>`;
    } else if (member.role === "admin") {
      roleBadgeHtml = `<span class="admin-role-badge admin"><i class="fa-solid fa-user-shield"></i> 운영진</span>`;
    } else if (member.role === "deleted") {
      roleBadgeHtml = `<span class="admin-role-badge deleted" style="background-color: var(--color-text-dim); color: #fff;"><i class="fa-solid fa-ban"></i> 삭제됨</span>`;
    } else {
      roleBadgeHtml = `<span class="admin-role-badge member"><i class="fa-solid fa-user"></i> 원우</span>`;
    }

    const isChecked = member.role === "admin" || member.role === "super_admin";
    const isSuperAdminDisabled = member.role === "super_admin";
    // 최고 운영진만 권한 토글을 변경할 수 있고, 휴지통 탭인 경우에는 토글 불가
    const isToggleDisabled = !state.isSuperAdmin || isSuperAdminDisabled || state.adminMemberSubTab === 'trash';

    const toggleHtml = `
      <label class="admin-toggle-switch">
        <input type="checkbox" class="role-toggle-checkbox" data-id="${member.id}" 
          ${isChecked ? 'checked' : ''} 
          ${isToggleDisabled ? 'disabled' : ''}>
        <span class="admin-toggle-slider"></span>
      </label>
    `;

    let manageButtonsHtml = "";
    if (state.adminMemberSubTab === 'trash') {
      manageButtonsHtml = `
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-light btn-sm admin-restore-btn" data-id="${member.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang-gold); border-color: rgba(197,160,89,0.3);">
            <i class="fa-solid fa-rotate-left"></i> 복구
          </button>
          <button class="btn btn-light btn-sm admin-delete-permanent-btn" data-id="${member.id}" 
            style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2);">
            <i class="fa-solid fa-trash-can"></i> 영구삭제
          </button>
        </div>
      `;
    } else {
      manageButtonsHtml = `
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-light btn-sm admin-edit-btn" data-id="${member.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px;">
            <i class="fa-solid fa-pen"></i> 수정
          </button>
          <button class="btn btn-light btn-sm admin-reset-pw-btn" data-id="${member.id}" title="원우 비밀번호를 최초 전화번호 뒷자리로 리셋" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang-gold); border-color: rgba(197,160,89,0.3);">
            <i class="fa-solid fa-rotate-left"></i> 초기화
          </button>
          <button class="btn btn-light btn-sm admin-delete-btn" data-id="${member.id}" 
            ${isSuperAdminDisabled ? 'disabled' : ''} 
            style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2);">
            <i class="fa-solid fa-trash-can"></i> 삭제
          </button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(member.name || "")}</td>
      <td style="font-family: monospace; color: var(--color-text-sub);">${escapeHtml(member.studentId || "")}</td>
      <td>${member.generation ? `${member.generation}기` : "-"}</td>
      <td>${escapeHtml(member.classYear || "")}</td>
      <td>${escapeHtml(member.degreeProcess || "")}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.8rem;">
          ${roleBadgeHtml}
          ${toggleHtml}
        </div>
      </td>
      <td>${manageButtonsHtml}</td>
    `;

    // 이벤트 리스너 바인딩
    // 1) 권한 토글 스위치 이벤트
    const checkbox = tr.querySelector('.role-toggle-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        toggleAdminRole(member.id, e.target.checked);
      });
    }

    if (state.adminMemberSubTab === 'trash') {
      // 복구 버튼 이벤트
      tr.querySelector('.admin-restore-btn').addEventListener('click', () => {
        handleRestoreMember(member.id, member.name);
      });
      // 영구 삭제 버튼 이벤트
      tr.querySelector('.admin-delete-permanent-btn').addEventListener('click', () => {
        handleDeleteMemberPermanent(member.id, member.name);
      });
    } else {
      // 2) 편집 버튼 이벤트
      tr.querySelector('.admin-edit-btn').addEventListener('click', () => {
        openProfileModal(member.id);
        enableEditMode();
      });

      // 3) 비밀번호 초기화 버튼 이벤트
      const resetPwBtn = tr.querySelector('.admin-reset-pw-btn');
      if (resetPwBtn) {
        resetPwBtn.addEventListener('click', () => {
          resetMemberPassword(member.id, member.name);
        });
      }

      // 4) 삭제 버튼 이벤트
      const delBtn = tr.querySelector('.admin-delete-btn');
      if (delBtn && !isSuperAdminDisabled) {
        delBtn.addEventListener('click', async () => {
          await handleDeleteMember(member.id, member.name);
        });
      }
    }

    tbody.appendChild(tr);
  });
}

// 멤버 권한 변경 처리 함수 (최고 운영진 전용)
async function toggleAdminRole(memberId, makeAdmin) {
  if (!state.isSuperAdmin) {
    alert("권한을 변경할 수 있는 권한이 없습니다. 최고 시스템 운영진에게 문의해 주세요.");
    renderAdminDashboard(); // 원래대로 토글 복구
    return;
  }

  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  if (member.role === "super_admin") {
    alert("최고 시스템 운영진의 권한은 변경할 수 없습니다.");
    renderAdminDashboard();
    return;
  }

  const nextRole = makeAdmin ? "admin" : "member";
  member.role = nextRole;

  // 로컬 메모리 및 로컬 스토리지 갱신
  localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

  // Supabase 클라우드 싱크
  const isSupabaseActive = supabaseClient !== null;
  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from('members')
        .update({ role: nextRole })
        .eq('id', memberId);

      if (error) throw error;
    } catch (err) {
      console.error("Supabase 권한 업데이트 에러:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 저장됩니다)");
    }
  }

  // 화면 갱신
  renderAdminDashboard();
  renderMembersGrid();
  updateUserInfoUI();

  alert(`[${member.name}] 님의 권한이 [${makeAdmin ? '부운영진' : '원우'}]으로 변경되었습니다.`);
}

// ==================== 데이터 렌더링 파트 ====================

// 기수, 전공, 학위과정 필터 셀렉터 옵션 렌더링
function renderFilterSelectorsOptions() {
  // 1. 기수 필터 셀렉터 옵션 렌더링
  const genSelect = document.getElementById('generationFilter');
  if (genSelect) {
    genSelect.innerHTML = '<option value="">전체 기수</option>';

    const gens = [...new Set(state.members
      .filter(m => m.id !== 'admin' && m.role !== 'deleted' && m.generation)
      .map(m => m.generation)
    )].sort((a, b) => a - b);

    gens.forEach(gen => {
      const opt = document.createElement('option');
      opt.value = String(gen);
      opt.innerText = `${gen}기`;
      genSelect.appendChild(opt);
    });

    genSelect.value = state.selectedGeneration;
  }

  // 2. 소속 전공 필터 셀렉터 옵션 렌더링
  const majorSelect = document.getElementById('majorFilter');
  if (majorSelect) {
    majorSelect.innerHTML = '<option value="">전체 전공</option>';

    const majors = [...new Set(state.members
      .filter(m => m.id !== 'admin' && m.role !== 'deleted' && m.classYear)
      .map(m => m.classYear)
    )].sort();

    majors.forEach(major => {
      const opt = document.createElement('option');
      opt.value = major;
      opt.innerText = major;
      majorSelect.appendChild(opt);
    });

    majorSelect.value = state.selectedMajor;
  }

  // 3. 학위 과정 필터 셀렉터 옵션 렌더링
  const degreeSelect = document.getElementById('degreeFilter');
  if (degreeSelect) {
    degreeSelect.innerHTML = '<option value="">전체 과정</option>';

    const degrees = [...new Set(state.members
      .filter(m => m.id !== 'admin' && m.role !== 'deleted' && m.degreeProcess)
      .map(m => m.degreeProcess)
    )].sort();

    degrees.forEach(degree => {
      const opt = document.createElement('option');
      opt.value = degree;
      opt.innerText = degree.endsWith("과정") ? degree : `${degree} 과정`;
      degreeSelect.appendChild(opt);
    });

    degreeSelect.value = state.selectedDegree;
  }
}

// 멤버 카드 그리드 렌더링
function renderMembersGrid(resetLimit = false) {
  if (resetLimit) {
    state.membersLimit = 12;
  }
  const gridContainer = document.getElementById('membersGrid');
  gridContainer.innerHTML = "";

  // 필터링 적용
  const filtered = state.members.filter(member => {
    if (member.id === 'admin') return false;
    if (member.role === 'deleted') return false;

    // 1. 검색어 필터링 (이름, 헤드라인, 태그, 소개글, 자유 기재 내용, SNS 링크)
    const matchesSearch = 
      member.name.toLowerCase().includes(state.searchTerm) ||
      member.headline.toLowerCase().includes(state.searchTerm) ||
      (member.tags || []).some(tag => tag.toLowerCase().includes(state.searchTerm)) ||
      (member.bio || "").toLowerCase().includes(state.searchTerm) ||
      (member.customContent || "").toLowerCase().includes(state.searchTerm) ||
      (member.email || "").toLowerCase().includes(state.searchTerm) ||
      (member.snsLinks || []).some(link => (link.value || "").toLowerCase().includes(state.searchTerm));

    // 2. 해시태그 사이드바 필터링
    const matchesTag = 
      !state.selectedTag || 
      (member.tags || []).some(tag => tag.toLowerCase() === state.selectedTag.toLowerCase());

    // 3. 기수 필터링
    const matchesGen = 
      !state.selectedGeneration || 
      String(member.generation) === state.selectedGeneration;

    // 4. 전공 필터링
    const matchesMajor = 
      !state.selectedMajor || 
      member.classYear === state.selectedMajor;

    // 5. 학위 과정 필터링
    const matchesDegree = 
      !state.selectedDegree || 
      member.degreeProcess === state.selectedDegree;

    return matchesSearch && matchesTag && matchesGen && matchesMajor && matchesDegree;
  });

  // 학번 오름차순 정렬
  filtered.sort((a, b) => {
    const idA = (a.studentId || "").toLowerCase();
    const idB = (b.studentId || "").toLowerCase();
    return idA.localeCompare(idB);
  });

  // 멤버 수 헤더 텍스트 갱신
  const countText = document.getElementById('memberCountText');
  if (state.searchTerm || state.selectedTag || state.selectedGeneration || state.selectedMajor || state.selectedDegree) {
    countText.innerText = `검색/필터 결과 (${filtered.length}명)`;
  } else {
    countText.innerText = `전체 멤버 (${filtered.length}명)`;
  }

  // 필터 매칭 결과가 없을 경우
  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="no-results" style="grid-column: 1/-1; padding: 3rem 1rem; text-align: center; color: var(--color-text-sub);">
        <i class="fa-regular fa-folder-open" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--color-text-dim);"></i>
        <p>조건에 맞는 멤버를 찾을 수 없습니다.</p>
      </div>
    `;
    return;
  }

  // 로딩 및 더보기 영역 제어
  const lazyLoadArea = document.getElementById('membersLazyLoadArea');
  const btnLoadMore = document.getElementById('btnLoadMoreMembers');
  const loadSpinner = document.getElementById('membersLoadSpinner');

  if (lazyLoadArea) {
    if (state.membersLimit < filtered.length) {
      lazyLoadArea.style.display = 'block';
      if (btnLoadMore) btnLoadMore.classList.remove('hidden');
      if (loadSpinner) loadSpinner.classList.add('hidden');
    } else {
      lazyLoadArea.style.display = 'none';
    }
  }

  // 카드 그리기
  const visibleMembers = filtered.slice(0, state.membersLimit);
  visibleMembers.forEach(member => {
    const card = document.createElement('article');
    card.className = 'member-card';
    const genColor = getGenerationColor(member.generation);
    card.style.setProperty('--cohort-color', genColor);
    
    const avatarBg = member.avatarColor || '#B30838';
    const tagsHtml = (member.tags || []).map(tag => `<span class="card-tag">#${escapeHtml(tag)}</span>`).join('');

    const snsOnlyIconsHtml = getSnsLinksCardHtml(member.snsLinks);

    card.innerHTML = `
      <div class="card-banner"></div>
      <div class="card-avatar" style="background-color: ${avatarBg};">
        ${member.avatarImage ? `<img src="${member.avatarImage}" alt="${escapeHtml(member.name)}">` : member.name[0]}
      </div>
      <div class="card-body">
        <div class="card-name-group">
          <div class="card-name-row">
            <h4 class="card-name">${escapeHtml(member.name)}</h4>
            ${member.generation ? `<span class="gen-badge">${member.generation}기</span>` : ''}
          </div>
          <span class="card-class">
            ${member.degreeProcess ? `${member.degreeProcess} 과정` : ''} / ${escapeHtml(member.classYear)}
          </span>
        </div>
        <p class="card-headline">${escapeHtml(member.headline)}</p>
        <div class="card-tags">
          ${tagsHtml}
        </div>
      </div>
      <div class="card-footer" style="display:flex; flex-direction:column; gap:0.4rem;">
        ${member.email ? `
          <div class="card-email-row">
            <span class="email-text" title="${escapeHtml(member.email)}">${escapeHtml(member.email)}</span>
            <button class="copy-email-btn" data-email="${escapeHtml(member.email)}" title="이메일 복사"><i class="fa-regular fa-copy"></i></button>
          </div>
        ` : ''}
        <div class="card-contacts" style="display:flex; justify-content:center; gap:0.5rem; ${member.email ? '' : 'border-top:1px solid var(--color-border); padding-top:0.4rem;'}">
          ${snsOnlyIconsHtml}
        </div>
        <button class="btn-view-profile" data-id="${member.id}">상세 프로필 보기</button>
      </div>
    `;

    // 이메일 클립보드 복사 이벤트
    card.querySelectorAll('.copy-email-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = e.currentTarget.getAttribute('data-email');
        navigator.clipboard.writeText(email).then(() => {
          alert(`이메일 주소(${email})가 클립보드에 복사되었습니다.`);
        });
      });
    });

    // 상세 보기 버튼 클릭
    card.querySelector('.btn-view-profile').addEventListener('click', () => {
      openProfileModal(member.id);
    });

    // 카드 전체 클릭으로도 상세 모달 열기 (모바일 대응)
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // 카드 내부 인터랙티브 요소 클릭 시에는 무시
      if (e.target.closest('.copy-email-btn, .contact-icon, .btn-view-profile, a')) return;
      openProfileModal(member.id);
    });

    gridContainer.appendChild(card);
  });
}

// 사이드바 인기 해시태그 목록 렌더링
function renderFilterTags() {
  const container = document.getElementById('filterTagsList');
  container.innerHTML = "";

  const allTagsMap = {};
  state.members
    .filter(m => m.id !== 'admin')
    .filter(member => {
      if (state.selectedGeneration && String(member.generation) !== state.selectedGeneration) {
        return false;
      }
      return true;
    })
    .forEach(member => {
      if (member.tags && Array.isArray(member.tags)) {
        member.tags.forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            allTagsMap[trimmed] = (allTagsMap[trimmed] || 0) + 1;
          }
        });
      }
    });

  const sortedTags = Object.keys(allTagsMap).sort((a, b) => allTagsMap[b] - allTagsMap[a]);

  let filteredTags = sortedTags;
  if (state.tagSearchTerm) {
    filteredTags = sortedTags.filter(tag => tag.toLowerCase().includes(state.tagSearchTerm));
  }

  if (filteredTags.length === 0) {
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--color-text-dim); padding: 0.5rem 0;">검색 결과가 없습니다.</span>`;
    return;
  }

  filteredTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = `btn-tag ${state.selectedTag.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`;
    btn.innerHTML = `#${escapeHtml(tag)} <span style="opacity:0.6;font-size:0.65rem;">(${allTagsMap[tag]})</span>`;
    
    btn.addEventListener('click', () => {
      if (state.selectedTag.toLowerCase() === tag.toLowerCase()) {
        state.selectedTag = '';
        btn.classList.remove('active');
        document.getElementById('clearFilterBtn').classList.add('hidden');
      } else {
        state.selectedTag = tag;
        document.querySelectorAll('.btn-tag').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('clearFilterBtn').classList.remove('hidden');
      }
      renderMembersGrid(true);
    });

    container.appendChild(btn);
  });
}

// ==================== 모달 상세 뷰 및 편집 제어 ====================
function openProfileModal(memberId) {
  state.selectedMemberId = memberId;
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

  // 쪽지 보내기 버튼 제어 (자기 자신이나 비로그인 게스트인 경우는 숨김, 타인일 때 노출)
  const sendDmBtn = document.getElementById('btnProfileSendDm');
  if (sendDmBtn) {
    if (state.currentUser && !state.currentUser.isGuest && state.currentUser.id !== memberId) {
      sendDmBtn.style.display = 'inline-block';
    } else {
      sendDmBtn.style.display = 'none';
    }
  }

  // 운영진 여부에 따라 기본 학적 정보 수정 필드 노출 토글
  const adminFieldsEl = document.getElementById('editAdminOnlyFields');
  if (adminFieldsEl) {
    if (state.isAdmin) {
      adminFieldsEl.classList.remove('hidden');
    } else {
      adminFieldsEl.classList.add('hidden');
    }
  }

  // 1. 조회 모드 데이터 매핑
  const modalAvatarEl = document.getElementById('modalAvatar');
  if (member.avatarImage) {
    modalAvatarEl.innerHTML = `<img src="${member.avatarImage}" alt="${escapeHtml(member.name)}">`;
  } else {
    modalAvatarEl.innerText = member.name[0];
  }
  modalAvatarEl.style.backgroundColor = member.avatarColor || '#B30838';
  document.getElementById('modalName').innerText = member.name;
  
  const classText = `${member.generation ? `${member.generation}기 · ` : ''}${member.degreeProcess ? `${member.degreeProcess} 과정` : ''} / ${member.classYear}`;
  document.getElementById('modalClass').innerText = classText;
  
  document.getElementById('modalHeadline').innerText = member.headline;
  document.getElementById('modalBio').innerText = member.bio || "소개글이 아직 등록되지 않았습니다.";

  // 학력/경력 정보 노출 필터링
  const modalEducationSection = document.getElementById('modalEducationSection');
  const modalEducation = document.getElementById('modalEducation');
  if (member.education) {
    modalEducation.innerText = member.education;
    modalEducationSection.classList.remove('hidden');
  } else {
    modalEducation.innerText = "";
    modalEducationSection.classList.add('hidden');
  }

  const modalExperienceSection = document.getElementById('modalExperienceSection');
  const modalExperience = document.getElementById('modalExperience');
  if (member.experience) {
    modalExperience.innerText = member.experience;
    modalExperienceSection.classList.remove('hidden');
  } else {
    modalExperience.innerText = "";
    modalExperienceSection.classList.add('hidden');
  }

  const modalProjects = document.getElementById('modalProjects');
  if (member.projects) {
    modalProjects.innerHTML = parseMarkdownToHtml(member.projects);
  } else {
    modalProjects.innerHTML = "<p style='color: var(--color-text-dim); font-size: 0.85rem;'>등록된 주요 프로젝트/성과 링크 내역이 없습니다.</p>";
  }

  // 자유 기재 영역 (customContent) 바인딩
  const modalCustomContent = document.getElementById('modalCustomContent');
  const modalCustomContentSection = document.getElementById('modalCustomContentSection');
  if (member.customContent) {
    modalCustomContent.innerHTML = parseMarkdownToHtml(member.customContent);
    modalCustomContentSection.classList.remove('hidden');
  } else {
    modalCustomContent.innerHTML = "";
    modalCustomContentSection.classList.add('hidden');
  }

  const tagsContainer = document.getElementById('modalTagsContainer');
  tagsContainer.innerHTML = (member.tags || []).map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('');

  const modalEmailRow = document.getElementById('modalEmailRow');
  if (member.email) {
    const config = EMAIL_CONFIG;
    modalEmailRow.innerHTML = `
      <button class="btn btn-light btn-sm btn-sns-link email-color copy-email-btn" data-email="${escapeHtml(member.email)}" style="width: 100%; justify-content: flex-start; font-weight: 500; font-family: inherit; margin-top: 0.25rem;">
        <i class="${config.icon}"></i>
        <span style="font-family: monospace; font-size: 0.8rem; color: var(--color-text-main);">${escapeHtml(member.email)}</span>
        <span style="margin-left: auto; font-size: 0.7rem; color: var(--color-text-dim); display: inline-flex; align-items: center; gap: 0.25rem;"><i class="fa-regular fa-copy"></i> 복사</span>
      </button>
    `;
    modalEmailRow.style.display = 'flex';
    modalEmailRow.style.width = '100%';
  } else {
    modalEmailRow.innerHTML = "";
    modalEmailRow.style.display = 'none';
  }

  const contactRow = document.getElementById('modalContactRow');
  contactRow.innerHTML = "";
  if (member.snsLinks && Array.isArray(member.snsLinks)) {
    member.snsLinks.forEach(link => {
      if (!link.value || link.type === 'email') return;
      const config = SNS_TYPES[link.type] || SNS_TYPES.other;
      let url = link.value;
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      contactRow.innerHTML += `<a href="${escapeHtml(url)}" target="_blank" class="btn btn-light btn-sm btn-sns-link ${config.colorClass}"><i class="${config.icon}"></i> ${config.label}</a>`;
    });
  }

  // Bind copy email event listeners
  const modalEmailCopyBtn = modalEmailRow.querySelector('.copy-email-btn');
  if (modalEmailCopyBtn) {
    modalEmailCopyBtn.addEventListener('click', (e) => {
      const email = e.currentTarget.getAttribute('data-email');
      navigator.clipboard.writeText(email).then(() => {
        alert(`이메일 주소(${email})가 클립보드에 복사되었습니다.`);
      });
    });
  }

  // 2. 편집 권한 체크 (상세 페이지 내의 직접 수정 버튼은 완전히 제거합니다. 관리자도 운영 관리 탭에서만 수정합니다.)
  const editBtn = document.getElementById('editProfileBtn');
  if (editBtn) {
    editBtn.classList.add('hidden');
  }

  // 3. 편집 모드 양식 데이터 채워넣기 (이름, 전공, 기수, 자유기재 추가)
  document.getElementById('editName').value = member.name || "";
  document.getElementById('editClassYear').value = member.classYear || "";
  document.getElementById('editGeneration').value = member.generation || "";
  document.getElementById('editDegreeProcess').value = member.degreeProcess || "석사";
  document.getElementById('editEducation').value = member.education || "";
  document.getElementById('editExperience').value = member.experience || "";
  document.getElementById('editCustomContent').value = member.customContent || "";

  document.getElementById('editHeadline').value = member.headline || "";
  
  document.getElementById('editEmail').value = member.email || "";
  // Clone snsLinks for editing and render input area
  state.editSnsLinks = member.snsLinks ? JSON.parse(JSON.stringify(member.snsLinks)) : [];
  state.editSnsLinks = state.editSnsLinks.filter(link => link.type !== 'email');
  renderSnsLinksInputArea('editSnsLinksContainer', state.editSnsLinks);

  document.getElementById('editTags').value = member.tags ? member.tags.join(', ') : "";
  document.getElementById('editBio').value = member.bio || "";
  document.getElementById('editProjects').value = member.projects || "";

  // 4. 모달 개인 방명록 폼 기본값 및 로드
  const guestbookFormBox = document.getElementById('modalGuestbookFormBox');
  if (guestbookFormBox) {
    if (state.currentUser && state.currentUser.isGuest) {
      guestbookFormBox.classList.add('hidden');
    } else {
      guestbookFormBox.classList.remove('hidden');
    }
  }

  const modalCommentAuthorInput = document.getElementById('modalCommentAuthor');
  if (state.currentUser) {
    if (state.isSuperAdmin) {
      modalCommentAuthorInput.value = "운영진";
      modalCommentAuthorInput.disabled = true;
    } else if (state.currentUser.isGuest) {
      modalCommentAuthorInput.value = "";
      modalCommentAuthorInput.disabled = false;
    } else {
      modalCommentAuthorInput.value = state.currentUser.name;
      modalCommentAuthorInput.disabled = true;
    }
  } else {
    modalCommentAuthorInput.value = "";
    modalCommentAuthorInput.disabled = false;
  }
  document.getElementById('modalCommentMessage').value = "";
  document.getElementById('modalCommentPrivate').checked = false;

  renderPersonalGuestbook(memberId);

  // 뷰 초기화
  document.getElementById('modalViewMode').classList.remove('hidden');
  document.getElementById('modalEditMode').classList.add('hidden');

  document.getElementById('profileModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
  document.body.style.overflow = '';
  state.selectedMemberId = null;
  
  // 이미지 크롭 미리보기 리셋
  const editPreview = document.getElementById('editAvatarPreview');
  const editPreviewImg = document.getElementById('editAvatarPreviewImg');
  if (editPreview && editPreviewImg) {
    if (editPreviewImg.src && editPreviewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(editPreviewImg.src);
    }
    editPreviewImg.src = "";
    editPreview.style.display = 'none';
  }
  state.editCroppedBlob = null;
}

function enableEditMode() {
  document.getElementById('modalViewMode').classList.add('hidden');
  document.getElementById('modalEditMode').classList.remove('hidden');
  const modalContent = document.querySelector('.modal-content');
  if (modalContent) modalContent.scrollTop = 0;
}

function cancelEditing() {
  document.getElementById('modalEditMode').classList.add('hidden');
  document.getElementById('modalViewMode').classList.remove('hidden');
}

// 편집 저장 처리
async function saveProfileData(e) {
  e.preventDefault();
  
  if (!state.isAdmin) {
    alert("프로필 수정 권한이 없습니다. (운영진만 프로필 수정이 가능합니다)");
    cancelEditing();
    return;
  }
  
  const memberIndex = state.members.findIndex(m => m.id === state.selectedMemberId);
  if (memberIndex === -1) return;

  const member = state.members[memberIndex];

  // 값 추출
  const nextName = document.getElementById('editName').value.trim();
  const nextClassYear = document.getElementById('editClassYear').value.trim();
  const nextGenerationVal = document.getElementById('editGeneration').value.trim();
  const nextDegreeProcess = document.getElementById('editDegreeProcess').value;
  const nextAcademicStatus = "";
  const nextEducation = document.getElementById('editEducation').value.trim();
  const nextExperience = document.getElementById('editExperience').value.trim();
  const nextCustomContent = document.getElementById('editCustomContent').value.trim();

  const nextHeadline = document.getElementById('editHeadline').value.trim();
  
  const nextEmail = document.getElementById('editEmail').value.trim();
  if (!validateEmail(nextEmail)) {
    return; // Stop saving
  }

  // Filter out empty links
  const finalSnsLinks = state.editSnsLinks.filter(link => link.value.trim() !== "" && link.type !== 'email');
  if (!validateSnsLinks(finalSnsLinks)) {
    return; // Stop saving
  }

  const nextBio = document.getElementById('editBio').value.trim();
  const nextProjects = document.getElementById('editProjects').value.trim();

  const rawTags = document.getElementById('editTags').value;
  const nextTags = rawTags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // 유효성 검사 완화 (모든 칸 비워두기 허용)
  let nextGeneration = null;
  if (nextGenerationVal) {
    nextGeneration = parseInt(nextGenerationVal);
    if (isNaN(nextGeneration)) {
      nextGeneration = null;
    }
  }

  // 이미지 업로드 파일 수집
  let nextAvatarImage = member.avatarImage; // 기존 이미지 유지

  if (state.editCroppedBlob) {
    const file = new File([state.editCroppedBlob], `${member.id}_avatar.jpg`, { type: 'image/jpeg' });
    const uploadedUrl = await uploadAvatarImage(member.id, file);
    if (uploadedUrl) {
      nextAvatarImage = uploadedUrl;
    }
    state.editCroppedBlob = null; // 업로드 완료 후 리셋
  }

  member.name = nextName;
  member.email = nextEmail;
  member.classYear = nextClassYear;
  member.generation = nextGeneration;
  member.degreeProcess = nextDegreeProcess;
  member.academicStatus = nextAcademicStatus;
  member.education = nextEducation;
  member.experience = nextExperience;
  member.customContent = nextCustomContent;

  member.headline = nextHeadline;
  member.snsLinks = finalSnsLinks;
  member.bio = nextBio;
  member.projects = nextProjects;
  member.tags = nextTags;
  member.avatarImage = nextAvatarImage;

  state.members[memberIndex] = member;
  localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

  // Supabase 클라우드 싱크
  const isSupabaseActive = supabaseClient !== null;
  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from('members')
        .update({
          name: member.name,
          email: member.email,
          class_year: member.classYear,
          generation: member.generation,
          headline: member.headline,
          sns_links: member.snsLinks,
          tags: member.tags,
          bio: member.bio,
          projects: member.projects,
          custom_content: member.customContent,
          avatar_image: member.avatarImage,
          degree_process: member.degreeProcess,
          academic_status: member.academicStatus,
          education: member.education,
          experience: member.experience,
          role: member.role
        })
        .eq('id', member.id);

      if (error) throw error;
    } catch (err) {
      console.error("Supabase 프로필 업데이트 에러:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 보존됩니다)");
    }
  }

  // 본인 계정 정보가 바뀐 경우 세션 정보 갱신
  if (state.currentUser && state.currentUser.id === member.id) {
    state.currentUser.name = member.name;
    state.currentUser.classYear = member.classYear;
    state.currentUser.generation = member.generation;
    state.currentUser.degreeProcess = member.degreeProcess;
    state.currentUser.academicStatus = member.academicStatus;
    sessionStorage.setItem('sogang_unity_session', JSON.stringify(state.currentUser));
  }

  updateUserInfoUI();
  renderMembersGrid();
  renderFilterTags();
  renderFilterSelectorsOptions(); // 필터 목록 갱신
  
  openProfileModal(member.id);
}

// ==================== 운영진용 멤버 추가/삭제 제어 ====================
function openAddMemberModal() {
  document.getElementById('memberAddForm').reset();
  document.getElementById('addEducation').value = "";
  document.getElementById('addExperience').value = "";
  
  state.addSnsLinks = [];
  renderSnsLinksInputArea('addSnsLinksContainer', state.addSnsLinks);

  document.getElementById('memberAddModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAddMemberModal() {
  document.getElementById('memberAddModal').classList.add('hidden');
  document.body.style.overflow = '';
  
  // 이미지 크롭 미리보기 리셋
  const addPreview = document.getElementById('addAvatarPreview');
  const addPreviewImg = document.getElementById('addAvatarPreviewImg');
  if (addPreview && addPreviewImg) {
    if (addPreviewImg.src && addPreviewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(addPreviewImg.src);
    }
    addPreviewImg.src = "";
    addPreview.style.display = 'none';
  }
  state.addCroppedBlob = null;
}

// 멤버 등록 서브밋 핸들러
async function handleAddMemberSubmit(e) {
  e.preventDefault();
  
  const studentId = document.getElementById('addStudentId').value.trim();
  const phoneLast4 = document.getElementById('addPhoneLast4').value.trim();
  const name = document.getElementById('addName').value.trim();
  const generationVal = document.getElementById('addGeneration').value.trim();
  const classYear = document.getElementById('addClassYear').value.trim();
  
  const headline = "서강대 가상융합전문대학원 원우";
  const email = "";

  const finalSnsLinks = state.addSnsLinks.filter(link => link.value.trim() !== "" && link.type !== 'email');
  if (!validateSnsLinks(finalSnsLinks)) {
    return; // Stop submitting
  }

  const bio = document.getElementById('addBio').value.trim();
  const education = document.getElementById('addEducation').value.trim();
  const experience = document.getElementById('addExperience').value.trim();
  
  const rawTags = document.getElementById('addTags').value;
  const tags = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

  // 1. 학번 중복 확인
  const isDuplicate = state.members.some(m => m.studentId.toLowerCase() === studentId.toLowerCase());
  if (isDuplicate) {
    alert("이미 등록된 학번입니다. 다른 학번을 입력해 주세요.");
    return;
  }

  let generation = null;
  if (generationVal) {
    generation = parseInt(generationVal);
    if (isNaN(generation)) generation = null;
  }

  const degreeProcess = document.getElementById('addDegreeProcess').value;
  const academicStatus = "";

  // 2. 신규 멤버 객체 빌드
  const newMember = {
    id: `member_${Date.now()}`,
    studentId,
    phoneLast4,
    name,
    email,
    classYear,
    generation,
    headline,
    avatarColor: getRandomAvatarColor(),
    snsLinks: finalSnsLinks,
    tags,
    bio,
    projects: "",
    customContent: "",
    avatarImage: null,
    degreeProcess,
    academicStatus,
    education,
    experience,
    role: "member"
  };

  // 이미지 업로드 파일 수집
  if (state.addCroppedBlob) {
    const file = new File([state.addCroppedBlob], `${newMember.id}_avatar.jpg`, { type: 'image/jpeg' });
    const uploadedUrl = await uploadAvatarImage(newMember.id, file);
    if (uploadedUrl) {
      newMember.avatarImage = uploadedUrl;
    }
    state.addCroppedBlob = null; // 리셋
  }

  // 3. 상태 추가 및 저장
  state.members.push(newMember);
  localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

  // Supabase 클라우드 싱크
  const isSupabaseActive = supabaseClient !== null;
  if (isSupabaseActive) {
    try {
      const { error } = await supabaseClient
        .from('members')
        .insert([{
          id: newMember.id,
          student_id: newMember.studentId,
          phone_last4: newMember.phoneLast4,
          name: newMember.name,
          class_year: newMember.classYear,
          generation: newMember.generation,
          headline: newMember.headline,
          avatar_color: newMember.avatarColor,
          sns_links: newMember.snsLinks,
          tags: newMember.tags,
          bio: newMember.bio,
          projects: newMember.projects,
          custom_content: newMember.customContent,
          avatar_image: newMember.avatarImage,
          degree_process: newMember.degreeProcess,
          academic_status: newMember.academicStatus,
          education: newMember.education,
          experience: newMember.experience,
          role: newMember.role
        }]);

      if (error) throw error;
    } catch (err) {
      console.error("Supabase 멤버 추가 에러:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 저장됩니다)");
    }
  }

  // 4. 모달 닫기 및 갱신
  closeAddMemberModal();
  renderFilterSelectorsOptions();
  renderMembersGrid();
  renderFilterTags();
  renderAdminDashboard();

  alert(`${name} 님이 디렉토리의 ${generation}기 구성원으로 성공적으로 추가되었습니다.`);
}

// 멤버 삭제 처리 핸들러 (Soft Delete: 휴지통 이동)
async function handleDeleteMember(memberId, name) {
  if (confirm(`정말로 [${name}] 원우 정보를 휴지통으로 이동하시겠습니까?\n이동 시 일반 목록에서 제외되며 로그인이 차단됩니다.`)) {
    const member = state.members.find(m => m.id === memberId);
    const nowIso = new Date().toISOString();
    if (member) {
      member.role = 'deleted';
      member.deletedAt = nowIso;
      localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
    }
    
    // Supabase 클라우드 싱크
    const isSupabaseActive = supabaseClient !== null;
    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from('members')
          .update({ role: 'deleted', deleted_at: nowIso })
          .eq('id', memberId);

        if (error) {
          const { error: retryError } = await supabaseClient
            .from('members')
            .update({ role: 'deleted' })
            .eq('id', memberId);
          if (retryError) throw retryError;
        }
      } catch (err) {
        console.error("Supabase 멤버 휴지통 이동 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    }

    renderFilterSelectorsOptions();
    renderMembersGrid();
    renderFilterTags();
    renderAdminDashboard();

    alert(`원우 [${name}] 정보가 휴지통으로 이동되었습니다.`);
  }
}

// 멤버 복구 처리 핸들러
async function handleRestoreMember(memberId, name) {
  if (confirm(`[${name}] 원우 정보를 활성 회원으로 복구하시겠습니까?`)) {
    const member = state.members.find(m => m.id === memberId);
    if (member) {
      member.role = 'member'; // 복구 시 기본 member 권한 설정
      member.deletedAt = null;
      localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
    }
    
    // Supabase 클라우드 싱크
    const isSupabaseActive = supabaseClient !== null;
    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from('members')
          .update({ role: 'member', deleted_at: null })
          .eq('id', memberId);

        if (error) {
          const { error: retryError } = await supabaseClient
            .from('members')
            .update({ role: 'member' })
            .eq('id', memberId);
          if (retryError) throw retryError;
        }
      } catch (err) {
        console.error("Supabase 멤버 복구 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    }

    renderFilterSelectorsOptions();
    renderMembersGrid();
    renderFilterTags();
    renderAdminDashboard();

    alert(`원우 [${name}] 정보가 복구되었습니다.`);
  }
}

// 멤버 영구 삭제 처리 핸들러
async function handleDeleteMemberPermanent(memberId, name) {
  if (confirm(`정말로 [${name}] 원우 정보를 완전히 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 데이터가 안전하게 파기됩니다.`)) {
    state.members = state.members.filter(m => m.id !== memberId);
    localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
    
    // Supabase 클라우드 싱크
    const isSupabaseActive = supabaseClient !== null;
    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from('members')
          .delete()
          .eq('id', memberId);

        if (error) throw error;
      } catch (err) {
        console.error("Supabase 멤버 영구 삭제 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    }

    renderFilterSelectorsOptions();
    renderMembersGrid();
    renderFilterTags();
    renderAdminDashboard();

    alert(`원우 [${name}] 정보가 영구히 파기되었습니다.`);
  }
}

function renderPersonalGuestbook(memberId) {
  const container = document.getElementById('modalCommentsList');
  if (!container) return;
  container.innerHTML = "";

  // 이 멤버에게 달린 방명록만 필터링
  const comments = state.guestbook.filter(log => log.targetMemberId === memberId);
  document.getElementById('modalCommentCount').innerText = `로그 ${comments.length}개`;

  const reversedLogs = [...comments].reverse();

  reversedLogs.forEach(log => {
    const card = document.createElement('div');
    
    // 비공개 메시지 권한 체크
    // 카드 주인(memberId가 currentUser.id와 같음), 글 작성자(log.author가 currentUser.name과 같음), 또는 운영진(isAdmin)
    const isOwner = state.currentUser && state.currentUser.id === memberId;
    const isAuthor = state.currentUser && state.currentUser.name === log.author;
    const isAuthorized = isOwner || isAuthor || state.isAdmin;

    let canDelete = state.currentUser && (state.isAdmin || isOwner || isAuthor);

    let messageBody = escapeHtml(log.message);

    if (log.isPrivate) {
      card.className = 'comment-card private-message';
      
      if (isAuthorized) {
        card.classList.add('authorized');
        messageBody = `<span class="masked-text" style="color: var(--color-sogang);"><i class="fa-solid fa-lock-open"></i> [나만 보기]</span><br>${messageBody}`;
      } else {
        messageBody = `<span class="masked-text"><i class="fa-solid fa-lock"></i> 비공개 메시지입니다. (카드 주인과 작성자만 열람 가능)</span>`;
      }
    } else {
      card.className = 'comment-card';
    }

    card.innerHTML = `
      <div class="comment-header" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
        <div class="comment-meta" style="display:flex; align-items:center; gap:0.4rem;">
          <span class="comment-name" style="font-weight:700;"><i class="fa-solid fa-circle-user"></i> ${escapeHtml(log.author)}</span>
          ${log.isPrivate ? `<span class="comment-badge-tag private">🔒 비공개</span>` : ''}
        </div>
        <span class="comment-time" style="color: var(--color-text-dim); font-size:0.68rem;">${log.timestamp}</span>
      </div>
      <p class="comment-body" style="font-size:0.78rem; line-height:1.4; margin-top:0.3rem; white-space:pre-wrap;">${messageBody}</p>
      <div class="comment-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; padding-top:0.3rem; border-top:1px solid var(--color-border);">
        <button class="comment-btn like-btn" data-id="${log.id}" style="background:transparent; border:none; cursor:pointer; font-size:0.7rem; color:var(--color-text-sub); display:inline-flex; align-items:center; gap:0.2rem;">
          <i class="fa-regular fa-thumbs-up"></i> 추천 <span>(${log.likes || 0})</span>
        </button>
        ${canDelete ? `
          <button class="comment-btn comment-delete-btn" data-id="${log.id}" title="방명록 삭제" style="background:transparent; border:none; cursor:pointer; font-size:0.7rem; color:var(--color-text-dim); display:inline-flex; align-items:center; gap:0.2rem;">
            <i class="fa-regular fa-trash-can"></i> 삭제
          </button>
        ` : ''}
      </div>
    `;

    card.querySelector('.like-btn').addEventListener('click', () => {
      likePersonalComment(log.id, memberId);
    });

    if (canDelete) {
      card.querySelector('.comment-delete-btn').addEventListener('click', () => {
        deletePersonalComment(log.id, memberId);
      });
    }

    container.appendChild(card);
  });
}

async function handleModalCommentSubmit(e) {
  e.preventDefault();
  const authorInput = document.getElementById('modalCommentAuthor');
  const messageInput = document.getElementById('modalCommentMessage');
  const privateInput = document.getElementById('modalCommentPrivate');

  const author = authorInput.value.trim();
  const message = messageInput.value.trim();
  const tag = 'general';
  const isPrivate = privateInput.checked;
  const targetMemberId = state.selectedMemberId;

  if (!author || !message || !targetMemberId) return;

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const newLog = {
    id: `log_${Date.now()}`,
    targetMemberId,
    author,
    message,
    tag,
    isPrivate,
    timestamp,
    likes: 0
  };

  state.guestbook.push(newLog);
  localStorage.setItem('sogang_unity_guestbook', JSON.stringify(state.guestbook));

  // Supabase 클라우드 싱크
  const isSupabaseActive = supabaseClient !== null;
  if (isSupabaseActive) {
    try {
      const { data, error } = await supabaseClient
        .from('guestbook')
        .insert([{
          target_member_id: targetMemberId,
          author,
          message,
          tag,
          is_private: isPrivate,
          timestamp,
          likes: 0
        }])
        .select();

      if (error) throw error;
      
      // 방명록 ID 갱신을 위해 전체 동기화 실행
      await syncWithSupabase();
    } catch (err) {
      console.error("Supabase 방명록 추가 에러:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 저장됩니다)");
    }
  }

  // 게스트 최초 이름 작성 시 세션명 변경 적용
  if (state.currentUser && state.currentUser.isGuest && !state.currentUser.name) {
    state.currentUser.name = author;
    sessionStorage.setItem('sogang_unity_session', JSON.stringify(state.currentUser));
    updateUserInfoUI();
  }

  // 메시지 폼 비우기
  messageInput.value = "";
  privateInput.checked = false;

  renderPersonalGuestbook(targetMemberId);
  
  // 알림 갱신
  updateNotifications();
}

async function likePersonalComment(id, memberId) {
  let likedList = [];
  try {
    const stored = localStorage.getItem('sogang_unity_liked_comments');
    if (stored) {
      likedList = JSON.parse(stored);
    }
  } catch (e) {
    console.error("추천 리스트 로드 오류:", e);
  }

  if (likedList.includes(id)) {
    alert("이미 이 방명록 글을 추천하셨습니다.");
    return;
  }

  const idx = state.guestbook.findIndex(log => log.id === id);
  if (idx !== -1) {
    state.guestbook[idx].likes = (state.guestbook[idx].likes || 0) + 1;
    localStorage.setItem('sogang_unity_guestbook', JSON.stringify(state.guestbook));
    
    likedList.push(id);
    localStorage.setItem('sogang_unity_liked_comments', JSON.stringify(likedList));
    
    // Supabase 클라우드 싱크
    const isSupabaseActive = supabaseClient !== null;
    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from('guestbook')
          .update({ likes: state.guestbook[idx].likes })
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error("Supabase 추천 에러:", err);
      }
    }

    renderPersonalGuestbook(memberId);
  }
}

async function deletePersonalComment(id, memberId) {
  if (confirm("이 방명록 글을 삭제하시겠습니까?")) {
    state.guestbook = state.guestbook.filter(log => log.id !== id);
    localStorage.setItem('sogang_unity_guestbook', JSON.stringify(state.guestbook));
    
    // Supabase 클라우드 싱크
    const isSupabaseActive = supabaseClient !== null;
    if (isSupabaseActive) {
      try {
        const { error } = await supabaseClient
          .from('guestbook')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.error("Supabase 방명록 삭제 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    }

    renderPersonalGuestbook(memberId);
  }
}

// HTML 엔티티 이스케이프 (보안 처리)
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== 엑셀 일괄 등록 제어 파트 ====================

// 엑셀 일괄 등록 모달 열기
function openExcelUploadModal() {
  document.getElementById('excelFileInput').value = "";
  document.getElementById('excelPreviewSection').classList.add('hidden');
  document.getElementById('excelConflictControls').classList.add('hidden');
  document.getElementById('btnSubmitExcel').disabled = true;
  
  const tbody = document.getElementById('excelPreviewTableBody');
  if (tbody) tbody.innerHTML = "";

  const statusText = document.getElementById('excelConflictStatusText');
  if (statusText) {
    statusText.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--color-text-dim);"></i> 파일을 업로드하면 정밀 진단이 시작됩니다.`;
    statusText.style.color = "var(--color-text-sub)";
  }

  document.getElementById('excelUploadModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// 엑셀 일괄 등록 모달 닫기
function closeExcelUploadModal() {
  document.getElementById('excelUploadModal').classList.add('hidden');
  document.body.style.overflow = '';
  state.excelParsedData = [];
  state.excelConflictsCount = 0;
  state.excelConflictsResolvedCount = 0;
}

// 템플릿 엑셀 파일 동적 생성 및 다운로드 (SheetJS 사용)
function downloadExcelTemplate() {
  try {
    // 1. 데이터 배열 구성 (헤더 및 샘플 데이터)
    const header = [
      "학번 (필수)",
      "이름 (필수)",
      "기수 (숫자)",
      "소속전공",
      "학위과정",
      "비밀번호 뒷자리 (4자리 필수)"
    ];
    
    const sampleRow = [
      "v2026113",
      "홍길동",
      10,
      "메타버스 전공",
      "석사",
      "1234"
    ];

    const data = [header, sampleRow];

    // 2. 워크북 및 워크시트 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 3. 열 너비 자동 조절 (옵션)
    ws['!cols'] = [
      { wch: 15 }, // 학번
      { wch: 10 }, // 이름
      { wch: 10 }, // 기수
      { wch: 20 }, // 전공
      { wch: 12 }, // 과정
      { wch: 28 }  // 비밀번호 뒷자리
    ];

    // 4. 워크시트를 워크북에 주입
    XLSX.utils.book_append_sheet(wb, ws, "원우_일괄등록_양식");

    // 5. 파일 내보내기 (.xlsx)
    XLSX.writeFile(wb, "Sogang_GSM_Connect_Template.xlsx");
  } catch (err) {
    console.error("엑셀 템플릿 생성 실패:", err);
    alert("엑셀 템플릿 다운로드 중 에러가 발생했습니다.");
  }
}

// 엑셀 파일 선택 핸들러
function handleExcelFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // 첫 번째 시트 조회
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // JSON 객체 배열로 변환 (헤더는 1행)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length <= 1) {
        alert("엑셀 파일 내에 원우 데이터가 존재하지 않습니다.");
        return;
      }

      // 파싱된 행 가공
      const rows = [];
      const headers = jsonData[0]; // 0번째 행은 헤더
      
      for (let i = 1; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        if (rowData.length === 0 || !rowData[0]) continue; // 학번이 비어있으면 스킵
        
        rows.push({
          studentId: String(rowData[0]).trim(),
          name: String(rowData[1] || "").trim(),
          generation: rowData[2] ? parseInt(rowData[2]) : null,
          classYear: String(rowData[3] || "").trim(),
          degreeProcess: String(rowData[4] || "").trim(),
          phoneLast4: String(rowData[5] || "").trim(),
          headline: "서강대 가상융합전문대학원 원우", // 한줄소개 제거에 따른 기본값
          email: "" // 이메일 제거에 따른 기본값
        });
      }

      if (rows.length === 0) {
        alert("유효한 원우 데이터가 없습니다. 필수 항목(학번)을 확인해 주세요.");
        return;
      }

      handleExcelParsedData(rows);
    } catch (err) {
      console.error("엑셀 파일 해석 오류:", err);
      alert("엑셀 파일 해석 중 에러가 발생했습니다. 공식 템플릿 파일 형식을 유지해 주세요.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// 엑셀 파싱 결과 진단 및 미리보기 렌더링
function handleExcelParsedData(rows) {
  state.excelParsedData = rows;
  state.excelConflictsCount = 0;
  state.excelConflictsResolvedCount = 0;

  const tbody = document.getElementById('excelPreviewTableBody');
  if (!tbody) return;
  tbody.innerHTML = "";

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    
    // 중복 여부 확인
    const isDuplicate = state.members.some(m => m.studentId.toLowerCase() === row.studentId.toLowerCase());
    
    let statusHtml = "";
    if (isDuplicate) {
      state.excelConflictsCount++;
      tr.className = "conflict-row";
      statusHtml = `
        <div style="display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start;">
          <span class="conflict-badge"><i class="fa-solid fa-circle-exclamation"></i> 학번 중복</span>
          <div class="conflict-options">
            <label>
              <input type="radio" name="conflict_${index}" value="overwrite" class="conflict-radio-btn" data-index="${index}">
              덮어쓰기
            </label>
            <label>
              <input type="radio" name="conflict_${index}" value="skip" class="conflict-radio-btn" data-index="${index}">
              건너뛰기
            </label>
          </div>
        </div>
      `;
    } else {
      statusHtml = `<span class="success-badge"><i class="fa-solid fa-circle-check"></i> 등록 가능</span>`;
    }

    tr.innerHTML = `
      <td style="font-family: monospace; font-weight: 600;">${escapeHtml(row.studentId)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.generation ? `${row.generation}기` : "-"}</td>
      <td>${escapeHtml(row.classYear)}</td>
      <td>${escapeHtml(row.degreeProcess)}</td>
      <td style="font-family: monospace;">${row.phoneLast4 ? "****" : ""}</td>
      <td>${statusHtml}</td>
    `;

    // 라디오 버튼 변경 이벤트 바인딩
    if (isDuplicate) {
      tr.querySelectorAll(`.conflict-radio-btn`).forEach(radio => {
        radio.addEventListener('change', () => {
          row.conflictAction = radio.value;
          validateConflictResolution();
        });
      });
    }

    tbody.appendChild(tr);
  });

  // UI 상태 갱신
  document.getElementById('excelPreviewSection').classList.remove('hidden');
  
  const conflictControls = document.getElementById('excelConflictControls');
  if (state.excelConflictsCount > 0) {
    conflictControls.classList.remove('hidden');
  } else {
    conflictControls.classList.add('hidden');
  }

  validateConflictResolution();
}

// 충돌 일괄 적용 처리
function applyAllConflictsAction(action) {
  state.excelParsedData.forEach((row, index) => {
    // 중복된 경우에만 설정
    const isDuplicate = state.members.some(m => m.studentId.toLowerCase() === row.studentId.toLowerCase());
    if (isDuplicate) {
      row.conflictAction = action;
      
      const radios = document.getElementsByName(`conflict_${index}`);
      radios.forEach(radio => {
        if (radio.value === action) {
          radio.checked = true;
        }
      });
    }
  });

  validateConflictResolution();
}

// 충돌 해결 상태 유효성 확인 (안전 잠금 관리)
function validateConflictResolution() {
  let resolvedCount = 0;
  
  state.excelParsedData.forEach(row => {
    const isDuplicate = state.members.some(m => m.studentId.toLowerCase() === row.studentId.toLowerCase());
    if (isDuplicate && row.conflictAction) {
      resolvedCount++;
    }
  });

  state.excelConflictsResolvedCount = resolvedCount;

  const statusText = document.getElementById('excelConflictStatusText');
  const btnSubmit = document.getElementById('btnSubmitExcel');

  if (state.excelConflictsCount > 0) {
    if (resolvedCount < state.excelConflictsCount) {
      statusText.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> 중복 충돌 항목 ${state.excelConflictsCount}개 중 ${resolvedCount}개 해결됨 (미해결 ${state.excelConflictsCount - resolvedCount}개)`;
      statusText.style.color = "#856404";
      btnSubmit.disabled = true;
    } else {
      statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> 모든 충돌이 완벽하게 해결되었습니다. (${state.excelConflictsCount}개 해결 완료)`;
      statusText.style.color = "#107c41";
      btnSubmit.disabled = false;
    }
  } else {
    statusText.innerHTML = `<i class="fa-solid fa-circle-check"></i> 등록 가능한 신규 원우 데이터 ${state.excelParsedData.length}건이 감지되었습니다.`;
    statusText.style.color = "#107c41";
    btnSubmit.disabled = false;
  }
}

// 최종 일괄 엑셀 데이터 등록 프로세스 수행
async function submitExcelData() {
  const btnSubmit = document.getElementById('btnSubmitExcel');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 등록 중...`;

  let newMembersCount = 0;
  let updatedMembersCount = 0;
  let skippedMembersCount = 0;

  const toInsertList = [];
  const toUpdateList = [];

  for (let i = 0; i < state.excelParsedData.length; i++) {
    const row = state.excelParsedData[i];
    
    // 필수 필드 결여 가드
    if (!row.studentId || !row.name || !row.phoneLast4) {
      skippedMembersCount++;
      continue;
    }

    const matchedIdx = state.members.findIndex(m => m.studentId.toLowerCase() === row.studentId.toLowerCase());
    const isDuplicate = matchedIdx !== -1;

    if (isDuplicate) {
      if (row.conflictAction === "overwrite") {
        // 기존 멤버 정보 업데이트
        const targetMember = state.members[matchedIdx];
        targetMember.name = row.name;
        targetMember.generation = row.generation;
        targetMember.classYear = row.classYear;
        targetMember.degreeProcess = row.degreeProcess;
        targetMember.phoneLast4 = row.phoneLast4;
        
        // 입력 칸이 비어있지 않으면 추가 정보도 병합
        if (row.headline) targetMember.headline = row.headline;
        if (row.email) {
          targetMember.email = row.email;
          if (targetMember.snsLinks) {
            targetMember.snsLinks = targetMember.snsLinks.filter(link => link.type !== 'email');
          }
        }

        toUpdateList.push(targetMember);
        updatedMembersCount++;
      } else {
        skippedMembersCount++;
      }
    } else {
      // 신규 등록
      const newMember = {
        id: `member_${Date.now()}_${i}`,
        studentId: row.studentId,
        phoneLast4: row.phoneLast4,
        name: row.name,
        email: row.email || "",
        classYear: row.classYear,
        generation: row.generation,
        headline: row.headline || "서강대 가상융합전문대학원 원우",
        avatarColor: getRandomAvatarColor(),
        snsLinks: [],
        tags: [],
        bio: "",
        projects: "",
        customContent: "",
        avatarImage: null,
        degreeProcess: row.degreeProcess || "석사",
        academicStatus: "",
        education: "",
        experience: "",
        role: "member"
      };

      state.members.push(newMember);
      toInsertList.push(newMember);
      newMembersCount++;
    }
  }

  // 로컬 메모리 동기화 및 스토리지 저장
  localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

  // Supabase 클라우드 싱크
  const isSupabaseActive = supabaseClient !== null;
  if (isSupabaseActive) {
    try {
      // 1. 신규 멤버 bulk insert
      if (toInsertList.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('members')
          .insert(toInsertList.map(m => ({
            id: m.id,
            student_id: m.studentId,
            phone_last4: m.phoneLast4,
            name: m.name,
            email: m.email || "",
            class_year: m.classYear,
            generation: m.generation,
            headline: m.headline,
            avatar_color: m.avatarColor,
            sns_links: m.snsLinks,
            tags: m.tags,
            bio: m.bio,
            projects: m.projects,
            custom_content: m.customContent,
            avatar_image: m.avatarImage,
            degree_process: m.degreeProcess,
            academic_status: m.academicStatus,
            education: m.education,
            experience: m.experience,
            role: m.role
          })));
        if (insertError) throw insertError;
      }

      // 2. 덮어쓴 멤버 개별/벌크 update (Supabase는 복수 업데이트가 까다로우므로 비동기 프로미스 올 처리)
      if (toUpdateList.length > 0) {
        const updatePromises = toUpdateList.map(m => 
          supabaseClient
            .from('members')
            .update({
              name: m.name,
              email: m.email || "",
              class_year: m.classYear,
              generation: m.generation,
              degree_process: m.degreeProcess,
              phone_last4: m.phoneLast4,
              headline: m.headline,
              sns_links: m.snsLinks
            })
            .eq('id', m.id)
        );
        const results = await Promise.all(updatePromises);
        const failedUpdate = results.find(res => res.error);
        if (failedUpdate) throw failedUpdate.error;
      }
    } catch (err) {
      console.error("Supabase 일괄 싱크 오류:", err);
      alert("클라우드 데이터베이스 동기화 실패 (로컬 스토리지에만 저장됩니다)");
    }
  }

  // UI 상태 갱신
  closeExcelUploadModal();
  renderFilterSelectorsOptions();
  renderMembersGrid();
  renderFilterTags();
  renderAdminDashboard();

  alert(`엑셀 일괄 등록 완료!\n- 신규 원우 등록: ${newMembersCount}명\n- 중복 정보 업데이트: ${updatedMembersCount}명\n- 건너뜀/실패: ${skippedMembersCount}명`);
}


// 전공 관리 기능 제거됨 (5.4 핫픽스: 운영진가 텍스트 인풋으로 직접 입력)

// ==================== 간이 마크다운 파서 ====================
function parseMarkdownToHtml(str) {
  if (!str) return "";
  
  // 1. 보안을 위해 먼저 HTML 이스케이프 처리
  let escaped = escapeHtml(str);
  
  // 2. 줄바꿈을 배열로 분리하여 처리
  const lines = escaped.split(/\r?\n/);
  let htmlResult = [];
  let inList = false;
  
  lines.forEach(line => {
    let trimmed = line.trim();
    
    // 소제목: ### 텍스트
    if (trimmed.startsWith("###")) {
      if (inList) {
        htmlResult.push("</ul>");
        inList = false;
      }
      const titleText = trimmed.replace(/^###\s*/, "");
      htmlResult.push(`<h5 class="markdown-title">${titleText}</h5>`);
      return;
    }
    
    // 인용구: > 텍스트
    if (trimmed.startsWith("&gt;")) {
      if (inList) {
        htmlResult.push("</ul>");
        inList = false;
      }
      const quoteText = trimmed.replace(/^&gt;\s*/, "");
      htmlResult.push(`<blockquote>${quoteText}</blockquote>`);
      return;
    }
    
    // 리스트: •, -, * 로 시작하는 줄
    const listPattern = /^([•\-*])\s*/;
    if (listPattern.test(trimmed)) {
      if (!inList) {
        htmlResult.push("<ul class='markdown-list'>");
        inList = true;
      }
      const itemText = trimmed.replace(listPattern, "");
      htmlResult.push(`<li>${itemText}</li>`);
      return;
    }
    
    // 리스트 중단 처리 (빈 줄이거나 리스트 패턴이 아닌 일반 텍스트가 올 경우)
    if (inList && trimmed === "") {
      htmlResult.push("</ul>");
      inList = false;
      return;
    }
    
    // 일반 줄바꿈 텍스트
    if (inList) {
      htmlResult.push("</ul>");
      inList = false;
    }
    
    if (trimmed !== "") {
      htmlResult.push(`<p>${trimmed}</p>`);
    } else {
      htmlResult.push("<br>");
    }
  });
  
  if (inList) {
    htmlResult.push("</ul>");
  }
  
  let finalHtml = htmlResult.join("");
  
  // 3. 인라인 서식 처리 (볼드체: **텍스트**)
  finalHtml = finalHtml.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  return `<div class="markdown-content">${finalHtml}</div>`;
}

// ==================== 새 댓글 알림(Notification) 로직 ====================
// 내 프로필에 달린 댓글 알림 갱신 및 렌더링
function updateNotifications() {
  const notifContainer = document.getElementById('notifContainer');
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  
  // 로그아웃 상태이거나 게스트 계정이면 알림 숨김
  if (!state.currentUser || state.currentUser.isGuest) {
    if (notifContainer) notifContainer.classList.add('hidden');
    return;
  }
  
  // 게스트가 아닌 정상 로그인 사용자라면 알림 노출
  if (notifContainer) notifContainer.classList.remove('hidden');
  
  // 내 카드 ID
  const myId = state.currentUser.id;
  
  // 전체 방명록 중 내 카드에 달린 글 필터링 (내가 직접 내 카드에 쓴 글은 제외하여 노이즈 방지)
  const myNotifs = state.guestbook.filter(log => 
    log.targetMemberId === myId && 
    log.author !== state.currentUser.name
  );
  
  // 마지막으로 알림창을 열어 읽은 시각 타임스탬프 로드
  const lastReadTime = localStorage.getItem('sogang_unity_last_notif_read') || '1970-01-01 00:00:00';
  
  let unreadCount = 0;
  state.notifications = myNotifs.map(log => {
    // 타임스탬프 비교로 읽음/안읽음 판단
    const isUnread = log.timestamp > lastReadTime;
    if (isUnread) unreadCount++;
    return {
      ...log,
      isUnread
    };
  }).reverse(); // 최신 댓글 순서
  
  state.unreadNotifCount = unreadCount;
  
  // 1. 배지 렌더링
  if (notifBadge) {
    if (unreadCount > 0) {
      notifBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.innerText = '0';
      notifBadge.classList.add('hidden');
    }
  }
  
  // 2. 알림 목록 렌더링
  if (!notifList) return;
  notifList.innerHTML = '';
  
  if (state.notifications.length === 0) {
    notifList.innerHTML = `
      <div class="notif-empty">
        <i class="fa-regular fa-bell-slash"></i>
        <p>아직 수신된 댓글 알림이 없습니다.</p>
      </div>
    `;
    return;
  }
  
  state.notifications.forEach(notif => {
    const item = document.createElement('div');
    item.className = `notif-item ${notif.isUnread ? 'unread' : ''}`;
    
    let previewText = notif.isPrivate ? '🔒 비공개 방명록을 남겼습니다.' : notif.message;
    if (previewText.length > 35) {
      previewText = previewText.substring(0, 35) + '...';
    }
    
    item.innerHTML = `
      <div class="notif-item-body">
        <strong>${escapeHtml(notif.author)}</strong> 님이 나에게 방명록을 남겼습니다:
        <span style="color: var(--color-text-sub); display: block; margin-top: 0.15rem; font-style: ${notif.isPrivate ? 'italic' : 'normal'};">${escapeHtml(previewText)}</span>
      </div>
      <div class="notif-item-time">${notif.timestamp}</div>
    `;
    
    // 알림 아이템 클릭 시
    item.addEventListener('click', () => {
      // 드롭다운 닫기
      const popover = document.getElementById('notifPopover');
      if (popover) popover.classList.add('hidden');
      
      // 내 프로필 모달 오픈
      openProfileModal(myId);
    });
    
    notifList.appendChild(item);
  });
}

// 알림 모두 읽음 처리 및 타임스탬프 갱신
function markNotificationsAsRead() {
  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  // 마지막 읽은 시점을 현재 시각으로 저장
  localStorage.setItem('sogang_unity_last_notif_read', nowStr);
  
  // 읽음 처리 후 알림 상태 다시 계산
  updateNotifications();
}

// ==================== 문의사항 및 건의 (Inquiry) 기능 ====================

// 문의 모달 열기
function openInquiryModal() {
  const modal = document.getElementById('inquiryModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchInquiryTab('write');

  // 작성자 기본값 채우기
  const authorInput = document.getElementById('inquiryAuthor');
  if (authorInput) {
    if (state.currentUser && !state.currentUser.isGuest) {
      authorInput.value = state.currentUser.name;
      authorInput.readOnly = true;
    } else {
      authorInput.value = "";
      authorInput.readOnly = false;
    }
  }

  // 필드 리셋
  const titleInput = document.getElementById('inquiryTitle');
  const messageInput = document.getElementById('inquiryMessage');
  if (titleInput) titleInput.value = "";
  if (messageInput) messageInput.value = "";

  // 내역 개수 표시
  updateMyInquiriesCount();
}

// 문의 모달 닫기
function closeInquiryModal() {
  const modal = document.getElementById('inquiryModal');
  if (modal) modal.classList.add('hidden');
}

// 문의 탭 전환
function switchInquiryTab(tab) {
  const tabWrite = document.getElementById('tabInquiryWrite');
  const tabList = document.getElementById('tabInquiryList');
  const viewWrite = document.getElementById('inquiryWriteView');
  const viewList = document.getElementById('inquiryListView');

  if (tab === 'write') {
    tabWrite.classList.add('active');
    tabWrite.style.borderBottom = "2px solid var(--color-sogang)";
    tabWrite.style.color = "var(--color-sogang)";
    tabWrite.style.fontWeight = "700";

    tabList.classList.remove('active');
    tabList.style.borderBottom = "none";
    tabList.style.color = "var(--color-text-sub)";
    tabList.style.fontWeight = "500";

    viewWrite.classList.remove('hidden');
    viewList.classList.add('hidden');
  } else {
    tabList.classList.add('active');
    tabList.style.borderBottom = "2px solid var(--color-sogang)";
    tabList.style.color = "var(--color-sogang)";
    tabList.style.fontWeight = "700";

    tabWrite.classList.remove('active');
    tabWrite.style.borderBottom = "none";
    tabWrite.style.color = "var(--color-text-sub)";
    tabWrite.style.fontWeight = "500";

    viewWrite.classList.add('hidden');
    viewList.classList.remove('hidden');

    renderMyInquiries();
  }
}

// 내 문의 개수 갱신
function updateMyInquiriesCount() {
  const countEl = document.getElementById('myInquiryCount');
  if (!countEl) return;
  if (!state.currentUser || state.currentUser.isGuest) {
    countEl.innerText = "0";
    return;
  }
  const myCount = state.inquiries.filter(i => i.studentId === state.currentUser.id && i.status !== 'deleted').length;
  countEl.innerText = String(myCount);
}

// 문의 전송 제출
async function handleInquirySubmit(e) {
  e.preventDefault();
  const authorInput = document.getElementById('inquiryAuthor');
  const titleInput = document.getElementById('inquiryTitle');
  const messageInput = document.getElementById('inquiryMessage');

  const author = authorInput.value.trim();
  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  const studentId = state.currentUser ? state.currentUser.id : 'guest';

  if (!author || !message) return;

  const now = new Date();
  const nowStr = now.toISOString();

  // 임시 고유 ID
  const tempId = `inq_${Date.now()}`;

  const newInq = {
    id: tempId,
    studentId,
    author,
    title,
    message,
    reply: "",
    repliedBy: "", // 답변한 운영진 초기화
    status: "pending",
    createdAt: nowStr
  };

  // 로컬 상태 추가
  state.inquiries.unshift(newInq);
  localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));

  // Supabase 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('inquiries')
        .insert([{
          student_id: studentId,
          author,
          title,
          message,
          reply: "",
          status: "pending"
        }]);
      if (error) throw error;
      await syncWithSupabase();
    } catch (err) {
      console.error("Supabase 문의 제출 에러:", err);
    }
  }

  alert("문의사항이 운영진에게 성공적으로 전달되었습니다.");
  messageInput.value = "";
  titleInput.value = "";
  
  switchInquiryTab('list');
}

// 내 문의 내역 렌더링
function renderMyInquiries() {
  const container = document.getElementById('myInquiriesContainer');
  if (!container) return;
  container.innerHTML = "";

  if (!state.currentUser || state.currentUser.isGuest) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-dim);">로그인 후 문의 내역을 조회할 수 있습니다.</div>`;
    return;
  }

  const myInqs = state.inquiries.filter(i => i.studentId === state.currentUser.id && i.status !== 'deleted');
  if (myInqs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-dim);"><i class="fa-regular fa-folder-open" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i> 아직 등록된 문의 내역이 없습니다.</div>`;
    return;
  }

  myInqs.forEach(inq => {
    const card = document.createElement('div');
    card.className = 'my-inquiry-card';

    const statusText = inq.status === 'resolved' ? '답변 완료' : '답변 대기';
    const statusClass = inq.status === 'resolved' ? 'resolved' : 'pending';
    const formattedDate = inq.createdAt ? inq.createdAt.substring(0, 10) + ' ' + inq.createdAt.substring(11, 16) : '-';

    card.innerHTML = `
      <div class="my-inquiry-header">
        <strong style="color:var(--color-text-main); font-size:0.85rem;">${escapeHtml(inq.title || "제목 없음")}</strong>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="inquiry-status-badge ${statusClass}">${statusText}</span>
          ${inq.status === 'pending' ? `<button class="btn btn-light btn-sm btn-delete-my-inquiry" data-id="${inq.id}" style="padding: 0.15rem 0.35rem; font-size: 0.7rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2); cursor: pointer;"><i class="fa-solid fa-trash-can"></i> 삭제</button>` : ''}
        </div>
      </div>
      <p style="margin: 0.2rem 0; color:var(--color-text-sub); line-height:1.4;">${escapeHtml(inq.message)}</p>
      <div style="font-size:0.7rem; color:var(--color-text-dim); text-align:right;">${formattedDate}</div>
      ${inq.reply ? `
        <div class="inquiry-reply-box">
          <strong style="color:var(--color-sogang); font-size:0.75rem;"><i class="fa-solid fa-reply"></i> 운영진 답변</strong>
          <p style="margin-top:0.25rem; font-size:0.8rem; line-height:1.4; color:var(--color-text-main); white-space:pre-wrap;">${escapeHtml(inq.reply)}</p>
        </div>
      ` : ''}
    `;

    const delBtn = card.querySelector('.btn-delete-my-inquiry');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        handleUserDeleteInquiry(inq.id);
      });
    }

    container.appendChild(card);
  });
}

// 사용자 본인 문의 삭제 처리 핸들러 (답변 대기 상태 - Soft Delete: 휴지통 이동)
async function handleUserDeleteInquiry(inquiryId) {
  if (confirm("정말로 이 문의사항을 삭제하시겠습니까?")) {
    const inquiry = state.inquiries.find(i => i.id === inquiryId);
    const nowIso = new Date().toISOString();
    if (inquiry) {
      inquiry.status = 'deleted';
      inquiry.deleted_at = nowIso;
      localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));
    }

    if (supabaseClient) {
      try {
        // Try with deleted_at column
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status: 'deleted', deleted_at: nowIso })
          .eq('id', inquiryId);
        
        if (error) {
          // Fallback retry if deleted_at column is missing
          const { error: retryError } = await supabaseClient
            .from('inquiries')
            .update({ status: 'deleted' })
            .eq('id', inquiryId);
          if (retryError) throw retryError;
        }
        alert("문의사항이 정상적으로 삭제되었습니다.");
      } catch (err) {
        console.error("Supabase 문의사항 삭제 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    } else {
      alert("문의사항이 삭제되었습니다.");
    }
    renderMyInquiries();
  }
}

// ==================== 비밀번호 변경 (Change Password) 기능 ====================

// 비밀번호 변경 모달 열기
function openChangePwModal() {
  const modal = document.getElementById('changePwModal');
  if (modal) modal.classList.remove('hidden');

  // 인풋 초기화
  const curEl = document.getElementById('currentPw');
  const newEl = document.getElementById('newPw');
  const confirmEl = document.getElementById('newPwConfirm');
  const errEl = document.getElementById('changePwError');

  if (curEl) curEl.value = "";
  if (newEl) newEl.value = "";
  if (confirmEl) confirmEl.value = "";
  if (errEl) errEl.classList.add('hidden');
}

// 비밀번호 변경 모달 닫기
function closeChangePwModal() {
  const modal = document.getElementById('changePwModal');
  if (modal) modal.classList.add('hidden');
}

// 비밀번호 변경 서브밋
async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const currentPw = document.getElementById('currentPw').value.trim();
  const newPw = document.getElementById('newPw').value.trim();
  const newPwConfirm = document.getElementById('newPwConfirm').value.trim();
  const errEl = document.getElementById('changePwError');

  if (!state.currentUser || state.currentUser.isGuest) return;

  // 1. 유효성 검사: 비밀번호는 최소 4글자 이상이어야 합니다.
  if (newPw.length < 4) {
    showPwError("새 비밀번호는 최소 4글자 이상이어야 합니다.");
    return;
  }

  // 2. 일치 검사
  if (newPw !== newPwConfirm) {
    showPwError("새 비밀번호 확인이 일치하지 않습니다.");
    return;
  }

  // 3. 현재 비밀번호 검증
  // 로컬 members에서 나의 비밀번호와 같은지 대조
  const myMember = state.members.find(m => m.id === state.currentUser.id);
  if (!myMember || myMember.phoneLast4 !== currentPw) {
    showPwError("현재 비밀번호가 정확하지 않습니다.");
    return;
  }

  // 4. 비밀번호 업데이트 진행
  myMember.phoneLast4 = newPw;
  localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('members')
        .update({ phone_last4: newPw })
        .eq('id', state.currentUser.id);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase 비밀번호 변경 서버 동기화 실패:", err);
    }
  }

  alert("비밀번호가 안전하게 변경되었습니다. 다음 로그인부터 적용됩니다.");
  closeChangePwModal();
}

function showPwError(msg) {
  const errEl = document.getElementById('changePwError');
  if (errEl) {
    errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
    errEl.classList.remove('hidden');
  }
}

// ==================== 관리자 비밀번호 초기화 기능 ====================
async function resetMemberPassword(memberId, memberName) {
  const confirmed = confirm(`정말로 [${memberName}] 원우의 비밀번호를 초기화하시겠습니까?\n\n초기화 시 기본 비밀번호 [1234] (으)로 리셋됩니다.`);
  if (!confirmed) return;

  const resetPw = "1234"; // 기본 비밀번호 1234로 초기화

  // 로컬 상태 변경
  const targetMember = state.members.find(m => m.id === memberId);
  if (targetMember) {
    targetMember.phoneLast4 = resetPw;
    localStorage.setItem('sogang_unity_members', JSON.stringify(state.members));
  }

  // Supabase 클라우드 적용
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('members')
        .update({ phone_last4: resetPw })
        .eq('id', memberId);
      if (error) throw error;
      alert(`[${memberName}] 원우의 비밀번호가 가입 시 전화번호 뒷자리 [${resetPw}] (으)로 성공적으로 초기화되었습니다.`);
    } catch (err) {
      console.error("Supabase 비밀번호 초기화 서버 전송 실패:", err);
      alert("서버 연결 실패로 인해 로컬에서만 초기화되었습니다.");
    }
  }
}

// ==================== 어드민 대시보드 내 문의 탭 및 답변 처리 ====================

// 어드민 탭 스위치
function switchAdminActiveTab(tab) {
  state.adminActiveTab = tab;
  const tabMembers = document.getElementById('adminTabMembers');
  const tabInquiries = document.getElementById('adminTabInquiries');
  const tabQuickLinks = document.getElementById('adminTabQuickLinks');
  
  const secMembers = document.getElementById('adminMembersSection');
  const secInquiries = document.getElementById('adminInquirySection');
  const secQuickLinks = document.getElementById('adminQuickLinksSection');

  if (tabMembers) tabMembers.classList.remove('active-tab');
  if (tabInquiries) tabInquiries.classList.remove('active-tab');
  if (tabQuickLinks) tabQuickLinks.classList.remove('active-tab');

  if (secMembers) secMembers.classList.add('hidden');
  if (secInquiries) secInquiries.classList.add('hidden');
  if (secQuickLinks) secQuickLinks.classList.add('hidden');

  if (tab === 'members') {
    if (tabMembers) tabMembers.classList.add('active-tab');
    if (secMembers) secMembers.classList.remove('hidden');
    renderAdminDashboard();
  } else if (tab === 'inquiries') {
    if (tabInquiries) tabInquiries.classList.add('active-tab');
    if (secInquiries) secInquiries.classList.remove('hidden');
    renderAdminInquiries();
  } else if (tab === 'quick_links') {
    if (tabQuickLinks) tabQuickLinks.classList.add('active-tab');
    if (secQuickLinks) secQuickLinks.classList.remove('hidden');
    renderAdminQuickLinks();
  }
}

function switchAdminMemberSubTab(subTab) {
  state.adminMemberSubTab = subTab;
  const btnActive = document.getElementById('adminMemTabActive');
  const btnTrash = document.getElementById('adminMemTabTrash');
  if (!btnActive || !btnTrash) return;

  if (subTab === 'active') {
    btnActive.style.borderBottom = '3px solid var(--color-sogang)';
    btnActive.style.fontWeight = '700';
    btnActive.style.color = 'var(--color-sogang)';
    btnTrash.style.borderBottom = 'none';
    btnTrash.style.fontWeight = '500';
    btnTrash.style.color = 'var(--color-text-sub)';
  } else {
    btnTrash.style.borderBottom = '3px solid var(--color-sogang)';
    btnTrash.style.fontWeight = '700';
    btnTrash.style.color = 'var(--color-sogang)';
    btnActive.style.borderBottom = 'none';
    btnActive.style.fontWeight = '500';
    btnActive.style.color = 'var(--color-text-sub)';
  }
  renderAdminDashboard();
}

function switchAdminInquirySubTab(subTab) {
  state.adminInquirySubTab = subTab;
  const btnActive = document.getElementById('adminInqTabActive');
  const btnTrash = document.getElementById('adminInqTabTrash');
  if (!btnActive || !btnTrash) return;

  if (subTab === 'active') {
    btnActive.style.borderBottom = '3px solid var(--color-sogang)';
    btnActive.style.fontWeight = '700';
    btnActive.style.color = 'var(--color-sogang)';
    btnTrash.style.borderBottom = 'none';
    btnTrash.style.fontWeight = '500';
    btnTrash.style.color = 'var(--color-text-sub)';
  } else {
    btnTrash.style.borderBottom = '3px solid var(--color-sogang)';
    btnTrash.style.fontWeight = '700';
    btnTrash.style.color = 'var(--color-sogang)';
    btnActive.style.borderBottom = 'none';
    btnActive.style.fontWeight = '500';
    btnActive.style.color = 'var(--color-text-sub)';
  }
  renderAdminInquiries();
}

// 어드민 문의 목록 렌더링
function renderAdminInquiries() {
  const tbody = document.getElementById('adminInquiryTableBody');
  
  // 1. 활성/휴지통 필터링 및 카운팅
  const activeInquiries = state.inquiries.filter(i => i.status !== 'deleted');
  const trashInquiries = state.inquiries.filter(i => i.status === 'deleted');

  const mainCountEl = document.getElementById('adminInquiryCount');
  const activeCountEl = document.getElementById('adminActiveInqCount');
  const trashCountEl = document.getElementById('adminTrashInqCount');

  if (mainCountEl) mainCountEl.innerText = String(activeInquiries.length);
  if (activeCountEl) activeCountEl.innerText = String(activeInquiries.length);
  if (trashCountEl) trashCountEl.innerText = String(trashInquiries.length);

  if (!tbody) return;
  tbody.innerHTML = "";

  // 현재 서브탭에 따라 렌더링 소스 결정
  const listToRender = (state.adminInquirySubTab === 'trash') ? trashInquiries : activeInquiries;

  if (listToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--color-text-dim); padding: 3rem;">
          <i class="fa-regular fa-envelope-open" style="font-size:2rem; display:block; margin-bottom:0.5rem;"></i>
          ${state.adminInquirySubTab === 'trash' ? '휴지통이 비어 있습니다.' : '접수된 건의 및 문의사항이 없습니다.'}
        </td>
      </tr>
    `;
    return;
  }

  listToRender.forEach(inq => {
    const tr = document.createElement('tr');

    const formattedDate = inq.createdAt ? inq.createdAt.substring(0, 16).replace('T', ' ') : '-';
    
    let statusText = '';
    let statusClass = '';
    if (inq.status === 'deleted') {
      statusText = '삭제됨';
      statusClass = 'deleted';
    } else if (inq.status === 'resolved') {
      statusText = '답변 완료';
      statusClass = 'resolved';
    } else {
      statusText = '접수 대기';
      statusClass = 'pending';
    }

    let actionButtonHtml = "";
    if (state.adminInquirySubTab === 'trash') {
      actionButtonHtml = `
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-light btn-sm admin-restore-inq-btn" data-id="${inq.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang-gold); border-color: rgba(197,160,89,0.3);">
            <i class="fa-solid fa-rotate-left"></i> 복구
          </button>
          <button class="btn btn-light btn-sm admin-delete-permanent-inq-btn" data-id="${inq.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2);">
            <i class="fa-solid fa-trash-can"></i> 영구삭제
          </button>
        </div>
      `;
    } else {
      actionButtonHtml = `
        <button class="btn btn-light btn-sm btn-open-inquiry" data-id="${inq.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; font-weight: 700;">
          <i class="fa-solid fa-file-signature"></i> 상세/답변
        </button>
      `;
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(inq.author)}</td>
      <td style="font-family: monospace; color: var(--color-text-sub);">${escapeHtml(inq.studentId)}</td>
      <td style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(inq.title || "제목 없음")}</td>
      <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">${escapeHtml(inq.message)}</td>
      <td style="font-size: 0.72rem; color: var(--color-text-dim);">${formattedDate}</td>
      <td><span class="inquiry-status-badge ${statusClass}">${statusText}</span></td>
      <td>${actionButtonHtml}</td>
    `;

    // 이벤트 리스너 바인딩
    if (state.adminInquirySubTab === 'trash') {
      tr.querySelector('.admin-restore-inq-btn').addEventListener('click', () => {
        handleRestoreInquiry(inq.id);
      });
      tr.querySelector('.admin-delete-permanent-inq-btn').addEventListener('click', () => {
        deleteInquiry(inq.id);
      });
    } else {
      tr.querySelector('.btn-open-inquiry').addEventListener('click', () => {
        openAdminInquiryModal(inq.id);
      });
    }

    tbody.appendChild(tr);
  });
}

// 관리자 문의 상세 및 답변 모달 열기
function openAdminInquiryModal(inqId) {
  const inq = state.inquiries.find(i => i.id === inqId);
  if (!inq) return;

  state.selectedInquiryId = inqId;

  const formattedDate = inq.createdAt ? inq.createdAt.substring(0, 16).replace('T', ' ') : '-';
  const statusText = inq.status === 'resolved' ? '답변 완료' : '접수 대기';
  const statusClass = inq.status === 'resolved' ? 'resolved' : 'pending';

  document.getElementById('adminInqAuthor').innerText = inq.author;
  document.getElementById('adminInqStudentId').innerText = inq.studentId;
  document.getElementById('adminInqDate').innerText = formattedDate;
  
  const badge = document.getElementById('adminInqStatusBadge');
  badge.innerText = statusText;
  badge.className = `inquiry-status-badge ${statusClass}`;

  document.getElementById('adminInqTitle').innerText = inq.title || "제목 없음";
  document.getElementById('adminInqMessage').innerText = inq.message;

  // 답변 작성자 이름 기본값 설정 (기존에 답변한 기록이 있으면 표시, 없으면 현재 로그인 어드민 이름)
  const replyAuthorInput = document.getElementById('adminReplyAuthor');
  if (inq.repliedBy) {
    replyAuthorInput.value = inq.repliedBy;
  } else {
    replyAuthorInput.value = state.currentUser ? state.currentUser.name : "운영진";
  }

  // 답변 텍스트 기본값 설정
  document.getElementById('adminReplyText').value = inq.reply || "";

  const modal = document.getElementById('adminInquiryModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// 관리자 문의 상세 및 답변 모달 닫기
function closeAdminInquiryModal() {
  const modal = document.getElementById('adminInquiryModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  state.selectedInquiryId = null;
}

// 관리자 답변 작성 서브밋 핸들러
async function handleAdminReplySubmit(e) {
  e.preventDefault();

  if (!state.selectedInquiryId) return;

  const replyText = document.getElementById('adminReplyText').value.trim();
  const repliedBy = document.getElementById('adminReplyAuthor').value.trim();

  if (!replyText) {
    alert("답변 내용을 입력해 주세요.");
    return;
  }
  if (!repliedBy) {
    alert("답변 작성 운영진 이름을 입력해 주세요.");
    return;
  }

  const success = await submitAdminReply(state.selectedInquiryId, replyText, repliedBy);
  if (success) {
    closeAdminInquiryModal();
  }
}

// 운영진 답변 저장
async function submitAdminReply(inquiryId, replyText, repliedBy) {
  const targetInq = state.inquiries.find(i => i.id === inquiryId);
  if (targetInq) {
    targetInq.reply = replyText;
    targetInq.repliedBy = repliedBy;
    targetInq.status = "resolved";
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));
  }

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('inquiries')
        .update({ 
          reply: replyText, 
          replied_by: repliedBy, 
          status: "resolved" 
        })
        .eq('id', inquiryId);
      if (error) throw error;
      alert("답변이 정상적으로 등록 및 저장되었습니다.");
      await syncWithSupabase();
      renderAdminInquiries();
      return true;
    } catch (err) {
      console.error("Supabase 답변 업데이트 실패:", err);
      alert("서버 연결 실패로 인해 로컬 스토리지에만 저장되었습니다.");
      renderAdminInquiries();
      return true;
    }
  } else {
    alert("로컬 스토리지 모드: 답변이 저장되었습니다.");
    renderAdminInquiries();
    return true;
  }
}

// 접수된 문의 삭제 (Soft Delete: 휴지통 이동 또는 Trash 탭 내 영구 삭제)
async function deleteInquiry(inquiryId) {
  const inquiry = state.inquiries.find(i => i.id === inquiryId);
  if (!inquiry) return;

  if (inquiry.status !== 'deleted') {
    // Soft Delete (move to trash)
    if (!confirm("이 문의 건을 휴지통으로 이동하시겠습니까?")) return;

    const nowIso = new Date().toISOString();
    inquiry.status = 'deleted';
    inquiry.deleted_at = nowIso;
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status: 'deleted', deleted_at: nowIso })
          .eq('id', inquiryId);
        
        if (error) {
          const { error: retryError } = await supabaseClient
            .from('inquiries')
            .update({ status: 'deleted' })
            .eq('id', inquiryId);
          if (retryError) throw retryError;
        }
        alert("문의 건이 휴지통으로 이동되었습니다.");
        closeAdminInquiryModal();
        await syncWithSupabase();
        renderAdminInquiries();
      } catch (err) {
        console.error("Supabase 문의 휴지통 이동 실패:", err);
        alert("서버 전송 실패로 로컬에서만 처리되었습니다.");
        closeAdminInquiryModal();
        renderAdminInquiries();
      }
    } else {
      alert("로컬 스토리지 모드: 문의 건이 휴지통으로 이동되었습니다.");
      closeAdminInquiryModal();
      renderAdminInquiries();
    }
  } else {
    // Permanent Delete
    if (!confirm("이 문의 건을 완전히 영구 삭제하시겠습니까?\n삭제된 문의는 복원할 수 없습니다.")) return;

    state.inquiries = state.inquiries.filter(i => i.id !== inquiryId);
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .delete()
          .eq('id', inquiryId);
        if (error) throw error;
        alert("문의 내역이 완전히 삭제되었습니다.");
        closeAdminInquiryModal();
        await syncWithSupabase();
        renderAdminInquiries();
      } catch (err) {
        console.error("Supabase 문의 영구 삭제 실패:", err);
        alert("서버 전송 실패로 로컬에서만 삭제되었습니다.");
        closeAdminInquiryModal();
        renderAdminInquiries();
      }
    } else {
      alert("로컬 스토리지 모드: 문의가 영구 삭제되었습니다.");
      closeAdminInquiryModal();
      renderAdminInquiries();
    }
  }
}

// 문의 복구 처리 핸들러
async function handleRestoreInquiry(inquiryId) {
  const inquiry = state.inquiries.find(i => i.id === inquiryId);
  if (!inquiry) return;

  if (confirm("이 문의 건을 일반 문의 목록으로 복구하시겠습니까?")) {
    const newStatus = inquiry.reply ? 'resolved' : 'pending';
    inquiry.status = newStatus;
    inquiry.deleted_at = null;
    localStorage.setItem('sogang_unity_inquiries', JSON.stringify(state.inquiries));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('inquiries')
          .update({ status: newStatus, deleted_at: null })
          .eq('id', inquiryId);
        
        if (error) {
          const { error: retryError } = await supabaseClient
            .from('inquiries')
            .update({ status: newStatus })
            .eq('id', inquiryId);
          if (retryError) throw retryError;
        }
        alert("문의 건이 복구되었습니다.");
        await syncWithSupabase();
        renderAdminInquiries();
      } catch (err) {
        console.error("Supabase 문의 복구 실패:", err);
        alert("서버 전송 실패로 로컬에서만 복구되었습니다.");
        renderAdminInquiries();
      }
    } else {
      alert("로컬 스토리지 모드: 문의 건이 복구되었습니다.");
      renderAdminInquiries();
    }
  }
}

// ==================== 쪽지(Direct Message) 시스템 기능 ====================

// 로그인 원우의 안 읽은 쪽지 개수 갱신
async function updateDmUnreadCount() {
  if (!state.currentUser || state.currentUser.isGuest) {
    state.dmUnreadCount = 0;
    updateDmBadgeUI();
    return;
  }
  
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('messages')
        .select('id, is_read, deleted_by_receiver')
        .eq('receiver_id', state.currentUser.id)
        .eq('is_read', false);
      if (error) throw error;
      const activeUnread = (data || []).filter(m => !m.deleted_by_receiver);
      state.dmUnreadCount = activeUnread.length;
    } catch (err) {
      console.warn("Supabase 안 읽은 쪽지 조회 실패 (messages 테이블 미생성 상태일 수 있음):", err);
      const cached = localStorage.getItem('sogang_unity_messages');
      if (cached) {
        const msgs = JSON.parse(cached);
        state.dmUnreadCount = msgs.filter(m => m.receiverId === state.currentUser.id && !m.isRead && !m.deletedByReceiver).length;
      }
    }
  } else {
    const cached = localStorage.getItem('sogang_unity_messages');
    if (cached) {
      const msgs = JSON.parse(cached);
      state.dmUnreadCount = msgs.filter(m => m.receiverId === state.currentUser.id && !m.isRead && !m.deletedByReceiver).length;
    }
  }
  updateDmBadgeUI();
}

function updateDmBadgeUI() {
  const badge = document.getElementById('dmUnreadBadge');
  if (badge) {
    if (state.dmUnreadCount > 0) {
      badge.innerText = String(state.dmUnreadCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

// 쪽지함 동기화 (온디맨드 호출)
async function syncDMs() {
  if (!state.currentUser || state.currentUser.isGuest) return;
  
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${state.currentUser.id},receiver_id.eq.${state.currentUser.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      state.messages = (data || []).map(m => ({
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        senderName: m.sender_name,
        receiverName: m.receiver_name,
        message: m.message,
        isRead: m.is_read,
        createdAt: m.created_at,
        deletedByReceiver: m.deleted_by_receiver || false
      }));
      localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));
    } catch (err) {
      console.error("Supabase DMs 동기화 실패 (로컬 스토리지 모드 실행):", err);
      const cached = localStorage.getItem('sogang_unity_messages');
      if (cached) state.messages = JSON.parse(cached);
    }
  } else {
    const cached = localStorage.getItem('sogang_unity_messages');
    if (cached) state.messages = JSON.parse(cached);
  }
  
  state.dmUnreadCount = state.messages.filter(m => m.receiverId === state.currentUser.id && !m.isRead && !m.deletedByReceiver).length;
  updateDmBadgeUI();
}

// 받은 쪽지 읽음 완료 처리
async function markMessagesAsRead() {
  if (!state.currentUser || state.currentUser.isGuest) return;
  
  const unreadDMs = state.messages.filter(m => m.receiverId === state.currentUser.id && !m.isRead);
  if (unreadDMs.length === 0) return;
  
  unreadDMs.forEach(m => m.isRead = true);
  localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));
  
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('messages')
        .update({ is_read: true })
        .eq('receiver_id', state.currentUser.id)
        .eq('is_read', false);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase DMs 읽음 업데이트 실패:", err);
    }
  }
  
  state.dmUnreadCount = 0;
  updateDmBadgeUI();
}

// 쪽지함 모달 제어
function openDmInboxModal() {
  if (!state.currentUser || state.currentUser.isGuest) {
    alert("로그인 후 쪽지함을 이용할 수 있습니다.");
    return;
  }
  const modal = document.getElementById('dmInboxModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  
  syncDMs().then(() => {
    renderDmInbox();
  });
}

function closeDmInboxModal() {
  const modal = document.getElementById('dmInboxModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  state.activeDmOpponentId = "";
}

function renderDmInbox() {
  const inboxTitle = document.getElementById('dmInboxTitle');
  const chatHeader = document.getElementById('dmChatHeader');
  const subTabMenu = document.getElementById('dmSubTabMenu');
  const chatInputContainer = document.getElementById('dmChatInputContainer');
  const chatReplyText = document.getElementById('dmChatReplyText');
  const chatCharCount = document.getElementById('dmChatCharCount');

  // textarea 초기화
  if (chatReplyText) {
    chatReplyText.value = "";
    if (chatCharCount) chatCharCount.innerText = "0 / 500자";
  }

  if (state.activeDmOpponentId) {
    // 1:1 대화 상세 뷰
    if (inboxTitle) inboxTitle.classList.add('hidden');
    if (chatHeader) chatHeader.classList.remove('hidden');
    if (subTabMenu) subTabMenu.classList.add('hidden');
    if (chatInputContainer) chatInputContainer.classList.remove('hidden');
    
    // 상대방 이름 노출
    const partner = state.members.find(m => m.id === state.activeDmOpponentId);
    const chatPartnerName = document.getElementById('dmChatPartnerName');
    if (chatPartnerName) {
      if (partner) {
        chatPartnerName.innerText = `${partner.generation ? `${partner.generation}기 ` : ''}${partner.name} 원우`;
      } else {
        chatPartnerName.innerText = state.activeDmOpponentId === 'admin' ? '운영진' : '알 수 없는 원우';
      }
    }
    
    renderDmChatThread(state.activeDmOpponentId, true);
    markMessagesAsReadForOpponent(state.activeDmOpponentId);
  } else {
    // 스레드 목록 뷰
    if (inboxTitle) inboxTitle.classList.remove('hidden');
    if (chatHeader) chatHeader.classList.add('hidden');
    if (subTabMenu) subTabMenu.classList.remove('hidden');
    if (chatInputContainer) chatInputContainer.classList.add('hidden');
    
    renderDmThreadList();
  }
}

// 대화 상대별 스레드 목록 렌더링
function renderDmThreadList() {
  const container = document.getElementById('dmListContainer');
  if (!container) return;
  container.innerHTML = "";

  // 유효한 메시지 필터링 (나에게 왔고 내가 지운 쪽지 & 대화방 나가기 시점 이전의 메시지 제외)
  const validMessages = state.messages.filter(m => {
    const isReceiver = m.receiverId === state.currentUser.id;
    if (isReceiver && m.deletedByReceiver) return false;

    const opponentId = m.senderId === state.currentUser.id ? m.receiverId : m.senderId;
    const leftAt = state.leftChats[opponentId];
    if (leftAt && new Date(m.createdAt) <= new Date(leftAt)) return false;

    return true;
  });

  // 상대방 별로 그룹화
  const threadsMap = {};
  validMessages.forEach(msg => {
    const opponentId = msg.senderId === state.currentUser.id ? msg.receiverId : msg.senderId;
    const opponentName = msg.senderId === state.currentUser.id ? msg.receiverName : msg.senderName;
    
    if (!threadsMap[opponentId]) {
      threadsMap[opponentId] = {
        opponentId,
        opponentName,
        messages: [],
        unreadCount: 0
      };
    }
    
    threadsMap[opponentId].messages.push(msg);
    if (msg.receiverId === state.currentUser.id && !msg.isRead) {
      threadsMap[opponentId].unreadCount++;
    }
  });

  const threads = Object.values(threadsMap);

  // 각 스레드마다 가장 최신 메시지 기준으로 내림차순 정렬
  threads.forEach(t => {
    t.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    t.lastMessage = t.messages[0];
  });

  threads.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

  if (threads.length === 0) {
    container.innerHTML = `
      <div class="dm-empty-state">
        <i class="fa-regular fa-comments"></i>
        <span>진행 중인 대화가 없습니다.</span>
      </div>
    `;
    return;
  }

  threads.forEach(t => {
    const item = document.createElement('div');
    item.className = 'dm-thread-item';
    
    const formattedDate = t.lastMessage.createdAt 
      ? t.lastMessage.createdAt.substring(0, 16).replace('T', ' ') 
      : '-';

    const truncatedBody = t.lastMessage.message.length > 40
      ? t.lastMessage.message.substring(0, 40) + '...'
      : t.lastMessage.message;

    // 기수와 아바타 장식
    const partner = state.members.find(m => m.id === t.opponentId);
    const initialChar = t.opponentName ? t.opponentName.substring(0, 1) : '?';
    const bgCol = partner && partner.avatarColor ? partner.avatarColor : '#b30838';

    item.innerHTML = `
      <div class="dm-thread-avatar" style="background-color: ${bgCol}; color: #fff; font-weight: 700; user-select: none;">
        ${initialChar}
      </div>
      <div class="dm-thread-info">
        <div class="dm-thread-header">
          <span class="dm-thread-name">${escapeHtml(t.opponentName)}</span>
          <span class="dm-thread-time">${formattedDate}</span>
        </div>
        <div class="dm-thread-body">${escapeHtml(truncatedBody)}</div>
      </div>
      ${t.unreadCount > 0 ? `<span class="dm-thread-unread-badge">${t.unreadCount}</span>` : ''}
    `;

    item.addEventListener('click', () => {
      state.activeDmOpponentId = t.opponentId;
      renderDmInbox();
    });

    container.appendChild(item);
  });
}

// 1:1 대화방 상세 렌더링
function renderDmChatThread(opponentId, forceScroll = false) {
  const container = document.getElementById('dmListContainer');
  if (!container) return;

  const previousScrollTop = container.scrollTop;
  const previousScrollHeight = container.scrollHeight;
  const wasAtBottom = previousScrollHeight - previousScrollTop <= container.clientHeight + 60;

  // 해당 상대방과의 메시지만 추출하여 시간순(오름차순) 정렬
  const chatMessages = state.messages
    .filter(m => {
      const isOpponent = (m.senderId === opponentId && m.receiverId === state.currentUser.id) ||
                         (m.senderId === state.currentUser.id && m.receiverId === opponentId);
      if (!isOpponent) return false;
      if (m.receiverId === state.currentUser.id && m.deletedByReceiver) return false;
      
      const leftAt = state.leftChats[opponentId];
      if (leftAt && new Date(m.createdAt) <= new Date(leftAt)) return false;
      
      return true;
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const prevMsgCount = container.querySelectorAll('.dm-chat-row').length;

  if (chatMessages.length === 0) {
    container.innerHTML = `
      <div class="dm-empty-state">
        <i class="fa-regular fa-paper-plane"></i>
        <span>대화 내역이 없습니다. 메시지를 보내 교류를 시작해 보세요!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  chatMessages.forEach(msg => {
    const isSent = msg.senderId === state.currentUser.id;
    const isDeleted = msg.message === "삭제된 쪽지입니다.";
    const row = document.createElement('div');
    row.className = `dm-chat-row ${isSent ? 'sent' : 'received'}`;

    const dateObj = new Date(msg.createdAt);
    let hour = dateObj.getHours();
    const min = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hour >= 12 ? '오후' : '오전';
    hour = hour % 12;
    hour = hour ? hour : 12;
    const timeStr = `${ampm} ${hour}:${min}`;
    
    // 삭제된 메시지가 아니고, 내가 보냈으며, 안 읽었을 때만 1 표시
    const showUnread = isSent && !isDeleted && !msg.isRead;

    // 내가 보낸 쪽지이면서 삭제되지 않았을 때만 삭제 액션 단추 제공
    const canDelete = isSent && !isDeleted;

    row.innerHTML = `
      <div class="dm-bubble-container">
        <div class="dm-bubble ${isDeleted ? 'deleted' : ''}">${escapeHtml(msg.message)}</div>
        <div class="dm-bubble-meta">
          ${showUnread ? `<span class="dm-unread-indicator">1</span>` : ''}
          <span class="dm-bubble-time" title="${msg.createdAt.substring(0, 16).replace('T', ' ')}">${timeStr}</span>
        </div>
      </div>
      ${canDelete ? `
      <div class="dm-bubble-actions-row">
        <button class="dm-bubble-action-btn btn-delete-chat" data-id="${msg.id}" title="보낸 쪽지 삭제 (내용을 '삭제된 쪽지입니다.'로 변경)">
          <i class="fa-solid fa-trash-can"></i> 삭제
        </button>
      </div>
      ` : ''}
    `;

    if (canDelete) {
      row.querySelector('.btn-delete-chat').addEventListener('click', () => {
        handleDeleteDm(msg.id);
      });
    }

    container.appendChild(row);
  });

  if (forceScroll || wasAtBottom || chatMessages.length > prevMsgCount) {
    container.scrollTop = container.scrollHeight;
  } else {
    container.scrollTop = previousScrollTop;
  }
}

// 특정 대화 상대방의 메시지들 읽음 완료 처리
async function markMessagesAsReadForOpponent(opponentId) {
  if (!state.currentUser || state.currentUser.isGuest) return;

  const targetMessages = state.messages.filter(m => m.senderId === opponentId && m.receiverId === state.currentUser.id && !m.isRead);
  if (targetMessages.length === 0) return;

  targetMessages.forEach(m => m.isRead = true);
  localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', opponentId)
        .eq('receiver_id', state.currentUser.id)
        .eq('is_read', false);
      if (error) throw error;
    } catch (err) {
      console.error(`Supabase DMs 읽음 업데이트 실패 (상대방: ${opponentId}):`, err);
    }
  }

  state.dmUnreadCount = state.messages.filter(m => m.receiverId === state.currentUser.id && !m.isRead && !m.deletedByReceiver).length;
  updateDmBadgeUI();
}

// 1:1 대화방 내에서 간이 답장 전송 처리
async function handleSendDmReply() {
  if (!state.currentUser || state.currentUser.isGuest) return;
  if (!state.activeDmOpponentId) return;

  const textInput = document.getElementById('dmChatReplyText');
  if (!textInput) return;

  const messageText = textInput.value.trim();
  if (!messageText) return;

  const opponentId = state.activeDmOpponentId;
  const receiver = state.members.find(m => m.id === opponentId);
  const receiverName = receiver ? receiver.name : (opponentId === 'admin' ? '운영진' : '알 수 없는 원우');

  const now = new Date();
  const nowStr = now.toISOString();

  const newMsg = {
    senderId: state.currentUser.id,
    receiverId: opponentId,
    senderName: state.currentUser.name,
    receiverName: receiverName,
    message: messageText,
    isRead: false,
    createdAt: nowStr,
    deletedByReceiver: false
  };

  // 로컬 상태 추가
  state.messages.unshift(newMsg);
  localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));

  // 즉시 화면 반영
  renderDmInbox();

  // 입력창 클리어
  textInput.value = "";
  const chatCharCount = document.getElementById('dmChatCharCount');
  if (chatCharCount) chatCharCount.innerText = "0 / 500자";

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('messages')
        .insert([{
          sender_id: newMsg.senderId,
          receiver_id: newMsg.receiverId,
          sender_name: newMsg.senderName,
          receiver_name: newMsg.receiverName,
          message: newMsg.message,
          is_read: false
        }]);
      if (error) throw error;
      await syncDMs();
      renderDmInbox();
    } catch (err) {
      console.error("Supabase DM 답장 전송 실패:", err);
    }
  } else {
    renderDmInbox();
  }
}

// 대화방 나가기 처리 핸들러 (나간 시점을 로컬에 저장하여 이전 내역 숨김)
async function handleLeaveChat() {
  if (!state.currentUser || state.currentUser.isGuest) return;
  if (!state.activeDmOpponentId) return;

  const opponentId = state.activeDmOpponentId;
  const partner = state.members.find(m => m.id === opponentId);
  const partnerName = partner ? partner.name : (opponentId === 'admin' ? '운영진' : '알 수 없는 원우');

  const confirmMsg = `[${partnerName}] 원우님과의 대화방을 나가시겠습니까?\n나가기 시 이전 대화 내역이 모두 삭제(숨김)되며, 상대방이 새 쪽지를 보내면 대화가 다시 시작됩니다.`;

  if (!confirm(confirmMsg)) return;

  // 1. 해당 상대가 보낸 쪽지 모두 읽음 처리
  await markMessagesAsReadForOpponent(opponentId);

  // 2. 나간 시간 기록 및 저장
  const nowIso = new Date().toISOString();
  state.leftChats[opponentId] = nowIso;
  localStorage.setItem('sogang_unity_left_chats_' + state.currentUser.id, JSON.stringify(state.leftChats));

  // 3. 상태 리셋 및 돌아가기
  state.activeDmOpponentId = "";
  renderDmInbox();
}

// 쪽지 삭제 처리 핸들러 (발신인 삭제 -> 영구삭제, 수신인 삭제 -> soft delete)
// 쪽지 삭제 처리 핸들러 (본인이 보낸 쪽지만 삭제 가능, 실제 삭제가 아니라 '삭제된 쪽지입니다.'로 업데이트)
async function handleDeleteDm(messageId) {
  const confirmMsg = "이 쪽지를 삭제하시겠습니까?\n삭제 시 대화창에서 내용이 '삭제된 쪽지입니다.'로 변경되며 복구할 수 없습니다.";

  if (!confirm(confirmMsg)) return;

  // 로컬 상태 변경
  const targetMsg = state.messages.find(m => m.id === messageId);
  if (targetMsg) {
    targetMsg.message = "삭제된 쪽지입니다.";
    localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));
  }

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('messages')
        .update({ message: "삭제된 쪽지입니다." })
        .eq('id', messageId);
      if (error) throw error;
      
      await syncDMs();
      renderDmInbox();
    } catch (err) {
      console.error("Supabase 쪽지 삭제(업데이트) 실패:", err);
      alert("서버 전송 실패로 로컬에서만 처리되었습니다.");
      renderDmInbox();
    }
  } else {
    alert("로컬 스토리지 모드: 쪽지가 삭제되었습니다.");
    renderDmInbox();
  }
}

// 쪽지 전송 모달 제어
function openDmSendModal(receiverId = "", receiverName = "") {
  if (!state.currentUser || state.currentUser.isGuest) {
    alert("로그인 후 쪽지를 보낼 수 있습니다.");
    return;
  }
  
  const modal = document.getElementById('dmSendModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  
  const hiddenInput = document.getElementById('dmReceiverSelect');
  const searchInput = document.getElementById('dmReceiverSearchInput');
  const dropdownList = document.getElementById('dmReceiverDropdownList');
  
  if (hiddenInput && searchInput) {
    if (receiverId) {
      hiddenInput.value = receiverId;
      let nameToUse = receiverName;
      const m = state.members.find(member => member.id === receiverId);
      if (m) {
        nameToUse = `${m.generation ? `${m.generation}기 ` : ''}${m.name} (${m.studentId})`;
      }
      searchInput.value = nameToUse || "";
    } else {
      hiddenInput.value = "";
      searchInput.value = "";
    }
    if (dropdownList) {
      dropdownList.classList.add('hidden');
    }
  }
  
  document.getElementById('dmMessageText').value = "";
}

// 받는 사람 드롭다운 렌더링
function renderReceiverDropdown(filterText = "") {
  const listContainer = document.getElementById('dmReceiverDropdownList');
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const activeMembers = state.members.filter(m => m.id !== 'admin' && m.id !== state.currentUser.id && m.role !== 'deleted');
  activeMembers.sort((a, b) => {
    const genA = a.generation || 999;
    const genB = b.generation || 999;
    if (genA !== genB) return genA - genB;
    return a.name.localeCompare(b.name);
  });

  const query = filterText.trim().toLowerCase();
  const filtered = activeMembers.filter(m => {
    const label = `${m.generation ? `${m.generation}기 ` : ''}${m.name} (${m.studentId})`.toLowerCase();
    return label.includes(query);
  });

  if (filtered.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.style.padding = '0.5rem 0.75rem';
    emptyEl.style.fontSize = '0.8rem';
    emptyEl.style.color = 'var(--color-text-dim)';
    emptyEl.innerText = '검색 결과가 없습니다.';
    listContainer.appendChild(emptyEl);
    return;
  }

  filtered.forEach(m => {
    const item = document.createElement('div');
    item.className = 'searchable-dropdown-item';
    const text = `${m.generation ? `${m.generation}기 ` : ''}${m.name}`;
    const subText = `(${escapeHtml(m.studentId)})`;
    item.innerHTML = `<span>${text}</span><span class="item-sub">${subText}</span>`;
    
    const currentSelected = document.getElementById('dmReceiverSelect').value;
    if (m.id === currentSelected) {
      item.classList.add('selected');
    }

    item.addEventListener('click', () => {
      document.getElementById('dmReceiverSelect').value = m.id;
      document.getElementById('dmReceiverSearchInput').value = `${m.generation ? `${m.generation}기 ` : ''}${m.name} (${m.studentId})`;
      listContainer.classList.add('hidden');
    });

    listContainer.appendChild(item);
  });
}

function closeDmSendModal() {
  const modal = document.getElementById('dmSendModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 쪽지 전송 서브밋 핸들러
async function handleSendDmSubmit(e) {
  e.preventDefault();
  if (!state.currentUser || state.currentUser.isGuest) return;

  const receiverId = document.getElementById('dmReceiverSelect').value;
  const messageText = document.getElementById('dmMessageText').value.trim();

  if (!receiverId) {
    alert("받는 사람을 선택해 주세요.");
    return;
  }
  if (!messageText) {
    alert("쪽지 내용을 입력해 주세요.");
    return;
  }

  const receiver = state.members.find(m => m.id === receiverId);
  if (!receiver) {
    alert("존재하지 않는 회원입니다.");
    return;
  }

  const now = new Date();
  const nowStr = now.toISOString();

  const newMsg = {
    senderId: state.currentUser.id,
    receiverId: receiverId,
    senderName: state.currentUser.name,
    receiverName: receiver.name,
    message: messageText,
    isRead: false,
    createdAt: nowStr
  };

  // 로컬 상태 추가
  state.messages.unshift(newMsg);
  localStorage.setItem('sogang_unity_messages', JSON.stringify(state.messages));

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('messages')
        .insert([{
          sender_id: newMsg.senderId,
          receiver_id: newMsg.receiverId,
          sender_name: newMsg.senderName,
          receiver_name: newMsg.receiverName,
          message: newMsg.message,
          is_read: false
        }]);
      if (error) throw error;
      alert("쪽지가 정상적으로 전송되었습니다.");
    } catch (err) {
      console.error("Supabase DM 전송 실패:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 보관됩니다)");
    }
  } else {
    alert("로컬 스토리지 모드: 쪽지가 전송되었습니다.");
  }

  closeDmSendModal();
  
  state.activeDmOpponentId = receiverId;
  openDmInboxModal();
}

// ==================== 빠른 바로가기 (Quick Links) 기능 ====================

// 메인 사이드바 링크 렌더링
function renderQuickLinks() {
  const container = document.getElementById('quickLinksContainer');
  if (!container) return;
  container.innerHTML = "";
  
  if (!state.quickLinks || state.quickLinks.length === 0) {
    container.innerHTML = `<div class="quick-link-empty"><i class="fa-solid fa-circle-info"></i> 등록된 바로가기가 없습니다.</div>`;
    return;
  }
  
  state.quickLinks.forEach(link => {
    const chip = document.createElement('a');
    chip.className = 'quick-link-chip';
    chip.href = link.url;
    chip.target = '_blank';
    chip.innerHTML = `<i class="fa-solid fa-link"></i> ${escapeHtml(link.title)}`;
    container.appendChild(chip);
  });
}

// 어드민 탭 리스트 테이블 렌더링
// 어드민 탭 리스트 테이블 렌더링
function renderAdminQuickLinks() {
  const tbody = document.getElementById('adminQuickLinksTableBody');
  const countEl = document.getElementById('adminQuickLinksCount');
  if (countEl) {
    countEl.innerText = String(state.quickLinks ? state.quickLinks.length : 0);
  }
  if (!tbody) return;
  tbody.innerHTML = "";
  
  if (!state.quickLinks || state.quickLinks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--color-text-dim); padding: 2rem;">
          등록된 빠른 바로가기 링크가 없습니다.
        </td>
      </tr>
    `;
    return;
  }
  
  state.quickLinks.forEach((link, index) => {
    const tr = document.createElement('tr');
    
    // 수정 모드인 경우
    if (state.editingLinkId === link.id) {
      tr.innerHTML = `
        <td>
          <input type="text" id="editLinkTitle_${link.id}" value="${escapeHtml(link.title)}" style="font-size: 0.8rem; padding: 0.3rem 0.5rem; border: 1px solid var(--color-sogang); border-radius: 4px; width: 100%; font-weight: 700;">
        </td>
        <td>
          <input type="url" id="editLinkUrl_${link.id}" value="${escapeHtml(link.url)}" style="font-size: 0.8rem; padding: 0.3rem 0.5rem; border: 1px solid var(--color-sogang); border-radius: 4px; width: 100%;">
        </td>
        <td>
          <button class="btn btn-sogang btn-sm btn-save-edit" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; margin-right: 0.2rem; font-weight: 700;">
            <i class="fa-solid fa-check"></i> 저장
          </button>
          <button class="btn btn-light btn-sm btn-cancel-edit" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-text-sub);">
            취소
          </button>
        </td>
      `;
      
      tr.querySelector('.btn-save-edit').addEventListener('click', () => {
        handleSaveQuickLinkEdit(link.id);
      });
      
      tr.querySelector('.btn-cancel-edit').addEventListener('click', () => {
        state.editingLinkId = null;
        renderAdminQuickLinks();
      });
      
    } else {
      // 일반 조회 모드
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(link.title)}</td>
        <td style="color: var(--color-text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 350px;">
          <a href="${link.url}" target="_blank" style="text-decoration: underline; color: var(--color-sogang-gold);">${escapeHtml(link.url)}</a>
        </td>
        <td>
          <button class="btn btn-light btn-sm btn-up" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; border-radius: 4px; margin-right: 0.2rem;" ${index === 0 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button class="btn btn-light btn-sm btn-down" style="padding: 0.3rem 0.5rem; font-size: 0.75rem; border-radius: 4px; margin-right: 0.4rem;" ${index === state.quickLinks.length - 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <button class="btn btn-light btn-sm btn-edit-link" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; margin-right: 0.2rem; border-color: rgba(197, 160, 89, 0.4); color: var(--color-sogang-gold);">
            <i class="fa-solid fa-pen"></i> 수정
          </button>
          <button class="btn btn-light btn-sm admin-delete-link-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2);">
            <i class="fa-solid fa-trash-can"></i> 삭제
          </button>
        </td>
      `;
      
      if (index > 0) {
        tr.querySelector('.btn-up').addEventListener('click', () => {
          handleMoveQuickLink(index, 'up');
        });
      }
      
      if (index < state.quickLinks.length - 1) {
        tr.querySelector('.btn-down').addEventListener('click', () => {
          handleMoveQuickLink(index, 'down');
        });
      }
      
      tr.querySelector('.btn-edit-link').addEventListener('click', () => {
        state.editingLinkId = link.id;
        renderAdminQuickLinks();
      });
      
      tr.querySelector('.admin-delete-link-btn').addEventListener('click', () => {
        handleDeleteQuickLink(link.id, link.title);
      });
    }
    
    tbody.appendChild(tr);
  });
}

// 빠른 링크 수정 저장
async function handleSaveQuickLinkEdit(linkId) {
  const titleInput = document.getElementById(`editLinkTitle_${linkId}`);
  const urlInput = document.getElementById(`editLinkUrl_${linkId}`);
  if (!titleInput || !urlInput) return;
  
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  
  if (!title || !url) {
    alert("링크 이름과 URL을 모두 입력해 주세요.");
    return;
  }
  
  const linkIndex = state.quickLinks.findIndex(l => l.id === linkId);
  if (linkIndex === -1) return;
  
  if (state.quickLinks.some((l, idx) => idx !== linkIndex && l.title === title)) {
    alert("이미 존재하는 링크 이름입니다.");
    return;
  }
  
  // 로컬 데이터 갱신
  const currentLink = state.quickLinks[linkIndex];
  currentLink.title = title;
  currentLink.url = url;
  
  localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
  
  // 에디트 상태 종료 및 UI 업데이트
  state.editingLinkId = null;
  renderQuickLinks();
  renderAdminQuickLinks();
  
  // Supabase 서버 동기화
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('quick_links')
        .update({ title, url })
        .eq('id', linkId);
      if (error) throw error;
      alert("링크가 성공적으로 수정되었습니다.");
    } catch (err) {
      console.error("Supabase 퀵링크 수정 실패:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
    }
  } else {
    alert("로컬 스토리지 모드: 링크가 수정되었습니다.");
  }
}

// 빠른 링크 순서 변경
async function handleMoveQuickLink(currentIndex, direction) {
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= state.quickLinks.length) return;
  
  const currentLink = state.quickLinks[currentIndex];
  const targetLink = state.quickLinks[targetIndex];
  
  // sort_order 스왑
  const tempOrder = currentLink.sort_order;
  currentLink.sort_order = targetLink.sort_order;
  targetLink.sort_order = tempOrder;
  
  // 정렬 후 캐시 저장
  state.quickLinks.sort((a, b) => a.sort_order - b.sort_order);
  localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
  
  // UI 선반영
  renderQuickLinks();
  renderAdminQuickLinks();
  
  // Supabase 서버 동기화
  if (supabaseClient) {
    try {
      const update1 = supabaseClient
        .from('quick_links')
        .update({ sort_order: currentLink.sort_order })
        .eq('id', currentLink.id);
        
      const update2 = supabaseClient
        .from('quick_links')
        .update({ sort_order: targetLink.sort_order })
        .eq('id', targetLink.id);
        
      const [res1, res2] = await Promise.all([update1, update2]);
      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;
    } catch (err) {
      console.error("Supabase 퀵링크 순서 동기화 실패:", err);
    }
  }
}

// 빠른 링크 추가 제출
async function handleAddQuickLinkSubmit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('newLinkTitle');
  const urlInput = document.getElementById('newLinkUrl');
  
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  
  if (!title || !url) return;
  
  if (state.quickLinks.some(l => l.title === title)) {
    alert("이미 존재하는 링크 이름입니다.");
    return;
  }
  
  const newLink = {
    id: Date.now(),
    title,
    url,
    sort_order: state.quickLinks.length + 1
  };
  
  state.quickLinks.push(newLink);
  localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
  
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('quick_links')
        .insert([{ title, url, sort_order: newLink.sort_order }])
        .select();
      if (error) throw error;
      
      if (data && data.length > 0) {
        newLink.id = data[0].id;
        localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
      }
      alert("새 빠른 링크가 등록되었습니다.");
    } catch (err) {
      console.error("Supabase 퀵링크 등록 에러:", err);
      alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
    }
  } else {
    alert("로컬 스토리지 모드: 새 빠른 링크가 등록되었습니다.");
  }
  
  titleInput.value = "";
  urlInput.value = "";
  
  renderQuickLinks();
  renderAdminQuickLinks();
}

// 빠른 링크 삭제
async function handleDeleteQuickLink(linkId, title) {
  if (confirm(`정말로 [${title}] 빠른 링크를 삭제하시겠습니까?`)) {
    state.quickLinks = state.quickLinks.filter(l => l.id !== linkId);
    localStorage.setItem('sogang_unity_quicklinks', JSON.stringify(state.quickLinks));
    
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('quick_links')
          .delete()
          .eq('id', linkId);
        if (error) throw error;
        alert("링크가 성공적으로 삭제되었습니다.");
      } catch (err) {
        console.error("Supabase 퀵링크 삭제 실패:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    } else {
      alert("링크가 삭제되었습니다.");
    }
    
    renderQuickLinks();
    renderAdminQuickLinks();
  }
}

// ==================== 실시간 쪽지 알림 및 백그라운드 폴링 기능 ====================

// 실시간 쪽지 폴링 시작
function startDmPolling() {
  // 중복 폴링 등록 방지
  if (state.dmPollingInterval) {
    clearInterval(state.dmPollingInterval);
  }

  // 로그인 상태가 아닌 경우에는 생략
  if (!state.currentUser || state.currentUser.isGuest) return;

  // 진입 시 즉시 1회 체크
  pollNewMessages();

  // 15초 주기로 체크 실행
  state.dmPollingInterval = setInterval(pollNewMessages, 15000);
}

// 신규 쪽지 백그라운드 탐색 루틴 (15초마다 실행되어 안 읽은 쪽지 수와 쪽지함 UI를 동기화)
async function pollNewMessages() {
  if (document.hidden) return; // 사용자가 탭을 최소화하거나 다른 탭을 활성화한 경우 API 호출 차단 (서버 부하 및 트래픽 절약)
  if (!state.currentUser || state.currentUser.isGuest || !supabaseClient) return;

  try {
    // 1. 만약 쪽지함 모달이 열려 있다면 전체 동기화하여 UI와 뱃지를 동시에 갱신
    const dmModal = document.getElementById('dmInboxModal');
    if (dmModal && !dmModal.classList.contains('hidden')) {
      await syncDMs();
      renderDmInbox();
    } else {
      // 2. 쪽지함이 닫혀 있는 경우 백그라운드에서 안 읽은 개수를 확인하여 우측 상단 뱃지만 갱신
      await updateDmUnreadCount();
    }
  } catch (err) {
    console.error("신규 쪽지 폴링 실패:", err);
  }
}
