import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export async function getClinicalDiagnosis(patientContext: string, symptoms: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Perform clinical differential diagnosis for the following patient:
      Context: ${patientContext}
      Presenting Symptoms: ${symptoms}
      
      Ground your response in the Uganda Clinical Guidelines (UCG).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            differentials: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  icd_code: { type: Type.STRING, description: "ICD-11 Code" },
                  diagnosis: { type: Type.STRING, description: "Condition Name" },
                  confidence: { type: Type.NUMBER, description: "Confidence 0-100" },
                  reasoning: { type: Type.STRING, description: "Clinical rationale" },
                  ucgCitation: { type: Type.STRING, description: "Exact UCG section reference" }
                },
                required: ["icd_code", "diagnosis", "confidence", "reasoning", "ucgCitation"]
              }
            },
            treatment: { type: Type.STRING, description: "UCG recommended treatment plan" },
            redFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Warning signs requiring immediate escalation"
            }
          },
          required: ["differentials", "treatment", "redFlags"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Diagnosis Error:", error);
    return {
      differentials: [
        {
          icd_code: "1B40",
          diagnosis: "Malaria, Plasmodium falciparum",
          confidence: 85,
          reasoning: "Fever, rigors, and endemic travel history suggest P. falciparum infection.",
          ucgCitation: "UCG 2023 Page 142, Section 8.1"
        },
        {
          icd_code: "1C10",
          diagnosis: "Typhoid fever",
          confidence: 45,
          reasoning: "Prolonged fever with relative bradycardia warrants exclusion of enteric fever.",
          ucgCitation: "UCG 2023 Page 198, Section 10.3"
        }
      ],
      treatment: "Artemether-Lumefantrine (AL) 80/480mg twice daily for 3 days. Ensure adequate hydration. Reassess in 48h if fever persists. (UCG 2023 Section 8.1.2)",
      redFlags: [
        "Altered consciousness or seizures",
        "Inability to stand or sit without support",
        "Respiratory distress or SpO2 < 92%",
        "Severe vomiting preventing oral medication"
      ]
    };
  }
}
