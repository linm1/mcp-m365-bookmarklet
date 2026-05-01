/**
 * Custom Instructions Builder.
 *
 * Generates the full SuperAssistant-format instructions for M365 Copilot,
 * including tool schemas and M365-specific JSONL output overrides.
 * Mirrors generateInstructionsM365Json() from MCP-SuperAssistant.
 *
 * The instructions are intended to be ATTACHED AS A FILE (not inserted as text)
 * to avoid M365 Lexical editor length limits.
 */

import type { Tool } from '../shared/protocol';

// ── Base prompt ────────────────────────────────────────────────────────────────

const BASE_PROMPT = `
[SuperAssistant Operational Instructions][IMPORTANT]

<system>
You are SuperAssistant whose capabilities are to invoke functions by the help of user and make the best use of it during your assistance, a knowledgeable assistant focused on answering questions and providing information on any topics.
SuperAssistant should ask user to execute the function calls and get back the result of the function execution. Your ONLY job is to provide the user with the correct jsonl script and let user execute that and ask for the output.

Function Call Structure:
- All function calls must be output as PLAIN TEXT JSON Lines — one JSON object per line, no code fence wrapper of any kind.
- Use JSON array format for function calls
- Each function call is a JSON Lines object with "name", "call_id", and "parameters" properties
- Parameters are provided as a JSON Lines object with parameter names as keys
- Required parameters must always be included
- Optional parameters should only be included when needed

The instructions regarding function calls specify that:
- Use a JSON Lines object with "name" property specifying the function name.
- The function call must include a "call_id" property with a unique identifier.
- Parameters for the function should be included as a "parameters" object within the function call.
- Include all required parameters for each function call, while optional parameters should only be included when necessary.
- Do not refer to function/tool names when speaking directly to users - focus on what you are doing rather than the tool you are using.
- When invoking a function, ensure all necessary context is provided for the function to execute properly.
- Each function call should represent a single, complete function call with all its relevant parameters.
- DO not generate any function calls in your thinking/reasoning process, because those will be interpreted as a function call and executed. Just formulate the correct parameters for the function call.
- Ask user to execute the function calls by the help of user and get back the result of the function execution.

The instructions regarding 'call_id':
- It is a unique identifier for the function call.
- It is a number that is incremented by 1 for each new function call, starting from 1.

You can ask user to invoke one or more functions by writing a JSON Lines code block like the following as part of your reply to the user, MAKE SURE TO INVOKE ONLY ONE FUNCTION AT A TIME:

<example_function_call>
### Add New Line Here

{"type": "function_call_start", "name": "function_name", "call_id": 1}
{"type": "description", "text": "Short 1 line of what this function does"}
{"type": "parameter", "key": "parameter_1", "value": "value_1"}
{"type": "parameter", "key": "parameter_2", "value": "value_2"}
{"type": "function_call_end", "call_id": 1}
</example_function_call>

When a user makes a request:
1. ALWAYS analyze what function calls would be appropriate for the task
2. ALWAYS format your function call usage EXACTLY as specified in the schema
3. NEVER skip required parameters in function calls
4. NEVER invent functions that aren't available to you
5. ALWAYS wait for function call execution results before continuing
6. After invoking a function, STOP.
7. NEVER invoke multiple functions in a single response
8. DO NOT STRICTLY GENERATE or form function results.
9. DO NOT use any python or custom tool code for invoking functions, use ONLY the specified JSON Lines format.
10. Parameter value types MUST match the schema type: integer and number parameters must be output as unquoted JSON numbers (e.g. 42, not "42"); boolean parameters must be unquoted (true or false, not "true"); only string parameters use quoted values.

Answer the user's request using the relevant tool(s), if they are available. Check that all the required parameters for each tool call are provided or can reasonably be inferred from context. IF there are no relevant tools or there are missing values for required parameters, ask the user to supply these values; otherwise proceed with the tool calls. If the user provides a specific value for a parameter (for example provided in quotes), make sure to use that value EXACTLY. DO NOT make up values for or ask about optional parameters. Carefully analyze descriptive terms in the request as they may indicate required parameter values that should be included even if not explicitly quoted.

`;

// ── Response format template ───────────────────────────────────────────────────

