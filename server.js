const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

console.log("Loaded AZURE_OPENAI_KEY:", process.env.AZURE_OPENAI_KEY);
console.log("Loaded AZURE_OPENAI_ENDPOINT:", process.env.AZURE_OPENAI_ENDPOINT);

const fetch = require('node-fetch');

console.log("Azure OpenAI deployment/model:", process.env.AZURE_OPENAI_DEPLOYMENT);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Load MCP settings
const clineMcpSettingsPath = path.resolve(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
let clineMcpSettings = {};
try {
    clineMcpSettings = JSON.parse(fs.readFileSync(clineMcpSettingsPath, 'utf8'));
    // REMOVE DEBUG LOGGING
    // console.log("Loaded MCP settings successfully from:", clineMcpSettingsPath);
    // console.log("MCP settings:", JSON.stringify(clineMcpSettings, null, 2));
} catch (e) {
    clineMcpSettings = {};
    // console.log("Could not load MCP settings from:", clineMcpSettingsPath);
    // console.log("Error:", e);
}

    // Load instructions manual for LLM
    const instructionsManualPath = path.resolve(__dirname, '../app_investigate.md');
    let instructionsManual = '';
    try {
        instructionsManual = fs.readFileSync(instructionsManualPath, 'utf8');
        console.log("Loaded LLM instructions manual from app_investigate.md");
    } catch (e) {
        instructionsManual = '';
        console.log("Could not load app_investigate.md for LLM instructions manual.");
    }

    // Load tools description for LLM
    const toolsManualPath = path.resolve(__dirname, '../tools_app_investigate.md');
    let toolsManual = '';
    try {
        toolsManual = fs.readFileSync(toolsManualPath, 'utf8');
        console.log("Loaded tools manual from tools_app_investigate.md");
    } catch (e) {
        toolsManual = '';
        console.log("Could not load tools_app_investigate.md for LLM tools manual.");
    }

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Serve chatbot UI
app.get('/copilot_chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'copilot_chat.html'));
});

// Fallback: serve chatbot UI for any unmatched route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'copilot_chat.html'));
});

// Helper: Summarize MCP tool result for LLM context
function summarizeMcpResult(command, result) {
    try {
        const parsed = JSON.parse(result);
        let summary = '';
        if (parsed.status && parsed.message) {
            summary += `Status: ${parsed.status}, Message: ${parsed.message}. `;
        }
        if (parsed.results && parsed.results.result) {
            if (Array.isArray(parsed.results.result)) {
                summary += `Key findings: `;
                if (command.includes('impact')) {
                    const impact = parsed.results.result.map(r =>
                        `${r.cloud_RoleName}: ${r.impactedRequests}/${r.totalRequests} requests impacted`
                    ).join('; ');
                    summary += impact;
                } else if (command.includes('time')) {
                    summary += `Time series data for failed requests analyzed.`;
                } else if (command.includes('trace get')) {
                    summary += `Distributed trace retrieved for analysis.`;
                } else if (command.includes('trace list')) {
                    summary += `Relevant traces listed for further investigation.`;
                }
            }
        }
        return summary || 'MCP tool executed, see logs for details.';
    } catch (e) {
        return 'MCP tool executed, see logs for details.';
    }
}

