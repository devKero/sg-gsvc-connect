// 서강대학교 가상융합전문대학원(GSM) 멤버 디렉토리 데이터 (자유 기재 및 개인 방명록 구조)
export const INITIAL_MEMBERS = [
  {
    id: "member_1",
    studentId: "v2026101",
    phoneLast4: "1001",
    name: "김서강",
    classYear: "메타버스 전공",
    generation: 9,
    headline: "유니티 엔진 기반 VR/AR 가상세계 시스템 아키텍처 설계 개발자",
    avatarColor: "#B60005", // 서강 스칼렛 크림슨
    snsLinks: [
      { type: "email", value: "seokang@sogang.ac.kr" },
      { type: "github", value: "https://github.com/sogang-albatross" },
      { type: "blog", value: "https://velog.io/@sogang" }
    ],
    tags: ["Unity", "C#", "VR/AR", "시스템설계"],
    bio: "안녕하세요! 유니티 엔진과 C# 최적화에 관심이 깊은 김서강입니다. 현재 가상융합전문대학원에서 가상현실 렌더링 파이프라인을 연구하고 있으며, 팀 내 핵심 메인 아키텍처 설계를 리드하고 있습니다.",
    projects: "• Sogang Campus VR Tour (2026) - 캠퍼스 가상 투어 기획 및 UI/UX 설계\n• Unity Multi-agent Simulation (2025) - 복수 에이전트 이동 패턴 최적화 연구",
    customContent: "### 💡 보여주고 싶은 저의 연구 & 관심 분야\n\n1. **실시간 가상 공간 최적화**\n- 모바일 및 독립형 VR 기기(Quest 3)에서의 초당 프레임수(FPS) 유지 기술\n- 드로우콜 배칭(Draw Call Batching) 최적화 전략 및 오클루전 컬링 활용\n\n2. **연구 프로젝트 협업 요청**\n- 현재 다중 사용자 가상 강의실 내 동적 아바타 변환 및 모션 캡처 데이터 패킷 최적화 프로젝트를 기획 중입니다. 소켓 기반 백엔드나 리깅 디자인에 관심 있으신 분은 언제든지 연락해주세요!\n\n*연락은 상단의 이메일 혹은 깃허브 이슈를 통해 주시면 감사하겠습니다.*",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_2",
    studentId: "v2026102",
    phoneLast4: "1002",
    name: "이알바",
    classYear: "컴퓨터공학 전공",
    generation: 9,
    headline: "C# 스크립트 메모리 관리 및 3D 물리 연산 최적화 전문 개발자",
    avatarColor: "#1d2d44", // 딥 네이비
    snsLinks: [
      { type: "email", value: "albatross_lee@sogang.ac.kr" },
      { type: "github", value: "https://github.com/bug-slayer" },
      { type: "blog", value: "https://tistory.com" }
    ],
    tags: ["C#", "물리엔진", "디버깅", "최적화"],
    bio: "컴파일 에러 해결과 메모리 누수 수집에 흥미가 깊은 백엔드 겸 클라이언트 개발자 이알바입니다. 대규모 물리 충돌 엔진을 유니티 내에서 실시간 시각화하는 작업을 전문으로 합니다.",
    projects: "• 3D Rigid Body custom solver (2025) - 유니티 내 커스텀 강체 물리 솔버 개발\n• ECS-based Agent Sandbox (2026) - ECS 기반 1만 개 객체 렌더링 최적화",
    customContent: "### 🛠️ 주로 사용하는 기술 스택 및 작업 환경\n\n- **주요 언어**: C# (Advanced), C++, Python\n- **엔진/라이브러리**: Unity Engine, DOTS (ECS/Job System/Burst Compiler)\n- **작업 환경**: Rider, Git, Windows/macOS\n\n### 💬 저의 개발 철학\n\"돌아가는 쓰레기보다 안 돌아가더라도 깨끗하고 논리적인 아키텍처가 낫다. 결국 디버깅 시간이 아키텍처에 의해 좌우되기 때문이다.\"",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_3",
    studentId: "v2026103",
    phoneLast4: "1003",
    name: "박유니",
    classYear: "미디어 테크놀로지",
    generation: 10,
    headline: "HLSL 셰이더 그래픽 프로그래밍 및 인터랙티브 UI/UX 테크니컬 아티스트",
    avatarColor: "#C5A059", // 서강 골드
    snsLinks: [
      { type: "email", value: "yuni_park@sogang.ac.kr" },
      { type: "github", value: "https://github.com/pixel-magician" },
      { type: "blog", value: "https://behance.net" }
    ],
    tags: ["UI/UX", "Shader", "3D아트", "인터랙티브"],
    bio: "기획자와 개발자 사이의 기술적 가교 역할을 맡아 비주얼 완성도를 극대화하는 테크니컬 아티스트 박유니입니다. UI 특수 효과 셰이더 튜닝과 모바일 경량화 렌더링이 핵심 전문 분야입니다.",
    projects: "• Interactive Particle System (2026) - 모바일 환경을 위한 경량화 파티클 연출 팩 제작\n• Neon Cyber Town Art Directing (2025) - 3D 배경 모델링 및 통합 라이트 맵 세팅",
    customContent: "### 🎨 디자인 및 아트 포트폴리오 요약\n\n- **Blender**: 하이폴리곤 모델링 및 섭스턴스 페인터 맵핑 연동\n- **Shader Graph / HLSL**: 물, 불, 네온 글로우 등 커스텀 셰이더 다량 보유\n- **Figma**: 와이어프레임 설계 및 모션 프로토타이핑\n\n> 기획서의 비주얼 구상을 유니티 에셋으로 완벽하게 컴파일해 드립니다. 협업 제안은 언제든 열려 있습니다!",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_4",
    studentId: "v2026104",
    phoneLast4: "1004",
    name: "최코딩",
    classYear: "가상융합 시스템",
    generation: 10,
    headline: "유니티 NavMesh 인공지능 길찾기 및 몬스터 전투 패턴 구현 개발자",
    avatarColor: "#2a9d8f", // 틸 그린
    snsLinks: [
      { type: "email", value: "coding_choi@sogang.ac.kr" },
      { type: "github", value: "https://github.com/choi-coding" },
      { type: "blog", value: "https://github.com" }
    ],
    tags: ["Unity", "NavMesh", "AI패턴", "게임콘텐츠"],
    bio: "수학적 경로 탐색 규칙을 기믹 장애물과 몬스터 에이전트에 이식하는 작업을 주 전공으로 삼고 있습니다. 성실한 커밋 기록과 꼼꼼한 코드 문서를 지향합니다.",
    projects: "• AI Patrol System (2026) - 장애물 회피 능동 네비게이션 메시 구현\n• Level Design Sandbox (2025) - 절차적 맵 생성 툴 키트 제작",
    customContent: "### ✍️ 학습 및 개발 아카이빙\n\n- **공부 중인 분야**: 디자인 패턴(State, Command, Observer), 유니티 신규 네비게이션 패키지\n- **목표**: 10기 프로젝트 중 AI 에이전트의 유기적인 연동 파트를 완벽하게 방어해 내는 것\n\n블로그와 깃허브에 학습 내용을 기록하고 있습니다. 코드 리뷰나 공부 방향성 피드백은 항상 환영합니다!",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_5",
    studentId: "v2026105",
    phoneLast4: "1005",
    name: "정메타",
    classYear: "메타버스 전공",
    generation: 9,
    headline: "VR 소셜 플랫폼 기획 및 멀티플레이 네트워크 룸 아키텍처 설계자",
    avatarColor: "#7209b7", // 퍼플
    snsLinks: [
      { type: "email", value: "meta_jung@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://velog.io" }
    ],
    tags: ["VR", "네트워크", "플랫폼기획", "Photon"],
    bio: "가상현실 속 대규모 동시 접속자 소통 체계를 연구하는 정메타입니다. 포톤(Photon Fusion)과 유니티 넷코드(Netcode)를 사용한 안정적인 패킷 동기화 설계를 구현합니다.",
    projects: "• Multi-user Classroom (2026) - 가상 가상 강의실 룸 패킷 최적화\n• VR Avatar Controller (2025) - VR 환경 내 신체 IK 동기화 모듈 개발",
    customContent: "네트워킹 패킷 최적화에 관심이 많습니다. 협업 문의 환영합니다!",
    avatarImage: null,
    degreeProcess: "박사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_6",
    studentId: "v2026106",
    phoneLast4: "1006",
    name: "강융합",
    classYear: "가상융합 전공",
    generation: 9,
    headline: "유니티 UI Toolkit 및 가상 인물 대화 시스템 인터랙션 주니어 프로그래머",
    avatarColor: "#f72585", // 로즈 핑크
    snsLinks: [
      { type: "email", value: "convergence_kang@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://tistory.com" }
    ],
    tags: ["UI-Toolkit", "대화시스템", "C#", "인터랙션"],
    bio: "유니티의 최신 UI 구조인 UI Toolkit을 적극 활용해 기기 호환성을 높이는 화면을 구성합니다. 노드 기반 대화 이벤트 트리 구현에 경험이 있습니다.",
    projects: "• Sogang WebGL Directory UI (2026) - WebGL 환경 최적화 반응형 UI\n• NPC Dialogue Graph Node (2025) - NPC 대화 이벤트 그래프 노드 에디터 플러그인 제작",
    customContent: "인터랙티브 디자인 및 프론트엔드 최적화에 대한 기술 노트를 블로그에 게재 중입니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "휴학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_7",
    studentId: "v2026107",
    phoneLast4: "1007",
    name: "윤엔진",
    classYear: "컴퓨터공학 전공",
    generation: 10,
    headline: "가상현실 그래픽스 렌더 셰이더 및 URP 커스텀 패스 렌더링 프로그래머",
    avatarColor: "#4361ee", // 블루
    snsLinks: [
      { type: "email", value: "engine_yoon@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://velog.io" }
    ],
    tags: ["URP", "Shader", "그래픽스", "Unity"],
    bio: "유니티 Universal Render Pipeline(URP)을 활용한 시각 효과 연구원입니다. 포스트 프로세싱 및 볼륨 이펙트를 활용한 고급 대기 연출에 강점이 있습니다.",
    projects: "• URP Custom Outline Shader (2026) - URP 기반 카툰 렌더링 아웃라인 셰이더 개발\n• Raymarching Fog in Unity (2025) - 레이마칭 기반 볼류메트릭 안개 효과 연출",
    customContent: "URP 커스텀 렌더 패스를 이용한 고효율 외곽선, 안개 효과를 작업해 둔 깃허브가 오픈되어 있습니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_8",
    studentId: "v2026108",
    phoneLast4: "1008",
    name: "신그래픽",
    classYear: "아트&테크놀로지",
    generation: 10,
    headline: "Blender 3D 캐릭터 모델링 및 유니티 리깅/애니메이션 테크니컬 아티스트",
    avatarColor: "#f77f00", // 오렌지
    snsLinks: [
      { type: "email", value: "graphic_shin@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://behance.net" }
    ],
    tags: ["Blender", "3D모델링", "애니메이션", "Rigging"],
    bio: "블렌더(Blender)를 활용한 3D 캐릭터 생성부터 유니티 Humanoid 리깅 시스템 이식까지 전방위 3D 파이프라인을 책임집니다. 프레임 누수 없는 정밀 리깅을 연구합니다.",
    projects: "• Albatross 3D Character (2026) - 서강대 가상 캐릭터 3D 모델 및 애니메이션 리깅\n• Asset Optimization Guideline (2025) - 폴리곤 다이어트를 통한 모바일 최적화 가이드 수립",
    customContent: "Blender와 Unity 간 최적 FBX 익스포트 세팅 리포트를 포트폴리오 사이트에서 확인해 보실 수 있습니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_9",
    studentId: "v2026109",
    phoneLast4: "1009",
    name: "송서버",
    classYear: "가상융합 시스템",
    generation: 9,
    headline: "유니티 전용 멀티서버 설계 및 MySQL 데이터베이스 연동 개발자",
    avatarColor: "#4a4e69", // 그레이 블루
    snsLinks: [
      { type: "email", value: "server_song@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://tistory.com" }
    ],
    tags: ["서버설계", "MySQL", "Node.js", "DB연동"],
    bio: "동시 접속자의 게임 상태 저장 및 계정 정보 연동을 위한 백엔드 인프라를 개발합니다. Node.js 소켓 서버와 MySQL 데이터베이스 연동이 가능합니다.",
    projects: "• Member Account DB API (2026) - 가상현실 디렉토리용 백엔 템플릿 REST API 구현\n• Socket.io Sync Server (2025) - WebGL 게임 동기화용 경량 소켓 서버 운영",
    customContent: "동접자 동기화 성능 최적화에 대한 기술 블로그 포스팅 중입니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "졸업",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_10",
    studentId: "v2026110",
    phoneLast4: "1010",
    name: "임오디오",
    classYear: "미디어 테크놀로지",
    generation: 10,
    headline: "가상현실 입체 음향 설계 및 FMOD 오디오 미들웨어 엔진 통합 프로그래머",
    avatarColor: "#d90429", // 레드
    snsLinks: [
      { type: "email", value: "audio_lim@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://github.com" }
    ],
    tags: ["FMOD", "입체음향", "사운드디자인", "오디오"],
    bio: "가상 환경 내 거리감과 반사음을 반영하는 3D 공간 음향을 프로그래밍합니다. 유니티 내부에 FMOD 스튜디오 엔진을 마운트하여 동적인 사운드를 조정합니다.",
    projects: "• 3D HRTF Spatializer Test (2026) - 머리전달함수 기반 오디오 위치 테스트\n• Dynamic BG Mixer (2025) - 게임 긴장도에 반응하는 동적 오디오 믹서 구축",
    customContent: "FMOD 이벤트를 유니티 C# 스크립트로 유연하게 트리거하는 오디오 프레임워크 에셋을 공유 중입니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_11",
    studentId: "v2026111",
    phoneLast4: "1011",
    name: "한인공",
    classYear: "인공지능 전공",
    generation: 9,
    headline: "머신러닝 에이전트(ML-Agents) 강화학습 기반 게임 캐릭터 지능 구현원",
    avatarColor: "#00f5d4", // 민트
    snsLinks: [
      { type: "email", value: "ai_han@sogang.ac.kr" },
      { type: "github", value: "https://github.com" },
      { type: "blog", value: "https://velog.io" }
    ],
    tags: ["ML-Agents", "강화학습", "인공지능", "C#"],
    bio: "유니티 텐서플로우 래퍼인 ML-Agents를 사용해 플레이어와 대적하는 자가 학습 인공지능을 구현합니다. 신경망 모델 경량화에 관심이 깊습니다.",
    projects: "• Self-Driving Car ML (2026) - 강화학습 기반 트랙 자율주행 시뮬레이터 제작\n• Boss Monster Behavior Training (2025) - 보스 캐릭터의 행동 패턴 강화학습 훈련",
    customContent: "강화학습 리워드 함수 설계 및 에이전트 의사결정 속도 개선에 관심을 두고 있습니다.",
    avatarImage: null,
    degreeProcess: "석박통합",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  {
    id: "member_12",
    studentId: "v2026112",
    phoneLast4: "1012",
    name: "민기획",
    classYear: "메타버스 전공",
    generation: 10,
    headline: "사용자 잔류 시간 최적화를 위한 3D 가상 공간 서비스 및 레벨 기획자",
    avatarColor: "#ff9f1c", // 골드 오렌지
    snsLinks: [
      { type: "email", value: "planning_min@sogang.ac.kr" },
      { type: "blog", value: "https://velog.io" }
    ],
    tags: ["레벨디자인", "서비스기획", "가상경제", "UI-UX"],
    bio: "수강생들이 몰입감을 느끼는 공간 가독성과 퀘스트 동선 배치를 설계합니다. 메타버스 가상 경제 시스템 설계 및 수치 밸런싱이 주 특기입니다.",
    projects: "• Virtual Expo Level Map (2026) - 가상 전시회 동선 구조 분석 및 설계\n• Economy balance simulator (2025) - 토큰 이코노미 밸런싱용 스프레드시트 툴 배포",
    customContent: "가상현실 사용자 몰입도 분석 툴과 기획 수치 모델링 엑셀 템플릿을 보유하고 있습니다.",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "member"
  },
  // 시스템 관리자 특별 계정
  {
    id: "admin",
    studentId: "admin",
    phoneLast4: "sogang_gsvc_admin2026!",
    name: "시스템 관리자",
    classYear: "디렉토리 관리",
    generation: null,
    headline: "서강대 가상융합전문대학원(GSM) 멤버 디렉토리 관리자 계정",
    avatarColor: "#111111",
    snsLinks: [
      { type: "email", value: "admin@sogang.ac.kr" }
    ],
    tags: ["관리자", "시스템"],
    bio: "서강대 가상융합전문대학원(GSM) 디렉토리의 멤버 정보를 수정/추가/삭제할 수 있는 최고 권한 계정입니다.",
    projects: "",
    customContent: "",
    avatarImage: null,
    degreeProcess: "석사",
    academicStatus: "재학",
    education: "",
    experience: "",
    role: "super_admin"
  }
];

export const INITIAL_GUESTBOOK = [
  {
    id: "comment_1",
    targetMemberId: "member_1", // 김서강 프로필 방명록
    author: "서강대_동문회",
    message: "서강대 가상융합전문대학원 9기 김서강 팀장님 파이팅입니다! 멋진 포트폴리오네요.",
    tag: "cheer",
    isPrivate: false, // 공개
    timestamp: "2026-05-26 16:45:12",
    likes: 5
  },
  {
    id: "comment_2",
    targetMemberId: "member_2", // 이알바 프로필 방명록
    author: "박교수",
    message: "이알바 학생, ECS 물리 최적화 기획서 확인했습니다. 다음 주 랩실 미팅에서 논의해봅시다.",
    tag: "feedback",
    isPrivate: false, // 공개
    timestamp: "2026-05-26 17:05:30",
    likes: 12
  },
  {
    id: "comment_3",
    targetMemberId: "member_1", // 김서강 프로필 방명록
    author: "이알바",
    message: "팀장님, 이번 주 URP 커스텀 아웃라인 셰이더 관련 빌드 에러 이슈에 대해 비공개로 문의드립니다.",
    tag: "question",
    isPrivate: true, // 비공개
    timestamp: "2026-05-26 17:15:00",
    likes: 0
  },
  {
    id: "comment_4",
    targetMemberId: "member_1", // 김서강 프로필 방명록
    author: "외부_협업사",
    message: "김서강 님, 비공개로 남깁니다. Quest 3 가상공간 최적화 관련하여 이메일로 비즈니스 제안서 발송해 드렸습니다. 검토 부탁드립니다.",
    tag: "coffee",
    isPrivate: true, // 비공개
    timestamp: "2026-05-26 17:22:15",
    likes: 0
  }
];

export const INITIAL_MAJORS = [
  "메타버스 전공",
  "컴퓨터공학 전공",
  "미디어 테크놀로지",
  "아트&테크놀로지",
  "가상융합 시스템",
  "인공지능 전공"
];
