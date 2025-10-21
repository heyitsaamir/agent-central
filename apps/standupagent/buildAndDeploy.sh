echo "Logging in to Azure and ACR..."
ACR_NAME="standupagentacr1761020070"
RESOURCE_GROUP="aamir-rg"
WEBAPP_NAME="standupagent"
# Login to Azure
az acr login --name $ACR_NAME

echo "Building and pushing Docker image..."
# Build and tag the image from root directory
cd ../..
docker build -t $ACR_NAME.azurecr.io/standupagent:latest .
docker push $ACR_NAME.azurecr.io/standupagent:latest

echo "Deploying to Azure Web App..."
# Update the web app to use container
az webapp config container set \
    --name $WEBAPP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name $ACR_NAME.azurecr.io/standupagent:latest \
    --docker-registry-server-url https://$ACR_NAME.azurecr.io \
    --docker-registry-server-user $(az acr credential show --name $ACR_NAME --query "username" -o tsv) \
    --docker-registry-server-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

echo "Restarting Azure Web App..."
# Restart the web app
az webapp restart --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
