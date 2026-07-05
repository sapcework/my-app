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
          borderRadius: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '120px',
          fontWeight: '900',
          fontFamily: 'Arial',
        }}
      >
        T
      </div>
    ),
    { width: 192, height: 192 }
  );
}
