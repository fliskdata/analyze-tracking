const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { z } = require('zod');
const { zodResponseFormat } = require('openai/helpers/zod');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function createPrompt(eventName, properties, implementations, codebaseDir) {
  // Initialize the prompt
  let prompt = `You are an expert at structured data extraction. Generate detailed descriptions for the following analytics event, its properties, and implementations.\n\n`;

  // Add event name
  prompt += `Event Name: "${eventName}"\n\n`;

  // Add properties
  prompt += `Properties:\n`;
  for (const propName in properties) {
    const prop = properties[propName];
    prompt += `- "${propName}" (type: ${prop.type})\n`;
  }

  // Add implementations with code snippets
  prompt += `\nImplementations:\n`;
  for (const impl of implementations) {
    const codeSnippet = getCodeSnippet(path.join(codebaseDir, impl.path), impl.line);
    prompt += `- Path: "${impl.path}", Line: ${impl.line}, Function: "${impl.function}", Destination: "${impl.destination}"\n`;
    prompt += `Code Snippet:\n`;
    prompt += '```\n';
    prompt += codeSnippet + '\n';
    prompt += '```\n';
  }

  return prompt;
}

function getCodeSnippet(filePath, lineNumber, contextLines = 5) {
  // Extract a code snippet from the file around the specified line
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const startLine = Math.max(0, lineNumber - contextLines - 1);
    const endLine = Math.min(lines.length, lineNumber + contextLines);

    const snippetLines = lines.slice(startLine, endLine);
    return snippetLines.join('\n');
  } catch (e) {
    console.error(`Failed to read file ${filePath}:`, e);
    return '';
  }
}

function createEventDescriptionSchema(properties) {
  // Define the schema for properties
  const propertiesSchema = {};
  for (const propName in properties) {
    propertiesSchema[propName] = z.object({
      description: z.string().describe('A maximum of 10 words describing the property and what it means'),
    });
  }

  // Define the schema for implementations
  const implementationsSchema = z.array(
    z.object({
      description: z.string().describe('A maximum of 10 words describing when this event is triggered'),
      path: z.string(),
      line: z.number(),
    })
  );

  // Construct the full schema
  const eventDescriptionSchema = z.object({
    eventDescription: z.string().describe('A maximum of 10 words describing the event and what it describes'),
    properties: z.object(propertiesSchema),
    implementations: implementationsSchema,
  });

  return eventDescriptionSchema;
}

async function sendPromptToLLM(prompt, schema) {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at structured data extraction. Generate detailed descriptions for the following analytics event, its properties, and implementations',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(schema, 'event_description'),
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error('Error during LLM response parsing:', error);
    return null;
  }
}

async function generateEventDescription(eventName, event, codebaseDir) {
  const properties = event.properties || {};
  const implementations = event.implementations || [];

  // Create prompt for the LLM
  const prompt = createPrompt(eventName, properties, implementations, codebaseDir);

  // Define the output schema using Zod
  const eventDescriptionSchema = createEventDescriptionSchema(properties);

  // Send prompt to the LLM and get the structured response
  const descriptions = await sendPromptToLLM(prompt, eventDescriptionSchema);

  return { eventName, descriptions };
}

async function generateDescriptions(events, codebaseDir) {
  const eventPromises = Object.entries(events).map(([eventName, event]) =>
    generateEventDescription(eventName, event, codebaseDir)
  );

  const results = await Promise.all(eventPromises);

  // Process results and update the events object
  results.forEach(({ eventName, descriptions }) => {
    if (descriptions) {
      const event = events[eventName];
      event.description = descriptions.eventDescription;

      // Update property descriptions
      for (const propName in descriptions.properties) {
        if (event.properties[propName]) {
          event.properties[propName].description = descriptions.properties[propName].description;
        }
      }

      // Update implementations with descriptions
      for (let i = 0; i < descriptions.implementations.length; i++) {
        if (event.implementations[i]) {
          if (event.implementations[i].path === descriptions.implementations[i].path && 
              event.implementations[i].line === descriptions.implementations[i].line) {
            event.implementations[i].description = descriptions.implementations[i].description;
          } else {
            console.error(`Returned implementation description does not match path or line for event: ${eventName}`);
          }
        }
      }
    } else {
      console.error(`Failed to get description for event: ${eventName}`);
    }
  });

  return events;
}

module.exports = { generateDescriptions };
