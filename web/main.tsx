import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, Copy, ExternalLink, Plus, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { mount, type PromptChipsApi } from './prompt-chips';

type Reply = {
  answer: string; status: string; citations: {id:string; module:string; section:string; url:string}[];
  helpLinks: {label:string; url:string}[]; token: string;
};
type Turn = { id: string; question: string; reply?: Reply; failed?: string };

// Prompt chips: the label on the chip and the full prompt typed into the input. Every prompt is answerable
// from the verified catalog except the last, which shows the honest "not verified" fallback.
type Chip = { label: string; prompt: string; icon: string };
const chipRows: { dir: number; speed?: number; chips: Chip[] }[] = [
  { dir: -1, chips: [
    { icon: 'chart', label: 'Compare peak speeds', prompt: 'Compare the peak speeds of C16QS and C20QM.' },
    { icon: 'trip', label: 'Check India LTE bands', prompt: 'Which LTE bands does the C16QS India variant support?' },
    { icon: 'idea', label: 'Explore eSIM options', prompt: 'Does every C16QS variant support eSIM?' },
    { icon: 'list', label: 'Shortlist by throughput', prompt: 'Which module should I shortlist for at least 20 Mbps published peak downlink?' },
    { icon: 'trip', label: 'C20QM satellite systems', prompt: 'Which satellite systems does the C20QM GNSS support?' },
  ] },
  { dir: 1, speed: .8, chips: [
    { icon: 'code', label: 'C16QS interfaces and OS', prompt: 'What interfaces and operating system does the C16QS use?' },
    { icon: 'learn', label: 'C20QM module size', prompt: 'What are the dimensions of the C20QM module?' },
    { icon: 'trip', label: 'C20QM bands in Europe', prompt: 'Which LTE bands does the C20QM EU variant support?' },
    { icon: 'chart', label: 'C16QS upload speed', prompt: 'What is the published peak uplink speed of the C16QS?' },
    { icon: 'idea', label: 'C20QM eSIM SKUs', prompt: 'Which C20QM SKUs include an integrated eSIM?' },
  ] },
  { dir: -1, speed: 1.15, chips: [
    { icon: 'list', label: 'Shortlist for 10 Mbps uplink', prompt: 'Which module should I shortlist for at least 10 Mbps published peak uplink?' },
    { icon: 'plan', label: 'C20QM operating system', prompt: 'Which operating system does the C20QM use?' },
    { icon: 'trip', label: 'C16QS GPS options', prompt: 'Does the C16QS support GPS positioning?' },
    { icon: 'learn', label: 'C16QS bands in North America', prompt: 'Which LTE bands does the C16QS NA variant support?' },
    { icon: 'mail', label: 'Ask about carrier approval', prompt: 'Is the C16QS approved by my carrier?' },
  ] },
];

// The rows never re-render: after mount the chips script moves them into an endless track.
const ChipRows = React.memo(function ChipRows() {
  return <div className="vs-prompt-chips-rows">{chipRows.map((row, i) =>
    <div key={i} className="vs-prompt-chips-row" data-dir={row.dir} data-speed={row.speed} aria-label="Suggested questions">
      {row.chips.map(chip => <button key={chip.label} type="button" className="vs-prompt-chips-chip"
        data-icon={chip.icon} data-prompt={chip.prompt}>{chip.label}</button>)}
    </div>)}</div>;
});

