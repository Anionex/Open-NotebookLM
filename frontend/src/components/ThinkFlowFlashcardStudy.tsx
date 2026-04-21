import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

type FlashcardItem = {
  id?: string;
  question?: string;
  answer?: string;
  type?: string;
  difficulty?: string | null;
  source_file?: string | null;
  source_excerpt?: string | null;
  tags?: string[];
};

type Props = {
  cards: FlashcardItem[];
};

export function ThinkFlowFlashcardStudy({ cards }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cardSetKey = useMemo(
    () =>
      JSON.stringify(
        cards.map((card, index) => ({
          id: card.id || `card_${index}`,
          question: card.question || '',
          answer: card.answer || '',
          type: card.type || '',
        })),
      ),
    [cards],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setFlipped(false);
  }, [cardSetKey]);

  const currentCard = useMemo(() => cards[currentIndex] || null, [cards, currentIndex]);
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  if (!currentCard) return null;

  const nextCard = () => {
    if (currentIndex >= cards.length - 1) return;
    setCurrentIndex((previous) => previous + 1);
    setFlipped(false);
  };

  const previousCard = () => {
    if (currentIndex <= 0) return;
    setCurrentIndex((previous) => previous - 1);
    setFlipped(false);
  };

  return (
    <div className="thinkflow-study-shell">
      <div className="thinkflow-study-head">
        <div>
          <span className="thinkflow-study-kicker">学习卡片</span>
          <h4>逐张翻卡学习当前知识点</h4>
        </div>
        <div className="thinkflow-study-progress-meta">
          <strong>
            {currentIndex + 1}/{cards.length}
          </strong>
          <span>点击卡片查看答案</span>
        </div>
      </div>

      <div className="thinkflow-study-progress">
        <div className="thinkflow-study-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <button
        type="button"
        className={`thinkflow-flashcard-stage ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped((previous) => !previous)}
      >
        <div className="thinkflow-flashcard-face is-front">
          <div className="thinkflow-flashcard-face-top">
            <span className="thinkflow-study-card-kicker">
              {currentCard.type === 'fill_blank' ? '填空卡' : currentCard.type === 'concept' ? '概念卡' : '问答卡'}
            </span>
            {currentCard.difficulty ? <span className="thinkflow-study-card-chip">{currentCard.difficulty}</span> : null}
          </div>
          <h3>{currentCard.question || '未生成问题'}</h3>
          <div className="thinkflow-flashcard-hint">
            <RotateCw size={15} />
            <span>点击翻到答案面</span>
          </div>
        </div>

        <div className="thinkflow-flashcard-face is-back">
          <div className="thinkflow-flashcard-face-top">
            <span className="thinkflow-study-card-kicker">答案面</span>
            {currentCard.source_file ? <span className="thinkflow-study-card-chip">{currentCard.source_file}</span> : null}
          </div>
          <div className="thinkflow-study-card-answer">
            <span>答案</span>
            <p>{currentCard.answer || '未生成答案'}</p>
          </div>
          {currentCard.source_excerpt ? (
            <div className="thinkflow-study-card-quote">
              <strong>依据</strong>
              <p>{currentCard.source_excerpt}</p>
            </div>
          ) : null}
          {currentCard.tags && currentCard.tags.length > 0 ? (
            <div className="thinkflow-study-card-tags">
              {currentCard.tags.map((tag) => (
                <span key={tag} className="thinkflow-study-card-chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      <div className="thinkflow-study-nav">
        <button type="button" className="thinkflow-doc-action-btn" onClick={previousCard} disabled={currentIndex === 0}>
          <ChevronLeft size={14} />
          上一张
        </button>
        <button type="button" className="thinkflow-generate-btn" onClick={nextCard} disabled={currentIndex >= cards.length - 1}>
          下一张
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
