import dynamic from 'next/dynamic';

const GameClient = dynamic(() => import('@/components/GameClient'), {
  // движок (three/webgpu) импортируется только в useEffect — SSR безопасен
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f0c',
        color: '#d8b45a',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          className="animate-spin"
          style={{
            width: 40,
            height: 40,
            margin: '0 auto 16px',
            borderRadius: '50%',
            border: '2px solid #6b5a2e',
            borderTopColor: '#d8b45a',
          }}
        />
        <p style={{ fontSize: 13, letterSpacing: '0.15em' }}>ЗАГРУЗКА ФАЭРУНА…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0b0f0c' }}>
      <GameClient />
    </main>
  );
}
