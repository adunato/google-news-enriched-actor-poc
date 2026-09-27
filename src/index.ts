import { Actor } from "apify";
import { processActorInput, runWithActorInput } from "./input.js";
import { retrieveGoogleNewsArticles } from "./google-news.js";
import { resolvePublisherUrls } from "./publisher-url.js";

async function main(): Promise<void> {
  await Actor.init();
  const rawInput: unknown = await Actor.getInput();
  await runWithActorInput(rawInput, async (input) => {
    const articles = await retrieveGoogleNewsArticles(input);
    const resolvedArticles = await resolvePublisherUrls(articles, input.resolvePublisherUrls);
    processActorInput(input, resolvedArticles);
  });
  await Actor.exit();
}

await main();
