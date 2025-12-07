import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Publisher, Grade, Term, VocabItem, TestPaperData, WritingFeedback, PracticeSessionData, WordDefinition } from '../types';

const getAiClient = () => {
  // Guidelines: The API key must be obtained exclusively from the environment variable process.env.API_KEY.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Vocabulary & Grammar Generation ---

export const generateVocabAndGrammar = async (
  publisher: Publisher,
  grade: Grade,
  term: Term,
  units: number[]
): Promise<PracticeSessionData> => {
  const ai = getAiClient();
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

  try {
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
                story: { type: Type.STRING, description: "Full story text with placeholders {{1}}, {{2}} etc." },
                blanks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      hint: { type: Type.STRING, description: "ALWAYS EMPTY STRING." },
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

    return {
      vocab: vocabWithIds,
      grammar: data.grammar || { title: "Error", story: "Could not generate grammar.", blanks: [] },
    };
  } catch (error) {
    console.error("Practice generation failed", error);
    throw error;
  }
};

// --- Test Paper Generation ---

export const generateTestPaper = async (
  publisher: Publisher,
  grade: Grade,
  term: Term,
  units: number[],
  isZhongkao: boolean = false
): Promise<TestPaperData> => {
  const ai = getAiClient();
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

  // Updated structure: Short Conversations + Passage Listening + 3 Reading Passages
  const systemInstruction = `You are an expert English teacher for Chinese middle school students. Create a comprehensive and challenging test paper based on ${publisher} ${grade} ${term}, Units: ${unitString}. 
  ${instructionDetails}
  
  The test must include exactly the following structure:
  
  1. Listening Section (Two Parts):
     - PART A: 5 Short Conversations. 
       SCRIPT FORMATTING RULE: You MUST strictly use speaker tags "Man:", "Woman:", "Boy:", "Girl:", or "Narrator:" at the start of every line.
       Example:
       Narrator: Conversation 1.
       Man: How are you?
       Woman: I am fine.
       Narrator: Question: How is the woman?
     
     - PART B: Passage Listening. 
       Script Format: "Narrator: Passage. [Text...]. Question 6..."
     
     - Provide 5 Multiple Choice Questions for Part A and 5 for Part B.
     - The 'listeningScript' field must contain the FULL text for both Part A and Part B so it can be read aloud by the TTS engine.
  
  2. Vocabulary & Grammar Section:
     - 10 challenging Multiple Choice Questions.
     - Focus on nuanced grammar and vocabulary usage.

  3. Reading Section A (Easy/Medium):
     - A standard reading passage.
     - 3 Questions.

  4. Reading Section B (Medium/Hard):
     - A more complex passage (e.g., cultural essay or science).
     - 3 Questions.

  5. Reading Section C (Hard/Challenge):
     - A difficult passage (long text, approx 300 words).
     - 4 Questions.
  
  6. Writing Section:
     - A structured writing prompt based on current hot topics or textbook themes.
  `;

  try {
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
            listeningScript: { type: Type.STRING, description: "Full script with speaker tags (Narrator:, Man:, Woman:)" },
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
    return {
      ...data,
      id: `test-${Date.now()}`,
    };
  } catch (error) {
    console.error("Test generation failed", error);
    throw error;
  }
};

// --- TTS Generation ---

export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: text }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Man',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
              },
              {
                speaker: 'Woman',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
              },
              {
                speaker: 'Boy',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
              },
              {
                speaker: 'Girl',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
              },
              {
                speaker: 'Narrator',
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
              }
            ]
          }
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data returned");
    }
    return audioData;
  } catch (error) {
    console.error("Speech generation failed", error);
    throw error;
  }
};

// --- Writing Grading ---

export const gradeWriting = async (
  question: string,
  studentAnswer: string,
  gradeLevel: string
): Promise<WritingFeedback> => {
  const ai = getAiClient();

  const prompt = `Grade this English writing for a Chinese middle school student (${gradeLevel}).
  Question: ${question}
  Student Answer: ${studentAnswer}
  
  Provide a score out of 10, constructive feedback, and an improved version of the answer.`;

  try {
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

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Grading failed", error);
    return {
      score: 0,
      feedback: "Could not grade automatically.",
      improvedVersion: "",
    };
  }
};

// --- Word Lookup ---

export const lookupWord = async (word: string): Promise<WordDefinition> => {
  const ai = getAiClient();
  const prompt = `Explain the English word/phrase "${word}" for a Chinese middle school student. 
  Return JSON with:
  - word: the word/phrase
  - phonetic: IPA or text pronunciation
  - chinese: Concise Chinese meaning
  - englishDefinition: Simple English definition
  - example: A simple example sentence`;

  try {
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
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Lookup failed", error);
    throw error;
  }
};