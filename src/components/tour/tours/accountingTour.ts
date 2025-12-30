import { Tour } from '@/hooks/useProductTour';

export const accountingTour: Tour = {
  id: 'accounting-tour',
  steps: [
    {
      target: '[data-tour="dashboard"]',
      title: 'Welcome to LotAstro',
      content: 'Your dashboard provides an overview of inventory status, pending orders, and key business metrics at a glance.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="catalog"]',
      title: 'Product Catalog',
      content: 'Browse and manage your product catalog. Each item includes quality specifications, color options, and supplier information.',
      placement: 'right'
    },
    {
      target: '[data-tour="orders"]',
      title: 'Order Management',
      content: 'Create and track customer orders. You can enter orders manually, use AI-assisted entry, or import from Excel files.',
      placement: 'right'
    },
    {
      target: '[data-tour="reservations"]',
      title: 'Reservations',
      content: 'Reserve specific lots for pending orders. Track reservation status and convert reservations to shipments when ready.',
      placement: 'right'
    },
    {
      target: '[data-tour="order-queue"]',
      title: 'Order Queue',
      content: 'Monitor order fulfillment progress. See which orders are pending, in progress, or ready for shipment.',
      placement: 'right'
    },
    {
      target: '[data-tour="suppliers"]',
      title: 'Suppliers',
      content: 'Manage supplier information including contact details, lead times, and order history for better procurement planning.',
      placement: 'right'
    },
    {
      target: '[data-tour="reports"]',
      title: 'Reports',
      content: 'Generate and schedule reports for inventory, orders, and business analytics. Export to Excel or PDF formats.',
      placement: 'right'
    },
    {
      target: '[data-tour="incoming-stock"]',
      title: 'Incoming Stock',
      content: 'Track expected deliveries and match them against purchase orders. Update inventory when goods arrive.',
      placement: 'right'
    },
    {
      target: '[data-tour="global-search"]',
      title: 'Quick Search',
      content: 'Find orders, products, or lots instantly. Use Ctrl+K for keyboard access.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="help"]',
      title: 'Getting Help',
      content: 'Access documentation and keyboard shortcuts anytime. You can restart this tour from the help menu.',
      placement: 'bottom'
    }
  ]
};
