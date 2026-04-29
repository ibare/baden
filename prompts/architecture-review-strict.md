# Architecture Review — Strict Mode

프로젝트의 아키텍처를 엄격하게 점검한다. 추론하지 않는다. 코드를 직접 읽고 판정한다.

---

## 원칙

- 모든 판정은 **코드를 직접 읽은 결과**에 근거한다. "아마 이럴 것이다"는 판정이 아니다.
- 판정이 애매하면 **위반으로 판정**한다. 의심의 이익을 코드에 주지 않는다.
- 각 항목에 대해 **파일명, 줄 번호, 코드 스니펫**을 근거로 제시한다.
- 근거 없는 PASS는 허용하지 않는다.

---

## Step 1: 구조 스캔

코드를 읽기 전에 전체 구조를 파악한다.

```bash
# 디렉터리 구조
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' | head -500

# 언어별 파일 수
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20

# 코드 규모
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" \) -not -path '*/node_modules/*' -not -path '*/.git/*' | xargs wc -l 2>/dev/null | tail -1

# 패키지/모듈 구조
ls -la
cat package.json 2>/dev/null || cat go.mod 2>/dev/null || cat requirements.txt 2>/dev/null || cat Cargo.toml 2>/dev/null || cat pom.xml 2>/dev/null
```

구조 파악 결과를 기록한다:

```
### 프로젝트 개요
- 언어:
- 프레임워크:
- 모노레포 여부:
- 앱/패키지 수:
- 총 소스 파일 수:
- 총 코드 라인 수:
```

---

## Step 2: 의존성 방향 검증

**위반 기준: 하위 모듈이 상위 모듈을 import하거나, 동일 레이어 간 순환 의존이 존재하면 위반.**

```bash
# import/require 패턴 전수 추출
grep -rn "import.*from\|require(" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v dist

# Python
grep -rn "^from\|^import" --include="*.py" | grep -v __pycache__ | grep -v venv

# 순환 의존 후보: A→B와 B→A가 동시에 존재하는 쌍 탐색
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| D-1 | 레이어 역전 | core/shared가 app/feature 레이어를 import하면 위반 |
| D-2 | 순환 의존 | 모듈 A↔B 양방향 import이 존재하면 위반 |
| D-3 | 우회 의존 | 인터페이스/타입을 통하지 않고 구현체를 직접 import하면 위반 |
| D-4 | 외부 노출 | 내부 모듈을 public API 없이 직접 경로로 import하면 위반 |

---

## Step 3: 단일 책임 검증

**위반 기준: 하나의 파일/클래스/함수가 두 개 이상의 도메인 책임을 수행하면 위반.**

```bash
# 거대 파일 탐색 (300줄 이상)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" \) -not -path '*/node_modules/*' | xargs wc -l 2>/dev/null | sort -rn | head -30

# 거대 함수 탐색 (50줄 이상)
# 언어에 맞는 패턴으로 함수 경계를 찾아 줄 수를 카운트한다

# 클래스/모듈의 public 메서드 수 (10개 이상이면 의심)
grep -c "public\|export.*function\|def " {파일} 
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| S-1 | 거대 파일 | 500줄 이상이면서 단일 책임으로 정당화할 수 없으면 위반 |
| S-2 | 거대 함수 | 50줄 이상이면서 분리 가능한 로직이 혼합되어 있으면 위반 |
| S-3 | God 클래스 | public 메서드 15개 이상 또는 3개 이상 도메인 책임이면 위반 |
| S-4 | 혼합 레이어 | 핸들러/컨트롤러에 비즈니스 로직이 직접 포함되면 위반 |
| S-5 | 유틸 덤프 | utils/helpers 파일이 무관한 함수들의 모음이면 위반 |

300줄 이상 파일은 **전부 읽고** 책임이 단일한지 판정한다.

---

## Step 4: 공유 자원 관리 검증

**위반 기준: 싱글턴/공유 인스턴스로 관리해야 하는 자원을 여러 곳에서 직접 생성하면 위반.**

```bash
# DB 클라이언트 직접 생성
grep -rn "new.*Client\|create.*Connection\|connect(" --include="*.ts" --include="*.py" --include="*.go" | grep -v node_modules | grep -v test

# HTTP 클라이언트 직접 생성
grep -rn "new.*Http\|axios\.create\|requests\.Session\|http\.Client{" --include="*.ts" --include="*.py" --include="*.go" | grep -v node_modules

# 설정 직접 로딩
grep -rn "process\.env\.\|os\.environ\|os\.Getenv" --include="*.ts" --include="*.py" --include="*.go" | grep -v node_modules | grep -v config
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| R-1 | DB 클라이언트 | 2곳 이상에서 직접 생성하면 위반 |
| R-2 | HTTP 클라이언트 | 공유 인스턴스 없이 각 파일에서 직접 생성하면 위반 |
| R-3 | 환경 변수 | config 모듈 없이 코드 전역에서 process.env 직접 접근하면 위반 |
| R-4 | 캐시/큐 | 연결 객체가 중앙 관리되지 않으면 위반 |

---

## Step 5: 에러 처리 검증

**위반 기준: 에러가 삼켜지거나, 일관되지 않은 방식으로 처리되면 위반.**

```bash
# catch 후 에러 처리 패턴
grep -rn -A5 "catch\|except\|rescue" --include="*.ts" --include="*.py" --include="*.go" | grep -v node_modules | grep -v test

