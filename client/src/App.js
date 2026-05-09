import React, { useState } from "react";
import SetupScreen from "./components/SetupScreen";
import InterviewScreen from "./components/InterviewScreen";
import ResultsScreen from "./components/ResultsScreen";

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState(null);
  const [results, setResults] = useState(null);

  if (screen === "setup")
    return <SetupScreen onStart={(c) => { setConfig(c); setScreen("interview"); }} />;
  if (screen === "interview")
    return <InterviewScreen config={config} onComplete={(d) => { setResults(d); setScreen("results"); }} />;
  if (screen === "results" && results)
    return <ResultsScreen data={results} />;
  return null;
}
