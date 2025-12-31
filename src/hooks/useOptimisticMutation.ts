import { useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

interface OptimisticMutationOptions<TData, TVariables, TContext = unknown> {
  // The mutation function
  mutationFn: (variables: TVariables) => Promise<TData>;
  // Query key to invalidate/update
  queryKey: QueryKey;
  // Function to create optimistic data
  optimisticUpdate?: (
    oldData: TData | undefined,
    variables: TVariables
  ) => TData | undefined;
  // Success message
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  // Error message
  errorMessage?: string | ((error: Error, variables: TVariables) => string);
  // Called on success
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  // Called on error
  onError?: (error: Error, variables: TVariables, context: TContext) => void;
  // Called on settle
  onSettled?: () => void;
}

export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  onSettled,
}: OptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update the cache
      if (optimisticUpdate) {
        queryClient.setQueryData<TData>(queryKey, (oldData) =>
          optimisticUpdate(oldData, variables)
        );
      }

      // Return context with the snapshotted value
      return { previousData } as TContext;
    },
    onError: (error: Error, variables: TVariables, context: TContext) => {
      // Rollback on error
      if (context && (context as { previousData?: TData }).previousData) {
        queryClient.setQueryData(
          queryKey,
          (context as { previousData?: TData }).previousData
        );
      }

      // Show error message
      const message =
        typeof errorMessage === 'function'
          ? errorMessage(error, variables)
          : errorMessage || error.message;
      toast.error(message);

      onError?.(error, variables, context);
    },
    onSuccess: (data: TData, variables: TVariables, context: TContext) => {
      // Show success message
      if (successMessage) {
        const message =
          typeof successMessage === 'function'
            ? successMessage(data, variables)
            : successMessage;
        toast.success(message);
      }

      onSuccess?.(data, variables, context);
    },
    onSettled: () => {
      // Invalidate query to refetch fresh data
      queryClient.invalidateQueries({ queryKey });
      onSettled?.();
    },
  });
}

// Helper for simple mutations without optimistic updates
export function useSimpleMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys,
  successMessage,
  errorMessage,
  onSuccess,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: QueryKey[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidate specified queries
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      // Show success message
      if (successMessage) {
        const message =
          typeof successMessage === 'function'
            ? successMessage(data)
            : successMessage;
        toast.success(message);
      }

      onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast.error(errorMessage || error.message);
    },
  });
}
