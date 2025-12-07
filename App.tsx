import React, { useState, useRef } from 'react';
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
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>;

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
      alert("Failed to generate content. Please check your connection and API key.");
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
      alert("Failed to generate test paper. Please check your API key.");
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
          <div className="flex items-center gap-4">
            {config && mode !== AppMode.Setup && (
              <button 
                onClick={() => setMode(AppMode.Dashboard)}
                className="text-sm font-medium text-slate-500 hover:text-brand-600"
              >
                Dashboard
              </button>
            )}
          </div>
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

function TextSelectionLookup({ children }: { children?: React.ReactNode }) {
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
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY
        });
        // Clear previous definition if new selection
        setDefinition(null);
      }
    } else {
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
            <div className="w-72 p-4 text-left">
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-lg text-brand-300">{definition.word}</h3>
                 <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{definition.phonetic}</span>
               </div>
               <p className="text-white font-medium mb-1">{definition.chinese}</p>
               <p className="text-slate-300 text-sm mb-2 italic">{definition.englishDefinition}</p>
               <div className="bg-slate-700/50 p-2 rounded text-sm text-slate-200 border-l-2 border-brand-500">
                 "{definition.example}"
               </div>
            </div>
          )}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
        </div>
      )}
    </div>
  );
}

// --- Setup View ---

