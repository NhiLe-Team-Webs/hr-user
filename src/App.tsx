// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from 'framer-motion';
import HRAssessmentApp from './components/HRAssessmentApp';
import LandingScreen from './components/LandingScreen';
import LoginScreen from './components/LoginScreen';
import RoleSelectionScreen from './components/RoleSelectionScreen';
import AssessmentScreen from './components/AssessmentScreen';
import ResultScreen from './components/ResultScreen';
import TryoutScreen from './components/TryoutScreen';
import NotFound from './pages/NotFound';
import { Role } from './types/assessment';
import React, { useState } from 'react';

const queryClient = new QueryClient();

interface AssessmentResult {
  score: number;
  strengths: string[];
}

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    navigate("/assessment");
  };

  const handleFinishAssessment = (result: AssessmentResult) => {
    setAssessmentResult(result);
    navigate("/result");
  };

  const handleTryoutClick = () => {
    navigate("/tryout");
  };

  const handleStartTask = () => {
    console.log("Starting a tryout task...");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HRAssessmentApp>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<LandingScreen onLoginClick={() => navigate("/login")} />} />
              <Route path="/login" element={<LoginScreen onRoleSelectionClick={() => navigate("/role-selection")} />} />
              <Route path="/role-selection" element={<RoleSelectionScreen onRoleSelect={handleRoleSelect} />} />
              <Route path="/assessment" element={<AssessmentScreen role={selectedRole as Role} onFinish={handleFinishAssessment} />} />
              <Route path="/result" element={<ResultScreen result={assessmentResult as AssessmentResult} onTryoutClick={handleTryoutClick} />} />
              <Route path="/tryout" element={<TryoutScreen onStartTask={handleStartTask} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </HRAssessmentApp>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;