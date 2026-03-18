import React, { useState } from 'react';
import { Brain, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../config/api';
import { getApiSettings } from '../../services/apiSettingsService';

interface QuizGeneratorProps {
  selectedFiles: string[];
  notebookId: string;
  email: string;
  userId: string;
  onGenerated: (quizId: string, questions: any[]) => void;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({
  selectedFiles,
  notebookId,
  email,
  userId,
  onGenerated,
}) => {
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    const settings = getApiSettings(userId);
    if (!settings?.apiUrl || !settings?.apiKey) {
      setError('Please configure API URL and API Key in Settings first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/v1/kb/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_paths: selectedFiles,
          notebook_id: notebookId,
          email: email,
          user_id: userId,
          api_url: settings.apiUrl,
          api_key: settings.apiKey,
          model: 'deepseek-v3.2',
          question_count: questionCount,
          language: 'en',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.questions) {
        onGenerated(data.quiz_id, data.questions);
      } else {
        setError('Failed to generate quiz');
      }
    } catch (err: any) {
      console.error('Generate quiz error:', err);
      setError(err.message || 'Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-card-soft p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-ios-gray-900">Generate Quiz</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-ios-gray-700 mb-2">
          Selected Files: {selectedFiles.length}
        </label>
        <p className="text-xs text-ios-gray-500">
          Generate multiple-choice questions to test understanding
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-ios-gray-700 mb-2">
          Number of Questions
        </label>
        <input
          type="number"
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          min={5}
          max={20}
          className="portal-input"
        />
        <p className="text-xs text-ios-gray-500 mt-1">
          Recommended: 10-15 questions
        </p>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || selectedFiles.length === 0}
        className="portal-button-primary w-full py-2.5 px-4 disabled:bg-ios-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Quiz...
          </>
        ) : (
          <>
            <Brain className="w-4 h-4" />
            Generate Quiz
          </>
        )}
      </button>
    </div>
  );
};
