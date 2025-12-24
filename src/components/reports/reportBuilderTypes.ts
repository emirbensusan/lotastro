// Shared types and constants for the Report Builder

import { CalculatedField } from './CalculatedFieldBuilder';
import { FilterGroup } from './FilterBuilder';
import { ReportStyling, DEFAULT_REPORT_STYLING as BASE_DEFAULT_STYLING } from './StyleBuilder';

export interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

export interface SelectedColumn extends ColumnDefinition {
  displayLabel?: string;
  width?: number;
  sortOrder?: 'asc' | 'desc' | null;
  sortPriority?: number;
}

export interface DataSource {
  key: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columnCount: number;
  hasJoins: boolean;
}

export interface JoinDefinition {
  table: string;
  labelEn: string;
  labelTr: string;
  joinColumn: string;
  foreignColumn: string;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

export interface ScheduleConfig {
  enabled: boolean;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  hour: number;
  minute: number;
  timezone: string;
  day_of_week?: number;
  day_of_month?: number;
  recipients: {
    roles: string[];
    emails: string[];
  };
}

export interface ReportConfig {
  id?: string;
  name: string;
  data_source: string;
  selected_joins: string[];
  columns_config: SelectedColumn[];
  calculated_fields?: CalculatedField[];
  sorting: SortConfig[];
  filters: FilterGroup[];
  styling?: ReportStyling;
  output_formats: string[];
  include_charts: boolean;
  schedule_id?: string | null;
  schedule_config?: ScheduleConfig;
}

export interface OutputFormat {
  key: string;
  labelEn: string;
  labelTr: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface TimezoneOption {
  value: string;
  label: string;
}

export interface DayOfWeek {
  value: number;
  labelEn: string;
  labelTr: string;
}

export interface RoleOption {
  value: string;
  labelEn: string;
  labelTr: string;
}

// Constants
import { Mail, FileSpreadsheet } from 'lucide-react';

export const OUTPUT_FORMATS: OutputFormat[] = [
  { key: 'html', labelEn: 'HTML Email', labelTr: 'HTML E-posta', icon: Mail },
  { key: 'excel', labelEn: 'Excel File', labelTr: 'Excel Dosyası', icon: FileSpreadsheet },
  { key: 'csv', labelEn: 'CSV File', labelTr: 'CSV Dosyası', icon: FileSpreadsheet },
];

export const TIMEZONES: TimezoneOption[] = [
  { value: 'Europe/Istanbul', label: 'Istanbul (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1/+2)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

export const DAYS_OF_WEEK: DayOfWeek[] = [
  { value: 0, labelEn: 'Sunday', labelTr: 'Pazar' },
  { value: 1, labelEn: 'Monday', labelTr: 'Pazartesi' },
  { value: 2, labelEn: 'Tuesday', labelTr: 'Salı' },
  { value: 3, labelEn: 'Wednesday', labelTr: 'Çarşamba' },
  { value: 4, labelEn: 'Thursday', labelTr: 'Perşembe' },
  { value: 5, labelEn: 'Friday', labelTr: 'Cuma' },
  { value: 6, labelEn: 'Saturday', labelTr: 'Cumartesi' },
];

export const ROLES: RoleOption[] = [
  { value: 'admin', labelEn: 'Admin', labelTr: 'Yönetici' },
  { value: 'senior_manager', labelEn: 'Senior Manager', labelTr: 'Üst Düzey Yönetici' },
  { value: 'accounting', labelEn: 'Accounting', labelTr: 'Muhasebe' },
  { value: 'warehouse_staff', labelEn: 'Warehouse Staff', labelTr: 'Depo Personeli' },
];

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  enabled: false,
  schedule_type: 'weekly',
  hour: 8,
  minute: 0,
  timezone: 'Europe/Istanbul',
  day_of_week: 1,
  day_of_month: 1,
  recipients: {
    roles: ['admin'],
    emails: [],
  },
};

export const DEFAULT_REPORT_STYLING = BASE_DEFAULT_STYLING;

// Helper functions
export const getColumnLabel = (col: ColumnDefinition, language: string): string => {
  return language === 'tr' ? col.labelTr : col.labelEn;
};

export const getDataSourceLabel = (ds: DataSource, language: string): string => {
  return language === 'tr' ? ds.labelTr : ds.labelEn;
};

export const getDataSourceDescription = (ds: DataSource, language: string): string => {
  return language === 'tr' ? ds.descriptionTr : ds.descriptionEn;
};