// Helper: MCP tool call with logging and startup delay, plus tools list
function callMcpTool(command, params, ws) {
    return new Promise((resolve, reject) => {
        let mcpCommand = "C:\\Users\\t-npanse\\app-insights-azmcp\\azure-mcp-win32-x64-0.2.5-alpha.1751322471\\package\\dist\\azmcp.exe";
        let mcpArgs = command.split(' ');
        let mcpEnv = Object.assign({}, process.env);

        if (clineMcpSettings.mcpServers && clineMcpSettings.mcpServers.AzureMCPDev2) {
            mcpCommand = clineMcpSettings.mcpServers.AzureMCPDev2.command || mcpCommand;
        }

        let args = [...mcpArgs];
        for (const [key, value] of Object.entries(params)) {
            if (key === "data-sets") {
                if (Array.isArray(value)) {
                    args.push(`--data-sets=${value.join(" ")}`);
                } else if (typeof value === 'string') {
                    args.push(`--data-sets=${value}`);
                }
            } else if (typeof value === 'string' || typeof value === 'number') {
                args.push(`--${key}=${value}`);
            }
        }

        const mcp = spawn(mcpCommand, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: mcpEnv,
            cwd: path.dirname(mcpCommand)
        });

        let responseData = '';
        let errorData = '';
        let finished = false;

        const timeout = setTimeout(() => {
            if (!finished) {
                finished = true;
                mcp.kill();
                resolve({ error: 'timeout' });
            }
        }, 30000); // 30 seconds timeout

        mcp.stdout.on('data', (data) => {
            responseData += data.toString();
            console.log(`[MCP STDOUT] ${data.toString()}`);
        });

        // Only display [MCP STDOUT] logs, suppress STDERR and other logs
        mcp.stderr.on('data', (data) => {
            // Suppressed: errorData += data.toString();
            // Suppressed: console.log(`[MCP STDERR] ${data.toString()}`);
        });

        mcp.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            let replyText = '';
            if (responseData) {
                replyText = responseData;
            } else if (errorData) {
                replyText = errorData;
            } else {
                replyText = 'No response from MCP tool';
            }
            resolve({ result: replyText });
        });

        mcp.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            resolve({ error: err.message });
        });
    });
}

