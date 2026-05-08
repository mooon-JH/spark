import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPICS_PER_CATEGORY = 90; // 기존 10개 + 신규 90개 = 카테고리당 100개

// ─────────────────────────────────────────────
// 공통 원칙 (16개 카테고리 모두 공유)
// ─────────────────────────────────────────────
const COMMON_RULES = `
[독자]
20대 후반~30대 / 커리어 성장·창업 희망·내면 탐구에 관심 있는 사람.
자기 자신을 흥미로운 탐구 대상으로 바라보는 사람.

[글감 정의]
읽는 순간 "나도 이런 적 있는데" 또는 "나는 어떻지?"가 즉각 튀어나오는 구체적인 글쓰기 출발점.

[톤]
긍정·호기심·발견 중심. 구체적 장면을 담을 것.
독자가 읽고 에너지가 생겨야 한다.

[공통 금지]
- 번아웃·탈진·무기력·결핍·후회·자기비판 등 부정적 상태를 전제로 하는 글감
- 뻔한 자기계발 문구 ("성장하려면", "더 나은 나를 위해" 등)
- 추상적 감정만 있고 구체적 장면이 없는 글감
- 글감 안에서 결론을 내버리는 글감
- 해석이나 설명이 이어져야 완결되는 글감

[구성 비율]
- 감정·탐구형 70%: 자기 경험을 즉각 떠올리게 만드는 글감 (습관 형성 목적)
- 구조화 유도형 30%: 경험을 분석·구조화하도록 유도하는 글감 (기획력 훈련 목적)

[형태 — 필수]
- 모든 글감은 2인칭 질문형으로 작성할 것
- 주어 생략 권장 ("당신은" 사용 시 어색함 주의)
- 어미: "~한 적 있나요?" / "~이었나요?" / "~했나요?" / "~인가요?" 등
- 서술형·독백형 절대 금지 ("나는 ~했다" / "~했던 그 일" 형태 금지)

[날카로운 글감 기준]
- 추상 → 구체 장면: "몰입했던 적 있나요?" (X) → "야근하면서도 시간이 빨리 간 적 있나요?" (O)
- 읽자마자 "나 얘기네": "한계를 느낀 적 있나요?" (X) → "잘하고 싶은 마음이 오히려 발목을 잡은 적 있나요?" (O)
- 열린 탐구: "성장이 중요한가요?" (X) → "성장을 원했나요, 인정을 원했나요?" (O)
`.trim();

