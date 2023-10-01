import {atom} from "jotai";
import {appJotaiStore} from "./app-jotai";
import {useAtom} from "jotai";
import {saveUsernameToLocalStorage} from "./data/localStorage";


const POLLING_INTERVAL = 1000 * 5; // 10 seconds
export type User = {
  isAuthenticated: boolean,
  expires: number,
  profile?: { displayName: string, username: string },
  showExpiryWarningThresholdMs: number
}
export const loggedInUserAtom = atom<User | null>(null);

updateUserInfo()
setInterval(() => {
  updateUserInfo()
}, POLLING_INTERVAL)

async function updateUserInfo() {
  try {
    const res = await fetch('/auth/user');
    if (res.ok) {
      const json: User = await res.json();
      appJotaiStore.set(loggedInUserAtom, json);

      saveUsernameToLocalStorage(json.profile?.displayName || '')
    }
  } catch (err) {
    console.log('failed to retrieve user info', err);
  }
}

export const UserSessionWarning = () => {
  const [user] = useAtom(loggedInUserAtom);
  if (user && user.isAuthenticated === false) {
    return <div className="collab-offline-warning">
      Your session has expired. Refresh your browser to re-login
    </div>
  }

  if (user) {
    const remainingTime = (user.expires || 0) - Date.now();
    const showWarning = remainingTime < (user.showExpiryWarningThresholdMs);
    if (showWarning) {
      return <div className="collab-offline-warning" >
        Your session will expiry soon. Please refresh your browser to re-login.
      </div>
    }
  }


  return null;
}
