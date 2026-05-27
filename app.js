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
  members: [],
  guestbook: [],
  currentUser: null,       // { id, name, classYear, isGuest, generation }
  selectedMemberId: null,  // 모달에 열린 멤버 ID
  searchTerm: '',          // 검색어
  adminSearchTerm: '',     // 운영 대시보드 검색어
  adminSelectedGeneration: '', // 운영 대시보드 기수 필터
  adminSelectedRole: '',       // 운영 대시보드 권한 필터
  excelParsedData: [],         // 엑셀 파싱 원본 데이터
  excelConflictsCount: 0,      // 엑셀 내 중복 학번 총합
  excelConflictsResolvedCount: 0, // 해결된 중복 학번 수
  selectedTag: '',         // 선택된 해시태그 필터
  selectedGeneration: '',  // 선택된 기수 필터 ("" 이면 전체 기수)
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
  unreadNotifCount: 0       // 미확인 알림 수
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
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
    if (links.length >= 5) {
      addBtn.disabled = true;
      addBtn.classList.add('disabled');
      addBtn.title = "소셜 링크는 최대 5개까지만 등록할 수 있습니다.";
    } else {
      addBtn.disabled = false;
      addBtn.classList.remove('disabled');
      addBtn.title = "";
    }
  }
}

// ==================== 앱 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  initLocalStorage();
  await syncWithSupabase();
  setupEventListeners();
  checkSession();
});

