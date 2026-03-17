import { describe, it, expect } from 'vitest';
import { buildInstructions } from './instructions';
import type { Tool } from '../shared/protocol';

describe('buildInstructions()', () => {
  it('returns a non-empty string', () => {
    const result = buildInstructions([{ name: 'dummy_tool' }]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns "No tools available" message for empty tool list', () => {
    const result = buildInstructions([]);
    expect(result).toContain('No tools available');
  });

  it('includes the base SuperAssistant prompt', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('SuperAssistant');
  });

  it('includes the AVAILABLE TOOLS section header', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('AVAILABLE TOOLS FOR SUPERASSISTANT');
  });

  it('includes the M365 Copilot override instructions', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('IMPORTANT OVERRIDE FOR M365 COPILOT');
  });

  it('includes function_call_start in the base prompt example', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('function_call_start');
  });

  it('includes each tool name and description', () => {
    const tools: Tool[] = [
      { name: 'read_file', description: 'Read a file from disk' },
      { name: 'write_file', description: 'Write a file to disk' },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('read_file');
    expect(result).toContain('Read a file from disk');
    expect(result).toContain('write_file');
    expect(result).toContain('Write a file to disk');
  });

  it('handles tools with no description', () => {
    const tools: Tool[] = [{ name: 'mystery_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('mystery_tool');
  });

  it('shows parameter name for tools with inputSchema', () => {
    const tools: Tool[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
          },
          required: ['path'],
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('path');
  });

  it('marks required parameters as (required)', () => {
    const tools: Tool[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('(required)');
  });

  it('marks optional parameters as (optional)', () => {
    const tools: Tool[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            encoding: { type: 'string', description: 'File encoding' },
          },
          required: ['path'],
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('(optional)');
  });

  it('instructs to STOP and wait for function_results', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('STOP');
    expect(result).toContain('function_results');
  });

  it('instructs not to use code fences', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result.toLowerCase()).toContain('code fence');
  });

  // ── New tests for plan changes ──────────────────────────────────────────────

  it('BASE_PROMPT example does NOT wrap function call in ```jsonl code fence', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    // The example in BASE_PROMPT must not contain ```jsonl — that teaches the LLM the wrong format
    expect(result).not.toMatch(/```jsonl[\s\S]*?function_call_start[\s\S]*?```/);
  });

  it('includes <response_format> block with thoughts guidance', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    expect(result).toContain('<response_format>');
    expect(result).toContain('<thoughts optional="true">');
    expect(result).toContain('</response_format>');
  });

  it('SCHEMA_NOTATION_TABLE appears after the tool list, not before', () => {
    const tools: Tool[] = [{ name: 'dummy_tool', description: 'A tool' }];
    const result = buildInstructions(tools);
    const toolsIdx = result.indexOf('AVAILABLE TOOLS FOR SUPERASSISTANT');
    const schemaIdx = result.indexOf('Compressed Schema Notation');
    expect(toolsIdx).toBeGreaterThan(-1);
    expect(schemaIdx).toBeGreaterThan(-1);
    expect(schemaIdx).toBeGreaterThan(toolsIdx);
  });

  // ── Type-coercion fix tests ─────────────────────────────────────────────────

  it('BASE_PROMPT includes rule that integer/number params must be unquoted JSON numbers', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    // Must instruct LLM that numeric values should NOT be quoted strings
    expect(result.toLowerCase()).toMatch(/integer.*unquoted|number.*unquoted|unquoted.*number|unquoted.*integer/);
  });

  it('RESPONSE_FORMAT example includes an unquoted numeric value (42)', () => {
    const tools: Tool[] = [{ name: 'dummy_tool' }];
    const result = buildInstructions(tools);
    // The example should demonstrate: "value": 42  (not "value": "42")
    expect(result).toMatch(/"value"\s*:\s*42/);
  });

  it('annotates integer parameters with a no-quote hint in the tool list', () => {
    const tools: Tool[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: {
            offset: { type: 'integer', description: 'Byte offset' },
            path: { type: 'string', description: 'File path' },
          },
          required: ['offset', 'path'],
        },
      },
    ];
    const result = buildInstructions(tools);
    // integer param must carry a hint that it should not be quoted
    const offsetLine = result.split('\n').find(l => l.includes('offset'));
    expect(offsetLine).toBeDefined();
    expect(offsetLine!.toLowerCase()).toMatch(/number|unquoted|not quoted/);
  });

  it('annotates boolean parameters with a no-quote hint in the tool list', () => {
    const tools: Tool[] = [
      {
        name: 'toggle',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', description: 'Toggle flag' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    const enabledLine = result.split('\n').find(l => l.includes('enabled'));
    expect(enabledLine).toBeDefined();
    expect(enabledLine!.toLowerCase()).toMatch(/boolean|unquoted|not quoted/);
  });

  it('does NOT annotate string parameters with the no-quote hint', () => {
    const tools: Tool[] = [
      {
        name: 'greet',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'User name' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    const nameLine = result.split('\n').find(l => l.includes('`name`'));
    expect(nameLine).toBeDefined();
    expect(nameLine!).not.toMatch(/unquoted|not quoted/);
  });

  it('includes nested object properties in parameter schema', () => {
    const tools: Tool[] = [
      {
        name: 'create_user',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              description: 'User address',
              properties: {
                street: { type: 'string', description: 'Street name' },
                city: { type: 'string', description: 'City name' },
              },
            },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('street');
    expect(result).toContain('Street name');
    expect(result).toContain('city');
  });

  it('includes array-of-objects item properties in parameter schema', () => {
    const tools: Tool[] = [
      {
        name: 'batch_process',
        inputSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'Items to process',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Item identifier' },
                  value: { type: 'number', description: 'Item value' },
                },
              },
            },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('Array items (objects) with properties');
    expect(result).toContain('id');
    expect(result).toContain('Item identifier');
  });

  // ── Whitespace normalization tests ──────────────────────────────────────────

  it('normalizes tool description with leading/trailing whitespace', () => {
    const tools: Tool[] = [{ name: 'tool', description: '  trimmed  ' }];
    const result = buildInstructions(tools);
    expect(result).toContain('**Description**: trimmed\n');
  });

  it('normalizes tool description with embedded newlines and indentation', () => {
    const tools: Tool[] = [
      { name: 'tool', description: '\n                        Line one.\n                        Line two.\n                    ' },
    ];
    const result = buildInstructions(tools);
    // Should collapse to a single space-separated line
    expect(result).toContain('**Description**: Line one. Line two.\n');
  });

  it('normalizes parameter description with embedded whitespace', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '\n  a file path\n  ' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('a file path');
    // Must not contain raw newlines inside the parameter description
    const paramLine = result.split('\n').find(l => l.includes('`path`'));
    expect(paramLine).toBeDefined();
    expect(paramLine).toContain('a file path');
  });

  // ── Parameter constraint tests ───────────────────────────────────────────────

  it('renders enum allowed values for a parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Status', enum: ['active', 'inactive', 'pending'] },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('allowed values: "active", "inactive", "pending"');
  });

  it('renders const value for a parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            version: { type: 'string', description: 'API version', const: 'v2' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('must be exactly: "v2"');
  });

  it('renders minimum and maximum range for a numeric parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Max results', minimum: 1, maximum: 100 },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('range: 1 to 100');
  });

  it('renders minimum-only range with unbounded max', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            offset: { type: 'integer', description: 'Start', minimum: 0 },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('range: 0 to (unbounded)');
  });

  it('renders minLength and maxLength for a string parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name', minLength: 1, maxLength: 255 },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('length: 1 to 255 characters');
  });

  it('renders pattern for a string parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code', pattern: '^[A-Z]{3}$' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('pattern: ^[A-Z]{3}$');
  });

  it('renders format for a string parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            created_at: { type: 'string', description: 'Timestamp', format: 'date-time' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('format: date-time');
  });

  it('renders default value for a parameter', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Max lines', default: 1000 },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('default: 1000');
  });

  it('renders first item from examples array', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path', examples: ['/home/user/file.txt', '/tmp/other.txt'] },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('example: "/home/user/file.txt"');
  });

  it('renders singular example field', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query', example: 'hello world' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    expect(result).toContain('example: "hello world"');
  });

  it('emits no constraint lines for a plain string parameter with no constraints', () => {
    const tools: Tool[] = [
      {
        name: 'tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'User name' },
          },
        },
      },
    ];
    const result = buildInstructions(tools);
    // No constraint sub-lines should appear for a plain string
    expect(result).not.toContain('allowed values');
    expect(result).not.toContain('range:');
    expect(result).not.toContain('default:');
    expect(result).not.toContain('format:');
    expect(result).not.toContain('pattern:');
  });
});
