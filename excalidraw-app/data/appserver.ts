import {ExcalidrawElement, FileId} from "../../element/types";
import {AppState, BinaryFileData, BinaryFileMetadata, DataURL} from "../../types";
import {decompressData} from "../../data/encode";
import {MIME_TYPES} from "../../constants";
import {getSyncableElements, SyncableExcalidrawElement} from "./index";
import {restoreElements} from "../../data/restore";
import {getSceneVersion} from "../../element";
import Portal from "../collab/Portal";
import {reconcileElements} from "../collab/reconciliation";
import {Simulate} from "react-dom/test-utils";

const VITE_BACKEND = import.meta.env.VITE_BACKEND

class SceneVersionCache {
  private static cache = new WeakMap<SocketIOClient.Socket, number>();
  static get = (socket: SocketIOClient.Socket) => {
    return SceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: SocketIOClient.Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

export const saveFilesToAppServer = async (roomId: string, files: { id: FileId; buffer: Uint8Array }[]) => {
  const erroredFiles = new Map<FileId, true>();
  const savedFiles = new Map<FileId, true>();

  await Promise.all(
    files.map(async ({id, buffer}) => {
      try {
        const formData = new FormData();
        formData.set('file', new Blob([buffer]));
        const response = await fetch(`${VITE_BACKEND}/rooms/${roomId}/files/${id}`, {body: formData, method: 'POST'});
        if (!response.ok) throw new Error('failed to send file');
        savedFiles.set(id, true);
      } catch (error: any) {
        erroredFiles.set(id, true);
      }
    }),
  );

  return {savedFiles, erroredFiles};
}

async function fetchGetElements(roomId: string) {
  const response = await fetch(`${VITE_BACKEND}/rooms/${roomId}/elements`, {method: 'GET'});
  if (!response.ok) throw new Error('failed to load elements');
  const loadedElements: ExcalidrawElement[] | null = await response.json()
  return loadedElements;
}

async function fetchPutElements(roomId: string, elements: readonly SyncableExcalidrawElement[]) {
  const response = await fetch(`${VITE_BACKEND}/rooms/${roomId}/elements`, {
    method: 'PUT',
    body: JSON.stringify(elements),
    headers: {'content-type': 'application/json'}
  });
  if (!response.ok) throw new Error('failed to load elements');
}

export const loadFromAppServer = async (
  roomId: string,
  socket: SocketIOClient.Socket | null,
): Promise<readonly ExcalidrawElement[] | null> => {
  console.log('lol load from appserver')

  const loadedElements = await fetchGetElements(roomId);
  if (loadedElements == null) {
    return null;
  }

  const elements = getSyncableElements(
    loadedElements
  );

  if (socket) {
    SceneVersionCache.set(socket, elements);
  }

  return restoreElements(elements, null);
};

export const isSavedToAppServer = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return SceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveToAppServer = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const {roomId, roomKey, socket} = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToAppServer(portal, elements)
  ) {
    return false;
  }


  const loadedElements = await fetchGetElements(roomId);

  if (loadedElements == null) {
    console.log('lol creating doc');
    await fetchPutElements(roomId, elements);

    return {
      elements,
      reconciledElements: null,
    };
  }

  const prevElements = getSyncableElements(
    loadedElements
  );

  const reconciledElements = getSyncableElements(
    reconcileElements(elements, prevElements, appState),
  );

  await fetchPutElements(roomId, reconciledElements);

  console.log('lol updating doc');

  SceneVersionCache.set(socket, elements);

  return { reconciledElements };
};

export const loadFilesFromAppServer = async (roomId: string,
                                             filesIds: readonly FileId[]) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `${VITE_BACKEND}/rooms/${roomId}/files/${id}`
        const response = await fetch(url);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const {data, metadata} = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {

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

  return {loadedFiles, erroredFiles};
};
