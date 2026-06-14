import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#4CAF50',
          borderRadius: '112px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '320px',
          fontWeight: '900',
          fontFamily: 'Arial',
        }}
      >
        L
      </div>
    ),
    { width: 512, height: 512 }
  );
}
