import React, { useState, useEffect, useCallback } from 'react';
import { 
  Heart, Eye, Gem, Languages, Clock, Shield, FileCheck2, BarChart3, MapPin, 
  Users, GraduationCap, Mail, ArrowLeft, ArrowRight, CheckCircle, PencilRuler,
  HeartHandshake, ClipboardList, Lightbulb, FileText
} from 'lucide-react';
import { Button } from './ui/button';
import { assessmentData } from '../data/assessmentData';
import { Role, Screen, UserAnswers } from '../types/assessment';
import { AnimatePresence, motion } from 'framer-motion';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../hooks/useLanguage';

const HRAssessmentApp = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const { lang, setLang, t } = useLanguage();

  const goToScreen = (screen: Screen) => {
    setCurrentScreen(screen);
    window.scrollTo(0, 0);
  };

  const selectRole = (role: Role) => {
    setCurrentRole(role);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    startTimer(assessmentData[role].duration);
    goToScreen('assessment');
  };

  const startTimer = (duration: number) => {
    setTimer(duration);
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          finishAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerInterval(interval);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveAnswer = (questionIndex: number, optionIndex: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const navigateQuestion = (direction: number) => {
    if (!currentRole) return;
    const questions = assessmentData[currentRole].questions;
    const newIndex = currentQuestionIndex + direction;
    
    if (newIndex >= 0 && newIndex < questions.length) {
      setCurrentQuestionIndex(newIndex);
    }
  };

  const finishAssessment = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    goToScreen('result');
  };

  const calculateScore = () => {
    if (!currentRole) return 0;
    const questions = assessmentData[currentRole].questions;
    let correctAnswers = 0;
    
    for (let i = 0; i < questions.length; i++) {
      if (userAnswers[i] === questions[i].correct) {
        correctAnswers++;
      }
    }
    
    return (correctAnswers / questions.length) * 100;
  };

  const getRandomStrengths = () => {
    const strengths = [
      t('strengths.strength1'),
      t('strengths.strength2'),
      t('strengths.strength3'),
      t('strengths.strength4'),
      t('strengths.strength5'),
      t('strengths.strength6')
    ];
    return strengths.sort(() => 0.5 - Math.random()).slice(0, 3);
  };

  const renderQuestion = () => {
    if (!currentRole) return null;
    const questions = assessmentData[currentRole].questions;
    if (questions.length === 0) return <p>{t('assessmentScreen.noAssessment')}</p>;
    
    const question = questions[currentQuestionIndex];
    
    return (
      <motion.div 
        key={currentQuestionIndex} 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        >
        <p className="text-sm font-semibold text-primary mb-2">{question.title}</p>
        <p className="text-xl font-semibold text-foreground mb-6 tracking-tight">{question.text}</p>
        <div className="space-y-4">
          {question.options.map((option, index) => (
            <label
              key={index}
              className={`block p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                userAnswers[currentQuestionIndex] === index
                  ? 'bg-primary/10 border-primary ring-1 ring-primary'
                  : 'border-border hover:bg-primary/5 hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name={`question${currentQuestionIndex}`}
                value={index}
                checked={userAnswers[currentQuestionIndex] === index}
                onChange={() => saveAnswer(currentQuestionIndex, index)}
                className="mr-3 accent-primary"
              />
              <span className="text-foreground">{option}</span>
            </label>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderResult = () => {
    const score = calculateScore();
    const strengths = getRandomStrengths();
    const isAPlayer = score >= 80;
    
    return (
      <div>
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-4">{t('resultScreen.strengthsTitle')}</h3>
          <div className="flex justify-center flex-wrap gap-4">
            {strengths.map((strength, index) => (
              <div key={index} className="bg-green-100 text-green-800 font-medium px-4 py-2 rounded-full">
                {strength}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-border/80">
          <h3 className="font-semibold text-xl mb-2 tracking-tight">{t('resultScreen.nextStepsTitle')}</h3>
          {isAPlayer ? (
            <div>
              <p className="text-muted-foreground my-6 text-lg">
                {t('resultScreen.successText')}
              </p>
              <Button className="apple-button mt-4">
                {t('resultScreen.successCta')}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground my-6 text-lg">
                {t('resultScreen.tryoutText')}
              </p>
              <Button onClick={() => goToScreen('tryout')} className="apple-button mt-4">
                {t('resultScreen.tryoutCta')}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 font-inter text-foreground">
      <div className="min-h-screen w-full flex flex-col items-center p-4">
        
        {/* Header */}
        <header className="w-full max-w-6xl mx-auto my-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Heart className="h-7 w-7 text-neutral-900 dark:text-neutral-50" />
            <h1>{t('common.teamName')}</h1>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="w-full max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Landing Screen */}
            {currentScreen === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-center apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-16">
                  <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                    {t('landingScreen.welcomeTitle')}
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-3xl mx-auto text-lg">
                    {t('landingScreen.welcomeSubtitle')}
                  </p>
                  
                  <div className="my-10 py-8 border-y border-border/80">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-6 tracking-wider">
                      {t('landingScreen.coreValuesTitle')}
                    </h3>
                    <div className="flex justify-center items-center gap-8 md:gap-16">
                      <div className="flex flex-col items-center gap-3 cursor-pointer transition-transform duration-200 hover:scale-110">
                        <div className="bg-primary/10 text-primary p-4 rounded-2xl">
                          <Heart className="w-7 h-7" />
                        </div>
                        <span className="font-semibold text-lg">{t('common.coreValue1')}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 cursor-pointer transition-transform duration-200 hover:scale-110">
                        <div className="bg-primary/10 text-primary p-4 rounded-2xl">
                          <Eye className="w-7 h-7" />
                        </div>
                        <span className="font-semibold text-lg">{t('common.coreValue2')}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 cursor-pointer transition-transform duration-200 hover:scale-110">
                        <div className="bg-primary/10 text-primary p-4 rounded-2xl">
                          <Gem className="w-7 h-7" />
                        </div>
                        <span className="font-semibold text-lg">{t('common.coreValue3')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-4 mb-10 flex-wrap">
                    <div className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-sm">
                      <Languages className="w-4 h-4" />
                      <span>VN/EN</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{t('common.timeInfo')}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-sm">
                      <Shield className="w-4 h-4" />
                      <span>{t('common.privacyInfo')}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => goToScreen('login')} 
                    className="apple-button"
                  >
                    {t('landingScreen.ctaStart')}
                  </Button>
                </div>

                {/* Section: How it works */}
                <div className="py-16 md:py-24 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">{t('landingScreen.howItWorksTitle')}</h2>
                  <p className="text-muted-foreground mb-12 max-w-2xl mx-auto text-lg">
                    {t('landingScreen.howItWorksSubtitle')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                      <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 p-3 rounded-xl inline-block mb-4">
                        <FileCheck2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-xl mb-2">{t('landingScreen.howItWorks1Title')}</h3>
                      <p className="text-muted-foreground">
                        {t('landingScreen.howItWorks1Description')}
                      </p>
                    </div>
                    <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                      <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 p-3 rounded-xl inline-block mb-4">
                        <BarChart3 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-xl mb-2">{t('landingScreen.howItWorks2Title')}</h3>
                      <p className="text-muted-foreground">
                        {t('landingScreen.howItWorks2Text')}
                      </p>
                    </div>
                    <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                      <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 p-3 rounded-xl inline-block mb-4">
                        <MapPin className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-xl mb-2">{t('landingScreen.howItWorks3Title')}</h3>
                      <p className="text-muted-foreground">
                        {t('landingScreen.howItWorks3Text')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Why it matters */}
                <div className="py-16 md:py-24 bg-card rounded-3xl px-8">
                  <div className="text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                      {t('landingScreen.whyItMattersTitle')}
                    </h2>
                    <p className="text-muted-foreground mb-12 max-w-3xl mx-auto text-lg">
                      {t('landingScreen.whyItMattersSubtitle')}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-center">
                    <div className="space-y-8 text-center md:text-left">
                      <div>
                        <h3 className="text-4xl font-bold text-primary">90%</h3>
                        <p className="font-semibold">{t('landingScreen.stat1Subtitle')}</p>
                        <p className="text-muted-foreground">
                          {t('landingScreen.stat1Text')}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-4xl font-bold text-primary">50%</h3>
                        <p className="font-semibold">{t('landingScreen.stat2Subtitle')}</p>
                        <p className="text-muted-foreground">
                          {t('landingScreen.stat2Text')}
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="bg-muted rounded-3xl p-6 shadow-lg border border-border">
                        <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl aspect-[4/5] flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                              <span className="text-primary-foreground font-bold text-xl">A</span>
                            </div>
                            <p className="text-sm text-muted-foreground">A-Player Candidate</p>
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <p className="font-bold text-lg">Nguyễn Văn A</p>
                          <p className="text-sm text-muted-foreground">Phù hợp 97%</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-8 text-center md:text-left">
                      <div>
                        <h3 className="text-4xl font-bold text-primary">88%</h3>
                        <p className="font-semibold">{t('landingScreen.stat4Subtitle')}</p>
                        <p className="text-muted-foreground">
                          {t('landingScreen.stat4Text')}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-4xl font-bold text-primary">Top 5%</h3>
                        <p className="font-semibold">{t('landingScreen.stat3Subtitle')}</p>
                        <p className="text-muted-foreground">
                          {t('landingScreen.stat3Text')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Explore communities */}
                <div className="py-16 md:py-24 text-center">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                    {t('landingScreen.exploreTitle')}
                  </h2>
                  <p className="text-muted-foreground mb-12 max-w-2xl mx-auto text-lg">
                    {t('landingScreen.exploreSubtitle')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col">
                      <div className="bg-primary/10 text-primary p-3 rounded-xl inline-block mb-4 self-start">
                        <Users className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-2xl mb-2">{t('landingScreen.volunteerTitle')}</h3>
                      <p className="text-muted-foreground flex-grow">
                        {t('landingScreen.volunteerText')}
                      </p>
                      <Button variant="secondary" className="mt-6 self-start">
                        {t('common.learnMore')}
                      </Button>
                    </div>
                    <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col">
                      <div className="bg-primary/10 text-primary p-3 rounded-xl inline-block mb-4 self-start">
                        <GraduationCap className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-2xl mb-2">{t('landingScreen.vocationalTitle')}</h3>
                      <p className="text-muted-foreground flex-grow">
                        {t('landingScreen.vocationalText')}
                      </p>
                      <Button variant="secondary" className="mt-6 self-start">
                        {t('common.learnMore')}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Login Screen */}
            {currentScreen === 'login' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center apple-card p-8 md:p-12"
              >
                <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('loginScreen.title')}</h2>
                <p className="text-muted-foreground mb-8">{t('loginScreen.subtitle')}</p>
                <div className="space-y-4 max-w-sm mx-auto">
                  <Button 
                    onClick={() => goToScreen('role-selection')} 
                    variant="outline" 
                    className="w-full"
                  >
                    {t('loginScreen.googleCta')}
                  </Button>
                  <Button 
                    onClick={() => goToScreen('role-selection')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {t('loginScreen.emailCta')}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Role Selection Screen */}
            {currentScreen === 'role-selection' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12"
              >
                              <h2 className="text-3xl font-bold mb-3 text-center tracking-tight">{t('roleSelectionScreen.title')}</h2>
                <p className="text-muted-foreground mb-10 text-center">
                  {t('roleSelectionScreen.subtitle')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div 
                    onClick={() => selectRole('Content Creator')} 
                    className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
                  >
                    <PencilRuler className="w-10 h-10 text-primary mb-4 mx-auto" />
                    <h3 className="text-xl font-bold mb-2">{t('roles.Content Creator')}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t('roleSelectionScreen.role1Text')}
                    </p>
                  </div>
                  
                  <div 
                    onClick={() => selectRole('Customer Support')} 
                    className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
                  >
                    <HeartHandshake className="w-10 h-10 text-primary mb-4 mx-auto" />
                    <h3 className="text-xl font-bold mb-2">{t('roles.Customer Support')}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t('roleSelectionScreen.role2Text')}
                    </p>
                  </div>
                  
                  <div 
                    onClick={() => selectRole('Operations')} 
                    className="p-6 text-center bg-muted/50 rounded-2xl hover:ring-2 ring-primary cursor-pointer transition-all transform hover:-translate-y-1"
                  >
                    <ClipboardList className="w-10 h-10 text-primary mb-4 mx-auto" />
                    <h3 className="text-xl font-bold mb-2">{t('roles.Operations')}</h3>
                    <p className="text-muted-foreground text-sm">
                      {t('roleSelectionScreen.role3Text')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Assessment Screen */}
            {currentScreen === 'assessment' && currentRole && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {t('assessmentScreen.assessmentTitle')}: {currentRole}
                  </h2>
                  <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl shadow-sm">
                    <Clock className="text-red-500 w-5 h-5" />
                    <span className="font-mono font-semibold text-red-500 text-lg">
                      {formatTime(timer)}
                    </span>
                  </div>
                </div>
                
                <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
                  {/* Progress Bar */}
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-muted-foreground">{t('assessmentScreen.progressLabel')}</span>
                      <span className="text-sm font-medium text-primary">
                        {t('assessmentScreen.questionLabel')} {currentQuestionIndex + 1} / {assessmentData[currentRole].questions.length}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                        style={{ 
                          width: `${((currentQuestionIndex + 1) / assessmentData[currentRole].questions.length) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Question Area */}
                  <div className="mb-8">
                    {renderQuestion()}
                  </div>

                  {/* Navigation */}
                  <div className="mt-8 pt-6 border-t border-border/80 flex justify-between items-center">
                    <Button
                      onClick={() => navigateQuestion(-1)}
                      disabled={currentQuestionIndex === 0}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span>{t('assessmentScreen.previousBtn')}</span>
                    </Button>
                    
                    {currentQuestionIndex === assessmentData[currentRole].questions.length - 1 ? (
                      <Button
                        onClick={finishAssessment}
                        className="apple-button flex items-center gap-2 bg-green-500 hover:bg-green-600"
                      >
                        <span>{t('assessmentScreen.finishBtn')}</span>
                        <CheckCircle className="w-5 h-5" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => navigateQuestion(1)}
                        className="apple-button flex items-center gap-2"
                      >
                        <span>{t('assessmentScreen.nextBtn')}</span>
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result Screen */}
            {currentScreen === 'result' && (
              <div className="fade-in text-center apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12">
                              <h2 className="text-3xl font-bold mb-3 tracking-tight">Cảm ơn bạn đã hoàn thành!</h2>
                <p className="text-muted-foreground mb-8">Đây là bản tóm tắt nhanh về các điểm mạnh của bạn.</p>
                {renderResult()}
              </div>
            )}

            {/* Tryout Screen */}
            {currentScreen === 'tryout' && (
              <div className="fade-in apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('tryoutScreen.title')}</h2>
                  <p className="text-muted-foreground">
                    {t('tryoutScreen.subtitle')} <span className="font-semibold text-red-600">{t('tryoutScreen.deadline')}</span>.
                  </p>
                </div>
                
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row items-start gap-5 p-6 bg-muted/50 rounded-2xl">
                    <div className="bg-primary/10 text-primary p-3 rounded-xl">
                      <Lightbulb className="w-6 h-6" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-bold text-lg">{t('tryoutScreen.task1Title')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        {t('tryoutScreen.task1Text')}
                      </p>
                      <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full mt-3 inline-block">
                        {t('tryoutScreen.task1Estimate')}
                      </span>
                    </div>
                    <Button variant="secondary" className="w-full md:w-auto">
                      {t('tryoutScreen.startBtn')}
                    </Button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-start gap-5 p-6 bg-muted/50 rounded-2xl">
                    <div className="bg-primary/10 text-primary p-3 rounded-xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-bold text-lg">{t('tryoutScreen.task2Title')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">
                        {t('tryoutScreen.task2Text')}
                      </p>
                      <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full mt-3 inline-block">
                        {t('tryoutScreen.task2Estimate')}
                      </span>
                    </div>
                    <Button variant="secondary" className="w-full md:w-auto">
                      {t('tryoutScreen.startBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default HRAssessmentApp;