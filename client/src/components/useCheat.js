import { useState, useRef, useCallback, useEffect } from "react";

export function useCheat() {
  const [m, setM] = useState({
    responseTimes: [], answerLengths: [], tabSwitches: 0,
    patterns: [], integrity: 100, copyPastes: 0,
  });
  const qStart = useRef(null);

  useEffect(() => {
    const flag = (type, severity) => setM((p) => {
      const np = [...p.patterns, { type, severity, time: new Date().toISOString() }];
      const c = np.filter((x) => x.severity === "critical").length;
      const h = np.filter((x) => x.severity === "high").length;
      const md = np.filter((x) => x.severity === "medium").length;
      return { ...p, patterns: np, integrity: Math.max(0, 100 - c * 20 - h * 10 - md * 4), tabSwitches: p.tabSwitches + (type === "tab_switch" ? 1 : 0) };
    });
    const onVis = () => document.hidden && flag("tab_switch", "high");
    const onBlur = () => flag("window_blur", "medium");
    const onCopy = () => { setM((p) => ({ ...p, copyPastes: p.copyPastes + 1 })); flag("copy_attempt", "high"); };
    const onPaste = () => flag("paste_detected", "critical");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  const startQ = useCallback(() => { qStart.current = Date.now(); }, []);

  const recordA = useCallback((text, rt) => {
    const t = rt || (qStart.current ? (Date.now() - qStart.current) / 1000 : 0);
    setM((p) => {
      const np = [...p.patterns];
      if (t < 3 && text.length > 300) np.push({ type: "impossibly_fast", severity: "critical", time: new Date().toISOString() });
      const c = np.filter((x) => x.severity === "critical").length;
      const h = np.filter((x) => x.severity === "high").length;
      const md = np.filter((x) => x.severity === "medium").length;
      return { ...p, responseTimes: [...p.responseTimes, t], answerLengths: [...p.answerLengths, text.length], patterns: np, integrity: Math.max(0, 100 - c * 20 - h * 10 - md * 4) };
    });
  }, []);

  return { m, startQ, recordA };
}
