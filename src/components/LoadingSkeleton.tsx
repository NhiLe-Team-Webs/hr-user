// src/components/LoadingSkeleton.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSkeletonProps {
  type: 'login' | 'assessment' | 'result';
  loadingText?: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type, loadingText }) => {
  const renderLoginSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <motion.div
            className="w-full max-w-md mx-auto bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            {/* Title and subtitle skeleton */}
            <div className="text-center mb-8">
                <div className="w-64 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto mb-2 animate-pulse" />
                <div className="w-48 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto animate-pulse" />
            </div>

            {/* Login buttons skeleton */}
            <div className="space-y-4">
                <div className="w-full h-12 bg-gradient-to-r from-indigo-200 to-indigo-300 rounded-xl animate-pulse" />
                <div className="w-full h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl animate-pulse" />
            </div>
        </motion.div>
    </div>
);

  const renderAssessmentSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header skeleton - matches AssessmentScreen structure */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="w-64 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse" />
            </div>
            
            {/* Progress Bar skeleton */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "35%" }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center mt-2 text-sm">
              <div className="w-20 h-4 bg-gray-300 rounded animate-pulse" />
              <div className="w-12 h-4 bg-gray-300 rounded animate-pulse" />
            </div>
          </motion.div>

          {/* Question Card skeleton */}
          <motion.div
            className="bg-white rounded-3xl shadow-xl p-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="space-y-8">
              {/* Question text skeleton */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-center"
              >
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="w-full h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse" />
                  <div className="w-3/4 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto animate-pulse" />
                  <div className="w-1/2 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto animate-pulse" />
                </div>
              </motion.div>

              {/* Answer options skeleton */}
              <div className="space-y-4">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                    className="relative flex items-center p-6 border-2 border-gray-200 rounded-2xl min-h-[70px]"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="w-full h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                      <div className="w-2/3 h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                    </div>
                    <div className="w-6 h-6 bg-gray-300 rounded-full animate-pulse ml-4" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Fixed Navigation skeleton */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="sticky bottom-0 bg-white shadow-lg border-t"
      >
        <div className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200">
            <div className="w-5 h-5 bg-gray-300 rounded animate-pulse" />
            <div className="w-16 h-4 bg-gray-300 rounded animate-pulse" />
          </div>
          
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-200 to-purple-300 animate-pulse">
            <div className="w-12 h-4 bg-white/50 rounded" />
            <div className="w-5 h-5 bg-white/50 rounded" />
          </div>
        </div>
      </motion.div>

      {/* Enhanced loading text */}
      {loadingText && (
        <motion.div 
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
        </motion.div>
      )}
    </div>
  );

  const renderResultSkeleton = () => (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-4xl mx-auto bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-r from-green-200 to-green-300 rounded-full mx-auto mb-4 animate-pulse" />
          <div className="w-64 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto mb-2 animate-pulse" />
          <div className="w-48 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mx-auto animate-pulse" />
        </div>

        {/* Score circle skeleton */}
        <div className="flex justify-center mb-8">
          <div className="w-32 h-32 border-8 border-gray-300 rounded-full animate-pulse" />
        </div>

        {/* Content grid skeleton */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-6 animate-pulse">
            <div className="w-32 h-6 bg-white/50 rounded mb-4" />
            <div className="space-y-3">
              <div className="w-full h-4 bg-white/50 rounded" />
              <div className="w-5/6 h-4 bg-white/50 rounded" />
              <div className="w-4/6 h-4 bg-white/50 rounded" />
            </div>
          </div>
          <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-6 animate-pulse">
            <div className="w-32 h-6 bg-white/50 rounded mb-4" />
            <div className="space-y-3">
              <div className="w-full h-4 bg-white/50 rounded" />
              <div className="w-5/6 h-4 bg-white/50 rounded" />
              <div className="w-4/6 h-4 bg-white/50 rounded" />
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <div className="w-48 h-12 bg-gradient-to-r from-green-200 to-green-300 rounded-xl animate-pulse" />
          <div className="w-48 h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl animate-pulse" />
        </div>
      </motion.div>

      {/* Enhanced loading text with progress */}
      {loadingText && (
        <motion.div 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl px-8 py-6 shadow-xl max-w-md">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-6 h-6 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-700 font-semibold text-lg">{loadingText}</span>
            </div>
            {/* Animated progress bar */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-green-400 to-teal-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </div>
            <div className="text-center mt-2 text-sm text-gray-600">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                Hoàn thành trong giây lát...
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  switch (type) {
    case 'login':
      return renderLoginSkeleton();
    case 'assessment':
      return renderAssessmentSkeleton();
    case 'result':
      return renderResultSkeleton();
    default:
      return null;
  }
};

export default LoadingSkeleton;