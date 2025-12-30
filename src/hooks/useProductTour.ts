import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  disableBeacon?: boolean;
}

export interface Tour {
  id: string;
  steps: TourStep[];
}

interface TourState {
  isActive: boolean;
  currentTourId: string | null;
  stepIndex: number;
  completedTours: string[];
}

const TOUR_STORAGE_KEY = 'lotastro_tour_progress';

export function useProductTour() {
  const { user } = useAuth();
  const { effectiveRole } = usePermissions();
  
  const [state, setState] = useState<TourState>(() => {
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          isActive: false,
          currentTourId: null,
          stepIndex: 0,
          completedTours: []
        };
      }
    }
    return {
      isActive: false,
      currentTourId: null,
      stepIndex: 0,
      completedTours: []
    };
  });

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const startTour = useCallback((tourId: string) => {
    setState(prev => ({
      ...prev,
      isActive: true,
      currentTourId: tourId,
      stepIndex: 0
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      stepIndex: prev.stepIndex + 1
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      stepIndex: Math.max(0, prev.stepIndex - 1)
    }));
  }, []);

  const skipTour = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      currentTourId: null,
      stepIndex: 0
    }));
  }, []);

  const completeTour = useCallback((tourId: string) => {
    setState(prev => ({
      ...prev,
      isActive: false,
      currentTourId: null,
      stepIndex: 0,
      completedTours: prev.completedTours.includes(tourId) 
        ? prev.completedTours 
        : [...prev.completedTours, tourId]
    }));
  }, []);

  const resetTour = useCallback((tourId: string) => {
    setState(prev => ({
      ...prev,
      completedTours: prev.completedTours.filter(id => id !== tourId)
    }));
  }, []);

  const resetAllTours = useCallback(() => {
    setState({
      isActive: false,
      currentTourId: null,
      stepIndex: 0,
      completedTours: []
    });
  }, []);

  const isTourCompleted = useCallback((tourId: string) => {
    return state.completedTours.includes(tourId);
  }, [state.completedTours]);

  const shouldShowTour = useCallback((tourId: string) => {
    return user && !state.completedTours.includes(tourId);
  }, [user, state.completedTours]);

  // Get the appropriate tour ID for current role
  const getRoleTourId = useCallback(() => {
    switch (effectiveRole) {
      case 'admin':
        return 'admin-tour';
      case 'senior_manager':
        return 'manager-tour';
      case 'accounting':
        return 'accounting-tour';
      case 'warehouse_staff':
      default:
        return 'warehouse-tour';
    }
  }, [effectiveRole]);

  return {
    isActive: state.isActive,
    currentTourId: state.currentTourId,
    stepIndex: state.stepIndex,
    completedTours: state.completedTours,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
    resetAllTours,
    isTourCompleted,
    shouldShowTour,
    getRoleTourId
  };
}
