-- Fix function permissions: service_role needs access for testing
-- Also grant to anon for edge function usage (they validate before auth)

GRANT EXECUTE ON FUNCTION public.validate_idempotency_key(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_idempotency_key(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.validate_contract_uom(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_contract_uom(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.log_contract_violation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;