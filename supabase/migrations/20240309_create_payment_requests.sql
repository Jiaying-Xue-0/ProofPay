-- Create payment_requests table
create table if not exists public.payment_requests (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    amount text not null,
    token_symbol text not null,
    token_address text not null,
    chain_id text not null,
    customer_name text not null,
    description text,
    tags text[],
    additional_notes text,
    status text not null default 'pending', -- pending, paid, cancelled
    payment_link text not null,
    requester_address text not null,
    payer_address text, -- 实际支付者的地址，支付后才会填写
    transaction_hash text,
    paid_at timestamp with time zone
);

-- Add RLS policies for payment_requests
alter table public.payment_requests enable row level security;

create policy "Enable read access for all users" on public.payment_requests
    for select using (true);

create policy "Enable insert for authenticated users only" on public.payment_requests
    for insert with check (auth.role() = 'authenticated');

create policy "Enable update for requester" on public.payment_requests
    for update using (auth.uid()::text = requester_address);

-- Add request_id to invoices table
alter table public.invoices
add column if not exists request_id uuid references public.payment_requests(id);

-- Create index for faster lookups
create index if not exists payment_requests_requester_address_idx on public.payment_requests(requester_address);
create index if not exists payment_requests_status_idx on public.payment_requests(status);
create index if not exists invoices_request_id_idx on public.invoices(request_id);

-- Add trigger to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger handle_payment_requests_updated_at
    before update on public.payment_requests
    for each row
    execute procedure public.handle_updated_at(); 