import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { OpenAIChatModel } from "@microsoft/teams.openai"

export const buildChatPromptModel = () => {
    return new OpenAIChatModel({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
        azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")
    });
}
