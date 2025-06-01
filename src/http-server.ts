import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { Octokit } from "@octokit/rest";
import * as actions from './operations/actions.js';

const GITHUB_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MCP GitHub Actions Server' });
});

// REST API endpoints
app.post('/api/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    let result;
    switch (toolName) {
      case 'list_workflows':
        result = await actions.listWorkflows(args.owner, args.repo, args.page, args.perPage);
        break;
      case 'get_workflow':
        result = await actions.getWorkflow(args.owner, args.repo, args.workflowId);
        break;
      case 'get_workflow_usage':
        result = await actions.getWorkflowUsage(args.owner, args.repo, args.workflowId);
        break;
      case 'list_workflow_runs':
        const { owner, repo, workflowId, ...options } = args;
        result = await actions.listWorkflowRuns(owner, repo, { workflowId, ...options });
        break;
      case 'get_workflow_run':
        result = await actions.getWorkflowRun(args.owner, args.repo, args.runId);
        break;
      case 'get_workflow_run_jobs':
        result = await actions.getWorkflowRunJobs(args.owner, args.repo, args.runId, args.filter, args.page, args.perPage);
        break;
      case 'trigger_workflow':
        result = await actions.triggerWorkflow(args.owner, args.repo, args.workflowId, args.ref, args.inputs);
        break;
      case 'cancel_workflow_run':
        result = await actions.cancelWorkflowRun(args.owner, args.repo, args.runId);
        break;
      case 'rerun_workflow':
        result = await actions.rerunWorkflowRun(args.owner, args.repo, args.runId);
        break;
      default:
        return res.status(404).json({ error: `Tool ${toolName} not found` });
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`Error in ${toolName}:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// WebSocket for real-time communication
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  
  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message.toString());
      const { tool, args, id } = request;
      
      // Handle tool calls via WebSocket
      let result;
      switch (tool) {
        case 'list_workflows':
          result = await actions.listWorkflows(args.owner, args.repo, args.page, args.perPage);
          break;
        // Add other cases as needed...
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
      
      ws.send(JSON.stringify({
        id,
        success: true,
        data: result
      }));
    } catch (error: any) {
      ws.send(JSON.stringify({
        id: request?.id,
        success: false,
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 MCP GitHub Actions HTTP Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});