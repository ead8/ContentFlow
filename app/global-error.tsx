'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px' }}>Try again</button>
        </div>
      </body>
    </html>
  )
}
