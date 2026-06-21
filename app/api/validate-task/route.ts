import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const { benchmarkUrls, completionUrl, taskTitle } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ pass: true, feedback: 'Great effort! (AI check not configured)' })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const imageContent: Anthropic.MessageParam['content'] = [
      ...benchmarkUrls.map((url: string) => ({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      })),
      {
        type: 'image' as const,
        source: { type: 'url' as const, url: completionUrl },
      },
      {
        type: 'text' as const,
        text: `The first ${benchmarkUrls.length} image(s) show the STANDARD for the task "${taskTitle}". The LAST image is what a child submitted as proof of completing the task. Compare them carefully. Does the child's photo meet the same standard shown in the benchmarks? Reply with exactly: PASS or FAIL on the first line. Then on the next line, write a single encouraging sentence for a child aged 5-12 (under 15 words).`,
      },
    ]

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: imageContent }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const pass = lines[0]?.toUpperCase().startsWith('PASS')
    const feedback = lines[1] || (pass ? 'Amazing job! You nailed it! 🌟' : 'Give it another go, you can do it! 💪')

    return NextResponse.json({ pass, feedback })
  } catch (err) {
    console.error('validate-task error:', err)
    return NextResponse.json({ pass: true, feedback: 'Task submitted! Great effort! ⭐' })
  }
}
