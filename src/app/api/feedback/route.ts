import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: Request) {
  try {
    const { body } = await request.json()

    if (!body || typeof body !== 'string' || body.trim().length < 50) {
      return NextResponse.json({ error: 'body must be at least 50 chars' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `다음 글에 대해 피드백을 제공해줘. 

글:
${body}

응답 형식 (JSON으로만 답변, 다른 텍스트는 출력하지 말 것):
{
  "flow": "글 전체의 흐름을 1~2문장으로 관찰만 해. 판단이나 평가 없이 서술적으로.",
  "highlights": [
    {
      "text": "원문에서 정확히 발췌한 문장 (20자 이내)",
      "type": "positive" 또는 "negative",
      "reason": "잘된 이유 또는 문제인 이유를 1~2문장으로",
      "example": "negative일 때만 — 방향 감을 주는 예시 문장 (정답은 아님, 힌트만)"
    }
  ],
  "next": "다음에 시도해볼 것 1가지를 구체적으로"
}

규칙:
- highlights는 2~4개 정도만 (너무 많지 않게)
- positive와 negative를 적절히 섞어서
- text는 원문에서 그대로 가져올 것 (20자 이내로 짧게)
- reason은 간결하게
- example은 negative일 때만, 힌트 역할
- 무조건 JSON만 출력`,
        },
      ],
    })

    const text = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    // JSON 파싱 시도
    const cleaned = text.replace(/```json|```/g, '').trim()
    const feedback = JSON.parse(cleaned)

    return NextResponse.json(feedback)
  } catch (err) {
    console.error('Feedback API error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
