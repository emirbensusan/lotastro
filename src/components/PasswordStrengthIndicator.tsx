import React from 'react';
import { Check, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const checkPasswordRequirements = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
};

export const isPasswordValid = (password: string): boolean => {
  const reqs = checkPasswordRequirements(password);
  return reqs.minLength && reqs.hasUppercase && reqs.hasLowercase && reqs.hasNumber && reqs.hasSpecial;
};

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const { t } = useLanguage();
  
  const requirements = checkPasswordRequirements(password);
  const metCount = Object.values(requirements).filter(Boolean).length;
  
  const getStrengthPercentage = () => (metCount / 5) * 100;
  
  const getStrengthLabel = () => {
    if (metCount <= 2) return t('passwordStrengthWeak');
    if (metCount <= 4) return t('passwordStrengthMedium');
    return t('passwordStrengthStrong');
  };
  
  const getStrengthColor = () => {
    if (metCount <= 2) return 'bg-destructive';
    if (metCount <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const requirementsList = [
    { key: 'minLength', label: t('passwordReqMinLength'), met: requirements.minLength },
    { key: 'hasUppercase', label: t('passwordReqUppercase'), met: requirements.hasUppercase },
    { key: 'hasLowercase', label: t('passwordReqLowercase'), met: requirements.hasLowercase },
    { key: 'hasNumber', label: t('passwordReqNumber'), met: requirements.hasNumber },
    { key: 'hasSpecial', label: t('passwordReqSpecial'), met: requirements.hasSpecial },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('passwordStrength')}:</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${getStrengthPercentage()}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          metCount <= 2 ? 'text-destructive' : metCount <= 4 ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {getStrengthLabel()}
        </span>
      </div>
      
      <ul className="space-y-1">
        {requirementsList.map((req) => (
          <li key={req.key} className="flex items-center gap-2 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={req.met ? 'text-green-600' : 'text-muted-foreground'}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
