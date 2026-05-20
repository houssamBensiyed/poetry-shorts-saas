import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { isUuid, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isHttpUrl, resolveLocalFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
};

/**
 * Stream one voice's stored file. Remote voices redirect to Cloudinary; local
 * voices are streamed after an ownership and path-confinement check, so the UI
 * never needs to expose a filesystem path to the browser.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getSessionUser();
  if (!user) return jsonError("Unauthorized", 401);
  if (!isUuid(params.id)) return jsonError("Voice not found", 404);

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "video";
  if (kind !== "audio" && kind !== "video") {
    return jsonError("Use kind=audio or kind=video", 400);
  }
  const download = searchParams.get("download") === "1";

  const voice = await prisma.voice.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      storage_mode: true,
      audio_url: true,
      rendered_video_url: true,
    },
  });
  if (!voice) return jsonError("Voice not found", 404);

  const stored =
    kind === "audio" ? voice.audio_url : voice.rendered_video_url;
  if (!stored) {
    return jsonError(
      kind === "audio" ? "This voice has no audio file" : "No rendered reel yet",
      404,
    );
  }

  if (voice.storage_mode === "REMOTE") {
    if (!isHttpUrl(stored)) return jsonError("Invalid stored media URL", 404);
    return NextResponse.redirect(stored);
  }

  let file: string;
  try {
    file = await resolveLocalFile(stored);
  } catch {
    return jsonError("The local media file is missing", 404);
  }

  const info = await stat(file).catch(() => null);
  if (!info) return jsonError("The local media file is missing", 404);
  const extension = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
  const disposition = `${download ? "attachment" : "inline"}; filename="${path.basename(file)}"`;

  // Video elements seek with byte ranges. Without a 206 response Safari will
  // not play the file at all, and Chrome cannot scrub.
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const [, rawStart, rawEnd] = match;
      let start = rawStart ? Number(rawStart) : 0;
      let end = rawEnd ? Number(rawEnd) : info.size - 1;
      if (!rawStart && rawEnd) {
        // Suffix range: the last N bytes.
        const length = Number(rawEnd);
        start = Math.max(0, info.size - length);
        end = info.size - 1;
      }
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end >= start &&
        start < info.size
      ) {
        end = Math.min(end, info.size - 1);
        const stream = Readable.toWeb(
          createReadStream(file, { start, end }),
        ) as unknown as ReadableStream;
        return new NextResponse(stream, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${info.size}`,
            "Accept-Ranges": "bytes",
            "Content-Disposition": disposition,
            "Cache-Control": "private, no-store",
          },
        });
      }

      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${info.size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  const stream = Readable.toWeb(
    createReadStream(file),
  ) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
