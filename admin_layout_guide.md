# 운영진 멤버 관리 테이블 가로 스크롤 및 배치 개선 가이드

본 문서는 모바일 및 PC 환경에서 운영진 멤버 관리 테이블의 레이아웃이 찌그러지거나 줄바꿈(wrapping)되는 현상을 해결하고, 모바일에서도 전체 컬럼(이름, 학번, 기수, 전공, 학위 등)을 깔끔하게 가로 스크롤하여 조회할 수 있는 개선 CSS 적용 가이드를 제공합니다.

---

## 1. 개선 핵심 요약

1. **테이블 최소 폭 지정 (`min-width`)**: 
   PC의 좁은 브라우저 창이나 모바일 뷰에서 테이블이 임의로 작아지는 것을 방지하여, 레이아웃 뭉개짐 없이 가로 스크롤바가 생기도록 설정합니다.
2. **전공 및 학위 컬럼 노출 (모바일)**:
   기존 모바일 뷰에서 공간 부족을 이유로 숨겼던 4번째(전공), 5번째(학위) 컬럼을 가로 스크롤을 활용하여 모바일에서도 정상 노출시킵니다.
3. **줄바꿈 방지 (`white-space: nowrap`)**:
   모든 셀의 텍스트가 강제로 다음 줄로 줄바꿈되는 것을 방지하고 한 줄 배치를 유지합니다.

---

## 2. styles.css 적용 코드 스케치 (준비안)

추후 레이아웃 적용 시 `styles.css` 파일의 미디어 쿼리 및 테이블 스타일 부분에 아래 코드를 반영할 수 있습니다.

### ① PC 및 기본 테이블 스타일 보강 (줄바꿈 방지 및 최소 폭 보장)
```css
/*styles.css 2994라인 근처 .admin-table-wrap 및 .admin-member-table 부분 수정 */

.admin-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch; /* iOS 모바일 스크롤 부드럽게 */
}

.admin-member-table {
  width: 100%;
  min-width: 950px; /* PC 해상도가 작아지거나 모바일일 때 테이블 뭉개짐 방지를 위한 최소 너비 */
  border-collapse: collapse;
  text-align: left;
  font-size: 0.88rem;
  table-layout: fixed; /* 고정 너비 레이아웃 적용 */
}

/* 각 열(Column)의 너비를 명시적으로 고정하여 배치를 고르게 만듦 */
.admin-member-table th:nth-child(1), .admin-member-table td:nth-child(1) { width: 100px; } /* 이름 */
.admin-member-table th:nth-child(2), .admin-member-table td:nth-child(2) { width: 110px; } /* 학번 */
.admin-member-table th:nth-child(3), .admin-member-table td:nth-child(3) { width: 80px;  } /* 기수 */
.admin-member-table th:nth-child(4), .admin-member-table td:nth-child(4) { width: 180px; } /* 전공 */
.admin-member-table th:nth-child(5), .admin-member-table td:nth-child(5) { width: 90px;  } /* 학위 */
.admin-member-table th:nth-child(6), .admin-member-table td:nth-child(6) { width: 190px; } /* 권한 */
.admin-member-table th:nth-child(7), .admin-member-table td:nth-child(7) { width: 200px; } /* 관리 버튼 */

.admin-member-table th {
  background-color: var(--color-bg-input);
  color: var(--color-text-sub);
  font-weight: 600;
  padding: 0.75rem 0.5rem;
  border-bottom: 2px solid var(--color-border);
  font-size: 0.82rem;
  white-space: nowrap;
}

.admin-member-table td {
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-main);
  vertical-align: middle;
  font-size: 0.82rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
```

### ② 모바일 미디어 쿼리 수정 (전공/학위 열 복구 및 스크롤 바인딩)
```css
/* styles.css 2045라인 근처 @media (max-width: 768px) 내부 수정 */

@media (max-width: 768px) {
  /* [제거 및 변경] 모바일 대시보드 테이블에서 전공(4번째), 학위(5번째)를 숨기던 코드를 제거합니다. */
  /*
  .admin-member-table th:nth-child(4),
  .admin-member-table td:nth-child(4),
  .admin-member-table th:nth-child(5),
  .admin-member-table td:nth-child(5) {
    display: none !important; 
  }
  */

  /* 모바일 환경에서도 테이블의 최소 폭(950px)이 적용되어 가로 스크롤로 전체 열을 조회할 수 있게 됩니다. */
  .admin-member-table {
    min-width: 950px !important;
  }
}
```

---

## 3. 적용 효과

- **PC 환경**: 화면 폭을 절반으로 줄이거나 해상도가 낮은 디바이스에서 관리자 페이지를 조회하더라도 이름, 전공, 관리 버튼 등이 찌그러지지 않고 고정 너비로 정렬되며, 화면을 넘어가는 경우 가로 스크롤을 통해 부드럽게 확인할 수 있습니다.
- **모바일 환경**: 이름과 학번, 기수만 보이고 전공/학위가 잘려 나가던 현상이 해결되고, 전체 테이블을 한눈에 오른쪽으로 밀어가며 손쉽게 멤버 상태를 파악하고 권한 및 관리를 조작할 수 있습니다.
