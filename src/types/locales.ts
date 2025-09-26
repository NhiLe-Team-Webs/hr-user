// src/types/locales.ts

type TranslationKey = {
  common: {
    teamName: string;
    coreValue1: string;
    coreValue2: string;
    coreValue3: string;
    learnMore: string;
    languageInfo: string;
    timeInfo: string;
    privacyInfo: string;
  };
  landingScreen: {
    welcomeTitle: string;
    welcomeSubtitle: string;
    coreValuesTitle: string;
    ctaStart: string;
    howItWorksTitle: string;
    howItWorksSubtitle: string;
    howItWorks1Title: string;
    howItWorks1Text: string;
    howItWorks2Title: string;
    howItWorks2Text: string;
    howItWorks3Title: string;
    howItWorks3Text: string;
    whyItMattersTitle: string;
    whyItMattersSubtitle: string;
    stat1Title: string;
    stat1Subtitle: string;
    stat1Text: string;
    stat2Title: string;
    stat2Subtitle: string;
    stat2Text: string;
    stat3Title: string;
    stat3Subtitle: string;
    stat3Text: string;
    exploreTitle: string;
    exploreSubtitle: string;
    volunteerTitle: string;
    volunteerText: string;
    vocationalTitle: string;
    vocationalText: string;
  };
  loginScreen: {
    title: string;
    subtitle: string;
    googleCta: string;
    emailCta: string;
  };
  roleSelectionScreen: {
    title: string;
    subtitle: string;
    role1Title: string;
    role1Text: string;
    role2Title: string;
    role2Text: string;
    role3Title: string;
    role3Text: string;
  };
  assessmentScreen: {
    assessmentTitle: string;
    progressLabel: string;
    questionLabel: string;
    previousBtn: string;
    nextBtn: string;
    finishBtn: string;
    noAssessment: string;
    typeYourAnswer: string;
    selectYourAnswer: string;
    errorLoading: string;
    loading: string;
    noOptions: string;
  };
  resultScreen: {
    title: string;
    subtitle: string;
    strengthsTitle: string;
    weaknessesTitle: string;
    summaryTitle: string;
    nextStepsTitle: string;
    sentToHrNotice: string;
    overallScore: string;
    completedCount: string;
    cheatingCount: string;
    cheatingDetected: string;
    cheatingClear: string;
    skillScoresTitle: string;
    emptyStrengths: string;
    emptyWeaknesses: string;
    emptySummary: string;
    scheduleCta: string;
    adjustedScoreNote: string;
    missingTitle: string;
    missingDescription: string;
    backToSelection: string;
    errorLoading: string;
  };
  tryoutScreen: {
    title: string;
    subtitle: string;
    deadline: string;
    task1Title: string;
    task1Text: string;
    task1Estimate: string;
    task2Title: string;
    task2Text: string;
    task2Estimate: string;
    startBtn: string;
  };
  roles: {
    'Content Creator': string;
    'Customer Support': string;
    Operations: string;
  };
  strengths: {
    strength1: string;
    strength2: string;
    strength3: string;
    strength4: string;
    strength5: string;
    strength6: string;
  };
};

export default TranslationKey;