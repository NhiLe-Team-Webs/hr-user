import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Eye, Gem, Languages, Clock, Shield, FileCheck2, BarChart3, MapPin, Users, GraduationCap } from 'lucide-react';
import { Button } from './ui/button';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../hooks/useLanguage';

interface LandingScreenProps {
  onLoginClick: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onLoginClick }) => {
  const { t } = useLanguage();

  return (
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
            <span>{t('common.languageInfo')}</span>
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
          onClick={onLoginClick}
          className="apple-button text-lg px-8 py-7 group"
        >
          <span className="flex items-center">
            {t('landingScreen.ctaStart').replace('→', '').trim()}
            <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="rgba(255, 255, 255, 1)"
              className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-2"
            >
              <path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z" />
            </svg>
          </span>
        </Button>
      </div>

      <div className="py-16 md:py-24 text-center bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-slate-800 dark:text-slate-100">
            {t('landingScreen.howItWorksTitle')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto text-lg">
            {t('landingScreen.howItWorksSubtitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Step 1 - Blue Theme */}
            <div className="apple-card bg-white dark:bg-slate-800/50 p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-blue-600/10 dark:from-blue-400/10 dark:to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 text-blue-600 dark:text-blue-400 p-4 rounded-2xl inline-block mb-6 shadow-sm">
                  <FileCheck2 className="w-8 h-8" />
                </div>
                <div className="w-8 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full mx-auto mb-4"></div>
                <h3 className="font-bold text-xl mb-3 text-slate-800 dark:text-slate-100">
                  {t('landingScreen.howItWorks1Title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('landingScreen.howItWorks1Text')}
                </p>
              </div>
            </div>

            {/* Step 2 - Green Theme */}
            <div className="apple-card bg-white dark:bg-slate-800/50 p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 dark:from-emerald-400/10 dark:to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl inline-block mb-6 shadow-sm">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <div className="w-8 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full mx-auto mb-4"></div>
                <h3 className="font-bold text-xl mb-3 text-slate-800 dark:text-slate-100">
                  {t('landingScreen.howItWorks2Title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('landingScreen.howItWorks2Text')}
                </p>
              </div>
            </div>

            {/* Step 3 - Purple Theme */}
            <div className="apple-card bg-white dark:bg-slate-800/50 p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-slate-200/60 dark:border-slate-700/60 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/10 dark:from-purple-400/10 dark:to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 text-purple-600 dark:text-purple-400 p-4 rounded-2xl inline-block mb-6 shadow-sm">
                  <MapPin className="w-8 h-8" />
                </div>
                <div className="w-8 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full mx-auto mb-4"></div>
                <h3 className="font-bold text-xl mb-3 text-slate-800 dark:text-slate-100">
                  {t('landingScreen.howItWorks3Title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('landingScreen.howItWorks3Text')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="py-16 md:py-24 bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 rounded-3xl px-8 border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
    <div className="text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight bg-gradient-to-r from-slate-800 via-blue-700 to-purple-700 dark:from-slate-100 dark:via-blue-300 dark:to-purple-300 bg-clip-text text-transparent">
        {t('landingScreen.whyItMattersTitle')}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-12 max-w-3xl mx-auto text-lg">
        {t('landingScreen.whyItMattersSubtitle')}
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-center">
      {/* Left Stats Column */}
      <div className="space-y-8 text-center md:text-left">
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-blue-200/30 dark:border-blue-700/30 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-center md:justify-start mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">90%</h3>
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('landingScreen.stat1Subtitle')}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {t('landingScreen.stat1Text')}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-emerald-200/30 dark:border-emerald-700/30 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-center md:justify-start mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <FileCheck2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-300 bg-clip-text text-transparent">50%</h3>
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('landingScreen.stat2Subtitle')}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {t('landingScreen.stat2Text')}
          </p>
        </div>
      </div>

      {/* Center Card */}
      <div className="p-4">
        <div className="bg-white/90 dark:bg-slate-800/90 rounded-3xl p-6 shadow-2xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm hover:shadow-3xl transition-all duration-500 group">
          <div className="bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-indigo-900/40 dark:via-purple-900/40 dark:to-pink-900/40 rounded-2xl aspect-[4/5] flex items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="text-center relative z-10">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">A-Player Candidate</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="font-bold text-lg text-slate-800 dark:text-slate-200">Nguyễn Văn A</p>
            <div className="flex items-center justify-center mt-2">
              <div className="flex items-center bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Phù hợp 97%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Stats Column */}
      <div className="space-y-8 text-center md:text-left">
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-orange-200/30 dark:border-orange-700/30 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-center md:justify-start mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">88%</h3>
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('landingScreen.stat4Subtitle')}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {t('landingScreen.stat4Text')}
          </p>
        </div>
        <div className="p-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border border-purple-200/30 dark:border-purple-700/30 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-center md:justify-start mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">Top 5%</h3>
          </div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{t('landingScreen.stat3Subtitle')}</p>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {t('landingScreen.stat3Text')}
          </p>
        </div>
      </div>
    </div>
  </div>

      <div className="py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
          {t('landingScreen.exploreTitle')}
        </h2>
        <p className="text-muted-foreground mb-12 max-w-2xl mx-auto text-lg">
          {t('landingScreen.exploreSubtitle')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Volunteer Section - Green Background */}
          <div className="apple-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col border border-green-200/50 dark:border-green-700/50">
            <div className="bg-white/80 dark:bg-green-800/30 text-green-700 dark:text-green-300 p-3 rounded-xl inline-block mb-4 self-start shadow-sm">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-2xl mb-2 text-green-800 dark:text-green-100">{t('landingScreen.volunteerTitle')}</h3>
            <p className="text-green-700/80 dark:text-green-200/90 flex-grow">
              {t('landingScreen.volunteerText')}
            </p>
            <Button 
              variant="secondary" 
              className="mt-6 self-start bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700 shadow-md hover:shadow-lg transition-all duration-200"
              onClick={() => window.open('https://www.nlf.sg/', '_blank')}
            >
              {t('common.learnMore')}
            </Button>
          </div>

          {/* Vocational Section - Blue Background */}
          <div className="apple-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col border border-blue-200/50 dark:border-blue-700/50">
            <div className="bg-white/80 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 p-3 rounded-xl inline-block mb-4 self-start shadow-sm">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-2xl mb-2 text-blue-800 dark:text-blue-100">{t('landingScreen.vocationalTitle')}</h3>
            <p className="text-blue-700/80 dark:text-blue-200/90 flex-grow">
              {t('landingScreen.vocationalText')}
            </p>
            <Button 
              variant="secondary" 
              className="mt-6 self-start bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
              onClick={() => window.open('https://nlt.nhi.sg/', '_blank')}
            >
              {t('common.learnMore')}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LandingScreen;