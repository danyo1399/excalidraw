import {isProd} from "./constants";

export function logDebug(str: string, ...args: any[]) {
  if(isProd) {
    return;
  }
  const clonedArgs = JSON.parse(JSON.stringify(args))
  console.log(str, ...clonedArgs);
}
