-- Migration 4: Triggers & Validation

-- 1. Auto-update incoming_stock status trigger
CREATE OR REPLACE FUNCTION public.update_incoming_stock_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.received_meters >= NEW.expected_meters THEN
    NEW.status := 'fully_received';
  ELSIF NEW.received_meters > 0 THEN
    NEW.status := 'partially_received';
  ELSE
    NEW.status := 'pending_inbound';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_incoming_stock_status
  BEFORE UPDATE OF received_meters ON public.incoming_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_incoming_stock_status();

-- 2. Validate reservation availability
CREATE OR REPLACE FUNCTION public.validate_reservation_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  IF NEW.scope = 'INCOMING' THEN
    SELECT (expected_meters - received_meters - reserved_meters)
    INTO v_available
    FROM incoming_stock
    WHERE id = NEW.incoming_stock_id;
    
    IF v_available < NEW.reserved_meters THEN
      RAISE EXCEPTION 'Insufficient incoming stock available. Available: %, Requested: %', v_available, NEW.reserved_meters;
    END IF;
  ELSIF NEW.scope = 'INVENTORY' THEN
    SELECT (meters - reserved_meters)
    INTO v_available
    FROM lots
    WHERE id = NEW.lot_id;
    
    IF v_available < NEW.reserved_meters THEN
      RAISE EXCEPTION 'Insufficient inventory available. Available: %, Requested: %', v_available, NEW.reserved_meters;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_reservation_availability
  BEFORE INSERT OR UPDATE ON public.reservation_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reservation_availability();

-- 3. Update reserved meters on reservation line INSERT
CREATE OR REPLACE FUNCTION public.update_reserved_meters_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scope = 'INCOMING' THEN
    UPDATE incoming_stock
    SET reserved_meters = reserved_meters + NEW.reserved_meters
    WHERE id = NEW.incoming_stock_id;
  ELSIF NEW.scope = 'INVENTORY' THEN
    UPDATE lots
    SET reserved_meters = reserved_meters + NEW.reserved_meters
    WHERE id = NEW.lot_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_reserved_meters_insert
  AFTER INSERT ON public.reservation_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reserved_meters_on_insert();

-- 4. Update reserved meters on reservation line UPDATE
CREATE OR REPLACE FUNCTION public.update_reserved_meters_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement old
  IF OLD.scope = 'INCOMING' THEN
    UPDATE incoming_stock
    SET reserved_meters = reserved_meters - OLD.reserved_meters
    WHERE id = OLD.incoming_stock_id;
  ELSIF OLD.scope = 'INVENTORY' THEN
    UPDATE lots
    SET reserved_meters = reserved_meters - OLD.reserved_meters
    WHERE id = OLD.lot_id;
  END IF;
  
  -- Increment new
  IF NEW.scope = 'INCOMING' THEN
    UPDATE incoming_stock
    SET reserved_meters = reserved_meters + NEW.reserved_meters
    WHERE id = NEW.incoming_stock_id;
  ELSIF NEW.scope = 'INVENTORY' THEN
    UPDATE lots
    SET reserved_meters = reserved_meters + NEW.reserved_meters
    WHERE id = NEW.lot_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_reserved_meters_update
  AFTER UPDATE ON public.reservation_lines
  FOR EACH ROW
  WHEN (OLD.reserved_meters IS DISTINCT FROM NEW.reserved_meters OR OLD.scope IS DISTINCT FROM NEW.scope)
  EXECUTE FUNCTION public.update_reserved_meters_on_update();

-- 5. Update reserved meters on reservation line DELETE
CREATE OR REPLACE FUNCTION public.update_reserved_meters_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.scope = 'INCOMING' THEN
    UPDATE incoming_stock
    SET reserved_meters = reserved_meters - OLD.reserved_meters
    WHERE id = OLD.incoming_stock_id;
  ELSIF OLD.scope = 'INVENTORY' THEN
    UPDATE lots
    SET reserved_meters = reserved_meters - OLD.reserved_meters
    WHERE id = OLD.lot_id;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_update_reserved_meters_delete
  AFTER DELETE ON public.reservation_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reserved_meters_on_delete();

-- 6. Handle reservation cancellation (delete lines)
CREATE OR REPLACE FUNCTION public.handle_reservation_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
    DELETE FROM reservation_lines WHERE reservation_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_handle_reservation_cancel
  AFTER UPDATE OF status ON public.reservations
  FOR EACH ROW
  WHEN (NEW.status = 'canceled')
  EXECUTE FUNCTION public.handle_reservation_cancel();