import wasmUrl from "./opus/opus.wasm?url"; 
import createOpusModule from "./opus/opus.js";

let Module = null;

export async function initOpus() {
  if (Module) return Module;

  Module = await createOpusModule({
    // 2. Use that URL directly here
    locateFile: (path) => {
      if (path.endsWith(".wasm")) {
        return wasmUrl; 
      }
      return path;
    }
  });

  return Module;
}