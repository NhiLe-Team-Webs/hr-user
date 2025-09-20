import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface ErrorPageProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onRetry?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({
  title,
  description,
  ctaLabel,
  onRetry,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handlePrimaryAction = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {title ?? t('errorPage.title')}
        </h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          {description ?? t('errorPage.description')}
        </p>
        <Button onClick={handlePrimaryAction} className="w-full">
          {ctaLabel ?? t('errorPage.cta')}
        </Button>
        <p className="mt-6 text-sm text-gray-400">
          {t('errorPage.support')}
        </p>
      </div>
    </div>
  );
};

export default ErrorPage;