// 로컬 스토리지 데이터 로드 및 초기화
function initLocalStorage() {
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

    // 3. majors 테이블 데이터 조회 제거됨

    // 만약 클라우드에 멤버 데이터가 아예 없다면, 초기 멤버 12인을 클라우드에 벌크 인서트(시드 데이터 주입)
    if (dbMembers.length === 0) {
      console.log("Supabase에 초기 데이터가 없어 INITIAL_MEMBERS 시드 데이터를 주입합니다...");
      const { error: seedError } = await supabaseClient
        .from('members')
        .insert(state.members.map(m => ({
          id: m.id,
          student_id: m.studentId,
          phone_last4: m.phoneLast4,
          name: m.name,
          email: m.email || "",
          class_year: m.classYear,
          generation: m.generation,
          headline: m.headline,
          avatar_color: m.avatarColor,
          sns_links: m.snsLinks || [],
          tags: m.tags,
          bio: m.bio,
          projects: m.projects,
          custom_content: m.customContent,
          avatar_image: m.avatarImage,
          degree_process: m.degreeProcess || "석사",
          academic_status: m.academicStatus || "재학",
          education: m.education || "",
          experience: m.experience || "",
          role: m.role || "member"
        })));
      if (seedError) throw seedError;
      
      // 방명록 시드 데이터도 주입
      const { error: seedGuestError } = await supabaseClient
        .from('guestbook')
        .insert(state.guestbook.map(g => ({
          target_member_id: g.targetMemberId,
          author: g.author,
          message: g.message,
          tag: g.tag,
          is_private: g.isPrivate,
          timestamp: g.timestamp,
          likes: g.likes || 0
        })));
      if (seedGuestError) throw seedGuestError;

      console.log("Supabase 시드 데이터 주입 완료!");
      
      // 주입 후 다시 로드
      await syncWithSupabase();
    } else {
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
          role: m.role || "member"
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

      // 전공 목록 동기화 제거됨
    }
    console.log("Supabase 클라우드 데이터베이스와 양방향 동기화 완료.");
  } catch (err) {
    console.error("Supabase 데이터 연동 실패 (로컬 스토리지 오프라인 모드 유지):", err);
  }
  
  // 알림 갱신
  updateNotifications();
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
    renderMembersGrid();
  });

  // 기수 필터 변경
  document.getElementById('generationFilter').addEventListener('change', (e) => {
    state.selectedGeneration = e.target.value;
    state.selectedTag = '';
    const clearBtn = document.getElementById('clearFilterBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    renderFilterTags();
    renderMembersGrid();
  });

  // 태그 필터 초기화 버튼
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    state.selectedTag = '';
    state.tagSearchTerm = '';
    const tagSearchInput = document.getElementById('tagSearchInput');
    if (tagSearchInput) tagSearchInput.value = '';
    document.getElementById('clearFilterBtn').classList.add('hidden');
    document.querySelectorAll('.btn-tag').forEach(b => b.classList.remove('active'));
    renderFilterTags();
    renderMembersGrid();
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
  const openAddMemberBtn = document.getElementById('openAddMemberModalBtn');
  if (openAddMemberBtn) {
    openAddMemberBtn.addEventListener('click', openAddMemberModal);
  }
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

  // 동적 SNS 링크 추가 버튼 이벤트
  const btnAddEditSnsLink = document.getElementById('btnAddEditSnsLink');
  if (btnAddEditSnsLink) {
    btnAddEditSnsLink.addEventListener('click', () => {
      if (state.editSnsLinks.length < 5) {
        state.editSnsLinks.push({ type: 'github', value: '' });
        renderSnsLinksInputArea('editSnsLinksContainer', state.editSnsLinks);
      }
    });
  }

  const btnAddAddSnsLink = document.getElementById('btnAddAddSnsLink');
  if (btnAddAddSnsLink) {
    btnAddAddSnsLink.addEventListener('click', () => {
      if (state.addSnsLinks.length < 5) {
        state.addSnsLinks.push({ type: 'github', value: '' });
        renderSnsLinksInputArea('addSnsLinksContainer', state.addSnsLinks);
      }
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
    errorEl.classList.add('hidden');
    
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
  renderGenerationSelectorOptions();
  renderMembersGrid();
  renderFilterTags();
  
  // 알림 상태 업데이트
  updateNotifications();
}

// 사용자 로그인 상태에 따른 UI 동기화
function updateUserInfoUI() {
  const user = state.currentUser;
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
  
  const openAddBtn = document.getElementById('openAddMemberModalBtn');
  if (state.isAdmin) {
    if (state.isSuperAdmin) {
      headlineEl.innerText = "디렉토리 최고 시스템 운영진 계정입니다.";
    } else {
      headlineEl.innerText = "디렉토리 부운영진 계정입니다.";
    }
    if (adminPanelEl) adminPanelEl.classList.remove('hidden');
    if (openAddBtn) openAddBtn.classList.remove('hidden');
  } else {
    if (adminPanelEl) adminPanelEl.classList.add('hidden');
    if (openAddBtn) openAddBtn.classList.add('hidden');
    if (user.isGuest) {
      headlineEl.innerText = "프로필을 직접 등록하고 편집하고 싶다면 학번으로 로그인해 주세요.";
    } else {
      headlineEl.innerText = matchedMember ? matchedMember.headline : "서강대 가상융합전문대학원(GSVC)의 정식 구성원입니다.";
    }
  }

  const sidebarEditBtnEl = document.getElementById('sidebarEditProfileBtn');
  if (sidebarEditBtnEl) {
    if (user.isGuest) {
      sidebarEditBtnEl.classList.add('hidden');
    } else {
      sidebarEditBtnEl.classList.remove('hidden');
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

  // 운영 기수 필터 드롭다운 동적 갱신 (선택 상태 보존)
  const adminGenSelect = document.getElementById('adminGenFilter');
  if (adminGenSelect) {
    const prevVal = state.adminSelectedGeneration;
    adminGenSelect.innerHTML = '<option value="">모든 기수</option>';
    const gens = [...new Set(nonAdminMembers
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

  // 1. 통계 수치 업데이트
  const totalCount = nonAdminMembers.length;
  
  const adminCount = nonAdminMembers.filter(m => 
    m.role === 'super_admin' || m.role === 'admin'
  ).length;
  
  const generations = [...new Set(nonAdminMembers
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

  // 실시간 검색어, 기수 필터, 권한 필터 AND 조건 적용
  const filtered = nonAdminMembers.filter(m => {
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
    if (state.adminSelectedRole) {
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
    } else {
      roleBadgeHtml = `<span class="admin-role-badge member"><i class="fa-solid fa-user"></i> 원우</span>`;
    }

    const isChecked = member.role === "admin" || member.role === "super_admin";
    const isSuperAdminDisabled = member.role === "super_admin";
    // 최고 운영진만 권한 토글을 변경할 수 있도록 제한
    const isToggleDisabled = !state.isSuperAdmin || isSuperAdminDisabled;

    const toggleHtml = `
      <label class="admin-toggle-switch">
        <input type="checkbox" class="role-toggle-checkbox" data-id="${member.id}" 
          ${isChecked ? 'checked' : ''} 
          ${isToggleDisabled ? 'disabled' : ''}>
        <span class="admin-toggle-slider"></span>
      </label>
    `;

    const manageButtonsHtml = `
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-light btn-sm admin-edit-btn" data-id="${member.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px;">
          <i class="fa-solid fa-pen"></i> 수정
        </button>
        <button class="btn btn-light btn-sm admin-delete-btn" data-id="${member.id}" 
          ${isSuperAdminDisabled ? 'disabled' : ''} 
          style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 4px; color: var(--color-sogang); border-color: rgba(179,8,56,0.2);">
          <i class="fa-solid fa-trash-can"></i> 삭제
        </button>
      </div>
    `;

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

    // 2) 편집 버튼 이벤트
    tr.querySelector('.admin-edit-btn').addEventListener('click', () => {
      openProfileModal(member.id);
      enableEditMode();
    });

    // 3) 삭제 버튼 이벤트
    const delBtn = tr.querySelector('.admin-delete-btn');
    if (delBtn && !isSuperAdminDisabled) {
      delBtn.addEventListener('click', async () => {
        await handleDeleteMember(member.id, member.name);
      });
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

// 기수 필터 셀렉터 옵션 렌더링
function renderGenerationSelectorOptions() {
  const select = document.getElementById('generationFilter');
  select.innerHTML = '<option value="">전체 기수</option>';

  const gens = [...new Set(state.members
    .filter(m => m.id !== 'admin' && m.generation)
    .map(m => m.generation)
  )].sort((a, b) => a - b);

  gens.forEach(gen => {
    const opt = document.createElement('option');
    opt.value = String(gen);
    opt.innerText = `${gen}기`;
    select.appendChild(opt);
  });

  select.value = state.selectedGeneration;
}

// 멤버 카드 그리드 렌더링
function renderMembersGrid() {
  const gridContainer = document.getElementById('membersGrid');
  gridContainer.innerHTML = "";

  // 필터링 적용
  const filtered = state.members.filter(member => {
    if (member.id === 'admin') return false;

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

    return matchesSearch && matchesTag && matchesGen;
  });

  // 멤버 수 헤더 텍스트 갱신
  const countText = document.getElementById('memberCountText');
  if (state.searchTerm || state.selectedTag || state.selectedGeneration) {
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

  // 카드 그리기
  filtered.forEach(member => {
    const card = document.createElement('article');
    card.className = 'member-card';
    const genColor = getGenerationColor(member.generation);
    card.style.setProperty('--cohort-color', genColor);
    
    const avatarBg = member.avatarColor || '#B30838';
    const tagsHtml = (member.tags || []).map(tag => `<span class="card-tag">#${escapeHtml(tag)}</span>`).join('');

    const snsOnlyIconsHtml = getSnsLinksCardHtml(member.snsLinks);

    card.innerHTML = `
      ${state.isAdmin ? `
        <button class="card-delete-btn" data-id="${member.id}" title="원우 삭제">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      ` : ''}
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
        <div class="card-contacts" style="display:flex; justify-content:center; gap:0.5rem; ${member.email ? '' : 'border-top:1px solid #f3f2ef; padding-top:0.4rem;'}">
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

    // 운영진 멤버 삭제 단추 이벤트
    if (state.isAdmin) {
      card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteMember(member.id, member.name);
      });
    }

    // 상세 보기 버튼 클릭
    card.querySelector('.btn-view-profile').addEventListener('click', () => {
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
      renderMembersGrid();
    });

    container.appendChild(btn);
  });
}

// ==================== 모달 상세 뷰 및 편집 제어 ====================
function openProfileModal(memberId) {
  state.selectedMemberId = memberId;
  const member = state.members.find(m => m.id === memberId);
  if (!member) return;

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

  // 2. 편집 권한 체크 (본인 또는 운영진)
  const editBtn = document.getElementById('editProfileBtn');
  const canEdit = state.currentUser && !state.currentUser.isGuest && (state.currentUser.id === member.id || state.isAdmin);
  if (canEdit) {
    editBtn.classList.remove('hidden');
  } else {
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
    if (state.isAdmin) {
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
  renderGenerationSelectorOptions(); // 기수 목록 갱신
  
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
  renderGenerationSelectorOptions();
  renderMembersGrid();
  renderFilterTags();
  renderAdminDashboard();

  alert(`${name} 님이 디렉토리의 ${generation}기 구성원으로 성공적으로 추가되었습니다.`);
}

// 멤버 삭제 처리 핸들러
async function handleDeleteMember(memberId, name) {
  if (confirm(`정말로 [${name}] 원우을 디렉토리에서 영구 삭제하시겠습니까?\n삭제된 계정 정보는 복구할 수 없으며 로그인이 차단됩니다.`)) {
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
        console.error("Supabase 멤버 삭제 에러:", err);
        alert("클라우드 서버 동기화 실패 (로컬 스토리지에만 반영됩니다)");
      }
    }

    renderGenerationSelectorOptions();
    renderMembersGrid();
    renderFilterTags();
    renderAdminDashboard();

    alert(`원우 [${name}] 데이터가 안전하게 파기되었습니다.`);
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
      <div class="comment-footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; padding-top:0.3rem; border-top:1px solid #f6f6f6;">
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
      "비밀번호 뒷자리 (4자리 필수)",
      "한줄소개",
      "이메일"
    ];
    
    const sampleRow = [
      "v2026113",
      "홍길동",
      10,
      "메타버스 전공",
      "석사",
      "1234",
      "인터랙티브 3D 콘텐츠 최적화에 관심이 있는 프로그래머",
      "hong@sogang.ac.kr"
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
      { wch: 28 }, // 비밀번호 뒷자리
      { wch: 50 }, // 한줄소개
      { wch: 25 }  // 이메일
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
          headline: String(rowData[6] || "").trim(),
          email: String(rowData[7] || "").trim()
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
  renderGenerationSelectorOptions();
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
