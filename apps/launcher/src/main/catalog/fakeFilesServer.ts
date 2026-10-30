import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * An in-process stand-in for the API's files route (`GET /v1/files/:token`, one simple Range):
 * tests register bodies by token and can refuse a token or cut a response after N bytes.
 */
export async function fakeFilesServer() {
  const files = new Map<string, Buffer>();
  const refused = new Map<string, number>();
  const cuts = new Map<string, number>();
  const holds = new Map<string, number>();
  const wholeOnly = new Set<string>();
  const ranges: Array<string | undefined> = [];
  const server: Server = createServer((request, response) => {
    const token = (request.url ?? '').replace(/^\/v1\/files\//, '');
    ranges.push(request.headers.range);
    const status = refused.get(token);
    if (status !== undefined) {
      response.writeHead(status).end();
      return;
    }
    const body = files.get(token);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    const match = wholeOnly.has(token) ? null : /^bytes=(\d+)-$/.exec(request.headers.range ?? '');
    const start = match ? Number(match[1]) : 0;
    if (start >= body.length && body.length > 0) {
      response.writeHead(416).end();
      return;
    }
    const slice = body.subarray(start);
    response.writeHead(match ? 206 : 200, { 'content-length': String(slice.length) });
    const hold = holds.get(token);
    if (hold !== undefined) {
      // Send the first bytes, then nothing until the client gives up (pause, cancel).
      response.write(slice.subarray(0, hold));
      return;
    }
    const cut = cuts.get(token);
    if (cut !== undefined) {
      cuts.delete(token);
      // Close the connection mid-body (fewer bytes than Content-Length). A graceful close, not a
      // reset: on Windows a reset also throws away bytes the client hasn't read yet.
      response.write(slice.subarray(0, cut), () => {
        setTimeout(() => {
          request.socket.end();
        }, 20);
      });
      return;
    }
    response.end(slice);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: (token: string) => `http://127.0.0.1:${String(port)}/v1/files/${token}`,
    serve(token: string, body: Buffer) {
      files.set(token, body);
    },
    refuse(token: string, status = 410) {
      refused.set(token, status);
    },
    /** The next response for this token stops after `bytes` bytes. */
    cutAfter(token: string, bytes: number) {
      cuts.set(token, bytes);
    },
    /** Responses for this token stall after `bytes` bytes until `release`. */
    hold(token: string, bytes: number) {
      holds.set(token, bytes);
    },
    /** Answers this token with the whole file (200) even when a Range is asked for. */
    ignoreRange(token: string) {
      wholeOnly.add(token);
    },
    release(token: string) {
      holds.delete(token);
    },
    ranges,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
