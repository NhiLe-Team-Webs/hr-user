// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { getAssessment, getQuestionsByIds } from '../lib/api';
import { Role, UserAnswers, Question } from '../types/assessment';
import { useLanguage } from '../hooks/useLanguage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface AssessmentScreenProps {
  role: Role;
  onFinish: () => void;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const hasAnsweredCurrent = typeof userAnswers[currentQuestionIndex] !== 'undefined';
  const [tabViolations, setTabViolations] = useState(0);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch assessment data from API
  useEffect(() => {
  const fetchData = async () => {
    try {
      const assessmentData = await getAssessment(role.name);
      if (!assessmentData) {
        throw new Error('No assessment data returned');
      }
      setAssessment(assessmentData);
      setTimeLeft(assessmentData.duration);

      if (assessmentData.questions?.length > 0) {
        const formattedQuestions: Question[] = assessmentData.questions.map((q: any) => {
          const formattedQuestion: Question = {
            id: q.id,
            text: q.text,
            type: q.type,
            format: q.format,
            required: q.required,
          };

          if (q.format === 'multiple_choice' && q.options) {
            formattedQuestion.options = q.options.map((opt: any) => ({
              id: opt.id,
              text: opt.option_text,
            }));
            formattedQuestion.correctAnswer = q.options.find((opt: any) => opt.is_correct)?.id;
          }

          return formattedQuestion;
        });
        console.log('Formatted questions:', formattedQuestions); // Debug log
        setQuestions(formattedQuestions);
      } else {
        setQuestions([]);
        setError(t('assessmentScreen.noQuestions'));
      }
    } catch (err) {
      setError(t('assessmentScreen.errorFetching'));
      console.error('Error fetching assessment data:', err);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [role, t]);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0 && timeLeft !== 0) {
      onFinish();
      return;
    }
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, onFinish]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations(prev => prev + 1);
        setIsAlertOpen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [role]);

  useEffect(() => {
    if (tabViolations >= 3) {
      onFinish();
    }
  }, [tabViolations, onFinish]);

  const finishAssessment = () => {
    onFinish();
  };

  const handleOptionSelect = (optionIndex: number) => {
    saveAnswer(currentQuestionIndex, optionIndex);
  };

  const saveAnswer = (questionIndex: number, answer: string | number) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const navigateQuestion = (direction: number) => {
    const newIndex = currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < questions.length) {
      setCurrentQuestionIndex(newIndex);
    }
  };
  
  const renderQuestion = () => {
    if (!questions || questions.length === 0) return <p>{t('assessmentScreen.noAssessment')}</p>;
    const question = questions[currentQuestionIndex];

    return (
      <div className="space-y-8">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold mb-8 text-gray-800 leading-relaxed">
            {question.text}
          </h3>
        </motion.div>
        
        <div className="space-y-4">
          {question.format === 'multiple_choice' ? (
            question.options?.map((option, index) => (
              <motion.div
                key={option.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div
                  className={`relative flex items-center p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 font-medium text-lg min-h-[70px]
                  ${userAnswers[currentQuestionIndex] === index
                      ? 'bg-blue-100 border-blue-500 text-blue-800 shadow-lg shadow-blue-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => handleOptionSelect(index)}
                >
                  <span className="flex-1 text-left text-sm">{option.text}</span>
                </div>
              </motion.div>
            ))
          ) : (
            <Textarea
              placeholder={t('assessmentScreen.typeYourAnswer')}
              value={userAnswers[currentQuestionIndex] || ''}
              onChange={(e) => saveAnswer(currentQuestionIndex, e.target.value)}
              className="min-h-[150px] p-4 border-2 rounded-2xl focus:border-blue-500 focus:ring-blue-500 transition-all duration-300"
            />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center p-8">Đang tải bài đánh giá...</div>;
  }
  
  if (!assessment) {
    return <div className="text-center p-8 text-red-500">Không có bài đánh giá nào cho vai trò này.</div>;
  }

  return (
    <motion.div
      key="assessment"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex flex-col"
    >
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                {t('assessmentScreen.assessmentTitle')}: {role.name}
              </h2>
              {/* Timer Display */}
              <motion.div
                className="flex items-center gap-2 text-lg font-semibold text-gray-800"
                animate={{
                  scale: timeLeft <= 300 ? [1, 1.1, 1] : 1,
                  color: timeLeft <= 300 ? '#EA3323' : '#374151',
                }}
                transition={{
                  repeat: timeLeft <= 300 ? Infinity : 0,
                  duration: 0.8,
                }}
              >
                <Clock className="w-5 h-5" />
                <span>{formatTime(timeLeft)}</span>
              </motion.div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>Câu {currentQuestionIndex + 1}/{questions.length}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%</span>
            </div>
          </motion.div>

          {/* Question Card */}
          <motion.div
            className="bg-white rounded-3xl shadow-xl p-8"
          >
            {renderQuestion()}
          </motion.div>
        </div>
      </div>

      {/* Fixed Navigation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky bottom-0 bg-white shadow-lg border-t"
      >
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Button
            onClick={() => navigateQuestion(-1)}
            disabled={currentQuestionIndex === 0}
            variant="outline"
            className="flex items-center gap-2 px-6 py-3 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('assessmentScreen.previousBtn')}</span>
          </Button>
          
          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={finishAssessment}
              disabled={!hasAnsweredCurrent}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                hasAnsweredCurrent 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                  : 'bg-gray-300'
              }`}
            >
              <span>{t('assessmentScreen.finishBtn')}</span>
              <CheckCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => navigateQuestion(1)}
              disabled={!hasAnsweredCurrent}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors ${
                hasAnsweredCurrent 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' 
                  : 'bg-gray-300'
              }`}
            >
              <span>{t('assessmentScreen.nextBtn')}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      </motion.div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#EA3323">
                <path d="m40-120 440-760 440 760H40Zm115.33-66.67h649.34L480-746.67l-324.67 560ZM482.78-238q14.22 0 23.72-9.62 9.5-9.61 9.5-23.83 0-14.22-9.62-23.72-9.5-14.22 0-23.72 9.62-9.62 9.5 23.83 0 14.22 9.62 23.72 9.62 9.5 23.83 9.5Zm-33.45-114H516v-216h-66.67v216ZM480-466.67Z"/>
              </svg>
              <AlertDialogTitle>Cảnh báo Gian lận!</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Bạn đã chuyển tab trong khi làm bài. Bài kiểm tra của bạn sẽ bị hủy nếu bạn vi phạm thêm {3 - tabViolations} lần nữa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsAlertOpen(false)}>Quay lại bài làm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AssessmentScreen;