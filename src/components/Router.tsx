// src/components/Router.tsx
import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import LandingScreen from './LandingScreen';
import LoginScreen from './LoginScreen';
import RoleSelectionScreen from './RoleSelectionScreen';
import AssessmentScreen from './AssessmentScreen';
import ResultScreen from './ResultScreen';
import TryoutScreen from './TryoutScreen';
import NotFound from '../pages/NotFound';
import { Role } from '../types/assessment';

// Define the new interface here
interface AssessmentResult {
  score: number;
  strengths: string[];
}

const Router = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  // Use the new interface for useState
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    navigate("/assessment");
  };

  // Use the new interface for the function parameter
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
    <Routes>
      <Route path="/" element={<LandingScreen onLoginClick={() => navigate("/login")} />} />
      <Route path="/login" element={<LoginScreen onRoleSelectionClick={() => navigate("/role-selection")} />} />
      <Route path="/role-selection" element={<RoleSelectionScreen onRoleSelect={handleRoleSelect} />} />
      <Route path="/assessment" element={<AssessmentScreen role={selectedRole as Role} onFinish={handleFinishAssessment} />} />
      {/* Pass the result to ResultScreen */}
      <Route path="/result" element={<ResultScreen result={assessmentResult as AssessmentResult} onTryoutClick={handleTryoutClick} />} />
      <Route path="/tryout" element={<TryoutScreen onStartTask={handleStartTask} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default Router;