// WebSocket for live steps and agent loop
wss.on('connection', function connection(ws) {
    ws.on('message', async function incoming(data) {
        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            return;
        }
if (parsed.type === 'chat') {
    const userMessage = parsed.message;
    let history = [
        { role: "user", content: userMessage }
    ];
    let troubleshootingDone = false;
    let maxSteps = 10;
    let stepCount = 0;
    let toolUsageCount = {
        'impact': 0,
        'time': 0,
        'trace get': 0,
        'trace list': 0
    };
    var mcpCallCount = 0;
    var llmCallCount = 0;

    // Store latest traceId/spanId pairs from trace list
    let latestTracePairs = [];

    // Preliminary LLM call to extract start/end time
    let extractedStartTime = null;
    let extractedEndTime = null;
    try {
        const prelimPrompt = `
Extract the start time and end time in ISO 8601 format from the following user prompt. If not present, return null for each.
Return a JSON object:
{
  "start_time": "<ISO8601 or null>",
  "end_time": "<ISO8601 or null>"
}
Prompt: ${userMessage}
`;
        const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const azureKey = process.env.AZURE_OPENAI_KEY;
        const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
        const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION;
        const prelimUrl = `${azureEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`;
        const prelimBody = {
            messages: [
                { role: "system", content: "You extract time ranges for troubleshooting." },
                { role: "user", content: prelimPrompt }
            ],
            max_tokens: 128,
            temperature: 0.0
        };
        const prelimResponse = await fetch(prelimUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": azureKey
            },
            body: JSON.stringify(prelimBody)
        });
        const prelimData = await prelimResponse.json();
        const prelimMatch = prelimData.choices[0].message.content.match(/\{[\s\S]*\}/);
        if (prelimMatch) {
            const prelimObj = JSON.parse(prelimMatch[0]);
            extractedStartTime = prelimObj.start_time;
            extractedEndTime = prelimObj.end_time;
        }
    } catch (e) {
        extractedStartTime = null;
        extractedEndTime = null;
    }

    ws.send(JSON.stringify({ type: 'info', message: `Troubleshooting started.` }));
    ws.send(JSON.stringify({ type: 'info', message: `Identified start_time: ${extractedStartTime}, end_time: ${extractedEndTime}` }));

    while (!troubleshootingDone && stepCount < maxSteps) {
                ws.send(JSON.stringify({ type: 'info', message: `LLM is deciding next troubleshooting action...` }));
                let llmPrompt = `
You are an SRE troubleshooting agent.

TOOLS MANUAL:
${toolsManual}

Here is your instructions manual:
${instructionsManual}

Current server time (ISO 8601): ${new Date().toISOString()}

When the user asks for a time range like "the last hour", "last 24 hours", "yesterday", or similar, ALWAYS use the current server time above to calculate the correct start-time and end-time in ISO 8601 format for any MCP tool command.

Before calling any MCP tool, you MUST check if you have all required parameters for that tool (such as resource-name, subscription-id, time range, and any required arguments listed in the tools manual). If any required parameter is missing, ask the user for it and do NOT call the tool until you have all required information.

Here is the conversation history:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}
After each MCP tool call, you will receive a summary of the result. Use this summary to decide your next step.
You must use all available tools (impact, time, trace get, trace list, trace get-span) as needed, and avoid repeating the same tool more than twice.
Show how you use multiple tools and switch between them to find the root cause.

IMPORTANT: When using the "impact" tool, you MUST set the "table" parameter to either "requests" or "dependencies". Do NOT use "exceptions" or any other value for the "table" parameter with the impact tool, or the command will fail.

IMPORTANT: When using the "trace list" tool, you MUST set the "table" parameter to either "requests" or "dependencies". Do NOT use "exceptions" or any other value for the "table" parameter with the trace list tool, or the command will fail and you will not get a spanId for the next trace get call.

IMPORTANT: After you call "trace get", if the trace output contains any exceptions, errors, or suspicious spans, you SHOULD call "trace get-span" with the relevant item-id and item-type to retrieve detailed information about that span for deeper analysis. Use "trace get-span" whenever you need stack traces, exception details, or dependency call information to confirm the root cause.

When you generate a new MCP tool command (especially for 'trace get'), ALWAYS include all required parameters. For 'trace get', your params MUST include: trace-id, span-id, subscription, resource-name, resource-group, start-time, end-time, and intent. 
IMPORTANT: You must ALWAYS include a valid span-id for every 'trace get' call. If you do not have a value for span-id, use the most recent span-id from previous MCP tool output or ask the user for it. Never call 'trace get' without a span-id, as this may result in excessive data and stack overflow errors.

If you have found the root cause, or you cannot proceed further, or you have enough information, set "done": true and provide a "root_cause" in your JSON response. Otherwise, set "done": false.

MANDATORY: In your FINAL response (when "done": true), you MUST include:
- "Problem Description": What was the issue?
- "Scope of Impact": How many instances and requests were affected?
- "Root Cause Analysis": What was the likely cause?
- "Evidence": What data supports your findings? Ensure you present the time-based analysis as well as the trace-based analysis.
- "Next Steps": What actions should be taken to resolve the issue?

Return a JSON object with:
{
  "command": "<azmcp tool command>",
  "params": { ... },
  "reasoning": "<your reasoning including Problem Description, Scope of Impact, Root Cause, Evidence and Next Steps>",
  "done": <true/false>,
  "root_cause": "<root cause if found>"
}
If you need more information, ask for it.
You have already called these tools: ${Object.entries(toolUsageCount).map(([tool, count]) => `${tool}: ${count} times`).join(', ')}
`;
                let llmResponse;
                try {
                    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
                    const azureKey = process.env.AZURE_OPENAI_KEY;
                    const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
                    const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION;
                    const llmUrl = `${azureEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`;
                    const llmBody = {
                        messages: [
                            { role: "system", content: "You are an SRE troubleshooting agent." },
                            ...history.map(h => ({ role: h.role, content: h.content })),
                            { role: "user", content: llmPrompt }
                        ],
                        max_tokens: 512,
                        temperature: 0.2
                    };
                    // Log the LLM prompt for debugging
                    // console.log(`[LLM PROMPT]\n${llmPrompt}\n`);
                    const llmResponseRaw = await fetch(llmUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "api-key": azureKey
                        },
                        body: JSON.stringify(llmBody)
                    });
                    const llmData = await llmResponseRaw.json();
                    llmCallCount += 1;
                    llmResponse = llmData.choices[0].message.content;
                    console.log(`[LLM RESPONSE] ${llmResponse}`);
                } catch (e) {
                    console.error(`[LLM ERROR]`, e);
                    ws.send(JSON.stringify({ type: 'info', message: `LLM error: ${e}` }));
                    break;
                }

let command, params, done, root_cause, llmObj;
try {
    const match = llmResponse.match(/\{[\s\S]*\}/);
    // Only show LLM message if there is text before "```json"
    const jsonMarkerIndex = llmResponse.indexOf("```json");
    let sentReasoning = false;
    if (match) {
        llmObj = JSON.parse(match[0]);
        command = llmObj.command;
        params = llmObj.params;
        done = llmObj.done;
        root_cause = llmObj.root_cause;
        // Only send LLM reasoning if not the final result
        if (!done) {
            if (jsonMarkerIndex > 0) {
                const preJsonText = llmResponse.slice(0, jsonMarkerIndex).trim();
                if (preJsonText) {
                    ws.send(JSON.stringify({ type: 'llm', message: preJsonText }));
                    sentReasoning = true;
                }
            }
            if (!sentReasoning && llmObj.reasoning) {
                ws.send(JSON.stringify({ type: 'llm', message: llmObj.reasoning }));
            }
        }
    } else {
        // If no JSON, send the whole response as an LLM message (only if not final)
        if (llmResponse && llmResponse.trim() && llmResponse.trim() !== "```json") {
            ws.send(JSON.stringify({ type: 'llm', message: llmResponse.trim() }));
        }
        ws.send(JSON.stringify({ type: 'info', message: `LLM did not return a valid JSON object.` }));
        break;
    }
} catch (e) {
    ws.send(JSON.stringify({ type: 'info', message: `Error parsing LLM response: ${e}` }));
    break;
}

                // Tool usage limit logic removed

if (
    done === true
    // Only deploy workbook when investigation is truly complete
) {
    troubleshootingDone = true;
    ws.send(JSON.stringify({ type: 'info', message: `Troubleshooting complete.` }));
    // Show only the LLM reasoning (not the JSON part) in the frontend
    // Extract Scope of Impact and Next Steps from reasoning and JSON fields
    let scopeOfImpact = "";
    let nextSteps = "";
    if (llmObj["Scope of Impact"]) {
        scopeOfImpact = llmObj["Scope of Impact"];
    }
    if (llmObj["Next Steps"]) {
        nextSteps = llmObj["Next Steps"];
    }
    if ((!scopeOfImpact || !nextSteps) && llmObj.reasoning) {
        const scopeMatch = llmObj.reasoning.match(/Scope of Impact\s*[:\-]\s*([\s\S]*?)(?:Next Steps|$)/i);
        const nextStepsMatch = llmObj.reasoning.match(/Next Steps\s*[:\-]\s*([\s\S]*)/i);
        if (!scopeOfImpact && scopeMatch && scopeMatch[1]) {
            scopeOfImpact = scopeMatch[1].trim();
        }
        if (!nextSteps && nextStepsMatch && nextStepsMatch[1]) {
            nextSteps = nextStepsMatch[1].trim();
        }
    }
    ws.send(JSON.stringify({ 
        type: 'result', 
        message: llmObj.reasoning, 
        root_cause: llmObj.root_cause,
        scope_of_impact: scopeOfImpact,
        next_steps: nextSteps,
        mcp_calls: mcpCallCount,
        llm_calls: llmCallCount
    }));

    // Autonomous Azure Workbook deployment
    console.log("[WORKBOOK] Starting autonomous Azure Workbook deployment...");
    ws.send(JSON.stringify({ type: 'agent', message: "Calling MCP tool 'azmcp workbook create'..." }));
    ws.send(JSON.stringify({ type: 'step', message: "Workbook report being deployed" }));
    deployWorkbook(llmObj.reasoning)
        .then(deployResult => {
            console.log("[WORKBOOK] Deployment result:", deployResult);
            ws.send(JSON.stringify({ type: 'mcp', message: deployResult }));

            // Improved extraction and debug logging for workbook link
            let workbookUrl = null;
            try {
                let deployObj = null;
                // TEMPORARILY ENABLE link extraction logs for debugging
                console.log("[WORKBOOK] Raw deployResult for link extraction:", deployResult);

                if (typeof deployResult === "string") {
                    try {
                        deployObj = JSON.parse(deployResult);
                    } catch (e) {
                        const jsonMatch = deployResult.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            deployObj = JSON.parse(jsonMatch[0]);
                        }
                    }
                } else if (typeof deployResult === "object" && deployResult !== null) {
                    deployObj = deployResult;
                }

                let workbookId = null;
                // Try all known locations for workbookId
                if (
                    deployObj &&
                    deployObj.properties &&
                    Array.isArray(deployObj.properties.outputResources) &&
                    deployObj.properties.outputResources.length > 0 &&
                    deployObj.properties.outputResources[0].id
                ) {
                    workbookId = deployObj.properties.outputResources[0].id;
                } else if (
                    deployObj &&
                    deployObj.outputResources &&
                    Array.isArray(deployObj.outputResources) &&
                    deployObj.outputResources.length > 0 &&
                    deployObj.outputResources[0].id
                ) {
                    workbookId = deployObj.outputResources[0].id;
                } else if (
                    deployObj &&
                    deployObj.results &&
                    deployObj.results.Workbook &&
                    deployObj.results.Workbook.WorkbookId
                ) {
                    workbookId = deployObj.results.Workbook.WorkbookId;
                }
                if (workbookId) {
                    workbookUrl = "https://ms.portal.azure.com/#@microsoft.onmicrosoft.com/resource" + workbookId + "/overview";
                    console.log("[WORKBOOK] Workbook URL:", workbookUrl);
                }
            } catch (e) {
                console.log("[WORKBOOK] Exception during workbook link extraction:", e);
            }
            if (workbookUrl) {
                ws.send(JSON.stringify({ type: 'agent', message: `Workbook deployed successfully! <a href="${workbookUrl}" target="_blank">Open Workbook in Azure Portal</a>` }));
            } else {
                console.log("[WORKBOOK] Could not extract workbook URL from deployResult:", deployResult);
            }
        })
        .catch(err => {
            console.error("[WORKBOOK] Deployment failed:", err);
            ws.send(JSON.stringify({ type: 'mcp', message: `Workbook deployment failed: ${err}` }));
        });

    break;
}

