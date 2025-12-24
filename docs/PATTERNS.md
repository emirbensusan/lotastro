# LotAstro Code Patterns

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Purpose**: Document established code patterns and best practices

---

## 1. Data Fetching Patterns

### 1.1 TanStack Query - Basic Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Standard query pattern
const useLots = (filters?: LotFilters) => {
  return useQuery({
    queryKey: ['lots', filters],  // Cache key includes dependencies
    queryFn: async () => {
      let query = supabase
        .from('lots')
        .select(`
          *,
          supplier:suppliers(name),
          catalog_item:catalog_items(code, color_name)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.quality) {
        query = query.eq('quality', filters.quality);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,  // Consider fresh for 30 seconds
  });
};
```

### 1.2 TanStack Query - Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';

const useCreateLot = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  return useMutation({
    mutationFn: async (lotData: CreateLotInput) => {
      const { data, error } = await supabase
        .from('lots')
        .insert(lotData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['lots'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      // Audit log
      logAction('CREATE', 'lot', data.id, data.lot_number, null, data);

      // User feedback
      toast({
        title: 'Success',
        description: 'Lot created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
```

### 1.3 Edge Function Invocation

```typescript
// Calling edge functions with proper error handling
const invokeEdgeFunction = async <T>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    console.error(`Edge function ${functionName} error:`, error);
    throw new Error(error.message || 'Edge function failed');
  }

  return data as T;
};

// Usage
const extractOrder = async (imageUrl: string) => {
  const result = await invokeEdgeFunction<ExtractedOrder>('extract-order', {
    imageUrl,
    extractionType: 'order',
  });
  return result;
};
```

### 1.4 RPC Function Calls

```typescript
// Database function calls
const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60 * 1000,  // Refresh every minute
  });
};

// RPC with parameters
const useInventoryPivot = (qualityFilter?: string) => {
  return useQuery({
    queryKey: ['inventory-pivot', qualityFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inventory_pivot_summary', {
        p_quality_filter: qualityFilter || null,
      });
      if (error) throw error;
      return data;
    },
  });
};
```

---

## 2. Form Patterns

### 2.1 React Hook Form + Zod

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

// Schema definition
const lotFormSchema = z.object({
  lot_number: z.string().min(1, 'Lot number is required').max(50),
  quality: z.string().min(1, 'Quality is required'),
  color: z.string().min(1, 'Color is required'),
  meters: z.number().positive('Meters must be positive'),
  supplier_id: z.string().uuid('Invalid supplier'),
  notes: z.string().max(500).optional(),
});

type LotFormValues = z.infer<typeof lotFormSchema>;

// Form component
const LotForm = ({ onSubmit, defaultValues }: LotFormProps) => {
  const form = useForm<LotFormValues>({
    resolver: zodResolver(lotFormSchema),
    defaultValues: defaultValues || {
      lot_number: '',
      quality: '',
      color: '',
      meters: 0,
      supplier_id: '',
      notes: '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="lot_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lot Number</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter lot number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="meters"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Meters</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </Form>
  );
};
```

### 2.2 Inline Editable Field

```typescript
// InlineEditableField component pattern
interface InlineEditableFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  canEdit: boolean;
  fieldName: string;
  label: string;
}

const InlineEditableField: React.FC<InlineEditableFieldProps> = ({
  value,
  onSave,
  canEdit,
  fieldName,
  label,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      setEditValue(value);  // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    return <span>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-muted px-1 rounded"
    >
      {value}
    </span>
  );
};
```

---

## 3. Permission Patterns

### 3.1 usePermissions Hook

```typescript
// src/hooks/usePermissions.tsx
export const usePermissions = () => {
  const { profile } = useAuth();
  const { viewAsRole } = useViewAsRole();
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  // Use viewAsRole if set, otherwise use actual role
  const effectiveRole = viewAsRole || profile?.role;

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!effectiveRole) return;

      const { data } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', effectiveRole);

      const permMap = new Map<string, boolean>();
      data?.forEach((p) => {
        permMap.set(`${p.permission_category}.${p.permission_action}`, p.is_allowed);
      });
      setPermissions(permMap);
      setLoading(false);
    };

    fetchPermissions();
  }, [effectiveRole]);

  const hasPermission = useCallback(
    (category: string, action: string): boolean => {
      // Admin override
      if (effectiveRole === 'admin') return true;
      return permissions.get(`${category}.${action}`) ?? false;
    },
    [permissions, effectiveRole]
  );

  return { hasPermission, loading };
};
```

### 3.2 Permission-Based UI Rendering

```typescript
// Conditional rendering based on permissions
const OrderActions = ({ order }: { order: Order }) => {
  const { hasPermission } = usePermissions();

  return (
    <div className="flex gap-2">
      {/* Always visible if can view */}
      <Button variant="ghost" size="sm">
        <Eye className="h-4 w-4" />
      </Button>

      {/* Edit only with permission */}
      {hasPermission('orders', 'fulfilorders') && (
        <Button variant="ghost" size="sm" onClick={handleEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {/* Approve only for senior/admin */}
      {hasPermission('orders', 'approve') && order.status === 'pending' && (
        <Button variant="ghost" size="sm" onClick={handleApprove}>
          <Check className="h-4 w-4" />
        </Button>
      )}

      {/* Delete only for admin */}
      {hasPermission('orders', 'cancelorders') && (
        <Button variant="ghost" size="sm" onClick={handleDelete}>
          <Trash className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
```

### 3.3 Protected Route Pattern

```typescript
// Protected route with permission check
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredPermission?: { category: string; action: string };
}> = ({ children, requiredPermission }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission.category, requiredPermission.action)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};
```

---

## 4. Component Patterns

### 4.1 Dialog/Modal Pattern

```typescript
// Standard dialog component
interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CreateOrderDialog: React.FC<CreateDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const createMutation = useCreateOrder();

  const handleSubmit = async (data: OrderFormValues) => {
    await createMutation.mutateAsync(data);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('orders.create')}</DialogTitle>
          <DialogDescription>
            {t('orders.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <OrderForm
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### 4.2 Sheet/Drawer Pattern

```typescript
// Detail view in sheet/drawer
const OrderDetailSheet: React.FC<{
  orderId: string | null;
  onClose: () => void;
}> = ({ orderId, onClose }) => {
  const { data: order, isLoading } = useOrder(orderId);

  return (
    <Sheet open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Order Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : order ? (
          <div className="space-y-4 mt-4">
            <OrderDetailContent order={order} />
          </div>
        ) : (
          <div className="text-center text-muted-foreground p-8">
            Order not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
```

### 4.3 Table Pattern with Sorting & Filtering

```typescript
// Reusable table with common features
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchKey?: keyof T;
  filterOptions?: FilterOption[];
}

const DataTable = <T extends { id: string }>({
  data,
  columns,
  searchKey,
  filterOptions,
}: DataTableProps<T>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        {filterOptions && <FilterDropdown options={filterOptions} />}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <SortableTableHead key={header.id} header={header} />
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
};
```

### 4.4 Mobile Card Pattern

```typescript
// Mobile-friendly card for list items
const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useLanguage();

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{order.order_number}</h3>
          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
        </div>
        <Badge variant={getStatusVariant(order.status)}>
          {t(`orderStatus.${order.status}`)}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">{t('date')}:</span>
          <span className="ml-1">{formatDate(order.created_at)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('items')}:</span>
          <span className="ml-1">{order.items_count}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1">
          {t('viewDetails')}
        </Button>
        <Button size="sm" className="flex-1">
          {t('fulfill')}
        </Button>
      </div>
    </Card>
  );
};
```

---

## 5. Hook Patterns

### 5.1 Custom Hook Structure

```typescript
// Standard custom hook structure
interface UseStockTakeSessionOptions {
  userId: string | undefined;
  timeoutMinutes?: number;
  onSessionExpired?: () => void;
}

interface UseStockTakeSessionReturn {
  session: StockTakeSession | null;
  isLoading: boolean;
  isExpiring: boolean;
  startSession: () => Promise<StockTakeSession | null>;
  endSession: () => Promise<boolean>;
  cancelSession: () => Promise<boolean>;
  keepSessionActive: () => void;
}

export const useStockTakeSession = ({
  userId,
  timeoutMinutes = 5,
  onSessionExpired,
}: UseStockTakeSessionOptions): UseStockTakeSessionReturn => {
  // State
  const [session, setSession] = useState<StockTakeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);

  // Refs for timers
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Callbacks
  const startSession = useCallback(async () => {
    // Implementation
  }, [userId]);

  const endSession = useCallback(async () => {
    // Implementation
  }, [session]);

  // Effects
  useEffect(() => {
    // Setup on mount
    return () => {
      // Cleanup on unmount
    };
  }, []);

  return {
    session,
    isLoading,
    isExpiring,
    startSession,
    endSession,
    cancelSession,
    keepSessionActive,
  };
};
```

### 5.2 useViewMode Hook

```typescript
// Persistent view mode toggle
export const useViewMode = (key: string = 'default') => {
  const storageKey = `viewMode_${key}`;
  
  const [viewMode, setViewModeState] = useState<'table' | 'cards'>(() => {
    const stored = localStorage.getItem(storageKey);
    return (stored as 'table' | 'cards') || 'table';
  });

  const setViewMode = useCallback((mode: 'table' | 'cards') => {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
  }, [storageKey]);

  return { viewMode, setViewMode };
};
```

### 5.3 usePullToRefresh Hook

```typescript
// Mobile pull-to-refresh pattern
export const usePullToRefresh = (
  onRefresh: () => Promise<void>,
  options: { threshold?: number; resistance?: number } = {}
) => {
  const { threshold = 80, resistance = 2.5 } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY.current) / resistance);
    setPullDistance(Math.min(distance, threshold * 1.5));
  }, [isPulling, resistance, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, isPulling, pullDistance, isRefreshing };
};
```

---

## 6. Loading State Patterns

### 6.1 Skeleton Loading

```typescript
// Skeleton placeholder for loading states
const OrderListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </Card>
    ))}
  </div>
);

