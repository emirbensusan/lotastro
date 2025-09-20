import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CartLot {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  selectedRollIds: string[];
  selectedRollsData: { id: string; meters: number; position: number }[];
  entry_date: string;
  supplier_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  age_days?: number;
  lineType?: 'standard' | 'sample';
  selectedRollMeters?: string[];
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

const CART_STORAGE_KEY = 'po_cart_items';
const CART_OPEN_STORAGE_KEY = 'po_cart_open';

// Helper functions for localStorage
const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

const loadFromStorage = (key: string, defaultValue: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const POCartProvider: React.FC<POCartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartLot[]>(() => 
    loadFromStorage(CART_STORAGE_KEY, [])
  );
  const [isCartOpen, setIsCartOpen] = useState(() => 
    loadFromStorage(CART_OPEN_STORAGE_KEY, false)
  );

  // Save cart items to localStorage whenever they change
  useEffect(() => {
    saveToStorage(CART_STORAGE_KEY, cartItems);
  }, [cartItems]);

  // Save cart open state to localStorage whenever it changes
  useEffect(() => {
    saveToStorage(CART_OPEN_STORAGE_KEY, isCartOpen);
  }, [isCartOpen]);

  const addToCart = (lot: CartLot) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === lot.id);
      if (existingItem) {
        // Merge selected roll IDs and data if item already exists
        const newSelectedRollIds = [...new Set([...existingItem.selectedRollIds, ...lot.selectedRollIds])];
        const newSelectedRollsData = [
          ...existingItem.selectedRollsData,
          ...lot.selectedRollsData.filter(rollData => 
            !existingItem.selectedRollsData.some(existing => existing.id === rollData.id)
          )
        ];
        return prev.map(item =>
          item.id === lot.id
            ? { ...item, selectedRollIds: newSelectedRollIds, selectedRollsData: newSelectedRollsData }
            : item
        );
      }
      return [...prev, lot];
    });
  };

  const removeFromCart = (lotId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== lotId));
  };

  const updateQuantity = (lotId: string, quantity: number) => {
    // Limit selected rolls and their data to the specified quantity
    setCartItems(prev =>
      prev.map(item => {
        if (item.id === lotId) {
          const limitedRollIds = item.selectedRollIds.slice(0, Math.max(0, Math.min(quantity, item.selectedRollsData.length)));
          const limitedRollsData = item.selectedRollsData.slice(0, Math.max(0, Math.min(quantity, item.selectedRollsData.length)));
          return { ...item, selectedRollIds: limitedRollIds, selectedRollsData: limitedRollsData };
        }
        return item;
      }).filter(item => item.selectedRollIds.length > 0)
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setIsCartOpen(false);
    // Clear localStorage as well
    saveToStorage(CART_STORAGE_KEY, []);
    saveToStorage(CART_OPEN_STORAGE_KEY, false);
  };

  const getTotalMeters = () => {
    return cartItems.reduce((total, item) => {
      // Use actual roll meter data instead of estimates
      const selectedRollsMeters = item.selectedRollsData.reduce((rollTotal, rollData) => rollTotal + rollData.meters, 0);
      return total + selectedRollsMeters;
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