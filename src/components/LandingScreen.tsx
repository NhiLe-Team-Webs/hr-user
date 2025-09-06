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
              {t('landingScreen.howItWorks1Text')}
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

      <div className="py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
          {t('landingScreen.exploreTitle')}
        </h2>
        <p className="text-muted-foreground mb-12 max-w-2xl mx-auto text-lg">
          {t('landingScreen.exploreSubtitle')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 text-left flex flex-col">
            <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 p-3 rounded-xl inline-block mb-4 self-start">
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
            <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 p-3 rounded-xl inline-block mb-4 self-start">
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
  );
};

export default LandingScreen;