#!/bin/bash

echo "Setting up CORS for Firebase Storage..."
echo "======================================="
echo ""

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null
then
    echo "gsutil is not installed. Please install Google Cloud SDK first:"
    echo "brew install google-cloud-sdk"
    exit 1
fi

# Set the project
PROJECT_ID="test-simple-123"
BUCKET_NAME="test-simple-123.appspot.com"

echo "Project ID: $PROJECT_ID"
echo "Storage Bucket: $BUCKET_NAME"
echo ""

# Login to Google Cloud
echo "Please login to Google Cloud..."
gcloud auth login

# Set the project
echo "Setting project..."
gcloud config set project $PROJECT_ID

# Apply CORS configuration
echo "Applying CORS configuration..."
gsutil cors set cors.json gs://$BUCKET_NAME

echo ""
echo "CORS configuration has been applied successfully!"
echo ""
echo "Next steps:"
echo "1. Go to Firebase Console > Storage > Rules"
echo "2. Update the rules as shown in UPLOAD_FIX_GUIDE.md"
echo "3. Restart your React app"
echo "4. Try uploading an image or video"
