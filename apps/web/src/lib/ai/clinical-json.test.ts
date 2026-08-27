import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractJsonObject, parseClinicalDemoResponse } from "./clinical-json.ts";

describe("extractJsonObject", () => {
  it("parses fenced JSON and strips think blocks", () => {
    const raw = `<think>ignore me</think>
\`\`\`json
{"hello":"world"}
\`\`\`
`;
    assert.deepEqual(extractJsonObject(raw), { hello: "world" });
  });

  it("extracts the first object from noisy completions", () => {
    const raw = "Sure, here you go:\n{ \"ok\": true, \"n\": 1 }\nThanks!";
    assert.deepEqual(extractJsonObject(raw), { ok: true, n: 1 });
  });
});

describe("parseClinicalDemoResponse", () => {
  it("normalizes camelCase hypotheses into the demo shape", () => {
    const parsed = parseClinicalDemoResponse(JSON.stringify({
      hypotheses: [
        {
          conditionName: "Malaria",
          icd11Code: "1F40",
          confidence: 0.9,
          aiReasoning: "Fever in endemic setting",
        },
      ],
      suggestedWorkup: ["mRDT"],
      redFlags: ["neck stiffness"],
      clinicalNote: "Consider malaria first.",
      followUpQuestions: ["Any travel?"],
    }));

    assert.equal(parsed.differentials[0]?.condition, "Malaria");
    assert.equal(parsed.differentials[0]?.confidence, "high");
    assert.deepEqual(parsed.suggested_workup, ["mRDT"]);
    assert.deepEqual(parsed.follow_up_questions, ["Any travel?"]);
  });

  it("rejects payloads with no differentials", () => {
    assert.throws(() => parseClinicalDemoResponse('{"clinical_note":"none"}'));
  });
});
