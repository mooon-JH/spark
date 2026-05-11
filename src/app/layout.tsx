// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spark - AI 글쓰기 코칭',
  description: '생각을 정리하는 글쓰기',
}

// 키보드 대응을 위한 viewport 설정
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // iOS 자동 줌 방지
  userScalable: false,
  interactiveWidget: 'resizes-content', // Chrome/Firefox에서 키보드 시 viewport 리사이즈
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
