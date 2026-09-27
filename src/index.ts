import { Actor } from "apify";
import { processActorInput, runWithActorInput } from "./input.js";
import { retrieveGoogleNewsArticles } from "./google-news.js";

async function main(): Promise<void> {
  await Actor.init();
  const rawInput: unknown = await Actor.getInput();
  await runWithActorInput(rawInput, async (input) => {
    const articles = await retrieveGoogleNewsArticles(input);
    processActorInput(input);
    console.info(
      JSON.stringify({ event: "google_news_articles_retrieved", articleCount: articles.length }),
    );
  });
  await Actor.exit();
}

await main();
