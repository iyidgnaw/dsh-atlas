import { ImageResponse } from 'next/og'

export const alt = 'DeepSeek Harness Atlas — skills, architecture, and decisions mapped'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f7f8f5', color: '#16191e', padding: 72 }}>
      <div style={{ color: '#1769df', fontSize: 24, fontWeight: 700, letterSpacing: 4 }}>DEEPSEEK HARNESS</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -5 }}>DeepSeek Harness Atlas</div>
        <div style={{ marginTop: 18, fontSize: 34, color: '#69727e' }}>Skills, architecture, and decisions—mapped.</div>
      </div>
      <div style={{ display: 'flex', gap: 28, fontSize: 24 }}><span>11 Skills</span><span>723 bilingual Agent Notes</span></div>
    </div>,
    size,
  )
}
