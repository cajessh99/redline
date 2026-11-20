// Runs the fixture contract through the real analysis boundary and prints what a reader would see.
//
//   npm run smoke    (loads .env.local when it exists)
//
// With OPENROUTER_API_KEY and OPENROUTER_MODEL set, it calls OpenRouter. Without them it says so and
// uses a fake built from the fixture sidecar, labelled FAKE MODEL. It prints the model name, never
// the key. Exit code 1 when the analysis returns an error.
import { readFileSync } from "node:fs";
import { analyse } from "../lib/analysis/analyse.ts";
import type { ModelClient } from "../lib/analysis/model.ts";
import { OpenRouterClient } from "../lib/analysis/openrouter-client.ts";
import { normaliseText } from "../lib/intake/normalise.ts";
import { defaultEnabledRedLines } from "../lib/red-lines/defaults.ts";
import { fakeModel, sidecarPayload, type Sidecar } from "../tests/support/fake-model.ts";

const PARTY = "Contractor";
const fixtures = new URL("../tests/fixtures/", import.meta.url);
const text = normaliseText(readFileSync(new URL("one-sided-services-agreement.txt", fixtures), "utf8"));

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
const modelName = process.env.OPENROUTER_MODEL?.trim();

let model: ModelClient;
let label: string;
if (apiKey && modelName) {
  model = new OpenRouterClient({ apiKey, model: modelName });
  label = `OpenRouter, model ${modelName}`;
} else {
  const sidecar = JSON.parse(
    readFileSync(new URL("one-sided-services-agreement.flags.json", fixtures), "utf8"),
  ) as Sidecar;
  model = fakeModel(sidecarPayload(sidecar));
  label = "FAKE MODEL (built from the fixture sidecar)";
  const missing = [apiKey ? null : "OPENROUTER_API_KEY", modelName ? null : "OPENROUTER_MODEL"].filter(Boolean);
  console.log(`Not set: ${missing.join(", ")}. Using the FAKE MODEL.`);
}

const redLines = defaultEnabledRedLines();
console.log(`Model: ${label}`);
console.log(`Document: one-sided-services-agreement.txt (${text.length} characters, normalised)`);
console.log(`Party: ${PARTY}`);
console.log(`Red lines: ${redLines.map((r) => r.id).join(", ")}`);
console.log("");

const started = Date.now();
const result = await analyse({ text, party: PARTY, redLines }, { model });
const seconds = ((Date.now() - started) / 1000).toFixed(1);

if (!result.ok) {
  console.error(`ERROR after ${seconds}s (${result.error.kind}): ${result.error.message}`);
  process.exit(1);
}

console.log(`${result.flags.length} flag(s) in ${seconds}s`);
for (const [i, flag] of result.flags.entries()) {
  console.log("");
  console.log(`${i + 1}. [${flag.tier}] ${flag.redLineId}: ${flag.redLineTitle}`);
  console.log(`   Statement: ${flag.statement}`);
  console.log(`   Source (offset ${flag.offset}): "${flag.sourceSentence}"`);
  const verbatim = text.slice(flag.offset, flag.offset + flag.sourceSentence.length) === flag.sourceSentence;
  console.log(`   Verbatim at offset: ${verbatim ? "yes" : "NO"}`);
}
console.log("");
console.log(`Checked: ${result.checkedRedLineIds.join(", ")}`);
console.log(`Diagnostics: ${JSON.stringify(result.diagnostics)}`);
