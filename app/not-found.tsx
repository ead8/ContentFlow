// app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', marginTop: '5rem', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oops! Page not found.</h1>
      <p style={{ marginBottom: '1.5rem' }}>Looks like we can’t find what you’re looking for.</p>
      <Link href="/">
        <p style={{ color: '#0070f3', textDecoration: 'underline' }}>Return to Home</p>
      </Link>
    </div>
  )
}