function SetupView({ onSave }: { onSave: (config: TextbookConfig) => void }) {
  const [publisher, setPublisher] = useState<Publisher>(Publisher.PEP);
  const [grade, setGrade] = useState<Grade>(Grade.Seven);
  const [term, setTerm] = useState<Term>(Term.One);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ publisher, grade, term });
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg border border-slate-100 p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Welcome Student!</h2>
        <p className="text-slate-500 mt-2">Choose your textbook to get started.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Publisher</label>
          <select 
            value={publisher} 
            onChange={(e) => setPublisher(e.target.value as Publisher)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          >
            {Object.values(Publisher).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
            <select 
              value={grade} 
              onChange={(e) => setGrade(e.target.value as Grade)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              {Object.values(Grade).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Term</label>
            <select 
              value={term} 
              onChange={(e) => setTerm(e.target.value as Term)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
            >
              {Object.values(Term).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors shadow-md shadow-brand-200"
        >
          Start Learning
        </button>
      </form>
    </div>
  );
}

// --- Dashboard ---

function Dashboard({ 
  config, 
  onStartVocab, 
  onStartTest, 
  onChangeConfig 
}: { 
  config: TextbookConfig, 
  onStartVocab: (units: number[]) => void, 
  onStartTest: (units: number[], isZhongkao: boolean) => void,
  onChangeConfig: () => void
}) {
  const [selectedUnits, setSelectedUnits] = useState<number[]>([1]);
  const [isZhongkao, setIsZhongkao] = useState(false);
  const units = Array.from({ length: 12 }, (_, i) => i + 1);

  const toggleUnit = (u: number) => {
    if (selectedUnits.includes(u)) {
      setSelectedUnits(selectedUnits.filter(i => i !== u));
    } else {
      setSelectedUnits([...selectedUnits, u].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{config.grade} - {config.term}</h2>
          <p className="text-slate-500 text-sm">{config.publisher}</p>
        </div>
        <button 
          onClick={onChangeConfig}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium px-3 py-1 bg-brand-50 rounded-full border border-brand-100"
        >
          Change Textbook
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-lg text-slate-800 mb-4">Select Units</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-3 mb-6">
          {units.map(u => (
            <button
              key={u}
              onClick={() => toggleUnit(u)}
              className={`h-10 rounded-lg font-medium transition-all ${
                selectedUnits.includes(u) 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-200 scale-105' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
            <h4 className="font-bold text-indigo-900 mb-2">Practice & Learn</h4>
            <p className="text-sm text-indigo-700/80 mb-6">Master vocabulary words and grammar rules through interactive exercises.</p>
            <button 
              onClick={() => selectedUnits.length > 0 && onStartVocab(selectedUnits)}
              disabled={selectedUnits.length === 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Practice
            </button>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
            <div className="flex justify-between items-start mb-2">
               <h4 className="font-bold text-amber-900">Mock Test Paper</h4>
               <label className="flex items-center gap-2 cursor-pointer">
                 <div className="relative inline-block w-8 h-4 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      name="toggle" 
                      id="toggle" 
                      checked={isZhongkao}
                      onChange={(e) => setIsZhongkao(e.target.checked)}
                      className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-green-400"
                      style={{ right: isZhongkao ? '0' : 'auto', left: isZhongkao ? 'auto' : '0' }}
                    />
                    <label htmlFor="toggle" className={`toggle-label block overflow-hidden h-4 rounded-full cursor-pointer ${isZhongkao ? 'bg-green-400' : 'bg-gray-300'}`}></label>
                 </div>
                 <span className={`text-xs font-bold ${isZhongkao ? 'text-green-700' : 'text-slate-500'}`}>Zhongkao Mode</span>
               </label>
            </div>
            <p className="text-sm text-amber-800/80 mb-6">Take a comprehensive test covering Listening, Reading, and Writing.</p>
            <button 
              onClick={() => selectedUnits.length > 0 && onStartTest(selectedUnits, isZhongkao)}
              disabled={selectedUnits.length === 0}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Generate Test Paper
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Vocab & Grammar Practice View ---

function VocabPracticeView({ data, onBack }: { data: PracticeSessionData, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'vocab' | 'grammar'>('vocab');
  
  // Vocab State
  const [vocabInputs, setVocabInputs] = useState<Record<string, string>>({});
  const [vocabResults, setVocabResults] = useState<Record<string, boolean>>({});
  const [showVocabResults, setShowVocabResults] = useState(false);

  const checkVocab = () => {
    const newResults: Record<string, boolean> = {};
    data.vocab.forEach(word => {
      const userVal = vocabInputs[word.id]?.trim().toLowerCase() || '';
      newResults[word.id] = userVal === word.english.toLowerCase();
    });
    setVocabResults(newResults);
    setShowVocabResults(true);
  };

  const retryVocab = () => {
    setVocabInputs({});
    setVocabResults({});
    setShowVocabResults(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <BackIcon />
        </button>
        <h2 className="text-2xl font-bold text-slate-800">Unit Practice</h2>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('vocab')}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${
            activeTab === 'vocab' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Vocabulary
          {activeTab === 'vocab' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('grammar')}
          className={`pb-3 px-4 font-bold text-sm transition-colors relative ${
            activeTab === 'grammar' ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Grammar Passage
          {activeTab === 'grammar' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-600"></div>}
        </button>
      </div>

      {activeTab === 'vocab' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {data.vocab.map((item, idx) => {
              const isCorrect = vocabResults[item.id];
              const showFeedback = showVocabResults;

              return (
                <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-mono text-slate-400">#{idx + 1}</span>
                      <span className="font-bold text-lg text-slate-800">{item.chinese}</span>
                    </div>
                    <TextSelectionLookup>
                       <p className="text-sm text-slate-500 italic">{item.partOfSpeech}</p>
                       <p className="text-sm text-slate-600 mt-1">{item.example.replace(item.english, '_______')}</p>
                    </TextSelectionLookup>
                  </div>
                  
                  <div className="w-full sm:w-64 relative">
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck="false"
                      disabled={showFeedback && isCorrect}
                      value={vocabInputs[item.id] || ''}
                      onChange={(e) => setVocabInputs({...vocabInputs, [item.id]: e.target.value})}
                      className={`w-full px-4 py-2 bg-white border-2 rounded-lg outline-none font-medium transition-all ${
                        showFeedback 
                          ? isCorrect 
                            ? 'border-green-500 text-green-700 bg-green-50' 
                            : 'border-red-300 text-red-700 bg-red-50'
                          : 'border-slate-200 focus:border-brand-500 text-slate-900'
                      }`}
                      placeholder="Type English word..."
                    />
                    {showFeedback && (
                      <div className="absolute right-3 top-2.5">
                        {isCorrect ? <CheckIcon /> : <XIcon />}
                      </div>
                    )}
                    {showFeedback && !isCorrect && (
                      <p className="absolute top-full left-0 mt-1 text-sm font-bold text-green-600 animate-fade-in">
                        Answer: {item.english}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
             {showVocabResults && (
               <button 
                onClick={retryVocab}
                className="px-6 py-2 border border-slate-300 bg-white text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
               >
                 Retry All
               </button>
             )}
             <button 
              onClick={checkVocab}
              className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors shadow-sm"
             >
               {showVocabResults ? 'Check Again' : 'Check Answers'}
             </button>
          </div>
        </div>
      ) : (
        <GrammarSection data={data.grammar} />
      )}
    </div>
  );
}

function GrammarSection({ data }: { data: GrammarPracticeData }) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [showResults, setShowResults] = useState(false);

  // Split story by placeholders {{id}}
  const parts = data.story.split(/(\{\{\d+\}\})/g);

  const checkGrammar = () => {
    const newResults: Record<string, boolean> = {};
    data.blanks.forEach(b => {
      const userVal = inputs[b.id]?.trim().toLowerCase() || '';
      const correctVal = b.answer.trim().toLowerCase();
      newResults[b.id] = userVal === correctVal;
    });
    setResults(newResults);
    setShowResults(true);
  };

  return (
     <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-4">{data.title}</h3>
        
        <TextSelectionLookup>
          <div className="prose prose-slate max-w-none leading-loose text-lg">
            {parts.map((part, idx) => {
              const match = part.match(/\{\{(\d+)\}\}/);
              if (match) {
                const id = parseInt(match[1]);
                const blank = data.blanks.find(b => b.id === id);
                if (!blank) return null;

                const isCorrect = results[id];
                const show = showResults;
                // Dynamic width calculation based on answer length (approx 1ch per char, min 6ch)
                const widthStyle = { width: `${Math.max(6, blank.answer.length + 2)}ch` };

                return (
                  <span key={idx} className="inline-block mx-1 align-baseline relative group">
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck="false"
                      style={widthStyle}
                      value={inputs[id] || ''}
                      onChange={(e) => setInputs({...inputs, [id]: e.target.value})}
                      className={`px-2 py-0.5 border-b-2 outline-none text-center font-medium transition-colors ${
                        show
                          ? isCorrect 
                            ? 'border-green-500 text-green-700 bg-green-50/50' 
                            : 'border-red-400 text-red-700 bg-red-50/50'
                          : 'border-slate-300 focus:border-brand-500 focus:bg-brand-50/20'
                      }`}
                    />
                    {show && !isCorrect && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded whitespace-nowrap shadow-sm z-10">
                        {blank.answer}
                      </span>
                    )}
                  </span>
                );
              }
              return <span key={idx} className="whitespace-pre-wrap">{part}</span>;
            })}
          </div>
        </TextSelectionLookup>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
           <div className="text-sm text-slate-500 italic">
             Fill in the blanks with the correct form of the words. Context is key!
           </div>
           <button 
            onClick={checkGrammar}
            className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors shadow-sm"
           >
             Check Grammar
           </button>
        </div>
     </div>
  );
}

// --- Test Paper View ---

function TestPaperView({ paper, config, onBack }: { paper: TestPaperData, config: TextbookConfig, onBack: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [writingFeedback, setWritingFeedback] = useState<Record<string, WritingFeedback>>({});
  const [isGrading, setIsGrading] = useState(false);

  const handleSubmit = async () => {
    if (!confirm("Are you sure you want to submit the test?")) return;
    
    setIsGrading(true);
    let totalScore = 0;
    let maxTotalScore = 0;
    const sectionScores: Record<string, number> = {};
    const newWritingFeedback: Record<string, WritingFeedback> = {};

    // Auto-grade MC/FitB
    for (const section of paper.sections) {
      let sectionScore = 0;
      for (const q of section.questions) {
        maxTotalScore += q.maxScore;
        const userAns = answers[q.id];
        
        if (q.type === 'writing') {
          // AI Grade Writing
          const feedback = await GeminiService.gradeWriting(q.prompt, userAns || "No answer provided.", config.grade);
          newWritingFeedback[q.id] = feedback;
          sectionScore += feedback.score; // Assume maxScore 10 for writing usually
          totalScore += feedback.score;
        } else {
           if (userAns === q.correctAnswer) {
             sectionScore += q.maxScore;
             totalScore += q.maxScore;
           }
        }
      }
      sectionScores[section.id] = sectionScore;
    }

    setWritingFeedback(newWritingFeedback);
    setResult({
      paperId: paper.id,
      totalScore,
      maxTotalScore,
      sectionScores,
      writingFeedback: newWritingFeedback,
      answers
    });
    setSubmitted(true);
    setIsGrading(false);
  };

  if (submitted && result) {
    return <TestResultView paper={paper} result={result} onBack={onBack} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <BackIcon />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{paper.title}</h2>
          <p className="text-slate-500">Comprehensive Assessment</p>
        </div>
      </div>

      {paper.listeningAudioBase64 && (
        <div className="bg-white rounded-xl shadow-sm border border-brand-200 p-4 flex items-center gap-4 sticky top-20 z-20">
          <div className="w-10 h-10 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center">
            <SpeakerIcon />
          </div>
          <div className="flex-1">
             <h4 className="font-bold text-slate-800 text-sm">Listening Audio</h4>
             <audio controls className="w-full h-8 mt-1" src={`data:audio/mp3;base64,${paper.listeningAudioBase64}`} />
          </div>
        </div>
      )}

      <div className="space-y-8">
        {paper.sections.map((section, sIdx) => (
          <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="mb-6 pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Part {sIdx + 1}</span>
              <h3 className="text-xl font-bold text-slate-800 mt-1">{section.title}</h3>
            </div>

            {section.readingPassage && (
              <TextSelectionLookup>
                <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200 prose prose-slate max-w-none text-slate-800 leading-relaxed font-serif">
                  {section.readingPassage.split('\n').map((p, i) => <p key={i} className="mb-2">{p}</p>)}
                </div>
              </TextSelectionLookup>
            )}

            <div className="space-y-8">
              {section.questions.map((q, qIdx) => (
                <div key={q.id}>
                  <div className="flex gap-3 mb-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {qIdx + 1}
                    </span>
                    <div className="font-medium text-lg text-slate-800">{q.prompt}</div>
                  </div>

                  <div className="pl-9">
                    {q.type === 'multiple_choice' && q.options && (
                      <div className="space-y-2">
                        {q.options.map(opt => {
                           const val = opt.charAt(0); // Assuming "A. answer" format
                           return (
                            <label key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors group">
                              <input 
                                type="radio" 
                                name={q.id} 
                                value={val} 
                                checked={answers[q.id] === val}
                                onChange={() => setAnswers({...answers, [q.id]: val})}
                                className="w-4 h-4 text-brand-600 focus:ring-brand-500 border-gray-300"
                              />
                              <span className="text-slate-700 group-hover:text-slate-900">{opt}</span>
                            </label>
                           );
                        })}
                      </div>
                    )}

                    {q.type === 'writing' && (
                      <textarea
                        className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none bg-white text-slate-900 placeholder-slate-400"
                        placeholder="Type your essay here..."
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        {isGrading ? (
          <div className="flex items-center gap-3 px-8 py-3 bg-brand-100 text-brand-700 font-bold rounded-lg cursor-wait">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
            Grading...
          </div>
        ) : (
          <button 
            onClick={handleSubmit}
            className="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg shadow-lg shadow-brand-200 transition-all transform hover:-translate-y-0.5"
          >
            Submit Test
          </button>
        )}
      </div>
    </div>
  );
}

// --- Test Result View ---

function TestResultView({ paper, result, onBack }: { paper: TestPaperData, result: TestResult, onBack: () => void }) {
  const [showScript, setShowScript] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
         <h2 className="text-3xl font-bold text-slate-800 mb-2">Test Results</h2>
         <div className="flex justify-center items-end gap-2 mb-4">
           <span className="text-6xl font-black text-brand-600">{result.totalScore}</span>
           <span className="text-2xl font-bold text-slate-400 mb-2">/ {result.maxTotalScore}</span>
         </div>
         <p className="text-slate-500">
           {result.totalScore / result.maxTotalScore > 0.8 ? "Excellent work! Keep it up." : "Good effort. Review your mistakes below."}
         </p>
         <button onClick={onBack} className="mt-6 px-6 py-2 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors">
           Back to Dashboard
         </button>
      </div>

      {paper.listeningScript && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg text-slate-800">Listening Script</h3>
             <button 
               onClick={() => setShowScript(!showScript)}
               className="text-sm font-bold text-brand-600 hover:text-brand-800"
             >
               {showScript ? 'Hide Script' : 'Show Script'}
             </button>
          </div>
          {showScript && (
             <TextSelectionLookup>
                <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-line text-slate-700 leading-relaxed border border-slate-200">
                  {paper.listeningScript}
                </div>
             </TextSelectionLookup>
          )}
        </div>
      )}

      <div className="space-y-8">
        {paper.sections.map((section, sIdx) => (
          <div key={section.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
             <div className="mb-6 pb-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{section.title}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                result.sectionScores[section.id] === section.questions.reduce((a, b) => a + b.maxScore, 0)
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
              }`}>
                Score: {result.sectionScores[section.id]}
              </span>
            </div>

            <div className="space-y-8">
               {section.questions.map((q, qIdx) => {
                 const userAns = result.answers[q.id];
                 const isCorrect = q.type !== 'writing' && userAns === q.correctAnswer;
                 const feedback = result.writingFeedback?.[q.id];

                 return (
                   <div key={q.id} className={`p-4 rounded-xl ${
                     q.type === 'writing' ? 'bg-slate-50' : isCorrect ? 'bg-green-50/50' : 'bg-red-50/50'
                   }`}>
                      <div className="flex gap-3 mb-2">
                        <span className="font-bold text-slate-500">{qIdx+1}.</span>
                        <div className="font-medium text-slate-800">{q.prompt}</div>
                      </div>

                      {q.type === 'multiple_choice' && (
                        <div className="ml-7 mb-3 text-slate-600">
                           <p>Your Answer: <span className="font-bold">{userAns || "(None)"}</span></p>
                           {!isCorrect && <p className="text-green-700">Correct Answer: <span className="font-bold">{q.correctAnswer}</span></p>}
                        </div>
                      )}

                      {q.type === 'writing' && feedback && (
                        <div className="ml-7 mt-4 space-y-4">
                           <div className="bg-white p-4 rounded border border-slate-200">
                             <h4 className="font-bold text-sm text-slate-500 uppercase mb-2">Your Essay</h4>
                             <p className="whitespace-pre-wrap text-slate-800">{userAns}</p>
                           </div>
                           
                           <div className="bg-blue-50 p-4 rounded border border-blue-100">
                              <div className="flex justify-between mb-2">
                                <h4 className="font-bold text-blue-900">AI Feedback</h4>
                                <span className="font-bold text-blue-700">{feedback.score}/10</span>
                              </div>
                              <p className="text-blue-800 mb-4">{feedback.feedback}</p>
                              <div className="bg-white/80 p-3 rounded text-sm text-slate-700">
                                <span className="font-bold text-slate-900 block mb-1">Improved Version:</span>
                                {feedback.improvedVersion}
                              </div>
                           </div>
                        </div>
                      )}

                      {!isCorrect && q.explanation && q.type !== 'writing' && (
                        <div className="ml-7 text-sm text-slate-500 bg-white p-3 rounded border border-slate-200/50">
                          <span className="font-bold">Explanation: </span>{q.explanation}
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