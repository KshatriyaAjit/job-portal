"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function generateAIScore(jobDescription: string, candidateProfile: any) {
  if (!apiKey || !genAI) {
    return { score: 0, reason: "Error: API Key is missing." };
  }

  try {
    // 👇 FORCE USE OF 'gemini-pro' (The standard free model)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      You are an expert Tech Recruiter. 
      JOB DESCRIPTION: "${jobDescription.slice(0, 500)}"
      CANDIDATE PROFILE: ${JSON.stringify(candidateProfile)}
      
      TASK: Rate match (0-100) and give 1 sentence reason.
      OUTPUT JSON: { "score": number, "reason": "string" }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON
    const jsonString = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);

  } catch (error: any) {
    console.error("AI Error:", error.message);
    // 👇 Updated Error Message to confirm new code is running
    return { score: 0, reason: `AI Error: ${error.message}` }; 
  }
}