// Usage
const OrderList = () => {
  const { data, isLoading } = useOrders();

  if (isLoading) return <OrderListSkeleton />;

  return (
    <div className="space-y-4">
      {data?.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
};
```

### 6.2 Loading Button

```typescript
// Button with loading state
interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  ...props
}) => (
  <Button disabled={disabled || isLoading} {...props}>
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {loadingText || children}
      </>
    ) : (
      children
    )}
  </Button>
);
```

---

## 7. Error Handling Patterns

### 7.1 Error Boundary

```typescript
// Global error boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              An unexpected error occurred. Please refresh the page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 7.2 Query Error Handling

```typescript
// Consistent error handling for queries
const useOrders = () => {
  const { toast } = useToast();

  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*');

      if (error) {
        // Log for debugging
        console.error('Failed to fetch orders:', error);
        throw error;
      }

      return data;
    },
    // Show toast on error
    meta: {
      onError: (error: Error) => {
        toast({
          title: 'Failed to load orders',
          description: error.message,
          variant: 'destructive',
        });
      },
    },
  });
};
```

---

## 8. Audit Logging Pattern

```typescript
// Using the audit log hook
const OrderActions = ({ order }: { order: Order }) => {
  const { logAction } = useAuditLog();
  const updateMutation = useUpdateOrder();

  const handleStatusChange = async (newStatus: string) => {
    const oldData = { status: order.status };
    const newData = { status: newStatus };

    await updateMutation.mutateAsync({ id: order.id, ...newData });

    // Log the change
    await logAction(
      'STATUS_CHANGE',
      'order',
      order.id,
      order.order_number,
      oldData,
      newData,
      `Status changed from ${order.status} to ${newStatus}`
    );
  };

  // ...
};
```

