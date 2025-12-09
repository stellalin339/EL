import { GoogleGenAI, Type, Modality } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    switch (action) {
      case "generateVocabAndGrammar":
        return await handleVocab(payload);
      case "generateTestPaper":
        return await handleTestPaper(payload);
      case "generateSpeech":
        return await handleSpeech(payload);
      case "gradeWriting":
        return await handleGrading(payload);
      case "lookupWord":
        return await handleLookup(payload);
      default:
        return new Response("Unknown action", { status: 400 });
    }
  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

async function handleVocab({ publisher, grade, term, units }: any) {
  const unitString = units.join(", ");
  const prompt = `Generate English practice content for Chinese middle school students using the latest edition of ${publisher} textbook, ${grade}, ${term}, Units: ${unitString}.
  
  PART 1: Vocabulary List
  Generate 20 challenging high-frequency words/phrases.
  Criteria:
  1. Focus on latest textbook content and Zhongkao key words.
  2. Avoid basic words; choose ones that differentiate top students.
  
  PART 2: Grammar Fill-in-the-Blank Passage
  Generate a coherent passage (approx 150-200 words) with 10-12 blanks to test comprehensive grammar and usage.
  
  CRITICAL REQUIREMENTS for the blanks:
  1. Tense Mixture: You MUST include blanks that test Simple Present, Simple Past, Simple Future, Present Progressive, and Present Perfect tenses.
  2. Set Phrases & Expressions: Include blanks that test key collocations, phrasal verbs, or fixed expressions specific to these units (e.g., "look forward to", "make a decision").
  3. Morphology: Test singular/plural nouns (irregular), comparative/superlative adjectives, and adverb formation.
  4. Contextual Logic: Conjunctions and prepositions.
  
  CRITICAL RULE FOR HINTS:
  - DO NOT PROVIDE ANY HINTS. The 'hint' field MUST ALWAYS be an empty string "".
  - The goal is for students to infer the word entirely from context.
  
  The difficulty should be moderate to hard, suitable for preparing for exams.
  
  Return a JSON object with:
  - 'vocab': Array of objects { english, chinese, partOfSpeech, example }.
  - 'grammar': Object { 
      'title': string, 
      'story': string (Use {{1}}, {{2}} as placeholders for blanks in the text), 
      'blanks': Array of { id: number, hint: string (ALWAYS EMPTY STRING ""), answer: string (correct form), explanation: string } 
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vocab: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                english: { type: Type.STRING },
                chinese: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ["english", "chinese", "partOfSpeech", "example"],
            },
          },
          grammar: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              story: { type: Type.STRING },
              blanks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.INTEGER },
                    hint: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ["id", "hint", "answer", "explanation"],
                },
              },
            },
            required: ["title", "story", "blanks"],
          },
        },
        required: ["vocab", "grammar"],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  // Add IDs to vocab items
  const vocabWithIds = (data.vocab || []).map((item: any, index: number) => ({
    ...item,
    id: `vocab-${Date.now()}-${index}`,
  }));

  return new Response(JSON.stringify({ vocab: vocabWithIds, grammar: data.grammar }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleTestPaper({ publisher, grade, term, units, isZhongkao }: any) {
  const unitString = units.join(", ");
  let instructionDetails = "";
  
  if (isZhongkao) {
    instructionDetails = `
    CRITICAL: This is a "Zhongkao Sprint" paper. 
    1. Integrate high-frequency key points (grammar, phrases, sentence structures) from previous years' Chinese Middle School Entrance Examinations (Zhongkao).
    2. The difficulty should EXCEED the standard textbook level to simulate actual exam pressure.
    3. In the 'explanation' field, explicitly mention which Zhongkao knowledge point is being tested.
    `;
  } else {
    instructionDetails = `
    Ensure the difficulty is challenging, suitable for top-tier students using the latest ${publisher} textbooks.
    `;
  }

  const systemInstruction = `You are an expert English teacher for Chinese middle school students. Create a comprehensive and challenging test paper based on ${publisher} ${grade} ${term}, Units: ${unitString}. 
  ${instructionDetails}
  
  The test must include exactly the following structure:
  
  1. Listening Section (Two Parts):
     - PART A: 5 Short Conversations. 
       SCRIPT FORMATTING RULE: You MUST strictly use speaker tags "Man:", "Woman:", "Boy:", "Girl:", or "Narrator:" at the start of every line.
     - PART B: Passage Listening. 
       Script Format: "Narrator: Passage. [Text...]. Question 6..."
     - Provide 5 Multiple Choice Questions for Part A and 5 for Part B.
     - The 'listeningScript' field must contain the FULL text for both Part A and Part B.
  
  2. Vocabulary & Grammar Section:
     - 10 challenging Multiple Choice Questions.

  3. Reading Section A (Easy/Medium):
     - A standard reading passage.
     - 3 Questions.

  4. Reading Section B (Medium/Hard):
     - A more complex passage.
     - 3 Questions.

  5. Reading Section C (Hard/Challenge):
     - A difficult passage (long text, approx 300 words).
     - 4 Questions.
  
  6. Writing Section:
     - A structured writing prompt.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Generate the full test paper structure in JSON.",
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          listeningScript: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['listening', 'reading', 'vocabulary', 'writing'] },
                readingPassage: { type: Type.STRING, nullable: true },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ['multiple_choice', 'boolean', 'fill_in_blank', 'writing'] },
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                      correctAnswer: { type: Type.STRING, nullable: true },
                      explanation: { type: Type.STRING },
                      maxScore: { type: Type.INTEGER },
                    },
                    required: ["id", "type", "prompt", "maxScore", "explanation"],
                  },
                },
              },
              required: ["id", "title", "type", "questions"],
            },
          },
        },
        required: ["title", "listeningScript", "sections"],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  const paper = { ...data, id: `test-${Date.now()}` };
  
  return new Response(JSON.stringify(paper), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleSpeech({ text }: any) {
  // Ensure exactly 2 speakers for 2.5 TTS
  const cleanText = text
    .replace(/(Narrator|Man|Boy):/g, 'Speaker A:')
    .replace(/(Woman|Girl):/g, 'Speaker B:');

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text: cleanText }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: 'Speaker A',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
            },
            {
              speaker: 'Speaker B',
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
          ]
        }
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return new Response(JSON.stringify({ audioData }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleGrading({ question, studentAnswer, gradeLevel }: any) {
  const prompt = `Grade this English writing for a Chinese middle school student (${gradeLevel}).
  Question: ${question}
  Student Answer: ${studentAnswer}
  
  Provide a score out of 10, constructive feedback, and an improved version of the answer.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          feedback: { type: Type.STRING },
          improvedVersion: { type: Type.STRING },
        },
        required: ["score", "feedback", "improvedVersion"],
      },
    },
  });

  return new Response(response.text, {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleLookup({ word }: any) {
  const prompt = `Explain the English word/phrase "${word}" for a Chinese middle school student. 
  Return JSON with:
  - word: the word/phrase
  - phonetic: IPA or text pronunciation
  - chinese: Concise Chinese meaning
  - englishDefinition: Simple English definition
  - example: A simple example sentence`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          chinese: { type: Type.STRING },
          englishDefinition: { type: Type.STRING },
          example: { type: Type.STRING },
        },
        required: ["word", "phonetic", "chinese", "englishDefinition", "example"],
      },
    },
  });

  return new Response(response.text, {
    headers: { "Content-Type": "application/json" },
  });
}