// ─────────────────────────────────────────────
// 카테고리별 개별 프롬프트 설정
// ─────────────────────────────────────────────
const CATEGORY_PROMPTS = {
  커리어: {
    tone: `일하는 나를 흥미로운 인간으로 탐구하는 시선.
"나는 왜 이 일을 하나"보다 "나는 이 일을 어떻게 하나"에 가까운 글감.
직업적 자아를 판단하지 않고 관찰하는 태도.`,
    examples: [
      "야근하면서도 시간이 빨리 간 적 있나요?",
      "잘하고 싶은 마음이 오히려 발목을 잡은 적 있나요?",
      "가장 잘 설명했다고 느낀 아이디어가 있나요?",
    ],
    forbidden: `번아웃·퇴사 충동·직장 불만을 전제로 하는 글감.
연봉·승진·스펙 중심의 글감.
"어떻게 하면 잘 될 수 있나" 류의 조언 느낌.`,
  },

  창업: {
    tone: `만들고 싶은 것에 대한 설렘과 탐구.
아직 없는 것을 발견하는 시선.
창업을 거창한 도전이 아니라 자연스러운 호기심으로 바라보는 글감.`,
    examples: [
      "직접 만들었으면 했던 서비스가 있나요?",
      "문제라고 느꼈지만 아무도 불편해하지 않았던 것이 있나요?",
      "내가 사업을 한다면 절대 안 할 것이 있나요?",
    ],
    forbidden: `실패 공포·자금 걱정·리스크를 전제로 하는 글감.
창업을 대단한 것으로 만드는 글감.
성공한 창업자 이야기 중심.`,
  },

  비즈니스인사이트: {
    tone: `세상을 내 눈으로 분석하는 즐거움.
"왜 이게 잘 됐지?"라는 호기심으로 비즈니스 현상을 탐구하는 글감.
정보 전달이 아닌 나의 관찰과 해석.`,
    examples: [
      "자주 쓰는 앱이 나를 붙잡는 방식을 눈치챈 적 있나요?",
      "잘 되는 가게와 망하는 가게의 차이를 발견한 순간이 있나요?",
      "광고인 줄 알면서도 사게 된 경험이 있나요?",
    ],
    forbidden: `경제 뉴스 논평·시사 분석 느낌의 글감.
정보 전달이 목적인 글감.
특정 기업·인물 평가 중심.`,
  },

  기획: {
    tone: `생각을 구조화하는 과정 자체를 탐구하는 글감.
내 사고방식의 패턴을 발견하는 재미.
기획을 거창한 업무가 아니라 일상적인 사고 훈련으로 바라보기.`,
    examples: [
      "계획대로 됐을 때와 안 됐을 때 공통점을 발견한 적 있나요?",
      "아이디어가 아이디어로만 끝난 이유를 알 것 같은 순간이 있나요?",
      "설득에 실패한 순간의 공통점을 찾아본 적 있나요?",
    ],
    forbidden: `방법론·프레임워크 소개 느낌의 글감.
"어떻게 하면 기획을 잘 할 수 있나" 류의 조언.
업무 스킬 향상 중심.`,
  },

  경험: {
    tone: `겪은 것에서 건져내는 발견.
과거를 후회가 아닌 탐구로 바라보기.
경험을 이미 완결된 것이 아니라 지금도 의미를 찾을 수 있는 자원으로 보는 시선.`,
    examples: [
      "처음 해봤는데 생각보다 잘 됐던 일이 있나요?",
      "한 번만 더 하고 싶은 경험이 있나요?",
      "그때는 몰랐는데 지금 보니 중요했던 것이 있나요?",
    ],
    forbidden: `결핍·후회·아쉬움을 전제로 하는 글감.
"그때로 돌아간다면" 류의 가정.
경험의 교훈을 결론으로 내버리는 글감.`,
  },

  감정: {
    tone: `감정을 흥미로운 데이터로 바라보기.
단정 짓지 않고 탐구하는 태도.
감정의 이유와 패턴을 발견하는 즐거움.`,
    examples: [
      "이유를 모르겠는데 기분이 좋았던 날이 있나요?",
      "화가 났는데 사실 슬펐던 것 같은 순간이 있나요?",
      "어떤 상황에서 가장 솔직해지는 것 같나요?",
    ],
    forbidden: `우울·무기력·자기비판을 전제로 하는 글감.
감정을 결론으로 단정 짓는 글감.
감정 해소·치유 방법 중심.`,
  },

  크리에이티브: {
    tone: `만들고 표현하는 행위 자체의 즐거움.
결과물보다 과정과 충동에 집중하는 글감.
재능 여부와 무관하게 누구나 공감할 수 있는 창작의 순간.`,
    examples: [
      "완성하지 못했지만 시작했다는 것만으로 의미 있었던 것이 있나요?",
      "만든 것 중 가장 나다웠던 것이 있나요?",
      "누군가에게 보여주기 전에 혼자 뿌듯했던 순간이 있나요?",
    ],
    forbidden: `재능 없음·비교·완성도 압박을 전제로 하는 글감.
특정 예술 장르·기술 중심.
결과물 평가 중심.`,
  },

  예술: {
    tone: `아름다움을 발견하고 언어로 포착하는 훈련.
전문 지식 없이도 가능한 감상의 기록.
예술 작품이 아니라 예술을 경험하는 '나'에 집중하는 글감.`,
    examples: [
      "같은 노래가 어떤 날은 다르게 들린 적 있나요?",
      "오래된 물건에서 뭔가 느꼈던 적 있나요?",
      "풍경이 기억에 남은 이유가 풍경 때문이 아니었던 적 있나요?",
    ],
    forbidden: `예술 지식·작품 해설 중심의 글감.
"명작이란 무엇인가" 류의 거창한 질문.
특정 예술가·작품 평가 중심.`,
  },

  취향: {
    tone: `내가 좋아하는 것을 탐구하는 재미.
취향을 발견하고 언어화하는 과정.
좋아함의 이유를 파고드는 시선.`,
    examples: [
      "좋아하는 것들의 공통점을 발견한 순간이 있나요?",
      "처음엔 별로였는데 지금은 없으면 안 되는 것이 있나요?",
      "남들은 별로인데 나만 좋아하는 것이 있나요?",
    ],
    forbidden: `소비·구매·제품 추천 중심의 글감.
유행·트렌드 추종 느낌.
취향을 자랑하거나 과시하는 글감.`,
  },

  컬쳐: {
    tone: `사회·문화 현상을 나의 시선으로 해석하기.
"나는 이 문화 속에 어디에 서 있나"를 탐구하는 글감.
비판보다 관찰과 발견 중심.`,
    examples: [
      "요즘 유행하는 것 중 나만 이해 못 하는 것이 있나요?",
      "10년 전과 지금, 달라진 내 기준이 있나요?",
      "다들 좋다는데 공감이 안 됐던 적 있나요?",
    ],
    forbidden: `사회 비판·세대 갈등 중심의 글감.
뉴스 코멘터리·시사 논평 느낌.
특정 집단 일반화.`,
  },

  "테크&트렌드": {
    tone: `기술 변화를 내 삶과 연결해서 보기.
관찰자가 아닌 당사자 시점의 글감.
기술을 설명하는 것이 아니라 기술을 경험하는 나를 탐구하기.`,
    examples: [
      "AI가 대신해줘서 오히려 아쉬웠던 적 있나요?",
      "기술이 편해졌는데 뭔가 잃은 것 같은 느낌이 든 적 있나요?",
      "처음 스마트폰을 쥐었을 때처럼 설렜던 기술이 있나요?",
    ],
    forbidden: `기술 설명·전망·미래 예측 중심의 글감.
"미래는 어떻게 될까" 류의 추상적 질문.
특정 기술·플랫폼 평가 중심.`,
  },

  철학: {
    tone: `거창하지 않게, 일상에서 발견하는 나만의 원칙.
정답이 없는 질문으로 탐구하는 글감.
철학적 개념이 아니라 살아가면서 부딪히는 구체적 장면에서 출발하기.`,
    examples: [
      "성장을 원했나요, 인정을 원했나요?",
      "옳다고 생각했지만 틀렸던 기준이 있나요?",
      "나만 이렇게 생각하는 것 같았는데 다들 그렇더라 싶었던 적 있나요?",
    ],
    forbidden: `철학적 개념·명언·격언 중심의 글감.
정답이 있는 질문.
교훈을 미리 내버리는 글감.`,
  },

  인간관계: {
    tone: `사람과의 관계에서 나를 발견하기.
판단 없이 관찰하는 태도.
관계를 문제로 보지 않고 나를 비추는 거울로 보는 시선.`,
    examples: [
      "5년 만에 만난 친구와 대화가 어색해진 적 있나요?",
      "먼저 연락하는 사람과 기다리는 사람, 어느 쪽인가요?",
      "누군가에게 솔직해지기 어려웠던 이유를 알 것 같은 적 있나요?",
    ],
    forbidden: `갈등·상처·원망을 전제로 하는 글감.
관계 문제 해결법 느낌.
특정 관계 유형(연인·가족 등)에 한정된 글감.`,
  },

  루틴: {
    tone: `반복되는 행동 패턴 그 자체를 탐구하는 글감.
"나는 이걸 왜 반복하지?"라는 시선으로 습관 하나하나를 들여다보기.
행동의 이유와 패턴을 발견하는 데 집중. 삶의 방식 전체나 몸·마음 상태는 다루지 않음.`,
    examples: [
      "지켜지는 루틴과 안 지켜지는 루틴의 차이를 느낀 적 있나요?",
      "의식 없이 하는 행동인데 없어지면 허전한 것이 있나요?",
      "가장 집중이 잘 되는 시간대가 있나요?",
    ],
    forbidden: `생산성 극대화·자기관리 실패를 전제로 하는 글감.
루틴 추천·방법론 소개 느낌.
의지력·게으름 중심의 글감.
몸 컨디션·피로·회복 중심의 글감 (→ 웰니스 카테고리).
삶의 방식·가치관 전체를 다루는 글감 (→ 라이프스타일 카테고리).
"혼자일 때 vs 함께일 때" 등 관계 맥락 중심의 글감 (→ 라이프스타일 카테고리).`,
  },

  라이프스타일: {
    tone: `내가 사는 방식의 전체적인 결을 탐구하는 글감.
"나는 어떤 사람으로 살고 있나"를 일상의 구체적 장면에서 포착하기.
개별 습관이나 몸·마음 상태가 아니라, 내 삶의 방식과 가치관이 드러나는 장면에 집중.`,
    examples: [
      "남들 눈에는 이상해 보여도 나한테는 맞는 것이 있나요?",
      "집에서의 나와 밖에서의 나 중 어느 쪽이 더 진짜인 것 같나요?",
      "함께 있을 때 더 나다워지나요, 혼자일 때 더 나다워지나요?",
    ],
    forbidden: `이상적 라이프스타일을 향한 압박·비교 느낌.
미니멀·슬로우라이프 등 특정 방향 강요.
소비·인테리어·여행 중심의 과시형 글감.
특정 반복 행동·습관 패턴을 탐구하는 글감 (→ 루틴 카테고리).
몸 컨디션·피로·회복·운동 중심의 글감 (→ 웰니스 카테고리).`,
  },

  웰니스: {
    tone: `몸과 마음의 상태·신호·회복에 집중하는 글감.
"내 몸과 마음이 보내는 신호를 나는 얼마나 알아채나"라는 시선.
건강을 의무가 아닌 탐구로 바라보기. 거창한 목표가 아니라 작은 감각의 변화에서 출발.`,
    examples: [
      "몸이 먼저 신호를 보냈는데 무시했던 순간이 있나요?",
      "나를 회복시키는 것들의 공통점을 발견한 적 있나요?",
      "긴장이 풀렸다고 느꼈던 순간, 무엇이 달랐나요?",
    ],
    forbidden: `다이어트·체중·외모 중심의 글감.
건강 불안·의무감을 전제로 하는 글감.
특정 건강법·식단·운동법 추천 느낌.
반복 행동·습관 패턴을 탐구하는 글감 (→ 루틴 카테고리).
삶의 방식·가치관 전체를 다루는 글감 (→ 라이프스타일 카테고리).
루틴이 생겼다/무너졌다 등 습관 형성 중심의 글감 (→ 루틴 카테고리).`,
  },
};

