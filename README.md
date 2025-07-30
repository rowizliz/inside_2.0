# Inside - Mạng xã hội dành cho người hướng nội

## 🌟 Giới thiệu

Inside là một mạng xã hội được thiết kế đặc biệt cho những người hướng nội, nơi họ có thể kết nối, chia sẻ và tương tác một cách thoải mái.

## ✨ Tính năng chính

### 📱 Giao diện người dùng
- **Dark theme** hiện đại và dễ chịu cho mắt
- **Responsive design** tối ưu cho mobile và desktop
- **Instagram-like UX** với navigation mượt mà

### 💬 Chat System
- **Real-time messaging** với Supabase Realtime
- **Direct chat** và **Group chat**
- **Unread message counter** với badge thông báo
- **Message persistence** và session management
- **Auto-scroll** và **message history**

### 📝 Social Features
- **Create posts** với text và hình ảnh
- **User profiles** với avatar và bio
- **Real-time feed** với live updates
- **Post interactions** (like, comment)

### 🔐 Authentication
- **Secure login/signup** với Supabase Auth
- **Session persistence** - không bị logout khi refresh
- **Protected routes** cho bảo mật

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18** với Hooks và Context API
- **Tailwind CSS** cho styling
- **Heroicons** cho icons
- **React Router** cho navigation

### Backend & Database
- **Supabase** cho:
  - Authentication
  - Real-time database
  - File storage
  - Row Level Security (RLS)

### Development
- **Create React App**
- **PostCSS** và **Autoprefixer**
- **Git** cho version control

## 🚀 Cài đặt và chạy

### Prerequisites
- Node.js (v14+)
- npm hoặc yarn
- Supabase account

### Installation
```bash
# Clone repository
git clone https://github.com/rowizliz/inside.git
cd inside

# Install dependencies
npm install

# Tạo file .env với Supabase credentials
echo "REACT_APP_SUPABASE_URL=your_supabase_url" > .env
echo "REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key" >> .env

# Chạy development server
npm start
```

### Environment Variables
Tạo file `.env` trong root directory:
```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

## 📊 Database Schema

### Tables
- `profiles` - User profiles
- `posts` - Social media posts
- `chat_channels` - Chat channels
- `chat_channel_members` - Channel memberships
- `messages` - Chat messages
- `message_reads` - Message read status

## 🎯 Tính năng nổi bật

### Session Management
- ✅ Không bị logout khi refresh
- ✅ Session persistence với localStorage
- ✅ Auto-refresh token

### Chat Experience
- ✅ Instagram-like flow (Feed → Chat List → Chat Detail)
- ✅ Real-time messaging
- ✅ Unread message counter
- ✅ Message history với pagination

### UI/UX
- ✅ Dark theme hiện đại
- ✅ Responsive design
- ✅ Smooth animations
- ✅ Loading states

## 🔗 Links

- **Live Demo**: [Deploy trên Vercel]
- **GitHub**: https://github.com/rowizliz/inside
- **Supabase**: https://supabase.com

## 📝 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 🤝 Contributing

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

**Made with ❤️ for introverts**
