-- Tạo bảng message_reads để tracking trạng thái đã nhận/đã xem từng message cho từng user
create table if not exists message_reads (
  id bigserial primary key,
  message_id bigint references messages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text check (status in ('delivered', 'seen')) not null default 'delivered',
  updated_at timestamptz default now(),
  unique (message_id, user_id)
);

-- Index để truy vấn nhanh
create index if not exists idx_message_reads_user on message_reads(user_id);
create index if not exists idx_message_reads_message on message_reads(message_id); 