function PromptChips({ withChips, busy, placeholder, label, autoFocus, inputRef, onSubmit }: {
  withChips: boolean; busy: boolean; placeholder: string; label: string; autoFocus?: boolean;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>; onSubmit: (prompt: string) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const api = useRef<PromptChipsApi | null>(null);
  const submit = useRef(onSubmit); submit.current = onSubmit;
  useEffect(() => {
    const el = root.current!;
    const pc = mount(el); api.current = pc; inputRef.current = pc.input;
    const handler = (event: Event) => {
      if (!submit.current((event as CustomEvent<{prompt: string}>).detail.prompt)) event.preventDefault();
    };
    el.addEventListener('vs-prompt-chips:submit', handler);
    if (autoFocus && !matchMedia('(pointer: coarse)').matches) pc.input.focus({ preventScroll: true });
    return () => {
      el.removeEventListener('vs-prompt-chips:submit', handler); pc.destroy(); api.current = null;
      if (inputRef.current === pc.input) inputRef.current = null;
    };
  }, []);
  useEffect(() => { api.current?.sync(); }, [busy]);
  return <div ref={root} className="vs-prompt-chips" data-busy={String(busy)} data-focus="auto">
    <form className="vs-prompt-chips-bar">
      <textarea id="question" className="vs-prompt-chips-input" rows={1} maxLength={800} spellCheck={false} autoComplete="off" placeholder={placeholder} aria-label={label}/>
      <button className="vs-prompt-chips-send" type="submit" aria-label="Send question"><svg viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
    </form>
    {withChips && <ChipRows/>}
  </div>;
}

const official = 'https://www.cavliwireless.com/iot-modules/c-series/';
function External({url, children}: {url:string; children:React.ReactNode}) {
  return <a href={url} target="_blank" rel="noreferrer">{children}<ExternalLink size={13} aria-hidden="true"/></a>;
}
function Feedback({reply}: {reply:Reply}) {
  const [mode, setMode] = useState<'idle'|'choose'|'saving'|'sent'>('idle');
  const [error, setError] = useState('');
  async function save(rating: string, reason: string | null) {
    setMode('saving'); setError('');
    try {
      const result = await fetch('/api/feedback', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:reply.token,rating,reason})});
      if (!result.ok) throw new Error((await result.json()).error);
      setMode('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback could not be saved.'); setMode('idle');
    }
  }
  return <div className="feedback">
    {mode === 'sent' ? <span role="status">Thanks for your feedback.</span> : mode === 'saving' ? <span role="status">Saving feedback…</span> :
      <><button title="Helpful" aria-label="Helpful" className="icon-button" onClick={() => void save('helpful', null)}><ThumbsUp size={15}/></button>
      <button title="Needs review" aria-label="Needs review" aria-expanded={mode==='choose'} className="icon-button" onClick={() => setMode(mode==='choose'?'idle':'choose')}><ThumbsDown size={15}/></button></>}
    {mode==='choose' && <div className="reason-list" aria-label="Feedback reason">
      {[['incorrect_spec','Incorrect spec'],['wrong_variant','Wrong variant'],['weak_citation','Weak citation'],['other','Other']].map(([key,label]) =>
        <button key={key} onClick={() => void save('needs_review', key)}>{label}</button>)}
    </div>}
    {error && <span role="alert">{error}</span>}
  </div>;
}

function CopyAnswer({reply}: {reply:Reply}) {
  const [status, setStatus] = useState('');
  async function copy() {
    const sources = reply.citations.map(({module,section,url}) => module + ' · ' + section + ': ' + url);
    try {
      await navigator.clipboard.writeText([reply.answer, ...sources].join('\n\n'));
      setStatus('Copied.');
    } catch {
      setStatus('Could not copy the answer.');
    }
  }
  return <><button className="icon-button" onClick={() => void copy()}><Copy size={14} aria-hidden="true"/> Copy</button>
    <span className="copy-status" role="status">{status}</span></>;
}

