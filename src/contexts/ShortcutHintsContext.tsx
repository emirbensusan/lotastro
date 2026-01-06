import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ShortcutHintsContextValue {
  pendingKey: string | null;
  setPendingKey: (key: string | null) => void;
}

const ShortcutHintsContext = createContext<ShortcutHintsContextValue | undefined>(undefined);

export const ShortcutHintsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pendingKey, setPendingKeyState] = useState<string | null>(null);

  const setPendingKey = useCallback((key: string | null) => {
    setPendingKeyState(key);
  }, []);

  return (
    <ShortcutHintsContext.Provider value={{ pendingKey, setPendingKey }}>
      {children}
    </ShortcutHintsContext.Provider>
  );
};

export const useShortcutHints = (): ShortcutHintsContextValue => {
  const context = useContext(ShortcutHintsContext);
  if (!context) {
    throw new Error('useShortcutHints must be used within a ShortcutHintsProvider');
  }
  return context;
};
