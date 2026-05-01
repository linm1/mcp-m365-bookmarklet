#!/usr/bin/env node
/**
 * MCP Test Agent Eval Scorer
 *
 * Parses an agent response string and scores it against eval criteria
 * defined in test-cases.jsonl.
 *
 * Usage: node score.mjs <test_id> <response_file>
 * Or import scoreResponse() programmatically.
 */

// ── Eval Criteria ─────────────────────────────────────────────────────────────

/**
 * Given a raw agent response string and a test case definition, return a
 * scored result object.
 */
export function scoreResponse(raw, testCase) {
  const lines = raw.split('\n');
  const scores = {};
  const notes = [];

  // 1. no_code_fence — response must not contain ``` markers
  scores.no_code_fence = !raw.includes('```');
  if (!scores.no_code_fence) notes.push('FAIL no_code_fence: response contains backtick code fence');

  // 2. Extract JSON lines (objects where type is one of the 4 JSONL types)
  const VALID_TYPES = new Set([
    'function_call_start',
    'function_call_end',
    'description',
    'parameter',
  ]);
  const jsonLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj.type === 'string' && VALID_TYPES.has(obj.type)) {
        jsonLines.push(obj);
      }
    } catch {
      // skip unparseable lines
    }
  }

  // 3. has_start / has_end
  const startObjs = jsonLines.filter(o => o.type === 'function_call_start');
  const endObjs = jsonLines.filter(o => o.type === 'function_call_end');
  scores.has_start = startObjs.length > 0;
  scores.has_end = endObjs.length > 0;
  if (!scores.has_start) notes.push('FAIL has_start: no function_call_start found');
  if (!scores.has_end) notes.push('FAIL has_end: no function_call_end found');

  // 4. call_id_integer — call_id must be a number, not a string
  scores.call_id_integer = false;
  if (startObjs.length > 0) {
    const cid = startObjs[0].call_id;
    scores.call_id_integer = typeof cid === 'number' && Number.isFinite(cid);
    if (!scores.call_id_integer) notes.push(`FAIL call_id_integer: call_id="${cid}" (${typeof cid}), must be integer`);
  }

  // 5. tool_exists — tool name must be one of the 7 known desktop-commander tools
  const KNOWN_TOOLS = new Set([
    'desktop-commander.write_file',
    'desktop-commander.read_file',
    'desktop-commander.execute_command',
    'desktop-commander.list_directory',
    'desktop-commander.create_directory',
    'desktop-commander.search_files',
    'desktop-commander.get_file_info',
  ]);
  scores.tool_exists = false;
  if (startObjs.length > 0) {
    const name = startObjs[0].name;
    scores.tool_exists = KNOWN_TOOLS.has(name);
    if (!scores.tool_exists) notes.push(`FAIL tool_exists: "${name}" not in allowed tool list`);
  }

  // 6. correct_tool — tool name matches expected
  scores.correct_tool = false;
  if (startObjs.length > 0) {
    scores.correct_tool = startObjs[0].name === testCase.expected_tool;
    if (!scores.correct_tool)
      notes.push(`FAIL correct_tool: got "${startObjs[0].name}", expected "${testCase.expected_tool}"`);
  }

  // 7. all_required_params — all required params must appear in parameter objects
  const paramObjs = jsonLines.filter(o => o.type === 'parameter');
  const presentKeys = new Set(paramObjs.map(o => o.key));
  const required = testCase.required_params ?? [];
  const missingParams = required.filter(k => !presentKeys.has(k));
  scores.all_required_params = missingParams.length === 0;
  if (!scores.all_required_params)
    notes.push(`FAIL all_required_params: missing [${missingParams.join(', ')}]`);

  // 8. integers_unquoted — integer params must have numeric (not string) values
  const intParams = testCase.integer_params ?? [];
  scores.integers_unquoted = true;
  for (const p of paramObjs) {
    if (intParams.includes(p.key) && typeof p.value === 'string') {
      scores.integers_unquoted = false;
      notes.push(`FAIL integers_unquoted: param "${p.key}" value "${p.value}" is a string, must be integer`);
    }
  }

  // 9. no_mock_results — response must not contain <function_results>
  scores.no_mock_results = !raw.includes('<function_results>');
  if (!scores.no_mock_results) notes.push('FAIL no_mock_results: response contains <function_results>');

  // 10. Bonus checks per test case
  if (testCase.eval?.mode_is_append) {
    const modeParam = paramObjs.find(p => p.key === 'mode');
    scores.mode_is_append = modeParam?.value === 'append';
    if (!scores.mode_is_append)
      notes.push(`FAIL mode_is_append: mode="${modeParam?.value}", expected "append"`);
  }

  if (testCase.eval?.timeout_is_10000) {
    const tParam = paramObjs.find(p => p.key === 'timeout_ms');
    scores.timeout_is_10000 = tParam?.value === 10000;
    if (!scores.timeout_is_10000)
      notes.push(`FAIL timeout_is_10000: timeout_ms="${tParam?.value}", expected 10000 (integer)`);
  }

  if (testCase.eval?.offset_is_integer) {
    const offParam = paramObjs.find(p => p.key === 'offset');
    scores.offset_is_integer = offParam != null && typeof offParam.value === 'number';
    if (!scores.offset_is_integer)
      notes.push(`FAIL offset_is_integer: offset="${offParam?.value}" (${typeof offParam?.value}), must be integer`);
  }

  if (testCase.eval?.length_is_integer) {
    const lenParam = paramObjs.find(p => p.key === 'length');
    scores.length_is_integer = lenParam != null && typeof lenParam.value === 'number';
    if (!scores.length_is_integer)
      notes.push(`FAIL length_is_integer: length="${lenParam?.value}" (${typeof lenParam?.value}), must be integer`);
  }

  // Tally
  const total = Object.values(scores).filter(v => typeof v === 'boolean').length;
  const passed = Object.values(scores).filter(v => v === true).length;

  return {
    id: testCase.id,
    tool: testCase.tool,
    prompt: testCase.prompt,
    pass: notes.length === 0,
    score: `${passed}/${total}`,
    scores,
    notes,
    jsonLines,
  };
}
