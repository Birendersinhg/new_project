import { useEffect, useState } from 'react';
import {
  ArrowLeft, Check, ChevronRight, Clock3, LogOut, RotateCcw, Sparkles, Trophy, X,
} from 'lucide-react';
import { BANK, LEVELS, QUESTIONS_PER_LEVEL, SUBJECTS, type Level, type Question, type Subject } from './quizData';

interface QuizAppProps {
  name: string;
  /** Seconds allowed per question, set by the admin. */
  timerSeconds: number;
  onLogout: () => void;
}

type Phase = 'subjects' | 'levels' | 'quiz' | 'result';

interface Answer {
  question: Question;
  picked: number | null;
  correct: boolean;
}

const letter = (i: number) => String.fromCharCode(65 + i);

export default function QuizApp({ name, timerSeconds, onLogout }: QuizAppProps) {
  const [phase, setPhase] = useState<Phase>('subjects');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [level, setLevel] = useState<Level>('easy');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(timerSeconds);

  const levelMeta = LEVELS.find((l) => l.id === level)!;
  const questions = subject ? BANK[subject.id][level] : [];
  const question = questions[index];
  const correctCount = answers.filter((a) => a.correct).length;
  const score = answers.reduce((sum, a) => sum + (a.correct ? levelMeta.points : 0), 0);

  const startQuiz = (nextSubject: Subject, nextLevel: Level) => {
    setSubject(nextSubject);
    setLevel(nextLevel);
    setIndex(0);
    setAnswers([]);
    setPicked(null);
    setLocked(false);
    setRemaining(timerSeconds);
    setPhase('quiz');
    window.scrollTo(0, 0);
  };

  const pick = (choice: number | null) => {
    if (locked || !question) return;
    setPicked(choice);
    setLocked(true);
    setAnswers((prev) => [...prev, { question, picked: choice, correct: choice === question.answer }]);
  };

  // Runs the countdown while a question is unanswered; 0 means the question is marked wrong.
  useEffect(() => {
    if (phase !== 'quiz' || locked || !question) return;
    if (remaining <= 0) {
      setLocked(true);
      setPicked(null);
      setAnswers((prev) => [...prev, { question, picked: null, correct: false }]);
      return;
    }
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, locked, remaining, question]);

  const next = () => {
    if (index + 1 >= questions.length) {
      setPhase('result');
      window.scrollTo(0, 0);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setLocked(false);
    setRemaining(timerSeconds);
  };

  const reset = () => {
    setPhase('subjects');
    setSubject(null);
    setAnswers([]);
    setIndex(0);
    setPicked(null);
    setLocked(false);
    window.scrollTo(0, 0);
  };

  const pct = Math.round((correctCount / QUESTIONS_PER_LEVEL) * 100);
  const verdict = pct === 100 ? 'Perfect score!' : pct >= 60 ? 'Well played!' : 'Keep practising!';
  const timerPct = Math.max(0, (remaining / timerSeconds) * 100);

  return (
    <div className="phone quiz">
      <header className="quiz-top">
        <div className="quiz-brand">
          <span className="quiz-logo"><Sparkles size={20} /></span>
          <div>
            <b>Quiz Arena</b>
            <small>{phase === 'quiz' && subject ? `${subject.name} - ${levelMeta.label}` : 'Test your knowledge'}</small>
          </div>
        </div>
        <div className="quiz-user">
          <span className="quiz-avatar">{name.charAt(0).toUpperCase()}</span>
          <button className="quiz-logout" onClick={onLogout} aria-label="Logout"><LogOut size={18} /></button>
        </div>
      </header>

      {phase === 'subjects' && (
        <div className="quiz-body">
          <div className="quiz-hero">
            <span className="quiz-hero-icon"><Trophy size={30} /></span>
            <div>
              <h2>Pick a subject</h2>
              <p>3 levels, 5 questions each, {timerSeconds} seconds per question.</p>
            </div>
          </div>
          <div className="subject-grid">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  className="subject-card"
                  style={{ background: `linear-gradient(145deg, ${s.from}, ${s.to})` }}
                  onClick={() => { setSubject(s); setPhase('levels'); window.scrollTo(0, 0); }}
                >
                  <span className="subject-icon" style={{ background: 'rgba(255,255,255,.16)' }}><Icon size={30} /></span>
                  <b>{s.name}</b>
                  <small>{s.tagline}</small>
                  <span className="subject-go"><ChevronRight size={18} /></span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'levels' && subject && (
        <div className="quiz-body">
          <button className="quiz-back" onClick={reset}><ArrowLeft size={18} /> All subjects</button>
          <div className="level-head">
            <span className="subject-icon" style={{ background: subject.soft, color: subject.from }}><subject.icon size={28} /></span>
            <div>
              <h2>{subject.name}</h2>
              <p>{subject.tagline}</p>
            </div>
          </div>
          <div className="level-list">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                className="level-card"
                onClick={() => startQuiz(subject, l.id)}
                style={{ borderColor: l.from }}
              >
                <span className="level-badge" style={{ background: `linear-gradient(135deg, ${l.from}, ${l.to})` }}>{l.label}</span>
                <span className="level-text">
                  <b>{l.label} level</b>
                  <small>{l.blurb}</small>
                </span>
                <span className="level-meta">
                  <b>{QUESTIONS_PER_LEVEL} Q</b>
                  <small>{l.points} pts each</small>
                </span>
                <ChevronRight size={20} className="level-chev" />
              </button>
            ))}
          </div>
          <div className="quiz-tip">
            <Clock3 size={16} /> You get {timerSeconds} seconds per question. Unanswered questions count as wrong.
          </div>
        </div>
      )}

      {phase === 'quiz' && subject && question && (
        <div className="quiz-body">
          <div className="quiz-progress">
            <div className="quiz-progress-top">
              <button className="quiz-back inline" onClick={() => setPhase('levels')}><ArrowLeft size={16} /> Levels</button>
              <span>Question {index + 1} of {questions.length}</span>
              <span className="quiz-score-live">{correctCount * levelMeta.points} pts</span>
            </div>
            <div className="quiz-progress-bar">
              {questions.map((_, i) => (
                <span key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
              ))}
            </div>
          </div>

          <div className="timer-row">
            <span className={'timer-chip' + (remaining <= 5 ? ' danger' : '')}>
              <Clock3 size={16} /> {remaining}s
            </span>
            <div className="timer-track">
              <div className={'timer-fill' + (remaining <= 5 ? ' danger' : '')} style={{ width: `${timerPct}%` }} />
            </div>
          </div>

          <div className="question-card">
            <span className="question-index">{index + 1}</span>
            <h3>{question.q}</h3>
          </div>

          <div className="option-list">
            {question.options.map((option, i) => {
              const isPicked = picked === i;
              const isCorrect = locked && i === question.answer;
              const isWrongPick = locked && isPicked && i !== question.answer;
              return (
                <button
                  key={option}
                  className={'option' + (isCorrect ? ' correct' : '') + (isWrongPick ? ' wrong' : '') + (isPicked && !locked ? ' picked' : '')}
                  onClick={() => pick(i)}
                  disabled={locked}
                >
                  <span className="option-letter">{letter(i)}</span>
                  <span className="option-text">{option}</span>
                  {isCorrect && <Check size={20} className="option-mark" />}
                  {isWrongPick && <X size={20} className="option-mark" />}
                </button>
              );
            })}
          </div>

          {locked && picked === null && <div className="quiz-note danger">Time up - the correct answer is highlighted.</div>}
          {locked && picked !== null && picked !== question.answer && <div className="quiz-note danger">Not quite. The correct answer is highlighted.</div>}
          {locked && picked === question.answer && <div className="quiz-note good">Correct! +{levelMeta.points} points</div>}

          <button className="quiz-next" onClick={next} disabled={!locked}>
            {index + 1 >= questions.length ? 'See my score' : 'Next question'} <ChevronRight size={20} />
          </button>
        </div>
      )}

      {phase === 'result' && subject && (
        <div className="quiz-body">
          <div className="result-card">
            <span className="result-icon"><Trophy size={38} /></span>
            <h2>{verdict}</h2>
            <p>{subject.name} - {levelMeta.label} level</p>
            <div className="result-score">
              <b>{score}</b>
              <span>points</span>
            </div>
            <div className="result-stats">
              <div><b>{correctCount}/{QUESTIONS_PER_LEVEL}</b><span>Correct</span></div>
              <div><b>{pct}%</b><span>Accuracy</span></div>
              <div><b>{timerSeconds}s</b><span>Per question</span></div>
            </div>
          </div>

          <div className="review-list">
            <h3>Answer review</h3>
            {answers.map((a, i) => (
              <div key={i} className={'review-row' + (a.correct ? ' good' : ' bad')}>
                <span className="review-icon">{a.correct ? <Check size={16} /> : <X size={16} />}</span>
                <div>
                  <b>{a.question.q}</b>
                  <small>
                    {a.picked === null ? 'Not answered' : `Your answer: ${a.question.options[a.picked]}`}
                    {!a.correct && ` | Correct: ${a.question.options[a.question.answer]}`}
                  </small>
                </div>
              </div>
            ))}
          </div>

          <div className="result-actions">
            <button className="quiz-next" onClick={() => startQuiz(subject, level)}><RotateCcw size={18} /> Play again</button>
            <button className="quiz-secondary" onClick={() => { setPhase('levels'); window.scrollTo(0, 0); }}>Change level</button>
            <button className="quiz-secondary" onClick={reset}>All subjects</button>
          </div>
        </div>
      )}
    </div>
  );
}
