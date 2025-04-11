const express = require('express');
const fs = require('fs').promises; // Using the promise-based version of fs
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001; // Use environment variable for port or default to 3001
const agentsFilePath = path.join(__dirname, 'agents.json');

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies

// --- API Endpoints ---

// GET endpoint to fetch ALL approved agents
app.get('/api/agents', async (req, res) => {
    try {
        const data = await fs.readFile(agentsFilePath, 'utf8');
        const agents = JSON.parse(data);
        // Ensure agents is an array before filtering
        const approvedAgents = Array.isArray(agents) ? agents.filter(agent => agent.approved === true) : [];
        res.json(approvedAgents);
    } catch (err) {
        console.error('Error reading or parsing agents.json for /api/agents:', err);
        if (err.code === 'ENOENT') {
            res.json([]); // Return empty array if file doesn't exist
        } else if (err instanceof SyntaxError) {
            console.error("agents.json contains invalid JSON.");
            res.status(500).json({ message: 'Error parsing agent data file.' });
        }
         else {
            res.status(500).json({ message: 'Error fetching agents' });
        }
    }
});

// GET endpoint to fetch a SINGLE approved agent by ID
app.get('/api/agents/:id', async (req, res) => {
    // Decode the ID from the URL in case it contains encoded characters
    const requestedId = decodeURIComponent(req.params.id);
    // Now matching against agent.id

    try {
        const data = await fs.readFile(agentsFilePath, 'utf8');
        const agents = JSON.parse(data);

        if (!Array.isArray(agents)) {
             console.error("agents.json does not contain a valid JSON array.");
             return res.status(500).json({ message: 'Error reading agent data.' });
        }

        // Find the agent that matches the ID AND is approved
        const agent = agents.find(agent =>
            // Match by exact ID and ensure it's approved
            agent.id === requestedId &&
            agent.approved === true
        );

        if (agent) {
            res.json(agent); // Found the approved agent
        } else {
            // Agent not found OR agent exists but is not approved
            console.log(`Agent not found or not approved for ID: ${requestedId} (matching by agent.id)`);
            res.status(404).json({ message: 'Agent not found or not approved' });
        }
    } catch (err) {
        console.error(`Error processing request for agent ID ${requestedId}:`, err);
        if (err.code === 'ENOENT') {
            // If the file doesn't exist, the agent cannot exist
             res.status(404).json({ message: 'Agent not found' });
        } else if (err instanceof SyntaxError) {
             console.error("agents.json contains invalid JSON.");
             res.status(500).json({ message: 'Error parsing agent data file.' });
        }
         else {
            res.status(500).json({ message: 'Error fetching agent details' });
        }
    }
});

// POST endpoint to submit a new agent
app.post('/api/submit-agent', async (req, res) => {
    const newAgent = req.body;

    // Basic validation (can be expanded)
    if (!newAgent || typeof newAgent !== 'object' || !newAgent.name) { // Example: check if name exists
        return res.status(400).json({ message: 'Invalid agent data submitted' });
    }

    // Set default approval status
    newAgent.approved = false;
    // Optional: Add a timestamp or unique ID if needed
    // We should add a unique ID here if 'name' isn't guaranteed to be unique
    // newAgent.id = require('crypto').randomUUID(); // Example using crypto for UUID
    // newAgent.submissionDate = new Date().toISOString();


    try {
        let agents = [];
        // Try reading existing agents, handle if file doesn't exist yet
        try {
            const data = await fs.readFile(agentsFilePath, 'utf8');
            agents = JSON.parse(data);
             // Ensure it's an array
             if (!Array.isArray(agents)) {
                console.warn('agents.json does not contain a valid JSON array. Initializing with an empty array.');
                agents = [];
            }
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                 // If file doesn't exist, 'agents' is already initialized as []
                 console.log('agents.json not found, creating a new one.');
            } else if (readError instanceof SyntaxError) {
                 console.error("agents.json contains invalid JSON. Cannot add new agent.");
                 // Cannot reliably add to invalid JSON, throw error.
                 throw new Error("Failed to parse existing agent data. Cannot add new agent.");
            }
            else {
                // For other read errors, re-throw them
                throw readError;
            }
        }


        // Optional: Check for duplicates before adding (e.g., based on name)
        // const existingAgent = agents.find(agent => agent.name === newAgent.name);
        // if (existingAgent) {
        //    return res.status(409).json({ message: 'An agent with this name already exists.' });
        // }

        // Add the new agent
        agents.push(newAgent);

        // Write the updated list back to the file
        await fs.writeFile(agentsFilePath, JSON.stringify(agents, null, 2), 'utf8'); // Pretty print JSON

        res.status(201).json({ message: 'Agent submitted successfully and awaiting approval', agent: newAgent });

    } catch (err) {
        console.error('Error processing agent submission:', err);
        // Send specific message if it was the parsing error we threw
        if (err.message.startsWith("Failed to parse existing agent data")) {
            res.status(500).json({ message: err.message });
        } else {
            res.status(500).json({ message: 'Error saving agent data' });
        }
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
