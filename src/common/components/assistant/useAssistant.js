// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { aiRequest } from '../../fleet/ai';
import { reportLinkOf, runToolCalls, SCREEN_TOOLS } from '../../fleet/assistantTools';
import { ruleFromAnswer } from '../../fleet/alertLinks';

const MAX_ROUNDS = 6;

// What one answer shows: the text, the tables and follow-up questions the model drew with its
// screen tools, a link to the report behind the last data it fetched, and the rule it could
// become (AI-01, "turn into an alert").
export const answerOf = (assistantTurns, question = '') => {
  const blocks = assistantTurns.flatMap((turn) => turn.content || []);
  const text = blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  const uses = blocks.filter((block) => block.type === 'tool_use');
  const tables = uses
    .filter((block) => block.name === 'show_table')
    .map((block) => block.input)
    .filter((table) => Array.isArray(table?.columns) && Array.isArray(table?.rows));
  const followups = uses
    .filter((block) => block.name === 'suggest_followups')
    .flatMap((block) => block.input?.questions || [])
    .slice(0, 3);
  const dataCalls = uses.filter((block) => !SCREEN_TOOLS.includes(block.name));
  const link = [...dataCalls].reverse().map(reportLinkOf).find(Boolean) || null;
  return {
    text,
    tables,
    followups,
    link,
    rule: ruleFromAnswer(dataCalls, question),
    steps: dataCalls.map((block) => block.name),
  };
};

// AI-01: a conversation about the fleet. Each question runs model turns until the model stops
// asking for data (at most six rounds); the data tools run here with the user's permissions.
const useAssistant = () => {
  const store = useStore();
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const historyRef = useRef([]);
  const controllerRef = useRef(null);

  const ask = useCallback(
    async (question) => {
      const text = question.trim();
      if (!text || busy) return;
      controllerRef.current = new AbortController();
      const { signal } = controllerRef.current;
      const index = turns.length;
      setTurns((current) => [...current, { question: text, pending: true, steps: [] }]);
      setBusy(true);
      const messages = [...historyRef.current, { role: 'user', content: text }];
      const replies = [];
      try {
        for (let round = 0; round < MAX_ROUNDS; round += 1) {
          const reply = await aiRequest('ask', { messages }, { signal });
          const turn = { role: 'assistant', content: reply.content };
          messages.push(turn);
          replies.push(turn);
          const partial = answerOf(replies);
          setTurns((current) =>
            current.map((item, i) => (i === index ? { ...item, steps: partial.steps } : item)),
          );
          if (reply.stop_reason !== 'tool_use') break;
          const state = store.getState();
          const results = await runToolCalls(reply.content, {
            devices: state.devices.items,
            positions: state.session.positions,
            groups: state.groups.items,
            drivers: state.drivers.items,
          });
          messages.push({ role: 'user', content: results });
        }
        // A conversation that ends on tool results is closed with the last answer only.
        historyRef.current =
          messages[messages.length - 1].role === 'user' ? messages.slice(0, -1) : messages;
        setTurns((current) =>
          current.map((item, i) =>
            i === index ? { ...item, ...answerOf(replies, text), pending: false } : item,
          ),
        );
      } catch (error) {
        if (signal.aborted) return;
        setTurns((current) =>
          current.map((item, i) => (i === index ? { ...item, pending: false, error } : item)),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, store, turns.length],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    historyRef.current = [];
    setTurns([]);
    setBusy(false);
  }, []);

  return { turns, busy, ask, reset };
};

export default useAssistant;
