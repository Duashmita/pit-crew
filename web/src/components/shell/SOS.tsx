export default function SOS({ onPress }: { onPress: () => void }) {
  return (
    <button className="sos" onClick={onPress} aria-label="SOS, alert your people now">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z" /></svg>
      SOS
    </button>
  )
}
