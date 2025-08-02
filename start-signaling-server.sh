#!/bin/bash

echo "🚀 Starting Enhanced Video Call Signaling Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Navigate to signaling server directory
cd signaling-server-new

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🔥 Starting signaling server on port 3000..."
echo "📊 Health check: http://localhost:3000/health"
echo "📈 Stats: http://localhost:3000/stats"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
