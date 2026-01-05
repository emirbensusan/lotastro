import React, { createContext, useContext, useEffect, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS, Step } from 'react-joyride';
import { useProductTour, Tour } from '@/hooks/useProductTour';
import { useLanguage } from '@/contexts/LanguageContext';
import { warehouseTour } from './tours/warehouseTour';
import { accountingTour } from './tours/accountingTour';
import { managerTour } from './tours/managerTour';
import { adminTour } from './tours/adminTour';

interface TourContextType {
  startTour: (tourId: string) => void;
  skipTour: () => void;
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
  isTourCompleted: (tourId: string) => boolean;
  shouldShowTour: (tourId: string) => boolean;
  getRoleTourId: () => string;
  isActive: boolean;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

const tours: Record<string, Tour> = {
  'warehouse-tour': warehouseTour,
  'accounting-tour': accountingTour,
  'manager-tour': managerTour,
  'admin-tour': adminTour
};

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { language } = useLanguage();
  const {
    isActive,
    currentTourId,
    stepIndex,
    startTour,
    skipTour,
    completeTour,
    resetTour,
    resetAllTours,
    isTourCompleted,
    shouldShowTour,
    getRoleTourId
  } = useProductTour();

  // CRITICAL FIX: Kill switch to completely disable tours if they brick navigation
  const toursDisabled = typeof window !== 'undefined' && 
    localStorage.getItem('lotastro_disable_tours') === 'true';

  const currentTour = currentTourId ? tours[currentTourId] : null;

  // CRITICAL FIX: Auto-reset stuck tour state on mount
  React.useEffect(() => {
    if (isActive && (!currentTourId || !tours[currentTourId])) {
      console.warn('[TourProvider] Resetting stuck tour state: isActive=true but no valid tour');
      skipTour();
    }
  }, [isActive, currentTourId, skipTour]);

  const steps: Step[] = React.useMemo(() => {
    if (!currentTour) return [];
    
    return currentTour.steps.map(step => ({
      target: step.target,
      title: step.title,
      content: step.content,
      placement: step.placement || 'bottom',
      disableBeacon: step.disableBeacon ?? true,
      styles: {
        options: {
          zIndex: 10000,
        }
      }
    }));
  }, [currentTour]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action } = data;

    if (status === STATUS.FINISHED) {
      if (currentTourId) {
        completeTour(currentTourId);
      }
    } else if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      skipTour();
    }
  };

  const contextValue: TourContextType = {
    startTour,
    skipTour,
    resetTour,
    resetAllTours,
    isTourCompleted,
    shouldShowTour,
    getRoleTourId,
    isActive
  };

  // Custom styling for enterprise look
  const joyrideStyles = {
    options: {
      arrowColor: 'hsl(var(--popover))',
      backgroundColor: 'hsl(var(--popover))',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      primaryColor: 'hsl(var(--primary))',
      textColor: 'hsl(var(--popover-foreground))',
      zIndex: 10000,
    },
    tooltip: {
      borderRadius: '0.5rem',
      padding: '1rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    },
    tooltipContainer: {
      textAlign: 'left' as const,
    },
    tooltipTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
    },
    tooltipContent: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      padding: '0.5rem 0',
    },
    buttonNext: {
      backgroundColor: 'hsl(var(--primary))',
      borderRadius: '0.375rem',
      color: 'hsl(var(--primary-foreground))',
      fontSize: '0.875rem',
      padding: '0.5rem 1rem',
    },
    buttonBack: {
      color: 'hsl(var(--muted-foreground))',
      marginRight: '0.5rem',
    },
    buttonSkip: {
      color: 'hsl(var(--muted-foreground))',
    },
    spotlight: {
      borderRadius: '0.5rem',
    },
  };

  // CRITICAL FIX: Only render Joyride when:
  // 1. Tours are not disabled via kill switch
  // 2. Tour is actively running (isActive)
  // 3. We have a valid tour with steps
  const shouldRenderJoyride = !toursDisabled && isActive && currentTour && steps.length > 0;

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {shouldRenderJoyride && (
        <Joyride
          steps={steps}
          stepIndex={stepIndex}
          run={true}
          continuous
          showProgress
          showSkipButton
          hideCloseButton={false}
          scrollToFirstStep
          disableScrolling={false}
          callback={handleCallback}
          styles={joyrideStyles}
          locale={{
            back: language === 'tr' ? 'Geri' : 'Back',
            close: language === 'tr' ? 'Kapat' : 'Close',
            last: language === 'tr' ? 'Bitir' : 'Finish',
            next: language === 'tr' ? 'İleri' : 'Next',
            skip: language === 'tr' ? 'Atla' : 'Skip',
          }}
          floaterProps={{
            disableAnimation: true,
          }}
        />
      )}
    </TourContext.Provider>
  );
}