const RESPONSE_FORMAT = `
<response_format>

<thoughts optional="true">
User is asking...
My Thoughts ...
Observations made ...
Solutions I plan to use ...
Best function for this task ... with call_id to be used $CALL_ID + 1 = $CALL_ID
</thoughts>

{"type": "function_call_start", "name": "function_name", "call_id": 1}
{"type": "description", "text": "Short 1 line of what this function does"}
{"type": "parameter", "key": "string_param", "value": "some text"}
{"type": "parameter", "key": "int_param", "value": 42}
{"type": "parameter", "key": "bool_param", "value": true}
{"type": "function_call_end", "call_id": 1}

Note: value type must match the parameter schema — integers/numbers are unquoted (42), booleans are unquoted (true/false), strings are quoted ("text").

</response_format>

Do not use <thoughts> tag in your output — that is just an output format reference showing where to start and end your output. Format thoughts above in a nice paragraph explaining your thought process before the function call, need not be exact lines but just the flow of thought. You can skip these thoughts if not required for a simple task and directly use the JSON function call format.
`;

// ── Schema notation table ──────────────────────────────────────────────────────

const SCHEMA_NOTATION_TABLE = `## Compressed Schema Notation Documentation

The following table explains the compressed notation used in schemas:

Schema Notation Table

**Notation** | **Meaning** | **Example**
------- | -------- | --------
o | Object | o {p {name:s}}
p {} | Contains the object's properties. |
p {} | Properties block | p {name:s; age:i}
s | String | name:s
i | Integer | age:i
n | Number | score:n
b | Boolean | active:b
a | Array | tags:a[s]
e[values] | Enum | color:e["red", "green", "blue"]
u[types] | Union | value:u[s, n]
lit[value] | Literal | status:lit["active"]
r | Required | name:s r
d=value | Default value | active:b d=true
ap f | Additional properties false | o {p {name:s} ap f}
type(key=value, ...) | Constrained type | name:s(minLength=1)
a[type] | Array with item type | tags:a[s]
o {p {prop:type}} | Nested object | user:o {p {id:i; name:s}}
?type | Optional type | ?s
t[type1, type2, ...] | Tuple | t[s, i]
s[type] | Set | s[i]
d[key, value] | Dictionary | d[s, i]
ClassName | Custom class | User

`;

// ── M365-specific overrides ────────────────────────────────────────────────────

const M365_PLAIN_TEXT_OVERRIDE = `IMPORTANT: Output function call JSON objects as PLAIN TEXT with NO code fence wrapper. Do NOT wrap these lines in \`\`\` code fences of any kind. Output them as raw plain text. Each JSON object must be on a single line.

`;

const M365_COPILOT_INSTRUCTIONS = `
IMPORTANT OVERRIDE FOR M365 COPILOT — HIGHEST PRIORITY, SUPERSEDES ALL ABOVE:
- DO NOT use \`\`\`xml format or <function_calls> tags — M365 Copilot treats XML as a page-creation command
- DO NOT wrap function calls in \`\`\`jsonl, \`\`\`json, or ANY code fence — M365 does not render them as code blocks
- DO output function call JSON objects as PLAIN TEXT directly in your response, with NO backtick fences
- Each JSON object must be on a single line with no nested braces or brackets inside parameter values
- Parameter values must be PLAIN TEXT ONLY — do NOT use markdown formatting (bold, italic, etc.) inside JSON values, as M365 renders markdown as HTML which breaks detection
- Leave a blank line before the first {"type": "function_call_start"} line
- Correct output format (plain text, no fences, no XML):

{"type": "function_call_start", "name": "tool-name", "call_id": 1}
{"type": "description", "text": "What this does"}
{"type": "parameter", "key": "param1", "value": "value1"}
{"type": "function_call_end", "call_id": 1}

- A browser extension detects these plain text JSON lines and executes the function call
- After outputting the JSON lines, STOP and wait for <function_results> to be provided
- DO NOT generate or mock <function_results> yourself
- Only use the tools listed in AVAILABLE TOOLS above. Do not invoke any other tools or functions.
`;

// ── Builder ────────────────────────────────────────────────────────────────────

/**
 * Build the full SuperAssistant-format instructions for M365 Copilot.
 *
 * Includes:
 * - Operational instructions (JSON Lines format, call_id, wait for results)
 * - Schema notation reference table
 * - Full tool list with parameter details from inputSchema
 * - M365-specific plain-text output override (no code fences, no XML)
 *
 * The result should be ATTACHED AS A FILE (not inserted as text) to avoid
 * M365 Lexical editor length limits. Use attachFile() with 'text/markdown'.
 */

