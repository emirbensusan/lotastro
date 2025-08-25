-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('warehouse_staff', 'accounting', 'admin');

-- Create enum for stock status
CREATE TYPE public.stock_status AS ENUM ('in_stock', 'out_of_stock', 'partially_fulfilled');

-- Create enum for order line type
CREATE TYPE public.order_line_type AS ENUM ('sample', 'standard');

-- Create profiles table for user data and roles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'warehouse_staff',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create suppliers table (managed by admin)
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create lots table for inventory tracking
CREATE TABLE public.lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_number TEXT NOT NULL UNIQUE,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  meters DECIMAL(10,2) NOT NULL CHECK (meters > 0),
  roll_count INTEGER NOT NULL DEFAULT 1 CHECK (roll_count > 0),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  status stock_status NOT NULL DEFAULT 'in_stock',
  qr_code_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on lots
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  fulfilled_by UUID REFERENCES auth.users(id),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create order_lots junction table (many-to-many)
CREATE TABLE public.order_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  roll_count INTEGER NOT NULL CHECK (roll_count > 0),
  line_type order_line_type NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, lot_id)
);

-- Enable RLS on order_lots
ALTER TABLE public.order_lots ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = has_role.user_id
    AND profiles.role = required_role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = get_user_role.user_id
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'warehouse_staff')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for suppliers
CREATE POLICY "All authenticated users can view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for lots
CREATE POLICY "All authenticated users can view lots" ON public.lots
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Warehouse staff and admins can create lots" ON public.lots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'warehouse_staff') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Warehouse staff and admins can update lots" ON public.lots
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'warehouse_staff') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Only admins can delete lots" ON public.lots
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for orders
CREATE POLICY "All authenticated users can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Accounting and admins can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'accounting') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Accounting and admins can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounting') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Only admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for order_lots
CREATE POLICY "All authenticated users can view order_lots" ON public.order_lots
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Accounting and admins can manage order_lots" ON public.order_lots
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'accounting') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Insert some default suppliers for testing
INSERT INTO public.suppliers (name) VALUES 
  ('Textile Corp'),
  ('Quality Fabrics Ltd'),
  ('Premium Textiles Inc');