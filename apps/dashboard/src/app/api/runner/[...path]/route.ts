import { NextRequest, NextResponse } from 'next/server';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:8000';
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || '';

async function proxyRequest(request: NextRequest, path: string) {
  const url = `${RUNNER_BASE_URL}/${path}`;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (RUNNER_API_KEY) {
    headers.set('Authorization', `Bearer ${RUNNER_API_KEY}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const response = await fetch(url, init);
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('Runner proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to runner service' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}
