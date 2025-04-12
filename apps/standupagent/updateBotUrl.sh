#!/bin/bash

BOT_NAME="standupagent"
RESOURCE_GROUP="standupagent"
REMOTE_URL="https://standupagent.azurewebsites.net/api/messages"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)
      LOCAL_URL="$2"
      shift 2
      ;;
    --remote)
      REMOTE_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate arguments
if [ -z "$LOCAL_URL" ] && [ -z "$REMOTE_MODE" ]; then
  echo "Error: Either --local <url> or --remote must be specified"
  exit 1
fi

# Set the endpoint URL
if [ -n "$LOCAL_URL" ]; then
  # Validate URL format
  if [[ ! "$LOCAL_URL" =~ ^https?:// ]]; then
    echo "Error: Local URL must start with http:// or https://"
    exit 1
  fi
  
  # Ensure URL ends with /api/messages
  if [[ ! "$LOCAL_URL" =~ /api/messages$ ]]; then
    ENDPOINT_URL="${LOCAL_URL%/}/api/messages"
  else
    ENDPOINT_URL="$LOCAL_URL"
  fi
elif [ "$REMOTE_MODE" = true ]; then
  ENDPOINT_URL="$REMOTE_URL"
fi

# Update the bot endpoint
echo "Updating bot endpoint to: $ENDPOINT_URL"
az bot update --name "$BOT_NAME" --resource-group "$RESOURCE_GROUP" --endpoint "$ENDPOINT_URL"

# Check if the update was successful
if [ $? -eq 0 ]; then
  echo "Bot endpoint updated successfully"
else
  echo "Failed to update bot endpoint"
  exit 1
fi 