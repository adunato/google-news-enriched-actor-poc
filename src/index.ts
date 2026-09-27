import { Actor } from "apify";
import { processActorInput, runWithActorInput } from "./input.js";

async function main(): Promise<void> {
  await Actor.init();
  const rawInput: unknown = await Actor.getInput();
  await runWithActorInput(rawInput, processActorInput);
  await Actor.exit();
}

await main();
