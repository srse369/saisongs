#!/bin/bash

# Database Setup Script for Song Studio
# This script helps execute the schema.sql file on your Neon database

set -e

echo "==============================="
echo "Song Studio - Database Setup"
echo "==============================="
echo ""

# Check if connection string is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup.sh <connection_string>"
    echo ""
    echo "Example:"
    echo "  ./setup.sh 'postgresql://user:password@host/database?sslmode=require'"
    echo ""
    echo "You can find your connection string in the Neon console:"
    echo "  https://console.neon.tech/"
    echo ""
    exit 1
fi

CONNECTION_STRING="$1"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "Error: psql is not installed."
    echo "Please install PostgreSQL client tools or use the Neon SQL Editor."
    echo ""
    echo "macOS: brew install postgresql"
    echo "Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo ""
    exit 1
fi

echo "Executing schema.sql..."
echo ""

# Execute the schema
psql "$CONNECTION_STRING" -f schema.sql

echo ""
echo "✓ Schema executed successfully!"
echo ""
echo "Verifying tables..."
echo ""

# Verify tables were created
psql "$CONNECTION_STRING" -c "\dt"

echo ""
echo "✓ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update your .env.local file with the connection string"
echo "  2. Start the development server: npm run dev"
echo "  3. Test the connection through the admin interface"
echo ""