// ─────────────────────────────────────────────
// 카테고리의 기존 글감 목록 조회
// ─────────────────────────────────────────────
async function fetchExistingTopics(category) {
  const { data, error } = await supabase
    .from("topic_categories")
    .select("topics(content)")
    .eq("category", category);

  if (error) throw new Error(`기존 글감 조회 실패: ${error.message}`);
  return data.map((row) => row.topics.content);
}

// ─────────────────────────────────────────────
// 글감 생성 (배치 API 사용 — 비용 50% 절감)
// ─────────────────────────────────────────────
function buildPrompt(category, existingTopics, needCount) {
  const config = CATEGORY_PROMPTS[category];

  // 중복 방지용으로 최근 20개만 주입 (토큰 절감)
  const recentTopics = existingTopics.slice(-20);
  const existingSection =
    recentTopics.length > 0
      ? `\n[이미 존재하는 글감 — 내용·느낌이 겹치지 않도록 할 것]\n${recentTopics.map((t) => `- "${t}"`).join("\n")}\n`
      : "";

  return `당신은 글감 큐레이터입니다.

${COMMON_RULES}

─────────────────────────
[카테고리: ${category}]

[이 카테고리의 톤]
${config.tone}

[이 카테고리 글감 예시]
${config.examples.map((e, i) => `${i + 1}. "${e}"`).join("\n")}

[이 카테고리 추가 금지]
${config.forbidden}
${existingSection}
─────────────────────────

[출력 조건]
- 개수: ${needCount}개
- 길이: 글감 하나당 15~25자 이내
- 모든 글감은 반드시 2인칭 질문형으로 작성할 것 ("~한 적 있나요?" / "~이었나요?" / "~했나요?" / "~인가요?")
- 서술형·독백형 절대 금지 ("나는 ~했다" / "~했던 그 일" 형태 금지)
- 위 예시와 비슷한 느낌이지만 그대로 복사하지 말 것
- JSON 배열로만 출력. 설명·번호·마크다운 없이.

["글감1", "글감2", ...]`;
}

