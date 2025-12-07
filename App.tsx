import React, { useState, useEffect, useRef } from 'react';
import { 
  Publisher, 
  Grade, 
  Term, 
  AppMode, 
  TextbookConfig, 
  VocabItem, 
  TestPaperData,
  TestResult,
  WritingFeedback,
  PracticeSessionData,
  GrammarPracticeData,
  WordDefinition
} from './types';
import * as GeminiService from './services/geminiService';

// --- Icons ---
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const BackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.Setup);
  const [config, setConfig] = useState<TextbookConfig | null>(null);
  
  // Data State
  const [practiceData, setPracticeData] = useState<PracticeSessionData | null>(null);
  const [testPaper, setTestPaper] = useState<TestPaperData | null>(null);
  
  // Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const handleConfigSave = (newConfig: TextbookConfig) => {
    setConfig(newConfig);
    setMode(AppMode.Dashboard);
  };

  const handleVocabStart = async (units: number[]) => {
    if (!config) return;
    setIsLoading(true);
    setLoadingMessage("Generating vocabulary and grammar challenges from textbook...");
    try {
      const data = await GeminiService.generateVocabAndGrammar(config.publisher, config.grade, config.term, units);
      setPracticeData(data);
      setMode(AppMode.VocabPractice);
    } catch (e) {
      alert("Failed to generate content. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestStart = async (units: number[], isZhongkao: boolean) => {
    if (!config) return;
    setIsLoading(true);
    if (isZhongkao) {
      setLoadingMessage("Generating Zhongkao-level simulation (Short Convos, Passage, 3 Readings + Writing)...");
    } else {
      setLoadingMessage("Generating Comprehensive Test (Short Convos, Passage, 3 Readings)...");
    }
    
    try {
      const paper = await GeminiService.generateTestPaper(config.publisher, config.grade, config.term, units, isZhongkao);
      
      if (paper.listeningScript) {
        setLoadingMessage("Synthesizing audio for Listening section (Conversations & Passage)...");
        try {
          const audioBase64 = await GeminiService.generateSpeech(paper.listeningScript);
          paper.listeningAudioBase64 = audioBase64;
        } catch (err) {
          console.error("Audio generation failed, continuing without audio", err);
        }
      }
      
      setTestPaper(paper);
      setMode(AppMode.TestPaper);
    } catch (e) {
      alert("Failed to generate test paper.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <nav className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" onClick={() => config && setMode(AppMode.Dashboard)}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl cursor-pointer">E</div>
            <span className="font-bold text-lg text-slate-800 cursor-pointer hidden sm:block">Middle School English Master</span>
            <span className="font-bold text-lg text-slate-800 cursor-pointer sm:hidden">English Master</span>
          </div>
          {config && mode !== AppMode.Setup && (
            <button 
              onClick={() => setMode(AppMode.Dashboard)}
              className="text-sm font-medium text-slate-500 hover:text-brand-600"
            >
              Dashboard
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            <p className="text-slate-600 animate-pulse font-medium text-center">{loadingMessage}</p>
          </div>
        ) : (
          <>
            {mode === AppMode.Setup && <SetupView onSave={handleConfigSave} />}
            {mode === AppMode.Dashboard && config && (
              <Dashboard 
                config={config} 
                onStartVocab={handleVocabStart}
                onStartTest={handleTestStart}
                onChangeConfig={() => setMode(AppMode.Setup)}
              />
            )}
            {mode === AppMode.VocabPractice && practiceData && (
              <VocabPracticeView 
                data={practiceData} 
                onBack={() => setMode(AppMode.Dashboard)} 
              />
            )}
            {mode === AppMode.TestPaper && testPaper && (
              <TestPaperView 
                paper={testPaper}
                config={config!}
                onBack={() => setMode(AppMode.Dashboard)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Text Lookup Wrapper Component ---

function TextSelectionLookup({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const text = sel.toString().trim();
      // Only show lookup for reasonably short selections (1-3 words roughly)
      if (text && text.length < 50 && text.split(' ').length <= 4) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Calculate relative to viewport to handle scrolling
        // We'll use fixed positioning for the tooltip
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top
        });
        // Clear previous definition if new selection
        setDefinition(null);
      }
    } else {
      // Don't hide immediately if clicking inside the tooltip (handled by click propagation check typically, but simple click outside works here)
      // We will handle clearing selection via a separate click listener on document if needed, 
      // but simpler: if they click anywhere else and selection is collapsed, hide.
      setSelection(null);
      setDefinition(null);
    }
  };

  const handleLookup = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clearing selection
    if (!selection) return;
    
    setLoading(true);
    try {
      const def = await GeminiService.lookupWord(selection.text);
      setDefinition(def);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className="relative">
      {children}
      
      {selection && (
        <div 
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-800 text-white rounded-lg shadow-xl p-1 animate-fade-in"
          style={{ left: selection.x, top: selection.y - 8 }}
        >
          {!definition ? (
            <button 
              onClick={handleLookup}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-700 rounded transition-colors whitespace-nowrap text-sm font-medium"
            >
              <SearchIcon />
              {loading ? "Loading..." : "Look up"}
            </button>
          ) : (
            <div className="w-64 p-3 text-left">
               <div className="flex justify-between items-start mb-1">
                 <h4 className="font-bold text-lg text-brand-300">{definition.word}</h4>
                 <button onClick={() => setSelection(null)} className="text-slate-400 hover:text-white"><XIcon /></button>
               </div>
               <div className="text-xs text-slate-400 mb-2 font-mono">/{definition.phonetic}/</div>
               <div className="mb-2">
                 <span className="bg-brand-900 text-brand-200 text-xs px-1 rounded mr-2">CH</span>
                 <span className="font-medium">{definition.chinese}</span>
               </div>
               <div className="mb-2 text-sm text-slate-300 leading-snug">
                 {definition.englishDefinition}
               </div>
               <div className="bg-slate-700/50 p-2 rounded text-xs text-slate-300 italic">
                 "{definition.example}"
               </div>
            </div>
          )}
          {/* Arrow */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1 w-2 h-2 bg-slate-800 rotate-45"></div>
        </div>
      )}
    </div>
  );
}

// --- Sub Components ---

function SetupView({ onSave }: { onSave: (config: TextbookConfig) => void }) {
  const [publisher, setPublisher] = useState<Publisher>(Publisher.PEP);
  const [grade, setGrade] = useState<Grade>(Grade.Seven);
  const [term, setTerm] = useState<Term>(Term.One);

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Setup Your Textbook</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Publisher</label>
          <select 
            value={publisher} 
            onChange={(e) => setPublisher(e.target.value as Publisher)}
            className="w-full rounded-lg border-slate-300 border p-3 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
          >
            {Object.values(Publisher).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Grade</label>
            <select 
              value={grade} 
              onChange={(e) => setGrade(e.target.value as Grade)}
              className="w-full rounded-lg border-slate-300 border p-3 focus:ring-2 focus:ring-brand-500 outline-none"
            >
              {Object.values(Grade).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Term</label>
            <select 
              value={term} 
              onChange={(e) => setTerm(e.target.value as Term)}
              className="w-full rounded-lg border-slate-300 border p-3 focus:ring-2 focus:ring-brand-500 outline-none"
            >
              {Object.values(Term).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button 
          onClick={() => onSave({ publisher, grade, term })}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mt-4"
        >
          Start Learning
        </button>
      </div>
    </div>
  );
}

function Dashboard({ 
  config, 
  onStartVocab, 
  onStartTest,
  onChangeConfig 
}: { 
  config: TextbookConfig;
  onStartVocab: (units: number[]) => void;
  onStartTest: (units: number[], isZhongkao: boolean) => void;
  onChangeConfig: () => void;
}) {
  const [selectedVocabUnits, setSelectedVocabUnits] = useState<number[]>([1]);
  const [selectedTestUnits, setSelectedTestUnits] = useState<number[]>([1]);
  const [isZhongkao, setIsZhongkao] = useState(false);
  
  // Helper to toggle units
  const toggleUnit = (unit: number, current: number[], setter: (u: number[]) => void) => {
    if (current.includes(unit)) {
      if (current.length > 1) setter(current.filter(u => u !== unit));
    } else {
      setter([...current, unit].sort((a, b) => a - b));
    }
  };

  const UnitSelector = ({ selected, onChange }: { selected: number[], onChange: (u: number[]) => void }) => (
    <div className="flex flex-wrap gap-2 mt-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(u => (
        <button
          key={u}
          onClick={() => toggleUnit(u, selected, onChange)}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
            selected.includes(u) 
              ? 'bg-brand-600 text-white shadow-md' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, Student!</h1>
          <p className="text-slate-500 mt-1">{config.grade} • {config.term} • {config.publisher}</p>
        </div>
        <button onClick={onChangeConfig} className="text-sm text-brand-600 font-medium underline">
          Change Textbook
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Vocabulary Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
            <h3 className="text-xl font-bold text-white">Vocabulary & Grammar</h3>
            <p className="text-emerald-100 text-sm mt-1">Word check and fill-in-the-blank passage</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium text-slate-700">Select Units to Practice:</p>
            <UnitSelector selected={selectedVocabUnits} onChange={setSelectedVocabUnits} />
            <button 
              onClick={() => onStartVocab(selectedVocabUnits)}
              className="mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Start Practice
            </button>
          </div>
        </div>

        {/* Test Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6">
            <h3 className="text-xl font-bold text-white">Comprehensive Test</h3>
            <p className="text-blue-100 text-sm mt-1">Listening, Reading x3, Writing</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium text-slate-700">Select Range (Units):</p>
            <UnitSelector selected={selectedTestUnits} onChange={setSelectedTestUnits} />
            
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <div className="flex items-center h-5 mt-1">
                 <input
                   id="zhongkao"
                   type="checkbox"
                   checked={isZhongkao}
                   onChange={(e) => setIsZhongkao(e.target.checked)}
                   className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                 />
              </div>
              <label htmlFor="zhongkao" className="text-sm text-slate-700 cursor-pointer select-none">
                 <span className="font-bold text-blue-900 block mb-1">Entrance Exam (Zhongkao) Challenge</span>
                 <span className="text-slate-500 leading-snug">
                   Questions derived from previous Zhongkao key points. <span className="font-bold">High Difficulty.</span>
                 </span>
              </label>
            </div>

            <button 
              onClick={() => onStartTest(selectedTestUnits, isZhongkao)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Generate Test Paper
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VocabPracticeView({ data, onBack }: { data: PracticeSessionData, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'vocab' | 'grammar'>('vocab');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-slate-500 hover:text-slate-800">
          <BackIcon />
          <span className="ml-1">Back to Dashboard</span>
        </button>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
           <button 
             onClick={() => setActiveTab('vocab')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'vocab' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             1. Word Spelling
           </button>
           <button 
             onClick={() => setActiveTab('grammar')}
             className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'grammar' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             2. Grammar Passage
           </button>
        </div>
      </div>

      {activeTab === 'vocab' ? (
        <VocabSection items={data.vocab} onFinished={() => setActiveTab('grammar')} />
      ) : (
        <GrammarSection data={data.grammar} />
      )}
    </div>
  );
}

function VocabSection({ items, onFinished }: { items: VocabItem[], onFinished: () => void }) {
  const [isReview, setIsReview] = useState(false);
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [mistakes, setMistakes] = useState<string[]>([]); 
  const [activeItems, setActiveItems] = useState<VocabItem[]>(items);

  const handleSubmit = () => {
    const newMistakes: string[] = [];
    activeItems.forEach(item => {
      const input = (userInputs[item.id] || "").trim().toLowerCase();
      const answer = item.english.trim().toLowerCase();
      if (input !== answer) {
        newMistakes.push(item.id);
      }
    });
    setMistakes(newMistakes);
    setIsReview(true);
  };

  const handleRetry = () => {
    const mistakeItems = items.filter(i => mistakes.includes(i.id));
    setActiveItems(mistakeItems);
    setUserInputs({});
    const resetInputs: Record<string, string> = {};
    mistakeItems.forEach(i => resetInputs[i.id] = "");
    setUserInputs(resetInputs);
    setMistakes([]);
    setIsReview(false);
  };

  const handleFullReset = () => {
    setActiveItems(items);
    setUserInputs({});
    setMistakes([]);
    setIsReview(false);
  };

  const score = activeItems.length - mistakes.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {isReview && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
          <div className="text-3xl font-bold text-slate-800 mb-2">
            Vocab Score: <span className={score === activeItems.length ? "text-green-600" : "text-brand-600"}>{score}</span> / {activeItems.length}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {mistakes.length > 0 && (
              <button onClick={handleRetry} className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-full font-bold transition-colors">
                Retry Mistakes ({mistakes.length})
              </button>
            )}
            <button onClick={handleFullReset} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-full font-bold transition-colors">
              Restart
            </button>
            <button onClick={onFinished} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-bold transition-colors flex items-center">
              Next: Grammar Challenge &rarr;
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {activeItems.map((item) => {
          const isWrong = isReview && mistakes.includes(item.id);
          const isRight = isReview && !mistakes.includes(item.id);

          return (
            <div key={item.id} className={`bg-white p-6 rounded-xl shadow-sm border ${isWrong ? 'border-red-200 bg-red-50' : isRight ? 'border-green-200 bg-green-50' : 'border-slate-100'}`}>
              <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{item.partOfSpeech}</span>
                    {isReview && (isRight ? <CheckIcon/> : <XIcon/>)}
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">{item.chinese}</h3>
                  <div className="text-slate-500 text-sm mt-1 italic">
                    <TextSelectionLookup>
                       "{item.example.replace(new RegExp(item.english, 'gi'), '_____')}"
                    </TextSelectionLookup>
                  </div>
                </div>
                
                <div className="flex-1">
                  {isReview ? (
                    <div className="text-right md:text-left">
                       <div className="mb-1">
                         <span className="text-xs text-slate-400">Your Answer:</span>
                         <div className={`font-mono text-lg ${isWrong ? 'text-red-600 line-through' : 'text-green-600'}`}>
                           {userInputs[item.id] || "(empty)"}
                         </div>
                       </div>
                       {isWrong && (
                         <div>
                            <span className="text-xs text-slate-400">Correct:</span>
                            <div className="font-mono text-lg text-green-700 font-bold">{item.english}</div>
                         </div>
                       )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={userInputs[item.id] || ""}
                      onChange={(e) => setUserInputs({...userInputs, [item.id]: e.target.value})}
                      placeholder="Type English word..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-3 text-lg font-mono text-slate-500 focus:text-slate-800 focus:ring-2 focus:ring-brand-200 outline-none transition-all placeholder:text-slate-200"
                      autoComplete="off"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isReview && (
        <div className="sticky bottom-6 mt-8">
           <button 
             onClick={handleSubmit}
             className="w-full shadow-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-lg transition-transform transform hover:-translate-y-1 active:scale-95"
           >
             Check Spelling Answers
           </button>
        </div>
      )}
    </div>
  );
}

function GrammarSection({ data }: { data: GrammarPracticeData }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isChecked, setIsChecked] = useState(false);

  // Parse the story into segments for rendering
  // Looks for {{1}}, {{2}} etc.
  const segments = data.story.split(/(\{\{\d+\}\})/g);

  const calculateScore = () => {
    let correct = 0;
    data.blanks.forEach(b => {
      if ((answers[b.id] || "").trim().toLowerCase() === b.answer.toLowerCase()) {
        correct++;
      }
    });
    return correct;
  };

  const score = calculateScore();
  const total = data.blanks.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
      <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
        <h2 className="text-xl font-bold text-indigo-900">{data.title}</h2>
        <p className="text-indigo-600 text-sm mt-1">Fill in the blanks with the correct form of the given words (tense, plural, etc).</p>
      </div>

      <TextSelectionLookup>
        <div className="p-8 leading-loose text-lg text-slate-800 font-serif">
          {segments.map((segment, idx) => {
            const match = segment.match(/\{\{(\d+)\}\}/);
            if (match) {
              const id = parseInt(match[1]);
              const blank = data.blanks.find(b => b.id === id);
              
              if (!blank) return <span key={idx} className="text-red-500">[Error]</span>;

              const isCorrect = isChecked && (answers[id] || "").trim().toLowerCase() === blank.answer.toLowerCase();
              const isWrong = isChecked && !isCorrect;
              
              const width = `${Math.max(4, blank.answer.length + 1)}ch`;

              return (
                <span key={idx} className="inline-flex flex-col align-middle mx-1 relative group">
                   <span className="flex items-baseline gap-1">
                      <input
                        type="text"
                        disabled={isChecked}
                        value={answers[id] || ""}
                        onChange={(e) => setAnswers({...answers, [id]: e.target.value})}
                        style={{ width }}
                        className={`border-b-2 px-1 py-0 text-center outline-none bg-white font-sans text-base transition-colors ${
                          isChecked 
                            ? isCorrect 
                              ? "border-green-500 text-green-700 font-bold bg-green-50" 
                              : "border-red-500 text-red-700 line-through bg-red-50"
                            : "border-slate-300 focus:border-indigo-500 text-slate-800"
                        }`}
                      />
                   </span>
                   {isWrong && (
                     <span className="absolute top-full left-0 mt-1 bg-red-100 text-red-700 text-xs px-2 py-1 rounded shadow-sm z-10 whitespace-nowrap font-sans border border-red-200">
                       {blank.answer}
                     </span>
                   )}
                </span>
              );
            }
            return <span key={idx}>{segment}</span>;
          })}
        </div>
      </TextSelectionLookup>

      <div className="px-8 pb-8">
        {isChecked && (
           <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
             <div className="flex items-center gap-3 mb-3">
               <div className="text-2xl font-bold text-indigo-900">Score: {score} / {total}</div>
             </div>
             <div className="space-y-2">
               {data.blanks.map(b => (
                 <div key={b.id} className="text-sm">
                   <span className="font-bold text-indigo-700">Blank {b.id} ({b.answer}):</span> <span className="text-slate-600">{b.explanation}</span>
                 </div>
               ))}
             </div>
           </div>
        )}

        {!isChecked ? (
          <button 
            onClick={() => setIsChecked(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg"
          >
            Check Grammar Answers
          </button>
        ) : (
          <div className="flex gap-4">
             <button 
               onClick={() => {
                 setAnswers({});
                 setIsChecked(false);
               }}
               className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-xl transition-colors"
             >
               Retry
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TestPaperView({ paper, config, onBack }: { paper: TestPaperData, config: TextbookConfig, onBack: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [grading, setGrading] = useState(false);
  const [writingFeedback, setWritingFeedback] = useState<Record<string, WritingFeedback>>({});
  const [score, setScore] = useState({ total: 0, max: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [showListeningScript, setShowListeningScript] = useState(false);

  const playAudio = async () => {
    if (!paper.listeningAudioBase64 || isPlaying) return;
    setIsPlaying(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const binaryString = atob(paper.listeningAudioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const float32Data = new Float32Array(bytes.length / 2);
      const dataInt16 = new Int16Array(bytes.buffer);
      
      for (let i = 0; i < dataInt16.length; i++) {
        float32Data[i] = dataInt16[i] / 32768.0;
      }
      
      const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      alert("Audio playback failed.");
    }
  };

  const handleAnswer = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = async () => {
    setGrading(true);
    let totalScore = 0;
    let maxTotalScore = 0;
    const newWritingFeedback: Record<string, WritingFeedback> = {};

    for (const section of paper.sections) {
      for (const q of section.questions) {
        maxTotalScore += q.maxScore;
        
        if (q.type === 'multiple_choice' || q.type === 'boolean' || q.type === 'fill_in_blank') {
             if (q.correctAnswer && answers[q.id]?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
               totalScore += q.maxScore;
             }
        } else if (q.type === 'writing') {
           const userAnswer = answers[q.id] || "";
           if (userAnswer) {
             try {
                const feedback = await GeminiService.gradeWriting(q.prompt, userAnswer, config.grade);
                newWritingFeedback[q.id] = feedback;
                totalScore += feedback.score; 
             } catch (e) {
               console.error("Grading failed for " + q.id);
             }
           }
        }
      }
    }
    
    setScore({ total: totalScore, max: maxTotalScore });
    setWritingFeedback(newWritingFeedback);
    setShowResult(true);
    setGrading(false);
  };
  
  if (showResult) {
      return (
       <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
          <h2 className="text-3xl font-bold text-center mb-6 text-slate-800">Test Results</h2>
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-brand-600 inline-block">{score.total}</div>
            <div className="text-2xl text-slate-400 inline-block ml-2">/ {score.max}</div>
          </div>
          <button onClick={onBack} className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-4 rounded-xl font-bold mb-8 transition-colors">Back to Dashboard</button>
          
          <div className="space-y-8">
            {/* Listening Script Review */}
            {paper.listeningScript && (
               <div className="border-t pt-6">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xl font-bold text-slate-800">Listening Script Review</h3>
                   <button 
                     onClick={() => setShowListeningScript(!showListeningScript)}
                     className="text-sm text-brand-600 font-bold hover:underline"
                   >
                     {showListeningScript ? "Hide Script" : "Show Script"}
                   </button>
                 </div>
                 {showListeningScript && (
                   <TextSelectionLookup>
                     <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 font-serif text-slate-700 leading-relaxed whitespace-pre-wrap">
                       {paper.listeningScript}
                     </div>
                   </TextSelectionLookup>
                 )}
               </div>
            )}

            {paper.sections.map(section => (
               <div key={section.id} className="border-t pt-6">
                 <h3 className="text-xl font-bold mb-4 text-slate-800">{section.title}</h3>
                 
                 {/* Reading Passage Review */}
                 {section.readingPassage && (
                   <div className="mb-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                     <p className="text-xs font-bold text-slate-400 uppercase mb-2">Review Passage (Select text to lookup words)</p>
                     <TextSelectionLookup>
                       <div className="font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
                         {section.readingPassage}
                       </div>
                     </TextSelectionLookup>
                   </div>
                 )}

                 <div className="space-y-4">
                   {section.questions.map(q => {
                      const isCorrect = q.correctAnswer && answers[q.id]?.toLowerCase() === q.correctAnswer.toLowerCase();
                      const feedback = writingFeedback[q.id];
                      
                      let statusClass = 'bg-slate-50 border-slate-200';
                      if (q.type !== 'writing') {
                          statusClass = isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
                      } else {
                          statusClass = 'bg-indigo-50 border-indigo-200';
                      }

                      return (
                        <div key={q.id} className={`p-4 rounded-lg border ${statusClass}`}>
                           <p className="font-medium text-slate-900">{q.prompt}</p>
                           <p className="mt-2 text-sm text-slate-600"><span className="font-bold">Your Answer:</span> {answers[q.id] || "(No Answer)"}</p>
                           
                           {q.correctAnswer && !isCorrect && q.type !== 'writing' && (
                             <p className="text-sm font-bold text-green-700 mt-1">Correct Answer: {q.correctAnswer}</p>
                           )}
                           
                           {q.explanation && (
                             <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-200/50 pt-2">{q.explanation}</p>
                           )}
                           
                           {feedback && (
                             <div className="mt-3 bg-white p-3 rounded border border-indigo-100 shadow-sm">
                               <div className="flex justify-between items-center mb-1">
                                  <p className="font-bold text-indigo-600 text-sm">AI Feedback</p>
                                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Score: {feedback.score}</span>
                               </div>
                               <p className="text-sm text-slate-700">{feedback.feedback}</p>
                               <div className="mt-2 pt-2 border-t border-slate-100">
                                 <p className="text-xs font-bold text-green-700">Suggestion:</p>
                                 <p className="text-sm text-green-800 italic">{feedback.improvedVersion}</p>
                               </div>
                             </div>
                           )}
                        </div>
                      );
                   })}
                 </div>
               </div>
            ))}
          </div>
       </div>
     );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4 sticky top-4 z-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{paper.title}</h1>
          <p className="text-slate-500 text-sm">Please complete all sections.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-medium px-4">Exit</button>
           <button 
             onClick={handleSubmit} 
             disabled={grading}
             className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition-colors shadow-md hover:shadow-lg"
           >
             {grading ? 'Grading...' : 'Submit Test'}
           </button>
        </div>
      </div>

      {paper.listeningAudioBase64 && (
        <div className="bg-slate-800 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
               Listening Section
            </h3>
            <p className="text-slate-400 text-sm">Click play to hear the conversation and passage.</p>
          </div>
          <button 
            onClick={playAudio} 
            disabled={isPlaying}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${isPlaying ? 'bg-slate-600 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg hover:shadow-brand-500/50'}`}
          >
            {isPlaying ? (
              <>
                 <span className="animate-pulse">Playing...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                Play Audio
              </>
            )}
          </button>
        </div>
      )}

      {paper.sections.map((section, idx) => (
        <div key={section.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
           <div className="mb-6 border-b border-slate-100 pb-4">
             <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded mb-2 uppercase tracking-wider">{section.type}</span>
             <h3 className="text-2xl font-bold text-slate-900">{section.title}</h3>
           </div>
           
           {section.readingPassage && (
             <TextSelectionLookup>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 font-serif text-lg leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {section.readingPassage}
                </div>
             </TextSelectionLookup>
           )}

           <div className="space-y-10">
             {section.questions.map((q, qIdx) => (
               <div key={q.id} className="group">
                 <div className="flex gap-4">
                   <div className="flex-shrink-0 w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-sm mt-1">
                     {qIdx + 1}
                   </div>
                   <div className="flex-1">
                     <p className="font-medium text-lg text-slate-800 mb-4">{q.prompt}</p>
                     
                     {q.type === 'multiple_choice' && q.options && (
                       <div className="space-y-3">
                         {q.options.map((opt, optIdx) => (
                           <label key={optIdx} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${answers[q.id] === opt ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-200 hover:bg-slate-50'}`}>
                             <div className="flex items-center h-6">
                               <input 
                                 type="radio" 
                                 name={q.id} 
                                 value={opt} 
                                 checked={answers[q.id] === opt} 
                                 onChange={(e) => handleAnswer(q.id, e.target.value)}
                                 className="w-5 h-5 text-brand-600 focus:ring-brand-500 border-gray-300"
                               />
                             </div>
                             <span className="text-slate-700 text-base leading-snug">{opt}</span>
                           </label>
                         ))}
                       </div>
                     )}

                     {(q.type === 'fill_in_blank' || q.type === 'boolean') && (
                        <input
                          type="text"
                          value={answers[q.id] || ""}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                          className="w-full border-b-2 border-slate-200 focus:border-brand-500 outline-none py-2 text-lg transition-colors bg-transparent placeholder-slate-300 text-slate-800"
                          placeholder="Type your answer here..."
                        />
                     )}

                     {q.type === 'writing' && (
                       <textarea
                         value={answers[q.id] || ""}
                         onChange={(e) => handleAnswer(q.id, e.target.value)}
                         className="w-full h-48 p-4 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none resize-none transition-all bg-white text-slate-900 placeholder-slate-300"
                         placeholder="Write your answer here..."
                       />
                     )}
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      ))}
    </div>
  );
}