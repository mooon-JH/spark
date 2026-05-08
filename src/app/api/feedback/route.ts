import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(request: Request) {
  try {
    const { body } = await request.json()

    if (!body || typeof body !== 'string') {
      return new Response('body required', { status: 400 })
    }

    // 스트리밍으로 응답 — 바텀 시트에 글자가 흘러들어오는 경험
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `아래 글을 읽고 피드백을 줘.

규칙:
- 잘 됐다/못 됐다 판단하지 마
- 공감으로 시작해
- 글에서 인상적인 부분을 짚어줘
- 글쓴이가 더 파고들 수 있는 질문 1개로 마무리해
- 해요체로, 짧고 따뜻하게
- 300자 이내

글:
${body}`,
        },
      ],
    })

    // ReadableStream으로 변환해서 클라이언트에 전달
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return new Response('failed', { status: 500 })
  }
}
