import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No GEMINI_API_KEY set");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function runSmokeTest() {
  console.log("=== GEMINI SMOKE TEST ===");
  console.log("SDK: @google/genai v2.28.0");
  
  const testCandidatePrompt = `You are an expert technical recruiter and talent evaluator. Analyze the following candidate for the specified job role.

Return ONLY a valid JSON object matching the following structure:
{
  "overallScore": number (0-100),
  "skillAlignment": {
    "score": number (0-100),
    "matchedSkills": ["string"],
    "missingSkills": ["string"]
  },
  "experienceAlignment": {
    "score": number (0-100),
    "assessment": "string"
  },
  "qualificationsAlignment": {
    "score": number (0-100),
    "assessment": "string"
  },
  "keyStrengths": ["string"],
  "recommendations": "string",
  "summary": "string"
}

JOB REQUIREMENTS:
Title: Senior Full Stack Engineer
Description: Looking for an experienced engineer proficient in React, Next.js, TypeScript, and MongoDB.

CANDIDATE PROFILE:
Skills: React, Next.js, TypeScript, Node.js, MongoDB
Bio: Experienced full-stack engineer with 5 years building production Next.js apps.`;

  const modelsToTry = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
    "gemini-3.5-flash-lite"
  ];

  for (const model of modelsToTry) {
    console.log(`\nAttempting generation with model: ${model}...`);
    try {
      // Test interactions.create
      const interaction = await ai.interactions.create({
        model,
        input: testCandidatePrompt,
      });

      const outputText = interaction.output_text;
      console.log(`[SUCCESS] Model '${model}' responded successfully via Interactions API.`);
      console.log(`Response length: ${outputText?.length} characters.`);
      
      // Clean and test JSON parse
      const cleaned = outputText?.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned || "{}");
      console.log(`Parsed Overall Score: ${parsed.overallScore}`);
      console.log(`Summary: ${parsed.summary}`);
      console.log(`Matched Skills:`, parsed.skillAlignment?.matchedSkills);
      return { success: true, model, parsed };
    } catch (err) {
      console.log(`[FAILED] Model '${model}' failed: status ${err.status} - ${err.message?.slice(0, 100)}`);
    }
  }

  return { success: false };
}

runSmokeTest().then((result) => {
  if (result.success) {
    console.log("\n>>> LIVE SMOKE TEST PASSED! <<<");
  } else {
    console.log("\n>>> LIVE SMOKE TEST FAILED! <<<");
  }
});