# 빈 catch 블록
grep -rn -A2 "catch.*{" --include="*.ts" | grep -v node_modules | grep "}"

# console.log로만 에러 처리
grep -rn "catch" --include="*.ts" -A3 | grep "console\.\(log\|error\)" | grep -v node_modules
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| E-1 | 삼킨 에러 | catch 후 로깅만 하고 재전파하지 않으면 위반 (의도적 흡수는 주석 필수) |
| E-2 | 빈 catch | catch 블록이 비어있으면 무조건 위반 |
| E-3 | 비일관 응답 | API 에러 응답 형식이 엔드포인트마다 다르면 위반 |
| E-4 | 미처리 Promise | .then() 체인에 .catch()가 없거나, async 함수에 try-catch 없이 throw 가능성이 있으면 위반 |
| E-5 | 에러 타입 | 커스텀 에러 클래스 없이 문자열이나 제네릭 Error만 throw하면 위반 |

---

## Step 6: 하드코딩 검증

**위반 기준: 변경 가능한 값이 코드에 직접 박혀있으면 위반.**

```bash
# 매직 넘버
grep -rn "[^a-zA-Z][0-9]\{3,\}[^a-zA-Z]" --include="*.ts" --include="*.py" | grep -v node_modules | grep -v test | grep -v "\.d\.ts"

# 하드코딩 URL
grep -rn "http://\|https://" --include="*.ts" --include="*.py" | grep -v node_modules | grep -v test | grep -v config | grep -v "\.d\.ts"

# 하드코딩 문자열 (에러 메시지, 상태값 등)
grep -rn "status.*=.*['\"]" --include="*.ts" | grep -v node_modules | grep -v test | grep -v types | grep -v enum | grep -v const
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| H-1 | 매직 넘버 | 의미 없는 숫자가 로직에 직접 사용되면 위반 (배열 인덱스 0, HTTP 상태코드 등 관례적 예외 있음) |
| H-2 | 하드코딩 URL | 환경별로 달라질 수 있는 URL이 코드에 직접 있으면 위반 |
| H-3 | 문자열 상수 | 여러 파일에서 동일 문자열이 반복되면 위반 |
| H-4 | 설정값 | 타임아웃, 재시도 횟수, 페이지 크기 등이 상수로 추출되지 않았으면 위반 |

---

## Step 7: API 설계 검증 (해당 시)

API 서버가 존재하는 경우에만 수행한다.

```bash
# 라우트 전수 추출
grep -rn "router\.\(get\|post\|put\|patch\|delete\)\|@\(Get\|Post\|Put\|Patch\|Delete\)\|@app\.\(get\|post\|put\|patch\|delete\)" --include="*.ts" --include="*.py" --include="*.go" | grep -v node_modules

# 응답 형식 패턴
grep -rn "res\.\(json\|send\|status\)\|return.*Response\|JSONResponse\|jsonify" --include="*.ts" --include="*.py" | grep -v node_modules | head -50

# 인증/권한 미들웨어 적용 여부
grep -rn "auth\|middleware\|guard\|protect\|require.*login\|@login_required" --include="*.ts" --include="*.py" | grep -v node_modules
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| A-1 | 응답 일관성 | 통일된 응답 래퍼 없이 각 엔드포인트가 자유 형식이면 위반 |
| A-2 | 인증 누락 | 보호되어야 할 엔드포인트에 인증 미들웨어가 없으면 위반 |
| A-3 | 입력 검증 | 요청 body/params 검증 없이 직접 사용하면 위반 |
| A-4 | 에러 응답 | 에러 시 스택 트레이스가 클라이언트에 노출되면 위반 |
| A-5 | 네이밍 | REST 컨벤션을 따르지 않으면 위반 (동사 URL, 불일치 HTTP 메서드 등) |

---

## Step 8: 테스트 검증

