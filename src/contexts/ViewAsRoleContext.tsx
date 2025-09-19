import React, { createContext, useContext, useState } from 'react';

type UserRole = 'warehouse_staff' | 'accounting' | 'senior_manager' | 'admin';

interface ViewAsRoleContextType {
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  isViewingAsOtherRole: boolean;
}

const ViewAsRoleContext = createContext<ViewAsRoleContextType | undefined>(undefined);

export const ViewAsRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);

  const value = {
    viewAsRole,
    setViewAsRole,
    isViewingAsOtherRole: viewAsRole !== null,
  };

  return (
    <ViewAsRoleContext.Provider value={value}>
      {children}
    </ViewAsRoleContext.Provider>
  );
};

export const useViewAsRole = () => {
  const context = useContext(ViewAsRoleContext);
  if (context === undefined) {
    throw new Error('useViewAsRole must be used within a ViewAsRoleProvider');
  }
  return context;
};