ws.send(JSON.stringify({ type: 'step', message: `Calling MCP tool '${command}'...` }));
const isIso = (str) => typeof str === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(str);
const hasPlaceholder = (str) => typeof str === "string" && /<.*?>/.test(str);

const now = new Date();
const pacificOffset = -7 * 60; // PDT UTC-7
const toPacificIso = (date) => {
    const pacificDate = new Date(date.getTime() - (date.getTimezoneOffset() - pacificOffset) * 60000);
    return pacificDate.toISOString().replace("Z", "-07:00");
};

// Parse relative time phrases like "30 minutes ago", "2 hours ago", "yesterday"
const parseRelativeTime = (phrase, referenceDate) => {
    if (!phrase || typeof phrase !== "string") return null;
    phrase = phrase.toLowerCase();
    let ms = 0;
    if (phrase.includes("minute")) {
        const match = phrase.match(/(\d+)\s*minute/);
        if (match) ms = parseInt(match[1]) * 60 * 1000;
    } else if (phrase.includes("hour")) {
        const match = phrase.match(/(\d+)\s*hour/);
        if (match) ms = parseInt(match[1]) * 60 * 60 * 1000;
    } else if (phrase.includes("day") || phrase.includes("yesterday")) {
        const match = phrase.match(/(\d+)\s*day/);
        if (match) ms = match ? parseInt(match[1]) * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    } else if (phrase.includes("now") || phrase.includes("current")) {
        ms = 0;
    }
    if (ms > 0) {
        return toPacificIso(new Date(referenceDate.getTime() - ms));
    }
    if (phrase.includes("now") || phrase.includes("current")) {
        return toPacificIso(referenceDate);
    }
    return null;
};

