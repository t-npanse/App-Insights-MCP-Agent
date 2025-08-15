# App-Insights-MCP-Agent
Codebase of my internship project demo - AI agent for troubleshooting App Insights resource and workbook creation


1. Extract chat_interface.zip - https://microsoft.sharepoint.com/:f:/t/AzureMonitoring-v-TeamSync/EvVNv7jtvfpMuqyzQgZzbfgBOqf91dCswVPMcSofkyS4wg?e=INq8gg
	1. .md files are instructions for the LLM
	2. .html is the chatbot frontend
	3. server.js is the backend file
2. Extract both MCP server files (one for troubleshooting and other for workbooks tools) - you will need the paths to "azmcp.exe" , which runs the MCP server on your machine
3. Command to run chatbot - "server.js"
4. You should see it here - http://localhost:3000/copilot_chat.html


Backend process -

The backend (server.js) runs the MCP server by spawning the MCP executable as a child process using Node.js's spawn function. The path and command for the MCP server are determined as follows:

- The default MCP executable path is hardcoded (e.g., C:\Users\t-npanse\app-insights-azmcp\azure-mcp-win32-x64-0.2.5-alpha.1751322471\package\dist\azmcp.exe).
- If clineMcpSettings.json exists and specifies a custom command for the MCP server, that path is used instead.
- When an MCP tool is called, the backend constructs the command and arguments, then spawns the MCP process with those arguments and environment variables.
- The working directory for the MCP process is set to the directory containing the MCP executable.

This logic is implemented in the callMcpTool and callMcpToolWithCustomPath functions.
