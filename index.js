import { createNewSession } from "./func/createNewSession.js";
// import { getInput } from "./func/getInput.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { getLatestSessionId } from "./func/getLatestSessionId.js";
import {oldAskOdysseus} from "./func/oldAskOdysseus.js";

// const question = await getInput();

const sessionId = await createNewSession();
const lastSessionId = await getLatestSessionId();

console.log("Old Session ID:", lastSessionId);
console.log("New Session ID:", sessionId);
console.log("Question:", question);
console.log("Answer:");

// new chat
await newAskOdysseus(sessionId, question);
await saveCurrentSession(sessionId);

// latest chat
await oldAskOdysseus(lastSessionId, question);