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

[형태]
- 서술형: 구체적 장면을 담은 완결 문장 (예: "야근하면서도 시간이 빨리 갔던 그 일")
- 질문형: 탐구를 유도하는 열린 질문 (예: "나는 성장을 원했나, 인정을 원했나")
- 두 형태를 자연스럽게 섞을 것

[날카로운 글감 기준]
- 추상 → 구체 장면: "내가 몰입했던 순간" (X) → "야근하면서도 시간이 빨리 갔던 그 일" (O)
- 읽자마자 "나 얘기네": "내 한계라고 생각했던 것들의 정체" (X) → "잘하고 싶은 마음이 오히려 나를 막았다" (O)
- 문장 자체로 완결: "결국 사람이 전부다" (X) → "나는 성장을 원했나, 인정을 원했나" (O)
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
      "야근하면서도 시간이 빨리 갔던 그 일",
      "잘하고 싶은 마음이 오히려 나를 막았다",
      "내가 가장 잘 설명한 아이디어는 무엇이었나",
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
      "내가 직접 만들었으면 했던 서비스",
      "문제라고 느꼈지만 아무도 불편해하지 않았던 것",
      "내가 사업을 한다면 절대 안 할 것",
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
      "내가 자주 쓰는 앱이 나를 붙잡는 방법",
      "잘 되는 가게와 망하는 가게의 차이를 처음 발견한 순간",
      "광고인 줄 알면서도 사게 된 경험",
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
      "계획대로 됐을 때와 안 됐을 때의 공통점",
      "아이디어가 아이디어로만 끝난 이유",
      "내가 설득에 실패한 순간의 공통점",
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
      "처음 해봤는데 생각보다 잘 됐던 것",
      "한 번만 더 하고 싶은 경험",
      "그때는 몰랐는데 지금 보니 중요했던 것",
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
      "이유를 모르겠는데 기분이 좋았던 날",
      "화가 났는데 사실 슬펐던 것 같은 순간",
      "나는 어떤 상황에서 가장 솔직해지나",
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
      "완성하지 못했지만 시작했다는 것만으로 의미 있었던 것",
      "내가 만든 것 중 가장 나다운 것",
      "누군가에게 보여주기 전에 혼자 뿌듯했던 순간",
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
      "같은 노래가 어떤 날은 다르게 들렸다",
      "오래된 물건에서 느낀 감정",
      "풍경이 기억에 남은 이유가 풍경 때문이 아니었던 것",
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
      "내가 좋아하는 것들의 공통점을 발견한 순간",
      "처음엔 별로였는데 지금은 없으면 안 되는 것",
      "남들은 별로인데 나만 좋아하는 것",
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
      "요즘 유행하는 것 중 나만 이해 못 하는 것",
      "10년 전과 지금, 달라진 내 기준",
      "다들 좋다는데 나는 왜 공감이 안 됐나",
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
      "AI가 대신해줘서 오히려 아쉬웠던 것",
      "기술이 편해졌는데 뭔가 잃은 것 같은 느낌",
      "처음 스마트폰을 쥐었을 때처럼 설렌 기술",
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
      "나는 성장을 원했나, 인정을 원했나",
      "옳다고 생각했지만 틀렸던 기준",
      "나만 이렇게 생각하는 것 같았는데 다들 그렇더라",
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
      "5년 만에 만난 친구와 대화가 어색해진 날",
      "내가 먼저 연락하는 사람과 기다리는 사람의 차이",
      "누군가에게 솔직해지기 어려웠던 이유",
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
      "지켜지는 루틴과 안 지켜지는 루틴의 차이",
      "의식 없이 하는 행동인데 없어지면 허전한 것",
      "나는 언제 가장 집중이 잘 되나",
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
      "남들 눈에는 이상해 보여도 나한테는 맞는 것",
      "집에서의 나와 밖에서의 나 중 어느 쪽이 더 진짜인가",
      "누군가와 함께 있을 때 더 나다워지는가, 혼자일 때 더 나다워지는가",
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
      "몸이 먼저 신호를 보냈는데 무시했던 순간",
      "나를 회복시키는 것들의 공통점",
      "긴장이 풀렸다고 느꼈던 순간, 무엇이 달랐나",
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
// 글감 생성
// ─────────────────────────────────────────────
async function generateTopics(category) {
  console.log(`\n[${category}] 글감 생성 중...`);

  const config = CATEGORY_PROMPTS[category];

  // 기존 글감 조회해서 중복 방지용으로 프롬프트에 주입
  const existingTopics = await fetchExistingTopics(category);
  const existingSection =
    existingTopics.length > 0
      ? `\n[이미 존재하는 글감 — 내용·느낌이 겹치지 않도록 할 것]\n${existingTopics.map((t) => `- "${t}"`).join("\n")}\n`
      : "";

  const prompt = `당신은 글감 큐레이터입니다.

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
- 개수: ${TOPICS_PER_CATEGORY}개
- 길이: 글감 하나당 15~25자 이내
- 서술형과 질문형을 자연스럽게 섞을 것
- 위 예시와 비슷한 느낌이지만 그대로 복사하지 말 것
- JSON 배열로만 출력. 설명·번호·마크다운 없이.

["글감1", "글감2", ...]`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────
// 첫 문장 생성
// ─────────────────────────────────────────────
async function generateFirstSentences(topicContent) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `당신은 글감 큐레이터입니다.

[역할]
주어진 글감에 어울리는 첫 문장을 3개 생성합니다.
첫 문장은 유저가 바로 이어 쓸 수 있도록 글쓰기의 공간을 열어주는 역할을 합니다.

[좋은 첫 문장의 기준]
- 내 경험과 즉각 연결됨
- 선택지나 방향을 제시함
- "아!" 하게 만드는 감각
- 결론을 내버리지 않고 공간을 열어줌

[나쁜 첫 문장 기준]
- 타인의 회고록 느낌
- 한 단계 거쳐야 연결되는 문장
- 감정을 단정 짓는 문장
- 이미 결론을 내버린 문장

[좋은 첫 문장 예시]
글감: "잘하고 싶은 마음이 오히려 나를 막았다"
→ "처음부터 잘하려고 했던 게 문제였을까?"
→ "완벽하게 하거나 아예 안 하거나, 나는 늘 그 둘 중에 하나였다."
→ "나는 노력이 부족한 게 아니라 시작이 부족했다."

[조건]
- 형식: 질문형 또는 서술형 혼합
- 길이: 20~35자
- 개수: 3개

[입력]
글감: ${topicContent}

[출력]
JSON 배열로만 출력. 설명·번호·마크다운 없이.
["첫문장1", "첫문장2", "첫문장3"]`,
      },
    ],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────
