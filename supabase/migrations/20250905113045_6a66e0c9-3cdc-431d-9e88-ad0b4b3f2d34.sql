
-- Tighten UPDATE permissions on lots:
-- Remove UPDATE access for warehouse_staff; keep only accounting and admin.

drop policy if exists "Warehouse staff and admins can update lots" on public.lots;

create policy "Accounting and admins can update lots"
on public.lots
for update
to authenticated
using (
  has_role(auth.uid(), 'accounting'::user_role)
  or has_role(auth.uid(), 'admin'::user_role)
)
with check (
  has_role(auth.uid(), 'accounting'::user_role)
  or has_role(auth.uid(), 'admin'::user_role)
);