if (
    !params["start-time"] ||
    !isIso(params["start-time"]) ||
    hasPlaceholder(params["start-time"])
) {
    let parsed = parseRelativeTime(params["start-time"], now);
    params["start-time"] = parsed || toPacificIso(new Date(now.getTime() - 30 * 60 * 1000));
}
if (
    !params["end-time"] ||
    !isIso(params["end-time"]) ||
    hasPlaceholder(params["end-time"])
) {
    let parsed = parseRelativeTime(params["end-time"], now);
    params["end-time"] = parsed || toPacificIso(now);
}

if (extractedStartTime && !params["start-time"]) params["start-time"] = extractedStartTime;
if (extractedEndTime && !params["end-time"]) params["end-time"] = extractedEndTime;

let mcpResultObj;
try {
    mcpResultObj = await callMcpTool(command, params, ws);
} catch (err) {
    console.error(`[MCP TOOL ERROR]`, err);
    ws.send(JSON.stringify({ type: 'step', message: `MCP tool threw error: ${err}` }));
    history.push({ role: "assistant", content: `MCP tool '${command}' threw error: ${err}` });
    ws.send(JSON.stringify({ type: 'result', message: llmObj.reasoning }));
    continue;
}

if (mcpResultObj.result) {
    mcpCallCount += 1;
    ws.send(JSON.stringify({ type: 'mcp', message: mcpResultObj.result }));
}