// 배치 API custom_id는 영문·숫자·_·- 만 허용 → 한글 카테고리명 영문으로 매핑
const CATEGORY_ID_MAP = {
  커리어: "career",
  창업: "startup",
  비즈니스인사이트: "biz-insight",
  기획: "planning",
  경험: "experience",
  감정: "emotion",
  크리에이티브: "creative",
  예술: "art",
  취향: "taste",
  컬쳐: "culture",
  "테크&트렌드": "tech-trend",
  철학: "philosophy",
  인간관계: "relationship",
  루틴: "routine",
  라이프스타일: "lifestyle",
  웰니스: "wellness",
};
const ID_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_ID_MAP).map(([k, v]) => [v, k])
);

async function generateTopics(categories) {
  // 각 카테고리의 기존 글감 조회 + needCount 계산
  const categoryData = await Promise.all(
    categories.map(async (category) => {
      const existingTopics = await fetchExistingTopics(category);
      const needCount = Math.max(0, TOPICS_PER_CATEGORY - existingTopics.length);
      return { category, existingTopics, needCount };
    })
  );

  // 생성이 필요 없는 카테고리 스킵
  const toGenerate = categoryData.filter(({ category, needCount }) => {
    if (needCount === 0) {
      console.log(`  → [${category}] 이미 ${TOPICS_PER_CATEGORY}개 존재. 스킵.`);
      return false;
    }
    console.log(`\n[${category}] 기존 ${TOPICS_PER_CATEGORY - needCount}개 / 추가 생성 ${needCount}개`);
    return true;
  });

  if (toGenerate.length === 0) return {};

  // 배치 요청 생성 — 비유: 배달 앱에서 여러 주문을 한 번에 묶어서 보내는 것처럼
  // 16개 카테고리를 각각 호출하는 대신 한 번에 묶어서 50% 할인 받는 방식
  console.log(`\n배치 API로 ${toGenerate.length}개 카테고리 요청 전송 중...`);

  const batchRequests = toGenerate.map(({ category, existingTopics, needCount }) => ({
    custom_id: CATEGORY_ID_MAP[category],
    params: {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildPrompt(category, existingTopics, needCount),
        },
      ],
    },
  }));

  // 배치 생성 요청
  const batch = await anthropic.messages.batches.create({ requests: batchRequests });
  console.log(`배치 ID: ${batch.id} / 상태: ${batch.processing_status}`);

  // 배치 완료 대기 (폴링 — 5초마다 상태 확인)
  console.log("배치 처리 대기 중...");
  let completed = false;
  while (!completed) {
    await new Promise((res) => setTimeout(res, 5000));
    const status = await anthropic.messages.batches.retrieve(batch.id);
    process.stdout.write(`\r상태: ${status.processing_status} (완료: ${status.request_counts.succeeded} / 전체: ${status.request_counts.processing + status.request_counts.succeeded + status.request_counts.errored})`);
    if (status.processing_status === "ended") completed = true;
  }
  console.log("\n배치 완료!");

  // 결과 수집
  const results = {};
  for await (const item of await anthropic.messages.batches.results(batch.id)) {
    const category = ID_TO_CATEGORY[item.custom_id] ?? item.custom_id;
    if (item.result.type === "succeeded") {
      try {
        const text = item.result.message.content[0].text.trim();
        const cleaned = text.replace(/```json|```/g, "").trim();
        results[category] = JSON.parse(cleaned);
      } catch (err) {
        console.error(`\n[${category}] 파싱 오류:`, err.message);
        results[category] = [];
      }
    } else {
      console.error(`\n[${category}] 배치 오류:`, item.result.error);
      results[category] = [];
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// 글감 1개 처리: DB insert (첫 문장은 온디맨드 스트리밍으로 생성)
// ─────────────────────────────────────────────
async function processTopic(content, category) {
  const { data, error } = await supabase
    .from("topics")
    .insert({ content })
    .select("id")
    .single();

  if (error) throw new Error(`topics insert 실패: ${error.message}`);

  const { error: catError } = await supabase
    .from("topic_categories")
    .insert({ topic_id: data.id, category });

  if (catError)
    throw new Error(`topic_categories insert 실패: ${catError.message}`);

  return data.id;
}

// ─────────────────────────────────────────────
// 특정 카테고리 기존 글감 삭제
// ─────────────────────────────────────────────
async function deleteCategory(category) {
  // topic_categories에서 해당 카테고리의 topic_id 목록 조회
  const { data: catRows, error: fetchError } = await supabase
    .from("topic_categories")
    .select("topic_id")
    .eq("category", category);

  if (fetchError) throw new Error(`조회 실패: ${fetchError.message}`);
  if (!catRows || catRows.length === 0) {
    console.log(`  → [${category}] 기존 글감 없음. 삭제 스킵.`);
    return;
  }

  const topicIds = catRows.map((r) => r.topic_id);

  // topic_categories 먼저 삭제
  const { error: catDeleteError } = await supabase
    .from("topic_categories")
    .delete()
    .eq("category", category);

  if (catDeleteError)
    throw new Error(`topic_categories 삭제 실패: ${catDeleteError.message}`);

  // topics 삭제
  const { error: topicDeleteError } = await supabase
    .from("topics")
    .delete()
    .in("id", topicIds);

  if (topicDeleteError)
    throw new Error(`topics 삭제 실패: ${topicDeleteError.message}`);

  console.log(`  → [${category}] 기존 글감 ${topicIds.length}개 삭제 완료`);
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  const ALL_CATEGORIES = Object.keys(CATEGORY_PROMPTS);

  // CLI 인자로 카테고리 지정 가능
  // 예: node generate-topics.mjs 루틴 라이프스타일 웰니스
  const args = process.argv.slice(2);
  const CATEGORIES =
    args.length > 0
      ? args.filter((a) => {
          if (!ALL_CATEGORIES.includes(a)) {
            console.warn(`⚠️  알 수 없는 카테고리 "${a}" — 스킵`);
            return false;
          }
          return true;
        })
      : ALL_CATEGORIES;

  if (CATEGORIES.length === 0) {
    console.error("실행할 카테고리가 없습니다.");
    process.exit(1);
  }

  const isPartial = CATEGORIES.length < ALL_CATEGORIES.length;

  console.log("=== Spark 글감 생성 시작 (s3.0) ===");
  if (isPartial) {
    console.log(`🎯 대상 카테고리: ${CATEGORIES.join(", ")}`);
    console.log("  → 기존 글감을 삭제하고 재생성합니다.\n");
    for (const category of CATEGORIES) {
      await deleteCategory(category);
    }
  } else {
    console.log(`카테고리: ${CATEGORIES.length}개 / 카테고리당 글감: ${TOPICS_PER_CATEGORY}개`);
    console.log(`예상 총 글감: ${CATEGORIES.length * TOPICS_PER_CATEGORY}개\n`);
  }

  // 배치 API로 전체 카테고리 한 번에 생성
  const results = await generateTopics(CATEGORIES);

  // 결과 DB insert
  let totalInserted = 0;
  for (const [category, topics] of Object.entries(results)) {
    if (!topics || topics.length === 0) continue;
    console.log(`\n[${category}] DB 저장 중...`);
    for (const content of topics) {
      try {
        await processTopic(content, category);
        process.stdout.write(".");
        totalInserted++;
      } catch (err) {
        console.error(`\n[${category}] insert 오류:`, err.message);
      }
    }
    console.log(` (${category} 완료)`);
  }

  console.log(`\n=== 완료: 총 ${totalInserted}개 글감 insert ===`);
}

main();
