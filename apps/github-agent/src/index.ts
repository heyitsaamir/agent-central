import { ChatPrompt } from '@microsoft/teams.ai';
import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { McpClientPlugin } from '@microsoft/teams.mcpclient';
import { OpenAIChatModel } from '@microsoft/teams.openai';

const app = new App({
  plugins: [new DevtoolsPlugin()],
  oauth: {
    defaultConnectionName: 'github-oauth'
  }
});

// You can run these as a middlware for all activities.
app.on('activity', async (ctx) => {
  // You can add any custom data to the context
  ctx['other_data'] = 'some value';
  try {
    await ctx.next();
  } catch (error) {
    console.error('Activity error:', error);
    await ctx.send(`Activity id ${ctx.activity.id}. Something went wrong!`);
  }
});

// General message handler
app.on('message', async ({ send, activity, signin, isSignedIn }) => {
  console.log('Received message:', activity.text);
  
  try {
    // Check if user is already signed in
    console.log('Checking if user is signed in:', isSignedIn);
    
    let userToken;
    if (!isSignedIn) {
      console.log('User not signed in, attempting to sign in...');
      userToken = await signin();
    } else {
      console.log('User already signed in, attempting to get token...');
      userToken = await signin();
    }
    
    console.log('Sign in result:', userToken ? 'Success - token received' : 'Failed - no token');
    
    if (!userToken) {
      console.error('User token is not available. OAuth configuration may be incomplete.');
      await send(`❌ **Authentication Required**
      
I need to authenticate with GitHub to help you. This appears to be a configuration issue.

**Possible solutions:**
1. **Check OAuth Configuration**: The GitHub OAuth connection 'github-oauth' may not be properly configured.
2. **Sign In**: Try signing out and signing back in to refresh your authentication.
3. **Contact Admin**: The bot may need additional OAuth setup for GitHub integration.

**What this bot can do once authenticated:**
- Help with GitHub repositories
- Answer questions about code
- Assist with development workflows

Please contact your administrator to ensure the GitHub OAuth connection is properly configured.`);
      return;
    }

    console.log('Authentication successful, proceeding with chat...');
    
    // Validate required environment variables
    const requiredEnvVars = [
      'AZURE_OPENAI_MODEL_DEPLOYMENT_NAME',
      'AZURE_OPENAI_API_KEY',
      'AZURE_OPENAI_API_VERSION',
      'AZURE_OPENAI_ENDPOINT'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      await send(`❌ **Configuration Error**
      
The bot is missing required configuration. Missing environment variables: ${missingVars.join(', ')}

Please contact your administrator to configure these settings.`);
      return;
    }

    const chatPrompt = new ChatPrompt({
      instructions: 'You are a helpful GitHub assistant. You can help with repository management, code questions, and development workflows.',
      model: new OpenAIChatModel({
        model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      }),
    }, [new McpClientPlugin()]).usePlugin('mcpClient', {
      url: 'https://api.githubcopilot.com/mcp/',
      params: {
        headers: {
          "Authorization": `Bearer ${userToken}`
        }
      }
    });

    const result = await chatPrompt.send(activity.text);
    console.log('Response from the model:', result.content);
    if (result?.content) {
      await send(result.content);
    } else {
      await send('I received your message but got no response from the model. Please try again.');
    }
  } catch (error) {
    console.error('Error in message handler:', error);
    if (error instanceof Error && error.message.includes('unauthorized')) {
      await send('❌ **Authentication Error**: Your GitHub token may have expired. Please sign in again.');
    } else {
      await send('❌ **Error**: Something went wrong while processing your message. Please try again or contact support.');
    }
  }
});

// Memeber added / removed handler
app.on('conversationUpdate', async ({ activity }) => {
  if (activity.membersAdded) {

  }

  if (activity.membersRemoved) {

  }
});

// Handle installation
app.on('install.add', async ({ send }) => {
  await send(`👋 **Welcome to GitHub Agent!**

I'm here to help you with GitHub-related tasks. To get started, I need to authenticate with your GitHub account.

**What I can help with:**
- Repository management
- Code questions and reviews  
- Development workflows
- GitHub API interactions

**Setup Required:**
- GitHub OAuth connection must be configured
- Sign in when prompted to authorize GitHub access

Try sending me a message to begin!`);
});

// Command handler
app.message(/hello/i, async () => {
  // TODO: Implement hello command
});

// Called when a task module is opened
app.on('dialog.open', async () => {
  return {};
});

// Called when a task module is submitted
app.on('dialog.submit', async () => {
  return {};
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