if (mcpResultObj.error) {
    console.error(`[MCP TOOL ERROR]`, mcpResultObj.error);
    ws.send(JSON.stringify({ type: 'step', message: `MCP tool failed or timed out. Displaying latest LLM reasoning.` }));
    history.push({ role: "assistant", content: `MCP tool '${command}' failed or timed out.` });
    ws.send(JSON.stringify({ type: 'result', message: llmObj.reasoning }));
    // Do NOT end the troubleshooting loop; allow user to provide more input
    continue;
}

const mcpSummary = summarizeMcpResult(command, mcpResultObj.result);

// If this was a trace list call, extract traceId/spanId pairs for LLM use
if (command && command.includes('trace list') && mcpResultObj.result) {
    try {
        const parsed = JSON.parse(mcpResultObj.result);
        latestTracePairs = [];
        if (
            parsed &&
            parsed.results &&
            parsed.results.result &&
            Array.isArray(parsed.results.result.rows)
        ) {
            for (const row of parsed.results.result.rows) {
                if (row.traces && Array.isArray(row.traces)) {
                    for (const t of row.traces) {
                        if (t.traceId && t.spanId) {
                            latestTracePairs.push({ traceId: t.traceId, spanId: t.spanId });
                        }
                    }
                }
            }
        }
    } catch (e) {
        // ignore extraction errors
    }
}

// Add traceId/spanId info to LLM prompt if available
let tracePairsText = '';
if (latestTracePairs.length > 0) {
    tracePairsText = `\n\nAvailable traceId/spanId pairs from previous trace list:\n` +
        latestTracePairs.map((p, i) => `  ${i + 1}. traceId: ${p.traceId}, spanId: ${p.spanId}`).join('\n') +
        `\nWhen calling 'trace get', you MUST use one of these traceId/spanId pairs.`;
}

history.push({ role: "assistant", content: `Summary of MCP tool '${command}': ${mcpSummary}${tracePairsText}` });

// Also include the full MCP tool output in the LLM prompt context for every call
if (mcpResultObj.result) {
    history.push({ role: "assistant", content: `Full MCP tool output for '${command}':\n${mcpResultObj.result}` });
}

stepCount++;
            }

            if (!troubleshootingDone) {
                ws.send(JSON.stringify({ type: 'result', message: "Troubleshooting loop ended without finding root cause. Please try again or provide more details." }));
            }
        }
    });
});

// REST endpoint for chat (for compatibility, triggers websocket event)
app.post('/chat', async (req, res) => {
    res.json({ reply: "Please use the live chat interface for real-time updates." });
});