---

## 9. Internationalization Pattern

```typescript
// Using the language context
const OrderStatus = ({ status }: { status: string }) => {
  const { t, language } = useLanguage();

  return (
    <Badge variant={getStatusVariant(status)}>
      {t(`orderStatus.${status}`)}
    </Badge>
  );
};

// Translation function returns string or object
const { t } = useLanguage();

// Simple key
const title = String(t('orders')); // "Orders" or "Siparişler"

// Nested key
const statusLabel = String(t('orderStatus.pending')); // "Pending" or "Beklemede"

// With interpolation (manual)
const message = String(t('orderCreated')).replace('{number}', orderNumber);
```

---

## 10. Toast Notification Pattern

```typescript
// Using toast for user feedback
const { toast } = useToast();

// Success notification
toast({
  title: 'Success',
  description: 'Order created successfully',
});

// Error notification
toast({
  title: 'Error',
  description: 'Failed to create order',
  variant: 'destructive',
});

// With action
toast({
  title: 'Order Created',
  description: 'Would you like to view the order?',
  action: (
    <ToastAction altText="View" onClick={() => navigate(`/orders/${orderId}`)}>
      View
    </ToastAction>
  ),
});

// Long duration for important messages
toast({
  title: 'Session Expiring',
  description: 'Your session will expire in 1 minute',
  variant: 'destructive',
  duration: 30000, // 30 seconds
});
```

