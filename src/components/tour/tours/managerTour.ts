import { Tour } from '@/hooks/useProductTour';

export const managerTour: Tour = {
  id: 'manager-tour',
  steps: [
    {
      target: '[data-tour="dashboard"]',
      title: 'Management Dashboard',
      content: 'Your executive dashboard shows key performance indicators, inventory health, and items requiring your attention.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="forecast"]',
      title: 'Demand Forecasting',
      content: 'View demand projections based on historical data. Identify potential stockouts and overstock situations before they occur.',
      placement: 'right'
    },
    {
      target: '[data-tour="approvals"]',
      title: 'Approval Queue',
      content: 'Review and approve pending requests from your team. Catalog changes, significant orders, and other items requiring authorization appear here.',
      placement: 'right'
    },
    {
      target: '[data-tour="reports"]',
      title: 'Report Builder',
      content: 'Create custom reports with your choice of data sources, filters, and visualizations. Schedule automated delivery to your inbox.',
      placement: 'right'
    },
    {
      target: '[data-tour="audit-logs"]',
      title: 'Audit Trail',
      content: 'Review all system activity with complete audit logs. Track changes, user actions, and maintain compliance records.',
      placement: 'right'
    },
    {
      target: '[data-tour="view-as-role"]',
      title: 'View as Role',
      content: 'Test the system from different user perspectives. Useful for training and troubleshooting access issues.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="notifications"]',
      title: 'Notifications',
      content: 'Stay informed of important events, pending approvals, and system alerts. Configure notification preferences in settings.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="help"]',
      title: 'Support Resources',
      content: 'Access documentation, keyboard shortcuts, and this tour anytime from the help menu.',
      placement: 'bottom'
    }
  ]
};
