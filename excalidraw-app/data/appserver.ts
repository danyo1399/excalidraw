import {FileId} from "../../element/types";
import {BinaryFileData, BinaryFileMetadata, DataURL} from "../../types";
import {decompressData} from "../../data/encode";
import {MIME_TYPES} from "../../constants";

const VITE_BACKEND = import.meta.env.VITE_BACKEND
export const saveFilesToAppServer = async (roomId: string, files: { id: FileId; buffer: Uint8Array }[]) => {
  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const formData = new FormData();
        formData.set('file', new Blob([buffer]));
        const response = await fetch(`${VITE_BACKEND}/rooms/${roomId}/files/${id}`, {body: formData, method: 'POST'});
        if(! response.ok) throw new Error('failed to send file');
        savedFiles.set(id, true);
      } catch (error: any) {
        erroredFiles.set(id, true);
      }
    }),
  );

  return { savedFiles, erroredFiles };
}

export const loadFilesFromAppServer = async (roomId: string, decryptionKey: string,
                                             filesIds: readonly FileId[] ) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `${VITE_BACKEND}/rooms/${roomId}/files/${id}`
        const response = await fetch(url);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );
          console.log('lol loaded file', {id, data, metadata})
          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
