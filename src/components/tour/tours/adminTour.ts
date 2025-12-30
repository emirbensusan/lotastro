import { Tour } from '@/hooks/useProductTour';

export const adminTour: Tour = {
  id: 'admin-tour',
  steps: [
    {
      target: '[data-tour="dashboard"]',
      title: 'System Administration',
      content: 'As an administrator, you have full access to all features plus system configuration and user management capabilities.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="admin"]',
      title: 'Admin Settings',
      content: 'Configure system-wide settings including user management, permissions, email templates, API keys, and security policies.',
      placement: 'right'
    },
    {
      target: '[data-tour="forecast"]',
      title: 'Forecast Engine',
      content: 'Configure forecasting parameters, adjust algorithms, and manage per-quality overrides for accurate demand prediction.',
      placement: 'right'
    },
    {
      target: '[data-tour="approvals"]',
      title: 'Approval Workflow',
      content: 'Process approval requests and configure approval thresholds. Set up delegation rules for when you are unavailable.',
      placement: 'right'
    },
    {
      target: '[data-tour="reports"]',
      title: 'Reporting System',
      content: 'Build custom reports, manage scheduled deliveries, and configure report permissions for different user roles.',
      placement: 'right'
    },
    {
      target: '[data-tour="audit-logs"]',
      title: 'System Audit',
      content: 'Complete audit trail of all system activities. Configure retention policies and set up audit alerts.',
      placement: 'right'
    },
    {
      target: '[data-tour="catalog"]',
      title: 'Catalog Management',
      content: 'Full catalog administration including approval workflows, custom fields, and supplier management.',
      placement: 'right'
    },
    {
      target: '[data-tour="view-as-role"]',
      title: 'Role Testing',
      content: 'Impersonate different user roles to verify permissions and test the user experience. Changes made are logged.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="global-search"]',
      title: 'Global Search',
      content: 'Search across all system data. Press Ctrl+K for quick access.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="sync-status"]',
      title: 'Sync Monitoring',
      content: 'Monitor offline sync status across all users. Resolve conflicts and track sync health.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="notifications"]',
      title: 'System Notifications',
      content: 'Receive alerts for system events, security issues, and user activity requiring attention.',
      placement: 'bottom'
    },
    {
      target: '[data-tour="help"]',
      title: 'Administrator Resources',
      content: 'Access technical documentation, API guides, and this tour anytime. You are ready to manage the system!',
      placement: 'bottom'
    }
  ]
};
