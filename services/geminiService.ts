import { Publisher, Grade, Term, TestPaperData, WritingFeedback, PracticeSessionData, WordDefinition } from '../types';

const API_ENDPOINT = '/.netlify/functions/gemini';

async function callApi(action: string, payload: any) {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${response.statusText}`);
  }

  return response.json();
}

// --- Vocabulary & Grammar Generation ---

export const generateVocabAndGrammar = async (
  publisher: Publisher,
  grade: Grade,
  term: Term,
  units: number[]
): Promise<PracticeSessionData> => {
  return callApi('generateVocabAndGrammar', { publisher, grade, term, units });
};

// --- Test Paper Generation ---

export const generateTestPaper = async (
  publisher: Publisher,
  grade: Grade,
  term: Term,
  units: number[],
  isZhongkao: boolean = false
): Promise<TestPaperData> => {
  return callApi('generateTestPaper', { publisher, grade, term, units, isZhongkao });
};

// --- TTS Generation ---

export const generateSpeech = async (text: string): Promise<string> => {
  const result = await callApi('generateSpeech', { text });
  return result.audioData;
};

// --- Writing Grading ---

export const gradeWriting = async (
  question: string,
  studentAnswer: string,
  gradeLevel: string
): Promise<WritingFeedback> => {
  return callApi('gradeWriting', { question, studentAnswer, gradeLevel });
};

// --- Word Lookup ---

export const lookupWord = async (word: string): Promise<WordDefinition> => {
  return callApi('lookupWord', { word });
};
