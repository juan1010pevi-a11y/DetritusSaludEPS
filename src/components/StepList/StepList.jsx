import './StepList.css';
export default function StepList({ steps, numStyle }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={i} className="step">
          <div className="step__num" style={numStyle}>{s.num || i + 1}</div>
          <div className="step__body"><h4>{s.title}</h4><p>{s.text}</p></div>
        </div>
      ))}
    </div>
  );
}
