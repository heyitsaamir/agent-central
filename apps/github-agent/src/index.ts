import { ChatPrompt } from '@microsoft/teams.ai';
import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { McpClientPlugin } from '@microsoft/teams.mcpclient';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
    await ctx.send(`Activity id ${ctx.activity.id}. Something went wrong!`);
  }
});

app.message(/mcp-direct/, async ({ send, activity, signin, log }) => {
  const userToken = await signin();
  if (!userToken) {
    log.error('User token is not available. Please sign in first.');
    return;
  }

  const transport = new StreamableHTTPClientTransport(new URL('https://api.githubcopilot.com/mcp/'), {
    requestInit: {
      headers: {
        "Authorization": `Bearer ${userToken}`
      },
    },
  })

  const client = new Client(
    {
      name: 'github-agent',
      version: '0.1.0',
    },
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: 'assign_copilot_to_issue',
      arguments: {
        issueNumber: 3,
        owner: 'heyitsaamir',
        repo: 'agent-central',
      },
    });

    await send(`Tool call result: ${JSON.stringify(result)}`);
  } catch (e) {
    log.error(`Error calling tool assign_copilot_to_issue for issueNumber 3:`, e);
    throw e;
  } finally {
    await client.close();
  }
});

app.message(/signout/, async ({ signout, isSignedIn, send }) => {
  if (!isSignedIn) {
    await send('You are not signed in.');
    return;
  }
  await signout();
  await send('You have been signed out.');
});

// Gerneral message handler
app.on('message', async ({ send, activity, signin, signout, next, log, ...rest }) => {
  log.info('Received message:', activity.text);
  log.info('Other data:', rest['other_data']);
  const userToken = await signin();
  if (!userToken) {
    log.error('User token is not available. Please sign in first.');
    return;
  } else {
    log.info('User token is available:', userToken);
  }

  const chatPrompt = new ChatPrompt({
    instructions: 'You are a helpful assistant.',
    model: new OpenAIChatModel({
      model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    }),
  }, [new McpClientPlugin()]).usePlugin('mcpClient', {
    url: 'https://api.githubcopilot.com/mcp/',
    params: {
      headers: {
        "Authorization": `Bearer ${userToken}`
      }
    }
  })

  const result = await chatPrompt.send(activity.text);
  console.log('Response from the model:', result.content);
  if (result?.content) {
    await send(result.content);
  } else {
    await send('No response from the model.');
  }
});

// Memeber added / removed handler
app.on('conversationUpdate', async ({ activity }) => {
  if (activity.membersAdded) {

  }

  if (activity.membersRemoved) {

  }
});

// Command handler
app.message(/hello/i, async ({ send }) => {

});

// Called when a task module is opened
app.on('dialog.open', async ({ send, activity }) => {
  return {};
});

// Called when a task module is submitted
app.on('dialog.submit', async ({ send, activity }) => {
  return {};
});

(async () => {
  await app.start(+(process.env.PORT || 3978));
})();
