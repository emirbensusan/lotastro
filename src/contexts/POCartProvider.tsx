import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartLot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  selectedRollIds: string[];
  entry_date: string;
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  age_days?: number;
}

interface POCartContextType {
  cartItems: CartLot[];
  addToCart: (lot: CartLot) => void;
  removeFromCart: (lotId: string) => void;
  updateQuantity: (lotId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  getTotalMeters: () => number;
  getTotalRolls: () => number;
  getItemCount: () => number;
}

const POCartContext = createContext<POCartContextType | undefined>(undefined);

export const usePOCart = () => {
  const context = useContext(POCartContext);
  if (!context) {
    throw new Error('usePOCart must be used within a POCartProvider');
  }
  return context;
};

interface POCartProviderProps {
  children: ReactNode;
}

export const POCartProvider: React.FC<POCartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartLot[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (lot: CartLot) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === lot.id);
      if (existingItem) {
        // Merge selected roll IDs if item already exists
        const newSelectedRollIds = [...new Set([...existingItem.selectedRollIds, ...lot.selectedRollIds])];
        return prev.map(item =>
          item.id === lot.id
            ? { ...item, selectedRollIds: newSelectedRollIds }
            : item
        );
      }
      return [...prev, lot];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (lotId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== lotId));
  };

  const updateQuantity = (lotId: string, quantity: number) => {
    // For backward compatibility, this method now limits selected roll IDs
    setCartItems(prev =>
      prev.map(item =>
        item.id === lotId
          ? { ...item, selectedRollIds: item.selectedRollIds.slice(0, Math.max(0, Math.min(quantity, item.roll_count))) }
          : item
      ).filter(item => item.selectedRollIds.length > 0)
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setIsCartOpen(false);
  };

  const getTotalMeters = () => {
    return cartItems.reduce((total, item) => {
      // For now, estimate meters based on selected roll count
      const metersPerRoll = item.meters / item.roll_count;
      return total + (metersPerRoll * item.selectedRollIds.length);
    }, 0);
  };

  const getTotalRolls = () => {
    return cartItems.reduce((total, item) => total + item.selectedRollIds.length, 0);
  };

  const getItemCount = () => {
    return cartItems.length;
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity, 
    clearCart,
    isCartOpen,
    setIsCartOpen,
    getTotalMeters,
    getTotalRolls,
    getItemCount,
  };

  return (
    <POCartContext.Provider value={value}>
      {children}
    </POCartContext.Provider>
  );
};