import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, SkipForward } from 'lucide-react';

type QuizOptionItem = {
  label?: string;
  text?: string;
};

type QuizQuestionItem = {
  id?: string;
  question?: string;
  options?: QuizOptionItem[];
  correct_answer?: string;
  explanation?: string;
  source_excerpt?: string | null;
  difficulty?: string | null;
  category?: string | null;
};

type Props = {
  questions: QuizQuestionItem[];
};

type QuizMode = 'taking' | 'result' | 'review';

export function ThinkFlowQuizStudy({ questions }: Props) {
  const [mode, setMode] = useState<QuizMode>('taking');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const questionSetKey = useMemo(
    () =>
      JSON.stringify(
        questions.map((question, index) => ({
          id: question.id || `question_${index}`,
          question: question.question || '',
          correct_answer: question.correct_answer || '',
          options: (question.options || []).map((option, optionIndex) => ({
            label: option.label || String.fromCharCode(65 + optionIndex),
            text: option.text || '',
          })),
        })),
      ),
    [questions],
  );

  useEffect(() => {
    setMode('taking');
    setCurrentIndex(0);
    setAnswers({});
  }, [questionSetKey]);

  const currentQuestion = useMemo(() => questions[currentIndex] || null, [questions, currentIndex]);
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  if (!currentQuestion) return null;

  const answerKey = String(currentQuestion.id || `question_${currentIndex}`);
  const selectedAnswer = answers[answerKey] || null;
  const hasActed = selectedAnswer !== null || Object.prototype.hasOwnProperty.call(answers, answerKey);

  const stats = questions.reduce(
    (summary, question, index) => {
      const key = String(question.id || `question_${index}`);
      const value = answers[key];
      if (!value) {
        summary.skipped += 1;
      } else if (value === question.correct_answer) {
        summary.correct += 1;
      } else {
        summary.wrong += 1;
      }
      return summary;
    },
    { correct: 0, wrong: 0, skipped: 0 },
  );

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((previous) => previous + 1);
      return;
    }
    setMode('result');
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((previous) => previous - 1);
  };

  const handleRetake = () => {
    setMode('taking');
    setCurrentIndex(0);
    setAnswers({});
  };

  if (mode === 'result') {
    return (
      <div className="thinkflow-study-shell">
        <div className="thinkflow-study-head">
          <div>
            <span className="thinkflow-study-kicker">测验结果</span>
            <h4>这轮测验已经完成</h4>
          </div>
          <div className="thinkflow-study-score">
            <CheckCircle2 size={16} />
            <strong>
              {stats.correct}/{questions.length}
            </strong>
          </div>
        </div>

        <div className="thinkflow-quiz-summary-grid">
          <article className="thinkflow-quiz-summary-card">
            <span>答对</span>
            <strong>{stats.correct}</strong>
          </article>
          <article className="thinkflow-quiz-summary-card">
            <span>答错</span>
            <strong>{stats.wrong}</strong>
          </article>
          <article className="thinkflow-quiz-summary-card">
            <span>跳过</span>
            <strong>{stats.skipped}</strong>
          </article>
        </div>

        <div className="thinkflow-study-nav">
          <button type="button" className="thinkflow-doc-action-btn" onClick={handleRetake}>
            <RotateCcw size={14} />
            重新做一遍
          </button>
          <button type="button" className="thinkflow-generate-btn" onClick={() => setMode('review')}>
            查看逐题复盘
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'review') {
    return (
      <div className="thinkflow-study-shell">
        <div className="thinkflow-study-head">
          <div>
            <span className="thinkflow-study-kicker">逐题复盘</span>
            <h4>检查你的答案与每题解析</h4>
          </div>
          <button type="button" className="thinkflow-doc-action-btn" onClick={() => setMode('result')}>
            返回结果页
          </button>
        </div>

        <div className="thinkflow-quiz-review-list">
          {questions.map((question, index) => {
            const key = String(question.id || `question_${index}`);
            const userAnswer = answers[key] || null;
            return (
              <article key={key} className="thinkflow-study-card thinkflow-quiz-card">
                <div className="thinkflow-study-card-top">
                  <span className="thinkflow-study-card-kicker">第 {index + 1} 题</span>
                  <div className="thinkflow-study-card-tags">
                    {question.category ? <span className="thinkflow-study-card-chip">{question.category}</span> : null}
                    {question.difficulty ? <span className="thinkflow-study-card-chip">{question.difficulty}</span> : null}
                  </div>
                </div>
                <h4>{question.question || '未生成题目'}</h4>
                <div className="thinkflow-quiz-options">
                  {(question.options || []).map((option, optionIndex) => {
                    const label = option.label || String.fromCharCode(65 + optionIndex);
                    const isCorrect = label === question.correct_answer;
                    const isSelected = label === userAnswer;
                    return (
                      <div
                        key={`${key}_${label}`}
                        className={`thinkflow-quiz-option ${isCorrect ? 'is-correct' : ''} ${isSelected ? 'is-selected' : ''}`}
                      >
                        <strong>{label}</strong>
                        <span>{option.text || '未提供选项内容'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="thinkflow-study-card-answer">
                  <span>你的答案</span>
                  <p>{userAnswer || '本题已跳过'}</p>
                </div>
                {question.explanation ? (
                  <div className="thinkflow-study-card-answer">
                    <span>解析</span>
                    <p>{question.explanation}</p>
                  </div>
                ) : null}
                {question.source_excerpt ? (
                  <div className="thinkflow-study-card-quote">
                    <strong>依据</strong>
                    <p>{question.source_excerpt}</p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="thinkflow-study-shell">
      <div className="thinkflow-study-head">
        <div>
          <span className="thinkflow-study-kicker">互动测验</span>
          <h4>先作答，再查看结果与复盘</h4>
        </div>
        <div className="thinkflow-study-progress-meta">
          <strong>
            {currentIndex + 1}/{questions.length}
          </strong>
          <span>完成后给出结果页</span>
        </div>
      </div>

      <div className="thinkflow-study-progress">
        <div className="thinkflow-study-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <article className="thinkflow-study-card thinkflow-quiz-card">
        <div className="thinkflow-study-card-top">
          <span className="thinkflow-study-card-kicker">第 {currentIndex + 1} 题</span>
          <div className="thinkflow-study-card-tags">
            {currentQuestion.category ? <span className="thinkflow-study-card-chip">{currentQuestion.category}</span> : null}
            {currentQuestion.difficulty ? <span className="thinkflow-study-card-chip">{currentQuestion.difficulty}</span> : null}
          </div>
        </div>

        <h4>{currentQuestion.question || '未生成题目'}</h4>

        <div className="thinkflow-quiz-options">
          {(currentQuestion.options || []).map((option, optionIndex) => {
            const label = option.label || String.fromCharCode(65 + optionIndex);
            const isSelected = selectedAnswer === label;
            return (
              <button
                key={`${answerKey}_${label}`}
                type="button"
                className={`thinkflow-quiz-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() =>
                  setAnswers((previous) => ({
                    ...previous,
                    [answerKey]: label,
                  }))
                }
              >
                <strong>{label}</strong>
                <span>{option.text || '未提供选项内容'}</span>
              </button>
            );
          })}
        </div>
      </article>

      <div className="thinkflow-study-nav">
        <button type="button" className="thinkflow-doc-action-btn" onClick={handlePrevious} disabled={currentIndex === 0}>
          <ChevronLeft size={14} />
          上一题
        </button>
        <button
          type="button"
          className="thinkflow-doc-action-btn"
          onClick={() =>
            setAnswers((previous) => ({
              ...previous,
              [answerKey]: null,
            }))
          }
        >
          <SkipForward size={14} />
          跳过
        </button>
        <button type="button" className="thinkflow-generate-btn" onClick={handleNext} disabled={!hasActed && currentIndex < questions.length - 1}>
          {currentIndex === questions.length - 1 ? '完成测验' : '下一题'}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
