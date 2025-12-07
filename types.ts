export enum Publisher {
  PEP = 'PEP (People\'s Education Press)',
  FLTRP = 'FLTRP (Foreign Language Teaching and Research Press)',
  YILIN = 'Yilin Press',
}

export enum Grade {
  Seven = 'Grade 7',
  Eight = 'Grade 8',
  Nine = 'Grade 9',
}

export enum Term {
  One = 'Term 1 (Book A)',
  Two = 'Term 2 (Book B)',
}

export enum AppMode {
  Setup = 'SETUP',
  Dashboard = 'DASHBOARD',
  VocabPractice = 'VOCAB_PRACTICE',
  TestPaper = 'TEST_PAPER',
  TestResult = 'TEST_RESULT',
}

export interface TextbookConfig {
  publisher: Publisher;
  grade: Grade;
  term: Term;
}

export interface VocabItem {
  id: string;
  english: string;
  chinese: string;
  partOfSpeech: string;
  example: string;
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  chinese: string;
  englishDefinition: string;
  example: string;
}

export interface GrammarBlank {
  id: number;
  hint: string; // e.g. "go" (root word) or empty if context clue
  answer: string;
  explanation: string;
}

export interface GrammarPracticeData {
  title: string;
  story: string; // text with {{1}}, {{2}} placeholders
  blanks: GrammarBlank[];
}

export interface PracticeSessionData {
  vocab: VocabItem[];
  grammar: GrammarPracticeData;
}

export interface VocabPracticeResult {
  wordId: string;
  userInput: string;
  isCorrect: boolean;
  timestamp: number;
}

export type QuestionType = 'multiple_choice' | 'boolean' | 'fill_in_blank' | 'writing';

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[]; // For MC
  correctAnswer?: string; // For auto-grading
  explanation?: string;
  userAnswer?: string;
  maxScore: number;
}

export interface TestSection {
  id: string;
  title: string;
  type: 'listening' | 'reading' | 'vocabulary' | 'writing';
  readingPassage?: string; // For reading sections
  questions: Question[];
}

export interface TestPaperData {
  id: string;
  title: string;
  listeningScript?: string;
  listeningAudioBase64?: string;
  sections: TestSection[];
}

export interface WritingFeedback {
  score: number;
  feedback: string;
  improvedVersion: string;
}

export interface TestResult {
  paperId: string;
  totalScore: number;
  maxTotalScore: number;
  sectionScores: Record<string, number>; // sectionId -> score
  writingFeedback?: Record<string, WritingFeedback>; // questionId -> feedback
  answers: Record<string, string>; // questionId -> userAnswer
}