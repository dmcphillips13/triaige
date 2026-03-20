import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL || 'http://localhost:8000';
const RUNNER_API_KEY = process.env.RUNNER_API_KEY || '';

async function proxyRequest(request: NextRequest, segments: string[]) {
  // Next.js decodes [...path] segments (%2F→/, %20→space), so re-encode
  // each one to preserve test names with slashes and special characters
  const url = `${RUNNER_BASE_URL}/${segments.map(encodeURIComponent).join('/')}`;

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (RUNNER_API_KEY) {
    headers.set('Authorization', `Bearer ${RUNNER_API_KEY}`);
  }

  // Forward the user's GitHub token so the runner can act on their behalf
  const session = await getSession();
  if (session?.github_token) {
    headers.set('X-GitHub-Token', session.github_token);
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
    const contentType = response.headers.get('Content-Type') || '';

    // Stream SSE responses directly instead of buffering
    if (contentType.includes('text/event-stream') && response.body) {
      return new NextResponse(response.body as ReadableStream, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/json',
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
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
