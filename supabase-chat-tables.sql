-- Tạo bảng chat channels (kênh chat)
CREATE TABLE IF NOT EXISTS chat_channels (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'group', -- 'group' hoặc 'direct'
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo bảng chat channel members (thành viên trong kênh)
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Tạo bảng messages với channel_id
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES chat_channels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_uid UUID REFERENCES auth.users(id),
  author_display_name TEXT,
  author_email TEXT,
  author_avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo RLS policies
CREATE POLICY "Enable all operations for chat_channels" ON chat_channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for chat_channel_members" ON chat_channel_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- Tạo kênh chat chung mặc định
INSERT INTO chat_channels (name, type, created_by) 
VALUES ('Chat Chung', 'group', NULL)
ON CONFLICT DO NOTHING;

-- Thêm tất cả user hiện tại vào kênh chat chung
INSERT INTO chat_channel_members (channel_id, user_id)
SELECT 1, id FROM auth.users
ON CONFLICT DO NOTHING; 