// 글감 1개 처리: 첫 문장 생성 + DB insert
// ─────────────────────────────────────────────
async function processTopic(content, category) {
  const firstSentences = await generateFirstSentences(content);

  const { data, error } = await supabase
    .from("topics")
    .insert({ content, first_sentences: firstSentences })
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

  console.log("=== Spark 글감 생성 시작 (v2.1) ===");
  if (isPartial) {
    console.log(`🎯 대상 카테고리: ${CATEGORIES.join(", ")}`);
    console.log("  → 기존 글감을 삭제하고 재생성합니다.\n");
  } else {
    console.log(`카테고리: ${CATEGORIES.length}개 / 카테고리당 글감: ${TOPICS_PER_CATEGORY}개`);
    console.log(`예상 총 글감: ${CATEGORIES.length * TOPICS_PER_CATEGORY}개\n`);
  }

  let totalInserted = 0;

  for (const category of CATEGORIES) {
    try {
      // 특정 카테고리만 실행할 때는 기존 데이터 먼저 삭제
      if (isPartial) await deleteCategory(category);

      const topics = await generateTopics(category);
      console.log(`  → ${topics.length}개 생성됨`);

      for (const content of topics) {
        await processTopic(content, category);
        process.stdout.write(".");
        totalInserted++;
      }
      console.log(` (${category} 완료)`);
    } catch (err) {
      console.error(`\n[${category}] 오류:`, err.message);
    }
  }

  console.log(`\n=== 완료: 총 ${totalInserted}개 글감 insert ===`);
}

main();
