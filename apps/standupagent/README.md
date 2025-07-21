This is a bot that you can use to manage your daily standups in Microsoft Teams.

1. Create a new bot using the Bot Framework. Note down the resource group
2. Create a new webapp `az webapp create --resource-group <resource-id> --plan standupagent-plan --name <webapp-name> --runtime "NODE:22-lts"`
3. Create a new Cosmos DB `az cosmosdb create --name <cosmos-db-name> --resource-group <resource-id> --default-consistency-level Session`
4. Create an ACR `az acr create --resource-group <resource-id> --name <acr-name> --sku Basic --admin-enabled true`
5. Update `buildAndDeploy.sh` with the names.
6. Using Azure Foundary, deploy a new model (`gpt-4.1-mini` should be good enough)
7. Duplicate `.sampleenv` to `.env` and update the values with the ones you created in the previous steps.
8. Run `buildAndDeploy.sh` to build and deploy the bot.