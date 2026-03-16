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
});
