echo "Logging in to Azure and ACR..."
# Login to Azure
az acr login --name standupagentacr

echo "Building and pushing Docker image..."
# Build and tag the image from root directory
cd ../..
docker build -t standupagentacr.azurecr.io/standupagent:latest .
docker push standupagentacr.azurecr.io/standupagent:latest

echo "Deploying to Azure Web App..."
# Update the web app to use container
az webapp config container set \
  --name standupagent \
  --resource-group standupagent \
  --docker-custom-image-name standupagentacr.azurecr.io/standupagent:latest \
  --docker-registry-server-url https://standupagentacr.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name standupagentacr --query "username" -o tsv) \
  --docker-registry-server-password $(az acr credential show --name standupagentacr --query "passwords[0].value" -o tsv)

echo "Restarting Azure Web App..."
# Restart the web app
az webapp restart --name standupagent --resource-group standupagent
