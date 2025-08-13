#!/bin/bash
#
# Development Start Script
#
# This script is intended for development use only. It starts the server on a
# specific port, killing any process that might already be using it if the
# 'lsof' command is available.
# In production, Deno manages the port automatically.
#

PORT=8020
export APP_ENV=development

# --- Environment Variable Loading ---
# Check if .env file exists and load it. This makes variables available to Deno.
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
else
  echo "Warning: .env file not found. Please create one from .env.example."
fi
# ------------------------------------

# Check if lsof command exists
if command -v lsof &> /dev/null; then
    # Find the process ID (PID) using the specified port
    PID=$(lsof -t -i:$PORT)

    # If a PID is found, kill the process
    if [ -n "$PID" ]; then
      echo "Process with PID $PID is using port $PORT. Killing it..."
      kill -9 $PID
      echo "Process killed."
    fi
else
    echo "Warning: 'lsof' command not found. Cannot check if port $PORT is in use."
fi


# Start the Deno application with all necessary permissions
echo "Starting server in development mode with file watching..."
deno run --allow-read --allow-net --allow-env --unstable-kv --allow-write --watch --reload main.ts