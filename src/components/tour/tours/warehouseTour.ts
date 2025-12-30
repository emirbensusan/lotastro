import { Tour } from '@/hooks/useProductTour';

export const warehouseTour: Tour = {
  id: 'warehouse-tour',
  steps: [
    {
      target: '[data-tour="dashboard"]',
      title: 'Welcome to LotAstro',
      content: 'This is your dashboard showing inventory overview and quick actions. You can see key metrics and navigate to common tasks from here.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="lot-intake"]',
      title: 'Lot Intake',
      content: 'Register new fabric lots as they arrive. You can scan QR codes or enter details manually. Each lot gets a unique identifier for tracking.',
      placement: 'right'
    },
    {
      target: '[data-tour="inventory"]',
      title: 'Inventory Overview',
      content: 'View all inventory grouped by quality and color. Click any cell to see lot details, available meters, and location information.',
      placement: 'right'
    },
    {
      target: '[data-tour="qr-scan"]',
      title: 'QR Scanner',
      content: 'Quickly look up lot information by scanning QR codes. Point your camera at any lot label to view its details instantly.',
      placement: 'right'
    },
    {
      target: '[data-tour="stock-take"]',
      title: 'Stock Take',
      content: 'Perform physical inventory counts. Upload photos of lot labels for automatic OCR processing, or enter counts manually.',
      placement: 'right'
    },
    {
      target: '[data-tour="global-search"]',
      title: 'Quick Search',
      content: 'Search across lots, orders, and catalog items. Press Ctrl+K (or Cmd+K on Mac) for a quick keyboard shortcut.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="sync-status"]',
      title: 'Offline Sync',
      content: 'When working offline, your changes are queued here. They sync automatically when you reconnect to the network.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="help"]',
      title: 'Need Help?',
      content: 'Access help documentation, keyboard shortcuts, and restart this tour anytime from the help menu. You are all set!',
      placement: 'bottom'
    }
  ]
};
