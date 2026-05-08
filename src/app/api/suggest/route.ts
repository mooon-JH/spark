import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: Request) {
  try {
    const { body } = await request.json()

    if (!body || typeof body !== 'string') {
      return NextResponse.json({ error: 'body required' }, { status: 400 })
    }

    // 컨텍스트: 현재 문단 전체 + 직전 문단 첫 문장만 전송 (비용 절감)
    const paragraphs = body.split('\n\n').filter(Boolean)
    const currentParagraph = paragraphs[paragraphs.length - 1] ?? ''
    const prevFirstSentence = paragraphs.length >= 2
      ? paragraphs[paragraphs.length - 2].split(/[.!?。]/)[0]
      : ''

    const context = prevFirstSentence
      ? `${prevFirstSentence}.\n\n${currentParagraph}`
      : currentParagraph

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `다음 글의 흐름을 자연스럽게 이어받아 다음 문장 1개만 제안해줘. 
글쓴이의 목소리와 어투를 그대로 유지해. 
설명하거나 평가하지 말고, 오직 다음 문장 1개만 출력해.

글:
${context}`,
        },
      ],
    })

    const suggestion = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    return NextResponse.json({ suggestion })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