---

## 11. Autocomplete Pattern

```typescript
// Autocomplete component usage
const QualityAutocomplete = ({ value, onChange }: Props) => {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) return;

      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke('autocomplete-qualities', {
          body: { query },
        });
        setOptions(data?.suggestions || []);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      options={options}
      onInputChange={fetchSuggestions}
      loading={loading}
      placeholder="Enter quality code"
    />
  );
};
```

---

## 12. File Upload Pattern

```typescript
// File upload to Supabase Storage
const useFileUpload = (bucket: string) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File, path: string): Promise<string> => {
    setUploading(true);
    setProgress(0);

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } finally {
      setUploading(false);
      setProgress(100);
    }
  };

  return { upload, uploading, progress };
};
```

---

## 13. Responsive Design Pattern

```typescript
// Using the mobile hook
const OrderList = () => {
  const isMobile = useIsMobile();
  const { viewMode, setViewMode } = useViewMode('orders');

  // Force cards on mobile
  const effectiveViewMode = isMobile ? 'cards' : viewMode;

  return (
    <div>
      {!isMobile && (
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      )}

      {effectiveViewMode === 'cards' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <OrderTable orders={orders} />
      )}
    </div>
  );
};
```

---

## 14. Complex State Management Pattern

```typescript
// useReportBuilder - complex multi-step form state
export const useReportBuilder = ({ open, editingConfig, onSave, onClose }) => {
  // Group related state
  const [dataSourceState, setDataSourceState] = useState({
    dataSources: [],
    selectedDataSource: '',
    availableColumns: [],
    availableJoins: [],
    selectedJoins: [],
  });

  const [columnState, setColumnState] = useState({
    selectedColumns: [],
    columnSearch: '',
  });

  const [reportState, setReportState] = useState({
    reportName: '',
    outputFormats: ['html'],
    includeCharts: false,
  });

  // Memoized handlers
  const handleDataSourceSelect = useCallback((key: string) => {
    setDataSourceState((prev) => ({
      ...prev,
      selectedDataSource: key,
    }));
    // Reset dependent state
    setColumnState((prev) => ({
      ...prev,
      selectedColumns: [],
    }));
  }, []);

  // Validation
  const isValid = useMemo(() => {
    return (
      reportState.reportName.trim() !== '' &&
      dataSourceState.selectedDataSource !== '' &&
      columnState.selectedColumns.length > 0
    );
  }, [reportState.reportName, dataSourceState.selectedDataSource, columnState.selectedColumns]);

  return {
    // Flattened state for consumers
    ...dataSourceState,
    ...columnState,
    ...reportState,
    isValid,
    handleDataSourceSelect,
    // ... other handlers
  };
};
```

---

## 15. Design System Patterns

### 15.1 Using Semantic Tokens

```typescript
// ✅ CORRECT - Use semantic tokens
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground border-border">
    <Badge className="bg-primary text-primary-foreground">Active</Badge>
    <p className="text-muted-foreground">Description</p>
  </Card>
</div>

// ❌ WRONG - Direct colors
<div className="bg-white text-black">
  <Card className="bg-gray-100 text-gray-900">
    <Badge className="bg-blue-500 text-white">Active</Badge>
  </Card>
</div>
```

### 15.2 Consistent Spacing

```typescript
// Use Tailwind spacing scale consistently
<div className="space-y-4">           {/* Between sections */}
  <div className="p-4">               {/* Card padding */}
    <div className="flex gap-2">      {/* Between inline items */}
      <Button size="sm">Action</Button>
    </div>
  </div>
</div>
```

### 15.3 Responsive Breakpoints

```typescript
// Mobile-first responsive design
<div className="
  grid 
  grid-cols-1 
  sm:grid-cols-2 
  md:grid-cols-3 
  lg:grid-cols-4 
  gap-4
">
  {items.map(item => <Card key={item.id} />)}
</div>

// Text sizing
<h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
  Title
</h1>
```