```bash
# 테스트 파일 수
find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" -o -name "*_test.*" \) -not -path '*/node_modules/*' | wc -l

# 소스 파일 대비 테스트 비율
echo "소스: $(find . -type f \( -name '*.ts' -o -name '*.py' \) -not -path '*/node_modules/*' -not -name '*.test.*' -not -name '*.spec.*' | wc -l)"
echo "테스트: $(find . -type f \( -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' \) -not -path '*/node_modules/*' | wc -l)"

# 테스트 커버리지 설정 존재 여부
cat jest.config* vitest.config* pytest.ini setup.cfg pyproject.toml 2>/dev/null | grep -i "coverage\|cov"
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| T-1 | 테스트 부재 | 핵심 비즈니스 로직에 테스트가 없으면 위반 |
| T-2 | 테스트 비율 | 소스 대비 테스트 파일 비율이 20% 미만이면 위반 |
| T-3 | 모킹 과다 | 테스트 파일의 50% 이상이 모킹으로 구성되면 위반 (구조 문제 신호) |
| T-4 | 통합 테스트 | API/DB 통합 테스트가 전무하면 위반 |

---

## Step 9: 보안 기초 검증

```bash
# 시크릿 노출
grep -rn "password\|secret\|api.key\|token\|credential" --include="*.ts" --include="*.py" --include="*.env" --include="*.json" | grep -v node_modules | grep -v ".env.example" | grep -v test | grep "=.*['\"].\{8,\}"

# SQL 인젝션 후보
grep -rn "query.*\`\|query.*\"\|execute.*f\"\|execute.*%" --include="*.ts" --include="*.py" | grep -v node_modules

# .env 파일 git 추적 여부
git ls-files | grep "\.env$"

# .gitignore에 시크릿 파일 포함 여부
cat .gitignore | grep -i "env\|secret\|key\|credential"
```

점검 항목:

| # | 항목 | 판정 기준 |
|---|------|----------|
| SEC-1 | 시크릿 노출 | 코드/설정에 시크릿이 하드코딩되어 있으면 Critical 위반 |
| SEC-2 | .env 추적 | .env 파일이 git에 추적되고 있으면 Critical 위반 |
| SEC-3 | SQL 인젝션 | 문자열 보간으로 쿼리를 구성하면 Critical 위반 |
| SEC-4 | 의존성 취약점 | npm audit / pip audit 결과 high/critical이 있으면 위반 |

---

## Step 10: 보고서 작성

모든 Step의 결과를 종합해 보고서를 작성한다.

### Severity 기준

- **Critical**: 보안 취약점, 데이터 유실 가능성, 즉시 수정 필수
- **High**: 아키텍처 원칙 위반, 확장성/유지보수성에 심각한 영향
- **Medium**: 코드 품질 저하, 기술 부채 누적
- **Low**: 컨벤션 불일치, 개선 권장

### 보고서 형식

```markdown
# Architecture Review Report

## 프로젝트 개요
(Step 1 결과)

## 요약
- 총 점검 항목: X개
- Critical: X건 / High: X건 / Medium: X건 / Low: X건
- 아키텍처 건강도: X/100

## 카테고리별 결과

### 의존성 방향 (D-1 ~ D-4)
| # | 항목 | 판정 | Severity | 근거 (파일:줄) |
|---|------|:----:|:--------:|---------------|

### 단일 책임 (S-1 ~ S-5)
| # | 항목 | 판정 | Severity | 근거 (파일:줄) |
|---|------|:----:|:--------:|---------------|

### 공유 자원 관리 (R-1 ~ R-4)
(동일 형식)

### 에러 처리 (E-1 ~ E-5)
(동일 형식)

### 하드코딩 (H-1 ~ H-4)
(동일 형식)

### API 설계 (A-1 ~ A-5)
(동일 형식, 해당 시)

### 테스트 (T-1 ~ T-4)
(동일 형식)

### 보안 (SEC-1 ~ SEC-4)
(동일 형식)

## Critical/High 위반 상세

각 Critical/High 위반에 대해:
1. 위반 위치 (파일, 줄, 코드 스니펫)
2. 위반 이유 (어떤 원칙을 어떻게 위반하는가)
3. 영향 범위 (이 위반이 미치는 파급 효과)
4. 권장 수정 방향

## 아키텍처 건강도 산출

기본 100점에서 감점:
- Critical 1건당: -15점
- High 1건당: -5점
- Medium 1건당: -2점
- Low 1건당: -0.5점
- 최저 0점

## 우선순위 액션 플랜

Critical → High 순서로 수정 계획을 제안한다.
각 액션에 예상 영향 범위와 난이도를 명시한다.
```

---

## 주의사항

- 이 리뷰는 **코드를 직접 읽고 수행**한다. 파일 목록만 보고 판정하지 않는다.
- 거대 프로젝트의 경우 Step 2~8을 **배치로 나눠** 수행한다. 컨텍스트 한계로 한 번에 전체를 읽을 수 없다.
- 각 Step에서 grep/find 결과가 많으면 **전수 확인이 불가능한 항목**을 명시하고, 샘플링 기반 판정임을 밝힌다.
- 프레임워크 관례상 불가피한 패턴 (예: Next.js page.tsx의 export default)은 위반에서 제외하되, 근거를 명시한다.
- PASS 판정 시에도 **"X개 파일을 확인한 결과 위반 없음"**으로 근거를 남긴다. "문제없어 보인다"는 PASS가 아니다.
