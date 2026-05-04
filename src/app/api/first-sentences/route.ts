import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { topicContent } = await request.json()

  if (!topicContent) {
    return new Response('topicContent required', { status: 400 })
  }

  // 비유: 유저가 글감을 고른 순간 Claude가 타이핑하듯 첫 문장을 써내려가는 것
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `당신은 글감 큐레이터입니다.

주어진 글감에 어울리는 첫 문장을 3개 생성하세요.
첫 문장은 유저가 바로 이어 쓸 수 있도록 글쓰기의 공간을 열어주는 역할을 합니다.

[좋은 첫 문장 기준]
- 내 경험과 즉각 연결됨
- 결론을 내버리지 않고 공간을 열어줌
- 질문형 또는 서술형 혼합 (20~35자)

[나쁜 첫 문장 기준]
- 이미 결론을 내버린 문장
- 감정을 단정 짓는 문장
- 한 단계 거쳐야 연결되는 문장

[예시]
글감: "잘하고 싶은 마음이 오히려 나를 막았다"
→ "처음부터 잘하려고 했던 게 문제였을까?"
→ "완벽하게 하거나 아예 안 하거나, 나는 늘 그 둘 중에 하나였다."
→ "나는 노력이 부족한 게 아니라 시작이 부족했다."

[입력]
글감: "${topicContent}"

[출력]
JSON 배열로만 출력. 설명·번호·마크다운 없이.
["첫문장1", "첫문장2", "첫문장3"]`,
      },
    ],
  })

  // ReadableStream으로 변환해서 클라이언트에 스트리밍
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