function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [sources, setSources] = useState<{turnId?: string; index?: number} | null>(null);
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 760px)').matches);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement|null>(null);
  const controller = useRef<AbortController|null>(null);
  const latest = turns.at(-1);
  const newestQuestion = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const query = matchMedia('(max-width: 760px)');
    const check = () => setCompact(query.matches);
    query.addEventListener('change', check);
    return () => query.removeEventListener('change', check);
  }, []);
  useEffect(() => {
    if (compact && sources) dialog.current?.showModal();
    else dialog.current?.close();
    if (sources && trigger.current) {
      const panel = compact ? dialog.current : inspector.current;
      const selector = sources.index === undefined ? 'a' : '[data-source="' + sources.index + '"] a';
      panel?.querySelector<HTMLElement>(selector)?.focus();
    } else if (!sources) {
      trigger.current?.focus();
      trigger.current = null;
    }
  }, [compact, sources]);
  useEffect(() => { newestQuestion.current?.scrollIntoView({block:'nearest'}); }, [latest?.id]);

  async function send(text: string, retryId?: string) {
    const value = text.trim();
    if (value.length < 2 || controller.current) return;
    const id = retryId ?? crypto.randomUUID();
    const request = new AbortController();
    controller.current = request;
    const next = {id, question:value};
    setPending(true);
    setTurns(current => retryId ? current.map(turn => turn.id === id ? next : turn) : [...current,next]);
    try {
      const result = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:value}),signal:request.signal});
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'The assistant is temporarily unavailable.');
      if (request.signal.aborted) return;
      setTurns(current => current.map(turn => turn.id === id ? {...turn,reply:data} : turn));
      if (data.citations.length && !matchMedia('(max-width: 760px)').matches) {
        setSources(current => {
          if (trigger.current || (retryId && current?.turnId !== id)) return current;
          return {turnId:id};
        });
      }
    } catch (error) {
      if (!request.signal.aborted) setTurns(current => current.map(turn => turn.id === id
        ? {...turn,failed:error instanceof Error ? error.message : 'Try again.'} : turn));
    } finally {
      if (controller.current === request) { controller.current = null; setPending(false); }
    }
  }
  // Called by the prompt-chips bar on submit; returning false keeps the text in the field.
  function accept(text: string) {
    if (text.trim().length < 2 || controller.current) return false;
    void send(text);
    return true;
  }
  function reset() {
    controller.current?.abort();
    controller.current = null;
    trigger.current = null;
    setPending(false); setTurns([]); setSources(null);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }
  function openSources(element: HTMLElement, turnId?: string, index?: number) {
    trigger.current = element;
    setSources({turnId,index});
  }
  function closeSources() {
    if (!trigger.current && inspector.current?.contains(document.activeElement)) input.current?.focus();
    setSources(null);
  }

  const citations = turns.find(turn => turn.id === sources?.turnId)?.reply?.citations ?? [];
  const panel = <>
    <div className="inspector-heading">
      <h2 id="sources-title">{citations.length ? 'Sources for this answer' : 'Product sources'}</h2>
      <button className="icon-button" aria-label="Close sources" onClick={closeSources}><X size={16}/></button>
    </div>
    <div className="source-list">
      {citations.length ? citations.map((source,index) =>
        <div key={source.id} data-source={index} data-selected={sources?.index === index}>
          <External url={source.url}><span className="source-number" aria-hidden="true">{index + 1}</span>
            <span><strong>{source.module} product page</strong><small>{source.section}</small></span></External>
        </div>) : <>
        <External url={official+'c16qs'}><span><strong>C16QS</strong><small>LTE Cat 1bis</small></span></External>
        <External url={official+'c20qm'}><span><strong>C20QM</strong><small>LTE Cat 4</small></span></External>
      </>}
    </div>
  </>;

  return <div className="app" onKeyDown={event => {
    if (event.key === 'Escape' && sources && !compact) closeSources();
  }}>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Cavli Module Assistant home">
        <img className="brand-logo" src="/cavli-logo.svg" alt="Cavli Wireless" width="104" height="56"/>
        <span>Module Assistant</span></a>
      <div className="toolbar">
        <button className="icon-button" onClick={reset} aria-label="New chat"><Plus size={16}/><span>New chat</span></button>
        <button className="top-button" aria-expanded={!!sources} onClick={event => {
          if (sources) { closeSources(); return; }
          openSources(event.currentTarget, turns.findLast(turn => turn.reply?.citations.length)?.id);
        }}><BookOpen size={16}/> Sources</button>
      </div>
    </header>
    <div className="workspace" data-inspector={!!sources && !compact}>
      <main className="main" data-home={!turns.length}>
        {!turns.length ? <div className="welcome">
          <div className="welcome-copy">
            <span className="eyebrow"><i aria-hidden="true"/>C16QS · C20QM · verified product sources</span>
            <h1>Ask about a Cavli module</h1>
            <p>Look up specifications, compare variants and check LTE bands. Pick a suggestion or type your own question.</p>
          </div>
          <PromptChips key="home" withChips busy={pending} placeholder="Ask about C16QS or C20QM" label="Your question"
            inputRef={input} onSubmit={accept}/>
        </div> : <div className="thread" aria-live="polite" aria-label="Conversation">
          {turns.map(turn => <article key={turn.id} className="exchange">
            <h2 ref={turn.id === latest?.id ? newestQuestion : undefined} className="question">{turn.question}</h2>
            <div className="agent-body">
              {turn.reply ? <>
                <h3 className="answer-heading">Answer</h3>
                <p className="answer">{turn.reply.answer}{turn.reply.citations.map((source,index) =>
                  <button key={source.id} className="citation"
                    aria-label={'View citation ' + (index + 1) + ': ' + source.module + ', ' + source.section}
                    onClick={event => openSources(event.currentTarget,turn.id,index)}>{index+1}</button>)}</p>
                {!!turn.reply.helpLinks.length && <div className="help-links">{turn.reply.helpLinks.map(link => <External key={link.url} url={link.url}>{link.label}</External>)}</div>}
                <div className="answer-tools"><CopyAnswer reply={turn.reply}/><Feedback reply={turn.reply}/></div>
              </> : turn.failed ? <div className="waiting" role="alert">{turn.failed} <button className="top-button" disabled={pending} onClick={() => { void send(turn.question,turn.id); input.current?.focus(); }}>Retry</button></div> :
                <div className="waiting" role="status">Checking product sources.<div className="skeleton" aria-hidden="true"/></div>}
            </div>
          </article>)}
        </div>}
        {!!turns.length && <div className="composer-area">
          <PromptChips key="thread" withChips={false} busy={pending} placeholder="Ask a follow-up" label="Follow-up question"
            autoFocus inputRef={input} onSubmit={accept}/>
        </div>}
      </main>
      {sources && !compact && <aside className="inspector" ref={inspector} aria-labelledby="sources-title"><div className="inspector-content">{panel}</div></aside>}
    </div>
    <dialog ref={dialog} aria-labelledby={sources && compact ? 'sources-title' : undefined}
      onCancel={event => { event.preventDefault(); closeSources(); }}
      onClick={event => { if (event.target === event.currentTarget) closeSources(); }}>
      {sources && compact && <div className="sheet">{panel}</div>}
    </dialog>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
