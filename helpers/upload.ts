/**
 * Upload a file to a Convex storage upload URL and return the resulting
 * storageId. Pair with a `generateUploadUrl` mutation on the backend.
 */
export async function uploadFile(uploadUrl: string, file: File): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('File upload failed');
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
