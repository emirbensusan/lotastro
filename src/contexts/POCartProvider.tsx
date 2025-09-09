import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartLot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  selectedRolls: number;
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
        // Update quantity if item already exists
        return prev.map(item =>
          item.id === lot.id
            ? { ...item, selectedRolls: Math.min(item.selectedRolls + lot.selectedRolls, item.roll_count) }
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
    setCartItems(prev =>
      prev.map(item =>
        item.id === lotId
          ? { ...item, selectedRolls: Math.max(0, Math.min(quantity, item.roll_count)) }
          : item
      ).filter(item => item.selectedRolls > 0)
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setIsCartOpen(false);
  };

  const getTotalMeters = () => {
    return cartItems.reduce((total, item) => {
      const metersPerRoll = item.meters / item.roll_count;
      return total + (metersPerRoll * item.selectedRolls);
    }, 0);
  };

  const getTotalRolls = () => {
    return cartItems.reduce((total, item) => total + item.selectedRolls, 0);
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