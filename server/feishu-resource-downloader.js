export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function createFeishuResourceDownloader({ client, logger = console }) {
  return async function downloadResource(messageId, fileKey) {
    const resource = await client.im.v1.messageResource.get({
      path: { message_id: messageId, file_key: fileKey },
      params: { type: "file" },
      data: { type: "file" },
    });
    const buffer = await streamToBuffer(resource.getReadableStream());
    logger.info?.("feishu_resource_downloaded", {
      bytes: buffer.length,
      messageId,
    });
    return buffer;
  };
}