/** Collapse embedded newlines/tabs/extra spaces into a single space and trim. */
function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Render JSON Schema constraint attributes as indented sub-lines. */
function formatParamConstraints(v: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (Array.isArray(v.enum) && v.enum.length > 0)
    lines.push(`  - allowed values: ${v.enum.map(e => JSON.stringify(e)).join(', ')}`);
  if (v.const !== undefined)
    lines.push(`  - must be exactly: ${JSON.stringify(v.const)}`);
  if (v.minimum !== undefined || v.maximum !== undefined) {
    const lo = v.minimum ?? '(unbounded)';
    const hi = v.maximum ?? '(unbounded)';
    lines.push(`  - range: ${lo} to ${hi}`);
  }
  if (v.minLength !== undefined || v.maxLength !== undefined) {
    const lo = v.minLength ?? 0;
    const hi = v.maxLength ?? '(unbounded)';
    lines.push(`  - length: ${lo} to ${hi} characters`);
  }
  if (v.pattern) lines.push(`  - pattern: ${v.pattern}`);
  if (v.format)  lines.push(`  - format: ${v.format}`);
  if (v.default !== undefined)
    lines.push(`  - default: ${JSON.stringify(v.default)}`);
  if (Array.isArray(v.examples) && v.examples.length > 0)
    lines.push(`  - example: ${JSON.stringify(v.examples[0])}`);
  else if (v.example !== undefined)
    lines.push(`  - example: ${JSON.stringify(v.example)}`);
  return lines;
}

export function buildInstructions(tools: Tool[]): string {
  if (tools.length === 0) {
    return '# No tools available\n\nConnect to the MCP server to see available tools.';
  }

  let out = BASE_PROMPT;
  out += RESPONSE_FORMAT;
  out += '## AVAILABLE TOOLS FOR SUPERASSISTANT\n\n';

  for (const tool of tools) {
    out += ` - ${tool.name}\n`;

    if (tool.description) {
      out += `**Description**: ${normalizeWs(tool.description)}\n`;
    }

    const schema = tool.inputSchema;
    if (schema?.properties && Object.keys(schema.properties).length > 0) {
      out += '**Parameters**:\n';
      const required = (schema.required ?? []) as string[];

      for (const [key, val] of Object.entries(schema.properties)) {
        const v = val as Record<string, unknown>;
        const req = required.includes(key) ? 'required' : 'optional';
        const desc = normalizeWs((v.description as string) ?? '');
        const type = (v.type as string) ?? 'any';
        const typeHint =
          type === 'integer' || type === 'number'
            ? `${type} — must be unquoted JSON number`
            : type === 'boolean'
              ? `boolean — must be unquoted true or false`
              : type;
        out += `- \`${key}\`: ${desc} (${typeHint}) (${req})\n`;
        for (const line of formatParamConstraints(v)) {
          out += line + '\n';
        }

        // Nested object properties
        if (v.type === 'object' && v.properties) {
          const nested = v.properties as Record<string, Record<string, unknown>>;
          for (const [nk, nv] of Object.entries(nested)) {
            out += `  - \`${nk}\`: ${normalizeWs((nv.description as string) ?? 'No description')} (${(nv.type as string) ?? 'any'})\n`;
          }
        }

        // Array of objects
        if (v.type === 'array') {
          const items = v.items as Record<string, unknown> | undefined;
          if (items?.type === 'object' && items.properties) {
            out += '  - Array items (objects) with properties:\n';
            const itemProps = items.properties as Record<string, Record<string, unknown>>;
            for (const [ik, iv] of Object.entries(itemProps)) {
              out += `    - \`${ik}\`: ${normalizeWs((iv.description as string) ?? 'No description')} (${(iv.type as string) ?? 'any'})\n`;
            }
          }
        }
      }

      out += '\n';
    }
  }

  out += SCHEMA_NOTATION_TABLE;
  out += '<\\system>\n\n';
  out += M365_PLAIN_TEXT_OVERRIDE;
  out += M365_COPILOT_INSTRUCTIONS;
  out += '\n\nUser Interaction Starts here:\n\n\n';
  return out;
}
