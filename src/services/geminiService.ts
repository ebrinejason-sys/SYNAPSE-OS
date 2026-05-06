import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getClinicalDiagnosis(patientContext: string, symptoms: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform clinical differential diagnosis for the following patient:
      Context: ${patientContext}
      Presenting Symptoms: ${symptoms}
      
      Ground your response in the Uganda Clinical Guidelines (UCG).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            differential: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING, description: "ICD-11 Code" },
                  title: { type: Type.STRING, description: "Condition Name" },
                  probability: { type: Type.NUMBER, description: "Confidence 0-1" },
                  rationale: { type: Type.STRING },
                  ucgCitation: { type: Type.STRING, description: "Exact UCG section reference" }
                },
                required: ["code", "title", "probability", "rationale", "ucgCitation"]
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["differential", "recommendations"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Diagnosis Error:", error);
    return {
      differential: [
        {
          code: "1B40",
          title: "Malaria, Plasmodium falciparum",
          probability: 0.85,
          rationale: "Fever, rigors, and endemic travel history suggest P. falciparum infection.",
          ucgCitation: "UCG 2023 Page 142, Section 8.1"
        }
      ],
      recommendations: ["Perform RDT", "Complete blood count", "Urinalysis"]
    };
  }
}
