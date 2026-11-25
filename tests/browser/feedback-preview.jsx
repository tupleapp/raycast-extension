import * as React from "react";

export function hasPendingRequests(requests) {
  return requests.some((request) => request.status === "Pending");
}

export function createPreview(loadCommand, types, sourceVersion) {
  const Environment = React.createContext(null);
  const FormState = React.createContext(null);
  let transport;

  function findSubmit(element) {
    if (!React.isValidElement(element)) return;
    if (element.type === SubmitForm) return element.props.onSubmit;
    for (const child of React.Children.toArray(element.props.children)) {
      const submit = findSubmit(child);
      if (submit) return submit;
    }
  }

  function Form({ navigationTitle, isLoading, actions, children }) {
    const form = React.useRef(null);
    const submit = findSubmit(actions);
    return (
      <form
        ref={form}
        className="command"
        aria-label={navigationTitle}
        onSubmit={(event) => {
          event.preventDefault();
          const hasError = React.Children.toArray(children).some((child) => child.props?.error);
          if (!hasError) void submit(Object.fromEntries(new FormData(form.current)));
        }}
      >
        <header>
          <span className="tuple-icon">↗</span>
          <div>
            <small>TUPLE</small>
            <h2>{navigationTitle}</h2>
          </div>
        </header>
        <div className="command-body">{children}</div>
        <footer>
          <span>{isLoading ? "Submitting…" : "No production connection"}</span>
          <FormState.Provider value={form}>{actions}</FormState.Provider>
        </footer>
      </form>
    );
  }
  Form.TextArea = React.forwardRef(function TextArea(
    { id, title, placeholder, value, autoFocus, error, onChange, onBlur },
    ref,
  ) {
    const input = React.useRef(null);
    React.useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
    return (
      <div className="field">
        <label htmlFor={id}>{title}</label>
        <textarea
          id={id}
          name={id}
          ref={input}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              input.current.form.requestSubmit();
            }
          }}
        />
        {error && (
          <p role="alert" id={`${id}-error`} className="validation">
            {error}
          </p>
        )}
      </div>
    );
  });
  Form.Description = ({ title, text }) => (
    <div className="description">
      {title && <h3>{title}</h3>}
      <p>{text}</p>
    </div>
  );
  Form.Separator = () => <hr />;
  function SubmitForm({ title }) {
    const form = React.useContext(FormState);
    return (
      <button className="primary" type="button" onClick={() => form.current.requestSubmit()}>
        {title}
        <kbd>⌘ ↵</kbd>
      </button>
    );
  }
  const api = {
    Form,
    Action: { SubmitForm },
    ActionPanel: ({ children }) => <div>{children}</div>,
    Icon: { Message: "message" },
    Toast: { Style: { Animated: "animated", Failure: "failure", Success: "success" } },
    showToast: async (initial) => transport.showToast(initial),
  };
  const Command = loadCommand(api, {
    jsonArgs: (...args) => ["--format", "json", ...args],
    runTuple: (args) => transport.runTuple(args),
  });

  function Surface() {
    const environment = React.useContext(Environment);
    transport = environment;
    return <Command />;
  }

  return function FeedbackPreview() {
    const [scenario, setScenario] = React.useState("success");
    const [pause, setPause] = React.useState(false);
    const [pending, setPending] = React.useState(null);
    const [requests, setRequests] = React.useState([]);
    const [toast, setToast] = React.useState(null);
    const [revision, setRevision] = React.useState(0);
    const sequence = React.useRef(0);
    const runTuple = async (args) => {
      const id = ++sequence.current;
      const help = args[0] === "feedback" && args[1] === "--help";
      setRequests((current) => [...current, { id, args, status: "Pending", help }]);
      const finish = (status) =>
        setRequests((current) => current.map((request) => (request.id === id ? { ...request, status } : request)));
      if (help) {
        finish("Read only");
        return scenario === "old-cli" ? "Usage: tuple [command]" : "Usage: tuple feedback <message> [flags]";
      }
      if (pause) await new Promise((resolve) => setPending(() => resolve));
      else await new Promise((resolve) => setTimeout(resolve, 350));
      setPending(null);
      if (scenario === "success") {
        finish("Accepted by fake CLI");
        return "";
      }
      finish("Rejected by fake CLI");
      if (scenario === "signed-out")
        throw new types.TupleError(types.TupleErrorKind.Unknown, "Synthetic authorization failure", undefined, {
          kind: "unauthorized",
          error_code: 401,
        });
      if (scenario === "unavailable")
        throw new types.TupleError(types.TupleErrorKind.Unknown, "Synthetic unavailable failure", undefined, {
          kind: "feedback_unavailable",
          error_code: 503,
        });
      throw new Error("Synthetic timeout: command arguments and private feedback must not appear in the toast");
    };
    const showToast = (initial) => {
      const state = { ...initial };
      setToast({ ...state });
      return new Proxy(state, {
        set(target, key, value) {
          target[key] = value;
          setToast({ ...target });
          return true;
        },
      });
    };
    const submits = requests.filter((request) => !request.help).length;
    const busy = hasPendingRequests(requests);
    return (
      <Environment.Provider value={{ runTuple, showToast }}>
        <main className="feedback-harness">
          <style>{styles}</style>
          <div className="harness-heading">
            <div>
              <span className="eyebrow">FUNCTIONAL BROWSER HARNESS</span>
              <h1>Send Feedback to Tuple</h1>
              <p>Actual command and validation code. Browser-rendered UI. Fake CLI only.</p>
            </div>
            <span className="safety-badge">● No feedback can leave this harness</span>
          </div>
          <div className="harness-grid">
            <section aria-label="Feedback command preview">
              <Surface key={revision} />
              {toast && (
                <div role="status" className={`toast ${toast.style}`}>
                  <strong>{toast.title}</strong>
                  {toast.message && <p>{toast.message}</p>}
                </div>
              )}
            </section>
            <aside>
              <h2>Test controls</h2>
              <p className="muted">Choose a fake CLI response, then use the real form. Use sample text only.</p>
              <label className="control-label" htmlFor="scenario">
                CLI response
              </label>
              <select
                id="scenario"
                value={scenario}
                disabled={busy}
                onChange={(event) => setScenario(event.target.value)}
              >
                <option value="success">Success</option>
                <option value="signed-out">Signed out</option>
                <option value="unavailable">Feedback unavailable</option>
                <option value="old-cli">Unsupported CLI</option>
                <option value="timeout">Unknown outcome / timeout</option>
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={pause}
                  disabled={busy}
                  onChange={(event) => setPause(event.target.checked)}
                />
                Pause feedback response
              </label>
              {pending && <button onClick={() => pending()}>Release feedback response</button>}
              <button
                className="reset"
                disabled={busy}
                onClick={() => {
                  setRevision((value) => value + 1);
                  setToast(null);
                  setRequests([]);
                  sequence.current = 0;
                }}
              >
                Close and reopen command
              </button>
              <div className="counts">
                <div>
                  <strong>{requests.filter((request) => request.help).length}</strong>
                  <span>Read-only checks</span>
                </div>
                <div>
                  <strong data-testid="submission-count">{submits}</strong>
                  <span>Fake submissions</span>
                </div>
              </div>
              <h3>CLI boundary log</h3>
              <p className="muted">Opening and editing must not call the CLI. Validation errors must not submit.</p>
              <div className="request-log" aria-label="CLI boundary log">
                {requests.length === 0 ? (
                  <p className="empty-log">No CLI calls</p>
                ) : (
                  requests.map((request) => (
                    <div className="request" key={request.id}>
                      <div>
                        <strong>{request.help ? "Support check" : "Feedback submission"}</strong>
                        <small>{request.status}</small>
                      </div>
                      <code>{JSON.stringify(request.args)}</code>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
          <p className="limitations">
            Not native Raycast evidence: typography, sizing, focus, and keyboard behavior are provided by browser
            adapters. No CLI process or network request is made. Source fingerprint: <code>{sourceVersion}</code>.
          </p>
        </main>
      </Environment.Provider>
    );
  };
}

const styles = `
.feedback-harness{color:#e9eaf0;background:#111218;min-height:100vh;padding:32px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}.feedback-harness *{box-sizing:border-box}.harness-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:0 auto 26px;max-width:1240px}.eyebrow{font-size:10px;letter-spacing:1.6px;color:#a2a5b6;font-weight:700}.harness-heading h1{font-size:25px;margin:5px 0}.harness-heading p,.muted{color:#969aaa;margin:5px 0 18px;font-size:12px}.safety-badge{font-size:11px;color:#a8dec5;background:#183029;border:1px solid #294c3e;padding:8px 12px;border-radius:20px;white-space:nowrap}.harness-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);align-items:start;gap:24px;max-width:1240px;margin:auto}.command{background:#22232c;border:1px solid #3b3d49;border-radius:13px;overflow:hidden;box-shadow:0 20px 60px #0004}.command header{display:flex;gap:12px;align-items:center;padding:20px 24px;border-bottom:1px solid #373944}.tuple-icon{display:grid;place-items:center;background:#6955de;width:34px;height:34px;border-radius:9px;font-size:24px}.command small{font-size:9px;color:#aaaabd;letter-spacing:1.4px}.command h2{font-size:16px;margin:0;font-weight:600}.command-body{padding:8px 24px 22px}.description p{font-size:12px;color:#bbbcca;margin:16px 0}.description h3{font-size:11px;font-weight:600;color:#e0e0ea;margin:17px 0 -8px}.field label{display:block;font-size:12px;font-weight:600;margin:18px 0 8px}.field textarea{display:block;width:100%;min-height:172px;resize:vertical;border-radius:7px;background:#191a22;color:#f0eff7;border:1px solid #505364;outline:none;padding:13px;font-size:13px;line-height:1.6;font-family:inherit}.field textarea:focus{border-color:#a59af4;box-shadow:0 0 0 2px #9383f22c}.field textarea[aria-invalid=true]{border-color:#ed9c9c}.field textarea::placeholder{color:#777c90}.validation{color:#f0a4a4;font-size:12px;margin:7px 0}.command hr{border:0;border-top:1px solid #3b3d49;margin:20px 0 0}.command footer{border-top:1px solid #3b3d49;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:#292a34}.command footer>span{color:#9397a9;font-size:10px}.feedback-harness button{cursor:pointer;border:1px solid #4c4e60;border-radius:7px;color:#e9eaf0;background:#343644;padding:9px 12px;font-size:12px;font-weight:500;font-family:inherit}.feedback-harness button:disabled{opacity:.4;cursor:default}.feedback-harness .primary{background:#7060d7;border-color:#8d7ce9;font-size:11px;display:flex;gap:12px;align-items:center}.feedback-harness kbd{font-size:10px;font-family:inherit;color:#ded8ff}.harness-grid aside{background:#1a1b23;border:1px solid #333642;border-radius:12px;padding:22px}.harness-grid aside h2{font-size:14px;margin:0 0 6px}.harness-grid aside h3{font-size:12px;margin:22px 0 4px}.control-label{font-size:11px;color:#bdc0ce;display:block;margin-bottom:7px}.feedback-harness select{width:100%;border:1px solid #505363;border-radius:6px;background:#262834;color:#e9eaf0;padding:10px;font-size:12px;font-family:inherit}.check{display:flex;gap:8px;align-items:center;font-size:12px;margin:17px 0}.feedback-harness input{accent-color:#a392f2}.reset{margin-top:8px;width:100%}.counts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #333642;border-bottom:1px solid #333642;padding:15px 0;margin-top:20px;gap:10px}.counts strong{font-size:23px;display:block;font-weight:500}.counts span{font-size:10px;color:#a2a5b7}.request-log{max-height:240px;overflow:auto}.empty-log{font-size:12px;color:#7e8397}.request{padding:10px 0;border-top:1px solid #333642}.request div{display:flex;flex-direction:column;font-size:11px}.request small{font-size:10px;color:#b3adf0;margin:3px 0}.request code{font:10px/1.6 ui-monospace,monospace;color:#a8adbf;word-break:break-all;display:block;white-space:pre-wrap}.toast{border:1px solid #575367;border-left:3px solid #a59af4;background:#262631;border-radius:9px;padding:14px 18px;margin-top:14px;font-size:12px}.toast p{margin:5px 0 0;color:#c6c8d4}.toast.success{border-left-color:#7dcea4}.toast.failure{border-left-color:#f0a4a4}.limitations{max-width:1240px;margin:22px auto 0;color:#8f94a8;font-size:11px}.limitations code{color:#beb8e9}@media(max-width:850px){.feedback-harness{padding:20px}.harness-heading{align-items:start;flex-direction:column;gap:8px}.harness-grid{grid-template-columns:1fr}.harness-grid aside{padding:18px}.safety-badge{white-space:normal}}`;
