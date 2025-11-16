import { NextResponse } from "next/server";

import { getCurrentUserServerSide, invokeContractsFunction } from "@/lib/amplify-server";
import { getContractExchangeById, getContractFileById } from "@/lib/contracts-data";

type RouteContext = {
  params: {
    id: string;
    fileId: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const exchangeId = context.params.id;
    const fileId = context.params.fileId;

    const currentUser = await getCurrentUserServerSide();
    const currentUserId = currentUser?.userId;

    if (!currentUserId) {
      return NextResponse.json({ error: "You must be signed in to download files." }, { status: 401 });
    }

    const [exchange, fileRecord] = await Promise.all([
      getContractExchangeById(exchangeId),
      getContractFileById(fileId),
    ]);

    if (!exchange) {
      return NextResponse.json({ error: "Exchange not found." }, { status: 404 });
    }

    const viewerIsParticipant =
      currentUserId === exchange.partyAId || currentUserId === exchange.partyBId;

    if (!viewerIsParticipant) {
      return NextResponse.json({ error: "You are not authorized to access this exchange." }, { status: 403 });
    }

    if (!fileRecord || fileRecord.exchangeId !== exchange.id) {
      return NextResponse.json({ error: "File not found in this exchange." }, { status: 404 });
    }

    const downloadPayload = await invokeContractsFunction({
      operation: "decryptAndDownload",
      payload: { fileId },
    });

    if (!downloadPayload.fileBase64) {
      throw new Error("contractsFunction response missing decrypted payload.");
    }

    const resolvedFileName = downloadPayload.fileName ?? fileRecord.fileName ?? "downloaded-file";
    const fileBuffer = Buffer.from(downloadPayload.fileBase64, "base64");

    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Length", fileBuffer.byteLength.toString());
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Disposition", buildContentDispositionHeader(resolvedFileName));

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Failed to stream decrypted file", error);
    return NextResponse.json({ error: "Unable to download file at this time." }, { status: 500 });
  }
}

function buildContentDispositionHeader(fileName: string) {
  const fallbackName = sanitizeAsciiFileName(fileName);
  const encodedFileName = encodeRFC5987ValueChars(fileName);
  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedFileName}`;
}

function sanitizeAsciiFileName(fileName: string) {
  const cleaned = fileName.replace(/["\r\n]/g, "_").replace(/[/\\]/g, "_");
  const asciiOnly = cleaned.replace(/[^\x20-\x7E]/g, "_").trim();
  return asciiOnly || "downloaded-file";
}

function encodeRFC5987ValueChars(str: string) {
  return encodeURIComponent(str)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}
