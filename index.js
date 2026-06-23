import { createNewSession } from "./func/createNewSession.js";
import { getInput } from "./func/getInput.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { getLatestSessionId } from "./func/getLatestSessionId.js";
import {oldAskOdysseus} from "./func/oldAskOdysseus.js";

//get input from user (this func will not be used for implementation projects)
const question = await getInput();

// new chat (func for create a new chat)
const sessionId = await createNewSession();
const lastSessionId = await getLatestSessionId();
await newAskOdysseus(sessionId, question);
await saveCurrentSession(sessionId);
console.log("New Session ID:", sessionId);

// latest chat (if there is a existing chat this func can be used)
await oldAskOdysseus(lastSessionId, question);
console.log("Old Session ID:", lastSessionId);

// print response and user input
console.log("Question:", question);
console.log("Answer:");