function deployWorkbook(investigationText) {
    console.log(`[DEBUG] deployWorkbook called with investigationText: ${investigationText}`);
    return new Promise(async (resolve, reject) => {
        const templatePath = "C:\\Users\\t-npanse\\app-insights-azmcp\\sample_workbook_template.json";
        let template;
        let serializedContent = "";
        try {
            console.log(`[DEBUG] Reading workbook template from: ${templatePath}`);
            template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            let serialized = JSON.parse(template.resources[0].properties.serializedData);

            // --- BEGIN PATCH: Add resourceIds to each chart and ensure fallbackResourceIds is correct ---

            // Get resource info from env or investigation context (customize as needed)
            const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || "069672f5-d070-47e0-9470-c24c76351cd4";
            const resourceGroup = process.env.AZURE_RESOURCE_GROUP || "abinetabateaksresourcegroup";
            // Try to extract resourceName from investigation text, fallback to env or default
            let resourceName = process.env.AZURE_APPINSIGHTS_RESOURCE || "demoappAI";
            const resourceNameMatch = investigationText.match(/application ['"]?([a-zA-Z0-9\-]+)['"]?/i);
            if (resourceNameMatch && resourceNameMatch[1]) {
                resourceName = resourceNameMatch[1];
            }
            const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/microsoft.insights/components/${resourceName}`;

            // Set fallbackResourceIds at root
            serialized.fallbackResourceIds = [resourceId];

            // Add resourceIds to each chart (type 3)
            for (let item of serialized.items) {
                if (item.type === 3 && item.content) {
                    item.content.resourceIds = [resourceId];
                }
                if (item.type === 1 && item.name === "Investigation Report") {
                    item.content.json = investigationText;
                }
            }

            // --- END PATCH ---

            serializedContent = JSON.stringify(serialized);
            console.log(`[DEBUG] Prepared serializedContent for workbook`);
        } catch (e) {
            console.error("[DEBUG] Error preparing serializedContent:", e);
            return reject('Could not prepare workbook content');
        }
        try {
            // Ensure required environment variables are set, fallback to hardcoded values if missing
            const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || "YOUR_SUBSCRIPTION_ID";
            const resourceGroup = process.env.AZURE_RESOURCE_GROUP || "YOUR_RESOURCE_GROUP";
            console.log("[WORKBOOK] Using subscription:", subscriptionId);
            console.log("[WORKBOOK] Using resource group:", resourceGroup);

            const params = {
                "auth-method": "Credential",
                "subscription": subscriptionId,
                "resource-group": resourceGroup,
                "title": "Investigation Report",
                "serialized-content": serializedContent
            };
            const workbookMcpPath = "C:\\Users\\t-npanse\\azure-mcp\\src\\bin\\Debug\\net9.0\\azmcp.exe";
            console.log(`[WORKBOOK] Spawning MCP workbook server: ${workbookMcpPath}`);
            console.log(`[WORKBOOK] MCP command: workbooks create`);
            console.log(`[WORKBOOK] MCP params:`, params);
            const mcpResult = await callMcpToolWithCustomPath("workbooks create", params, workbookMcpPath);
            console.log(`[WORKBOOK] MCP result:`, mcpResult);
            resolve(mcpResult.result || mcpResult.error || "No response from MCP tool");
        } catch (err) {
            reject('Failed to create workbook via MCP: ' + err);
        }
    });
}

// Helper to spawn MCP tool with a custom executable path
function callMcpToolWithCustomPath(command, params, mcpPath) {
    return new Promise((resolve, reject) => {
        let mcpArgs = command.split(' ');
        let mcpEnv = Object.assign({}, process.env);

        let args = [...mcpArgs];
        for (const [key, value] of Object.entries(params)) {
            if (key === "data-sets") {
                if (Array.isArray(value)) {
                    args.push(`--data-sets=${value.join(" ")}`);
                } else if (typeof value === 'string') {
                    args.push(`--data-sets=${value}`);
                }
            } else if (typeof value === 'string' || typeof value === 'number') {
                args.push(`--${key}=${value}`);
            }
        }

        const mcp = spawn(mcpPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: mcpEnv,
            cwd: path.dirname(mcpPath)
        });

        let responseData = '';
        let errorData = '';
        let finished = false;

        const timeout = setTimeout(() => {
            if (!finished) {
                finished = true;
                mcp.kill();
                resolve({ error: 'timeout' });
            }
        }, 30000);

        mcp.stdout.on('data', (data) => {
            responseData += data.toString();
            console.log(`[MCP STDOUT] ${data.toString()}`);
        });

        mcp.stderr.on('data', (data) => {
            // Suppressed: errorData += data.toString();
            // Suppressed: console.log(`[MCP STDERR] ${data.toString()}`);
        });

        mcp.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            let replyText = '';
            if (responseData) {
                replyText = responseData;
            } else if (errorData) {
                replyText = errorData;
            } else {
                replyText = 'No response from MCP tool';
            }
            resolve({ result: replyText });
        });

        mcp.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            resolve({ error: err.message });
        });
    });
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
